-- ============================================================================
-- Bibliothèque de questionnaires et envoi universel
-- ============================================================================
--
-- Quatre murs bloquaient le brief, et chacun appelle une décision.
--
-- 1. form_type valait « study_permit | work_permit | pr », en union TypeScript
--    ET en contrainte CHECK. Une bibliothèque où le consultant crée ses
--    propres questionnaires ne tient pas dans une contrainte CHECK : un
--    cabinet ne peut pas déployer. Les modèles deviennent des LIGNES.
--
-- 2. client_id et matter_id étaient NOT NULL. Or on doit pouvoir envoyer un
--    questionnaire de préconsultation à un PROSPECT, qui n'a ni client ni
--    dossier — c'est même le cas d'usage principal du brief. Le destinataire
--    devient donc l'un OU l'autre, et la base refuse les deux ou aucun.
--
-- 3. Aucun mécanisme de lien sécurisé. Le portail suppose un compte Supabase ;
--    un prospect n'en a pas et ne doit pas en avoir. D'où un jeton, dont la
--    base ne conserve QUE l'empreinte.
--
-- 4. « Expiré » figurait dans la liste des statuts du brief. On ne le stocke
--    pas : ce serait un fait qui vieillit tout seul et qu'il faudrait balayer
--    par une tâche de fond. La date limite est le fait ; l'expiration se
--    calcule — comme requirement_status() et deadline_status() avant elle.
--
-- La table client_questionnaires est vide : elle vient d'être créée et n'a
-- jamais servi en production. On la restructure donc franchement plutôt que
-- d'empiler des colonnes de compatibilité qui ne compatibiliseraient rien.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les modèles
-- ---------------------------------------------------------------------------
-- firm_id NULL = modèle fourni avec le logiciel, visible de tous les cabinets
-- et modifiable par aucun. Un cabinet qui veut l'adapter le duplique : sa
-- copie porte son firm_id. C'est ce qui permet de corriger une coquille dans
-- le catalogue sans écraser le travail des cabinets.

