-- ============================================================================
-- Portail client : dépôt de pièces et validation par le client
-- ============================================================================
--
-- Le portail était en lecture seule. Un client voyait ses dossiers, ses
-- documents et ses factures ; il ne pouvait rien déposer, et on ne pouvait rien
-- lui faire confirmer. L'écran de téléversement existait dans l'interface, sans
-- rien derrière.
--
-- C'est la première fois qu'une personne EXTÉRIEURE AU CABINET écrit dans cette
-- base. Deux principes tiennent tout ce qui suit.
--
-- ---------------------------------------------------------------------------
-- PREMIER PRINCIPE : NE JAMAIS CROIRE CE QUE LE CLIENT ENVOIE
-- ---------------------------------------------------------------------------
-- Un client qui téléverse ne choisit ni son cabinet, ni son dossier, ni le
-- statut de sa pièce, ni la mention « déposé par le client ». Tout cela est
-- POSÉ PAR UN DÉCLENCHEUR à partir de sa session, en écrasant ce qu'il aurait
-- envoyé.
--
-- Une politique RLS qui se contenterait de vérifier ces champs laisserait le
-- client déclarer sa pièce « valide » — c'est-à-dire vérifiée par un
-- consultant réglementé qui ne l'a jamais vue.
--
-- ---------------------------------------------------------------------------
-- SECOND PRINCIPE : LA RLS EST AU NIVEAU DE LA LIGNE, PAS DE LA COLONNE
-- ---------------------------------------------------------------------------
-- Laisser un client répondre à une demande de validation suppose de l'autoriser
-- à modifier une ligne qu'il ne doit pas pouvoir réécrire entièrement. Une
-- politique d'UPDATE ouvre la ligne ENTIÈRE. Les colonnes qu'il ne doit pas
-- toucher sont donc protégées par un déclencheur — comme l'a déjà exigé
-- protect_firm_columns().
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Un statut honnête pour une pièce qui vient d'arriver
-- ---------------------------------------------------------------------------
-- Le vocabulaire ne connaissait que « valide », « invalide » et « archivé ».
-- Une pièce fraîchement déposée n'est aucun des trois : elle attend d'être
-- regardée. La faire entrer en « invalide » l'aurait accusée à tort ; en
-- « valide », elle aurait menti.

alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in ('pending_review','valid','invalid','archived'));

alter table public.documents add column if not exists requirement_id uuid
  references public.matter_requirements(id) on delete set null;

comment on column public.documents.requirement_id is
  'La pièce exigée à laquelle ce fichier répond, quand le déposant l''a précisé.';

-- ---------------------------------------------------------------------------
-- 2. Ce qu'un dépôt de client devient, quoi qu'il envoie
-- ---------------------------------------------------------------------------

create or replace function public.stamp_client_upload()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  son_client uuid;
  son_cabinet uuid;
begin
  -- Ne concerne que les clients du portail. Un membre du cabinet dépose ce
  -- qu'il veut, sous sa propre responsabilité.
  if not public.is_portal_client() then return new; end if;

  select cu.client_id, cu.firm_id into son_client, son_cabinet
    from public.client_users cu where cu.user_id = auth.uid() limit 1;

  if son_client is null then
    raise exception 'Aucun dossier client rattaché à ce compte.' using errcode = 'insufficient_privilege';
  end if;

  -- Écrasés, jamais vérifiés : la différence compte. Vérifier laisserait
  -- passer ce qui est correct ET ce qui est absent ; écraser rend le champ
  -- inatteignable.
  new.client_id            := son_client;
  new.firm_id              := son_cabinet;
  new.category             := 'client_upload';
  new.source               := 'portail client';
  new.status               := 'pending_review';
  new.uploaded_by_user_id  := auth.uid();
  new.uploaded_by          := coalesce(
                                (select c.name from public.clients c where c.id = son_client),
                                'Client');
  new.date                 := current_date;
  new.archived_at          := null;

  -- Le dossier visé doit être le sien. Un identifiant emprunté est effacé
  -- plutôt que refusé : le dépôt reste valable, il se rattache simplement au
  -- client, et le consultant le classera.
  if new.matter_id is not null and not exists (
    select 1 from public.matters m where m.id = new.matter_id and m.client_id = son_client
  ) then
    new.matter_id := null;
  end if;

  -- Idem pour la pièce exigée : elle doit appartenir à un dossier du client.
  if new.requirement_id is not null and not exists (
    select 1 from public.matter_requirements r
      join public.matters m on m.id = r.matter_id
     where r.id = new.requirement_id and m.client_id = son_client
  ) then
    new.requirement_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_stamp_client_upload on public.documents;
