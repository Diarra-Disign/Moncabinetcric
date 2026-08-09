-- ============================================================================
-- Distinguer un formulaire d'une pièce justificative
-- ============================================================================
--
-- Les deux se mêlaient dans une seule liste : « Passeport valide au moins 6
-- mois » voisinait avec « Formulaire IMM 1294 ». Ce ne sont pourtant pas les
-- mêmes objets, ni les mêmes gestes — une pièce se demande au client, un
-- formulaire se remplit et se fait signer.
--
-- ---------------------------------------------------------------------------
-- POURQUOI UNE COLONNE, ET NON UNE EXPRESSION RÉGULIÈRE DANS L'ÉCRAN
-- ---------------------------------------------------------------------------
-- Il serait tentant de reconnaître un formulaire à son code — « IMM » suivi de
-- chiffres — au moment de l'affichage. Trois raisons de ne pas le faire :
--
--   · la règle serait recopiée dans chaque écran qui trie, et elles
--     divergeraient ;
--   · elle est fausse pour ce qui n'est pas fédéral. Le CSQ et le CAQ portent
--     des codes sans « IMM » et restent des certificats, non des formulaires ;
--     un formulaire provincial « A-0506-F » serait rangé du mauvais côté ;
--   · elle ne se corrige pas. Un classement rangé en base se rectifie d'un
--     UPDATE, une expression régulière demande un déploiement.
--
-- Le classement initial EMPLOIE ce motif — c'est le meilleur point de départ
-- dont on dispose — mais il devient une donnée, révisable.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.program_requirements
  add column if not exists kind text not null default 'document'
  check (kind in ('form','document'));

alter table public.matter_requirements
  add column if not exists kind text not null default 'document'
  check (kind in ('form','document'));

comment on column public.matter_requirements.kind is
  'form ou document. Un formulaire se remplit et se signe ; une pièce se demande au client.';

-- Classement initial : les formulaires fédéraux d'IRCC.
update public.program_requirements set kind = 'form' where code ~ '^IMM[0-9]+$';
update public.matter_requirements  set kind = 'form' where code ~ '^IMM[0-9]+$';

-- Les exigences déjà posées reprennent le classement de leur modèle, au cas où
-- un code aurait été corrigé à la main d'un côté seulement.
update public.matter_requirements r
   set kind = pr.kind
  from public.program_requirements pr
 where pr.code = r.code and pr.kind is distinct from r.kind;

-- ---------------------------------------------------------------------------
-- Le garnissage d'un dossier neuf reporte le classement
-- ---------------------------------------------------------------------------

create or replace function public.seed_matter_requirements()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.matter_requirements
    (firm_id, matter_id, code, label_fr, label_en, mandatory, rank, kind)
  select new.firm_id, new.id, pr.code, pr.label_fr, pr.label_en, pr.mandatory, pr.rank, pr.kind
    from public.program_requirements pr
   where pr.program_id = public.programme_modele(coalesce(new.program, ''))
  on conflict (matter_id, code) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- La vue rend le classement
-- ---------------------------------------------------------------------------
-- Une fonction qui renvoie une table ne se modifie pas : sa signature change,
-- il faut la reconstruire.

drop function if exists public.matter_requirements_view(uuid);

create function public.matter_requirements_view(m_id uuid)
returns table (
  id uuid, code text, label_fr text, label_en text, mandatory boolean, rank int,
  kind text, status text, document_id uuid, received_from text,
  received_at timestamptz, verified_at timestamptz, expires_on date, rejection_reason text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.id, r.code, r.label_fr, r.label_en, r.mandatory, r.rank, r.kind,
         public.requirement_status(r.requested_at, r.received_at, r.verified_at,
                                   r.rejected_at, r.expires_on),
         r.document_id, r.received_from, r.received_at, r.verified_at,
         r.expires_on, r.rejection_reason
    from public.matter_requirements r
   where r.matter_id = m_id
   order by r.rank, r.label_fr;
$$;

revoke all on function public.matter_requirements_view(uuid) from public;
grant execute on function public.matter_requirements_view(uuid) to authenticated;

-- La vue du portail suit, pour que le client voie la même distinction.
--
-- SUPPRIMÉE puis recréée, et non remplacée : CREATE OR REPLACE VIEW refuse
-- d'insérer une colonne ailleurs qu'à la fin.
--   ERROR: cannot change name of view column "status" to "kind"
-- Le refus est salutaire — une vue dont les colonnes se décalent renverrait
-- silencieusement les mauvaises valeurs à ce qui la lit par position.
drop view if exists public.portal_requirements;

create view public.portal_requirements
with (security_invoker = true) as
  select r.id, r.matter_id, r.code, r.label_fr, r.label_en, r.mandatory, r.rank, r.kind,
         public.requirement_status(r.requested_at, r.received_at, r.verified_at,
                                   r.rejected_at, r.expires_on) as status,
         r.expires_on,
         r.rejection_reason
    from public.matter_requirements r
    join public.matters m on m.id = r.matter_id
   where m.client_id = public.current_client_id();

grant select on public.portal_requirements to authenticated;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select kind, count(*) from public.program_requirements group by kind;
--   select code, label_fr, kind from public.program_requirements order by kind, code;
-- ============================================================================