create table if not exists public.questionnaire_templates (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references public.firms(id) on delete cascade,
  slug        text not null,
  title_fr    text not null,
  title_en    text not null,
  description_fr text not null default '',
  description_en text not null default '',

  -- Le questionnaire lui-même : sections, champs, options.
  sections    jsonb not null default '[]'::jsonb,

  -- Le message par défaut proposé à l'envoi (§18). [Prénom] et [Date limite]
  -- y sont substitués au moment de l'envoi, pas ici.
  message_fr  text not null default '',
  message_en  text not null default '',

  -- Le questionnaire proposé d'emblée depuis une fiche prospect (§23).
  is_default_preconsultation boolean not null default false,

  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.questionnaire_templates is
  'Bibliothèque de questionnaires. firm_id nul = modèle système partagé.';

-- Le slug identifie un modèle DANS son cabinet. Deux cabinets peuvent tous
-- deux avoir un « preconsultation » sans se marcher dessus ; un même cabinet
-- ne peut pas en avoir deux. Index partiel car NULL n'entre pas dans un
-- unique ordinaire : les modèles système ont leur propre index.
create unique index if not exists questionnaire_templates_slug_firm
  on public.questionnaire_templates (firm_id, slug) where firm_id is not null;
create unique index if not exists questionnaire_templates_slug_systeme
  on public.questionnaire_templates (slug) where firm_id is null;

-- Un seul questionnaire de préconsultation par défaut par cabinet : sans
-- cette contrainte, « le » questionnaire proposé serait celui que le hasard
-- de l'ordre de lecture désigne.
create unique index if not exists questionnaire_templates_defaut_unique
  on public.questionnaire_templates (coalesce(firm_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_default_preconsultation;

alter table public.questionnaire_templates enable row level security;

drop policy if exists questionnaire_templates_lecture on public.questionnaire_templates;
create policy questionnaire_templates_lecture on public.questionnaire_templates
  for select to authenticated
  using (firm_id is null or firm_id = public.current_firm_id());

-- L'écriture ne vise QUE les modèles du cabinet. Un modèle système n'est
-- modifiable par personne depuis l'application : le with check impose un
-- firm_id non nul, donc même un UPDATE ne peut pas en fabriquer un.
drop policy if exists questionnaire_templates_ecriture on public.questionnaire_templates;
create policy questionnaire_templates_ecriture on public.questionnaire_templates
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 2. Les envois
-- ---------------------------------------------------------------------------

alter table public.client_questionnaires
  add column if not exists template_id uuid references public.questionnaire_templates(id) on delete set null,
  add column if not exists lead_id uuid references public.leads(id) on delete cascade,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists message text not null default '',
  add column if not exists sent_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists sent_by uuid references public.profiles(id) on delete set null,
  add column if not exists reminded_at timestamptz,
  add column if not exists reminder_count integer not null default 0,
  add column if not exists token_hash text,
  add column if not exists token_revoked_at timestamptz,
  add column if not exists prefill jsonb not null default '{}'::jsonb;

comment on column public.client_questionnaires.sections is
  'Instantané du modèle au moment de l''envoi. Modifier le modèle ensuite ne '
  'doit pas déplacer le sol sous les pieds de qui remplit déjà : les réponses '
  'déjà saisies pointeraient vers des champs disparus.';

comment on column public.client_questionnaires.prefill is
  'Ce que le cabinet savait déjà au moment de l''envoi (§25). Conservé à part '
  'des réponses, faute de quoi on ne pourrait plus distinguer « le client a '
  'confirmé » de « personne n''a relu ».';

comment on column public.client_questionnaires.token_hash is
  'Empreinte SHA-256 du jeton d''accès, jamais le jeton. Une fuite de la base '
  'ne donne donc aucun lien utilisable.';

-- Le destinataire : un client OU un prospect, jamais les deux, jamais aucun.
alter table public.client_questionnaires alter column client_id drop not null;
alter table public.client_questionnaires alter column matter_id drop not null;

alter table public.client_questionnaires
  drop constraint if exists client_questionnaires_destinataire;
alter table public.client_questionnaires
  add constraint client_questionnaires_destinataire
  check ((client_id is not null) <> (lead_id is not null));

-- Un dossier n'a de sens que pour un client. Rattacher un dossier à un
-- questionnaire de prospect produirait une ligne que rien ne sait afficher.
alter table public.client_questionnaires
  drop constraint if exists client_questionnaires_dossier_si_client;
alter table public.client_questionnaires
  add constraint client_questionnaires_dossier_si_client
  check (matter_id is null or client_id is not null);

-- form_type disparaît au profit de template_id. La colonne est vide en
-- production : la garder « au cas où » créerait deux sources de vérité sur
-- ce qu'est un questionnaire.
alter table public.client_questionnaires drop column if exists form_type;

-- Les statuts du brief, moins « expiré » qui se calcule.
alter table public.client_questionnaires drop constraint if exists client_questionnaires_status_check;
alter table public.client_questionnaires
  add constraint client_questionnaires_status_check
  check (status in ('draft','sent','opened','in_progress','submitted','to_correct','corrected','completed','cancelled'));

alter table public.client_questionnaires alter column status set default 'draft';

create index if not exists client_questionnaires_lead_idx on public.client_questionnaires(lead_id);
create index if not exists client_questionnaires_template_idx on public.client_questionnaires(template_id);
create unique index if not exists client_questionnaires_token_idx
  on public.client_questionnaires(token_hash) where token_hash is not null;

-- ---------------------------------------------------------------------------
-- 3. Le statut visible, calculé
-- ---------------------------------------------------------------------------

create or replace function public.questionnaire_status(
  p_status text, p_due_date timestamptz, p_token_revoked_at timestamptz
) returns text
language sql immutable
as $$
  select case
    -- Un questionnaire déjà rendu n'expire pas rétroactivement : il a été
    -- soumis à temps, la date limite a cessé de le concerner.
    when p_status in ('completed','cancelled','submitted','corrected') then p_status
    when p_token_revoked_at is not null then 'cancelled'
    when p_due_date is not null and p_due_date < now() then 'expired'
    else p_status
  end
$$;

comment on function public.questionnaire_status(text, timestamptz, timestamptz) is
  'Statut affiché. « expiré » ne se stocke pas : ce serait un fait qui vieillit '
  'seul et qu''il faudrait balayer par une tâche de fond, laquelle mentirait '
  'entre deux passages.';

-- ---------------------------------------------------------------------------
-- 4. Cloisonnement du prospect
-- ---------------------------------------------------------------------------
-- La politique du portail visait client_id = current_client_id(). Avec un
-- lead_id nul de leur côté, les questionnaires de prospects n'entrent dans
-- aucune politique : ils sont donc invisibles au portail, ce qui est
-- exactement ce que demande le brief (« Le prospect ne doit pas avoir accès
-- au portail client »).

drop policy if exists client_questionnaires_portal on public.client_questionnaires;
create policy client_questionnaires_portal on public.client_questionnaires
  for select to authenticated
  using (
    public.is_portal_client()
    and client_id is not null
    and client_id = public.current_client_id()
    -- Un brouillon que le cabinet prépare n'est pas encore adressé.
    and status <> 'draft'
  );

drop policy if exists client_questionnaires_portal_update on public.client_questionnaires;
create policy client_questionnaires_portal_update on public.client_questionnaires
  for update to authenticated
  using (
    public.is_portal_client()
    and client_id is not null
    and client_id = public.current_client_id()
    and status not in ('draft','completed','cancelled')
  )
  with check (
    public.is_portal_client()
    and client_id = public.current_client_id()
    and status not in ('draft','completed','cancelled')
  );

-- Le déclencheur de colonnes protégées suit les colonnes nouvelles : un
-- destinataire ne redirige pas son questionnaire vers quelqu'un d'autre, ne
-- prolonge pas sa propre date limite et ne réécrit pas les questions.
create or replace function public.protect_questionnaire_columns()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_portal_client() then return new; end if;

  if new.firm_id     is distinct from old.firm_id
     or new.client_id   is distinct from old.client_id
     or new.lead_id     is distinct from old.lead_id
     or new.matter_id   is distinct from old.matter_id
     or new.template_id is distinct from old.template_id
     or new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.sections    is distinct from old.sections
     or new.message     is distinct from old.message
     or new.due_date    is distinct from old.due_date
     or new.corrections is distinct from old.corrections
     or new.prefill     is distinct from old.prefill
     or new.token_hash  is distinct from old.token_hash
     or new.token_revoked_at is distinct from old.token_revoked_at
     or new.sent_by     is distinct from old.sent_by
     or new.created_at  is distinct from old.created_at then
    raise exception 'Un client ne peut modifier que ses réponses.'
      using errcode = 'insufficient_privilege';
  end if;

  if not (new.history @> old.history) then
    raise exception 'Le journal des modifications ne peut pas être réécrit.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

commit;