create trigger documents_stamp_client_upload
  before insert on public.documents
  for each row execute function public.stamp_client_upload();

-- ---------------------------------------------------------------------------
-- 3. Le dépôt marque la pièce exigée comme REÇUE — jamais comme vérifiée
-- ---------------------------------------------------------------------------

create or replace function public.link_upload_to_requirement()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.requirement_id is null then return new; end if;

  update public.matter_requirements r
     set document_id   = new.id,
         received_at   = now(),
         received_from = case when new.category = 'client_upload' then 'client' else 'firm' end,
         -- Un nouveau dépôt lève le refus précédent : la pièce a été refaite.
         rejected_at   = null,
         rejection_reason = null,
         -- ET REMET LA VÉRIFICATION À ZÉRO. Sans cela, remplacer une pièce
         -- déjà validée par une autre laisserait la nouvelle marquée comme
         -- vérifiée sans que personne ne l'ait regardée.
         verified_at   = null,
         verified_by   = null
   where r.id = new.requirement_id;

  return new;
end;
$$;

drop trigger if exists documents_link_requirement on public.documents;
create trigger documents_link_requirement
  after insert on public.documents
  for each row execute function public.link_upload_to_requirement();

-- ---------------------------------------------------------------------------
-- 4. Le client peut déposer
-- ---------------------------------------------------------------------------
-- La politique reste stricte malgré le déclencheur : si celui-ci était un jour
-- désactivé, elle refuserait encore un dépôt au nom d'un autre.

drop policy if exists documents_portal_insert on public.documents;
create policy documents_portal_insert on public.documents
  for insert to authenticated
  with check (
    public.is_portal_client()
    and client_id = public.current_client_id()
    and category  = 'client_upload'
  );

-- Il peut aussi VOIR ce qu'il vient de déposer : la politique de lecture
-- existante écarte 'consultant_upload', pas 'client_upload'.

-- ---------------------------------------------------------------------------
-- 5. Demander au client de valider, et recueillir sa réponse
-- ---------------------------------------------------------------------------

create table if not exists public.document_reviews (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  matter_id   uuid references public.matters(id) on delete set null,

  -- Le brief distingue trois cas, et il a raison : confirmer l'exactitude
  -- d'un relevé n'est pas signer une entente de représentation.
  kind        text not null default 'validation'
              check (kind in ('validation','signature','validation_and_signature')),

  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  message      text,
  due_on       date,

  status       text not null default 'pending'
               check (status in ('pending','confirmed','error_reported','cancelled')),
  responded_at timestamptz,
  client_comment text,

  -- La demande de signature correspondante, quand il y en a une.
  signature_request_id uuid references public.signature_requests(id) on delete set null,

  created_at  timestamptz not null default now()
);

create index if not exists document_reviews_client_idx on public.document_reviews(client_id, status);
create index if not exists document_reviews_firm_idx   on public.document_reviews(firm_id, status);
create unique index if not exists document_reviews_une_en_cours
  on public.document_reviews(document_id) where status = 'pending';

comment on table public.document_reviews is
  'Demande faite au client de confirmer un document, d''en signaler une erreur, ou de le signer.';

-- ---------------------------------------------------------------------------
-- 6. Ce qu'un client peut modifier dans sa réponse, et rien d'autre
-- ---------------------------------------------------------------------------

create or replace function public.protect_review_columns()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_portal_client() then return new; end if;

  if new.firm_id is distinct from old.firm_id
     or new.client_id is distinct from old.client_id
     or new.document_id is distinct from old.document_id
     or new.matter_id is distinct from old.matter_id
     or new.kind is distinct from old.kind
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at
     or new.message is distinct from old.message
     or new.due_on is distinct from old.due_on
     or new.signature_request_id is distinct from old.signature_request_id then
    raise exception 'Un client ne peut modifier que sa réponse.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Il répond, il n'annule pas et ne rouvre pas.
  if new.status not in ('confirmed','error_reported') then
    raise exception 'Réponse attendue : confirmation ou signalement d''erreur.'
      using errcode = 'check_violation';
  end if;

  if old.status <> 'pending' then
    raise exception 'Cette demande a déjà reçu une réponse.'
      using errcode = 'check_violation';
  end if;

  -- Signaler une erreur sans dire laquelle n'aide personne.
  if new.status = 'error_reported'
     and coalesce(btrim(new.client_comment), '') = '' then
    raise exception 'Un signalement d''erreur doit être accompagné d''un commentaire.'
      using errcode = 'check_violation';
  end if;

  new.responded_at := now();
  return new;
