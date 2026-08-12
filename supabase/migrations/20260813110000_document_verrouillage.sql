-- ---------------------------------------------------------------------------
-- Le verrouillage de version d'un document
-- ---------------------------------------------------------------------------
-- LE DÉFAUT QUE CECI REND IMPOSSIBLE : faire signer une version d'un contrat,
-- puis remplacer le fichier, et présenter le nouveau comme celui qui a été
-- signé. Aujourd'hui rien ne l'empêche — un document envoyé en signature reste
-- modifiable, et l'empreinte figée dans la demande deviendrait simplement
-- « divergente » sans que personne ne le voie.
--
-- LE VERROU EST EN BASE, PAS DANS LE CODE. C'est la règle suivie par tout ce
-- module : une garantie applicative cède à un appel direct de l'API, et c'est
-- précisément ce qu'un adversaire tenterait. Le déclencheur ci-dessous refuse
-- même au rôle de service.
--
-- CE QU'IL NE VERROUILLE PAS, et c'est délibéré : le NOM, le statut de
-- révision, la catégorie, le rattachement au dossier. Renommer une pièce ou la
-- classer ailleurs ne change pas ce qui a été signé. Verrouiller ces
-- colonnes-là obligerait à créer une version pour corriger une faute de frappe
-- dans un titre — et le consultant contournerait le verrou plutôt que de le
-- respecter.

alter table public.documents
  -- Posé au moment où le document part en signature. Tant qu'il est là, le
  -- CONTENU ne bouge plus.
  add column if not exists locked_at timestamptz,
  -- La version que celle-ci remplace. Une chaîne, pas un arbre : un document
  -- corrigé remplace exactement un prédécesseur.
  add column if not exists supersedes_id uuid references public.documents(id) on delete set null,
  add column if not exists version integer not null default 1;

create index if not exists idx_documents_supersedes
  on public.documents (supersedes_id) where supersedes_id is not null;

comment on column public.documents.locked_at is
  'Posé à l''envoi en signature. Tant qu''il est renseigné, storage_path et sha256 ne peuvent plus changer — le verrou est tenu par un déclencheur, pas par le code.';

-- ---------------------------------------------------------------------------
-- Le déclencheur
-- ---------------------------------------------------------------------------
create or replace function public.documents_verrou()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    -- Un document signé ne se supprime pas. Il s'archive, ou il est remplacé
    -- par une version qui le désigne. Le supprimer romprait la chaîne des
    -- versions et effacerait ce sur quoi une signature a été apposée.
    if old.locked_at is not null then
      raise exception
        'Ce document est verrouillé : il a été envoyé en signature. Annulez la demande, puis créez une nouvelle version.'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if old.locked_at is null then return new; end if;

  -- Le CONTENU est figé : le fichier et son empreinte.
  if new.storage_path is distinct from old.storage_path
     or new.sha256 is distinct from old.sha256 then
    raise exception
      'Le contenu d''un document envoyé en signature ne se modifie plus. Annulez la demande, puis créez une nouvelle version.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Le verrou lui-même ne se retire pas par une simple mise à jour : sans
  -- cette ligne, il suffirait de vider locked_at pour tout rouvrir, et le
  -- verrou ne serait qu'une convention.
  if new.locked_at is null then
    raise exception
      'Le verrou d''un document signé ne se retire pas. Créez une nouvelle version.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists documents_verrou_trg on public.documents;
create trigger documents_verrou_trg
  before update or delete on public.documents
  for each row execute function public.documents_verrou();

-- ---------------------------------------------------------------------------
-- Poser le verrou — SECURITY DEFINER
-- ---------------------------------------------------------------------------
-- Le verrou se pose en même temps que la demande de signature part. Une
-- fonction plutôt qu'un UPDATE applicatif : le jour où un second chemin enverra
-- un document en signature, il ne pourra pas oublier de verrouiller.
create or replace function public.verrouiller_document(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ok boolean;
begin
  -- Le cabinet est vérifié ICI, malgré SECURITY DEFINER : sans ce contrôle, la
  -- fonction permettrait de verrouiller le document d'un autre cabinet — un
  -- déni de service discret.
  select exists (
    select 1 from public.documents d
    where d.id = p_document_id
      and d.firm_id = public.current_firm_id()
  ) into ok;

  if not ok then return false; end if;

  update public.documents
     set locked_at = coalesce(locked_at, now())
   where id = p_document_id;

  return true;
end;
$$;

revoke all on function public.verrouiller_document(uuid) from public, anon;
grant execute on function public.verrouiller_document(uuid) to authenticated, service_role;

comment on function public.verrouiller_document is
  'Pose le verrou de contenu. Vérifie le cabinet malgré SECURITY DEFINER : sans cela, on verrouillerait le document d''un tiers.';