end;
$$;

drop trigger if exists document_reviews_protect on public.document_reviews;
create trigger document_reviews_protect
  before update on public.document_reviews
  for each row execute function public.protect_review_columns();

-- ---------------------------------------------------------------------------
-- 7. La réponse du client se répercute sur la pièce exigée
-- ---------------------------------------------------------------------------
-- Une confirmation du client N'EST PAS une vérification par le cabinet. Elle
-- ne pose donc jamais verified_at : c'est au consultant réglementé de vérifier,
-- et sa responsabilité ne se délègue pas au client qui confirme son propre
-- document.

create or replace function public.apply_review_answer()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then return new; end if;

  if new.status = 'error_reported' then
    update public.matter_requirements r
       set rejected_at = now(),
           rejection_reason = coalesce(new.client_comment, 'Erreur signalée par le client'),
           verified_at = null, verified_by = null
      from public.documents d
     where d.id = new.document_id and r.id = d.requirement_id;
  end if;

  return new;
end;
$$;

drop trigger if exists document_reviews_apply on public.document_reviews;
create trigger document_reviews_apply
  after update on public.document_reviews
  for each row execute function public.apply_review_answer();

-- ---------------------------------------------------------------------------
-- 8. Cloisonnement
-- ---------------------------------------------------------------------------

alter table public.document_reviews enable row level security;

drop policy if exists document_reviews_firm on public.document_reviews;
create policy document_reviews_firm on public.document_reviews
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

drop policy if exists document_reviews_client_read on public.document_reviews;
create policy document_reviews_client_read on public.document_reviews
  for select to authenticated
  using (public.is_portal_client() and client_id = public.current_client_id());

drop policy if exists document_reviews_client_answer on public.document_reviews;
create policy document_reviews_client_answer on public.document_reviews
  for update to authenticated
  using (public.is_portal_client() and client_id = public.current_client_id())
  with check (public.is_portal_client() and client_id = public.current_client_id());

-- ---------------------------------------------------------------------------
-- 9. Ce que le client voit de ses pièces exigées
-- ---------------------------------------------------------------------------
-- Une VUE, et non une politique sur matter_requirements : la table porte des
-- notes internes et l'identité du membre qui a vérifié. Ouvrir la table
-- entière pour montrer quatre colonnes reviendrait à tout exposer et à espérer
-- que l'écran n'en affiche qu'une partie.

create or replace view public.portal_requirements
with (security_invoker = true) as
  select r.id, r.matter_id, r.code, r.label_fr, r.label_en, r.mandatory, r.rank,
         public.requirement_status(r.requested_at, r.received_at, r.verified_at,
                                   r.rejected_at, r.expires_on) as status,
         r.expires_on,
         r.rejection_reason
    from public.matter_requirements r
    join public.matters m on m.id = r.matter_id
   where m.client_id = public.current_client_id();

comment on view public.portal_requirements is
  'Pièces attendues du client. Les notes internes et l''identité du vérificateur restent hors de portée.';

grant select on public.portal_requirements to authenticated;

-- La lecture des pièces exigées par le client passe par la vue, qui filtre les
-- colonnes. La table elle-même lui reste fermée.
drop policy if exists matter_requirements_portal on public.matter_requirements;
create policy matter_requirements_portal on public.matter_requirements
  for select to authenticated
  using (
    public.is_portal_client()
    and exists (select 1 from public.matters m
                 where m.id = matter_id and m.client_id = public.current_client_id())
  );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- Aucune pièce déposée par un client ne doit être « valide » d'emblée :
--   select count(*) from public.documents
--    where category = 'client_upload' and status = 'valid'
--      and uploaded_by_user_id is not null;
--
--   -- Aucune demande de validation en double sur un même document :
--   select document_id, count(*) from public.document_reviews
--    where status = 'pending' group by document_id having count(*) > 1;
-- ============================================================================
