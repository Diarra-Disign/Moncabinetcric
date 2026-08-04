-- =====================================================================
-- moncabinetcric — Schéma initial
-- Projet Supabase : zpbkxzrnvzxcwlhjllrp
--
-- Modèle multi-cabinet : chaque table porte firm_id et RLS est activée
-- dès la création. L'authentification n'est pas encore branchée : à ce
-- stade l'accès se fait exclusivement côté serveur avec la clé
-- service_role, qui contourne RLS par conception. Les politiques
-- ci-dessous sont donc déjà en place mais ne deviendront réellement
-- discriminantes qu'une fois Supabase Auth branché (migration 0003).
--
-- Conventions :
--   - snake_case pour les colonnes ; la couche lib/data/ fait la
--     correspondance vers le camelCase de types.ts.
--   - montants en centimes (bigint) partout où types.ts utilise *Cents.
--   - les identifiants métier lisibles (#DOS-35695, SA-2026-000142)
--     sont conservés dans des colonnes dédiées, la clé primaire reste
--     un uuid technique.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Cabinets et membres
-- ---------------------------------------------------------------------

create table public.firms (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  rcic_number    text not null,
  rcic_name      text not null,
  address        text,
  phone          text,
  email          text,
  logo_letter    text,
  logo_url       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.firms is 'Cabinets de consultants réglementés. Racine du cloisonnement multi-locataire.';

create table public.firm_members (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  -- Rattachement à auth.users, laissé nullable tant que l'auth n'est pas branchée.
  user_id        uuid unique,
  email          text not null,
  full_name      text not null,
  role           text not null check (role in ('owner','rcic','risia','staff','bookkeeper','system')),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (firm_id, email)
);

create index on public.firm_members (firm_id);

-- ---------------------------------------------------------------------
-- Clients, dossiers, prospects
-- ---------------------------------------------------------------------

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  legacy_id      text,
  file_number    text not null,
  name           text not null,
  first_name     text,
  last_name      text,
  email          text not null,
  phone          text not null,
  citizenship    text not null,
  residence      text not null,
  province       text,
  program        text not null,
  status         text not null check (status in ('active','consultation','pending')),
  intake_motif   text not null,
  client_type    text check (client_type in ('individual','employer')),
  neq_number     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, file_number)
);

create index on public.clients (firm_id);
create index on public.clients (firm_id, legacy_id);

create table public.matters (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  legacy_id      text,
  reference      text not null,
  client_name    text not null,
  client_type    text check (client_type in ('b2b','b2c')),
  program        text not null,
  category       text check (category in ('pr','work','study','sponsorship','appeal')),
  opened_date    date not null,
  deadline       date,
  rcic           text not null,
  status         text not null check (status in ('valid','alert','review','pending')),
  urgency_days   integer,
  notes          text,
  is_priority    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, reference)
);

create index on public.matters (firm_id);
create index on public.matters (firm_id, client_id);
create index on public.matters (firm_id, legacy_id);

create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.firms(id) on delete cascade,
  legacy_id         text,
  name              text not null,
  first_name        text,
  last_name         text,
  company           text,
  type              text not null check (type in ('b2b','b2c')),
  visa_type         text not null,
  estimated_value   numeric(12,2) not null default 0,
  score             integer not null check (score between 0 and 100),
  score_label       text not null check (score_label in ('high','med','low')),
  stage             text not null check (stage in ('newLead','consultation','proposal','negotiation','signed')),
  last_contact      date,
  email             text not null,
  phone             text not null,
  notes             text not null default '',
  lmia_positions    integer,
  source            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.leads (firm_id);
create index on public.leads (firm_id, stage);

-- ---------------------------------------------------------------------
-- Facturation et fidéicommis
-- ---------------------------------------------------------------------

create table public.invoices (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references public.firms(id) on delete cascade,
  client_id            uuid references public.clients(id) on delete set null,
  matter_id            uuid references public.matters(id) on delete set null,
  legacy_id            text,
  invoice_number       text not null,
  client_name          text not null,
  service_description  text,
  amount               numeric(12,2) not null,
  date                 date not null,
  status               text not null check (status in ('paid','pending','trust_reconciled')),
  is_trust_account     boolean not null default false,
  tax_exempt           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (firm_id, invoice_number)
);

create index on public.invoices (firm_id);
create index on public.invoices (firm_id, matter_id);

-- ---------------------------------------------------------------------
-- Coffre-fort documentaire
-- ---------------------------------------------------------------------

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  matter_id      uuid references public.matters(id) on delete set null,
  legacy_id      text,
  name           text not null,
  type           text not null,
  category       text not null check (category in ('client_upload','consultant_upload','contract','invoice','ircc_form')),
  uploaded_by    text not null,
  date           date not null,
  expiration     text,
  source         text not null,
  status         text not null check (status in ('valid','invalid','archived')),
  client_name    text,
  file_size      text,
  sha256         text,
  storage_path   text,
  file_url       text,
  -- Aperçu textuel du document. Le binaire réel vit dans Supabase Storage,
  -- référencé par storage_path.
  content        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index on public.documents (firm_id);
create index on public.documents (firm_id, matter_id);
create index on public.documents (firm_id, category) where status <> 'archived';

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------

create table public.calendar_events (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.firms(id) on delete cascade,
  matter_id         uuid references public.matters(id) on delete set null,
  legacy_id         text,
  title             text not null,
  client_name       text not null,
  client_initials   text not null,
  avatar_bg         text not null,
  program           text not null,
  type              text not null check (type in ('visio','deadline','signing')),
  platform          text check (platform in ('zoom','google_meet','calendly')),
  link              text,
  date              date not null,
  day_name          text not null,
  time              text not null,
  hour              integer not null check (hour between 0 and 23),
  status            text not null check (status in ('ready','pending_doc','completed')),
  trust_balance     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.calendar_events (firm_id, date);

-- ---------------------------------------------------------------------
-- Ententes de services
-- ---------------------------------------------------------------------

create table public.agreements (
  id                             uuid primary key default gen_random_uuid(),
  firm_id                        uuid not null references public.firms(id) on delete cascade,
  matter_id                      uuid references public.matters(id) on delete set null,
  legacy_id                      text,
  reference                      text not null,
  client_name                    text not null,
  client_address                 text,
  client_country_of_residence    text,
  client_phone                   text,
  client_email                   text,
  program                        text not null,
  date                           text not null,
  status                         text not null check (status in ('draft','pending_signatures','fully_signed','amended','cancelled')),
  government_fees                jsonb not null default '[]'::jsonb,
  discount_cents                 bigint not null default 0,
  discount_label                 text,
  total_professional_fees_cents  bigint not null default 0,
  total_government_fees_cents    bigint not null default 0,
  tps_cents                      bigint not null default 0,
  tvq_cents                      bigint not null default 0,
  is_tax_exempt                  boolean not null default false,
  grand_total_cents              bigint not null default 0,
  rcic_name                      text not null,
  rcic_licence_no                text not null,
  signed_at                      timestamptz,
  sha256                         text,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  unique (firm_id, reference)
);

create index on public.agreements (firm_id);

create table public.agreement_persons (
  id                     uuid primary key default gen_random_uuid(),
  agreement_id           uuid not null references public.agreements(id) on delete cascade,
  legacy_id              text,
  person_name            text not null,
  party_role             text not null check (party_role in ('principal','spouse','child','sponsor','employer','third_party')),
  is_signatory           boolean not null default false,
  address                text,
  country_of_residence   text,
  phone                  text,
  email                  text,
  position               integer not null default 0
);

create index on public.agreement_persons (agreement_id);

create table public.agreement_services (
  id             uuid primary key default gen_random_uuid(),
  agreement_id   uuid not null references public.agreements(id) on delete cascade,
  person_id      uuid references public.agreement_persons(id) on delete set null,
  legacy_id      text,
  person_name    text not null,
  program_name   text not null,
  scope_included text not null default '',
  scope_excluded text not null default '',
  fee_cents      bigint not null default 0,
  position       integer not null default 0
);

create index on public.agreement_services (agreement_id);

-- ---------------------------------------------------------------------
-- Échéances réglementaires
-- ---------------------------------------------------------------------

create table public.deadline_rules (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  label_fr           text not null,
  label_en           text not null,
  trigger_event      text not null check (trigger_event in (
                       'status_expiry','biometrics_request','ita_received','medical_expiry',
                       'lmia_expiry','restoration_window','caq_expiry','cicc_license_renewal',
                       'trust_reconciliation')),
  offset_days        integer not null,
  offset_direction   text not null check (offset_direction in ('before','after')),
  severity           text not null check (severity in ('critical','high','normal')),
  reminder_offsets   integer[] not null default '{}',
  authority          text not null,
  source_url         text,
  effective_from     date not null,
  verified_on        date,
  is_active          boolean not null default true
);

comment on table public.deadline_rules is 'Référentiel réglementaire partagé, non cloisonné par cabinet.';

create table public.deadlines (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.firms(id) on delete cascade,
  matter_id         uuid references public.matters(id) on delete set null,
  legacy_id         text,
  person_id         text,
  client_name       text not null,
  program           text not null,
  title             text not null,
  rule_code         text references public.deadline_rules(code),
  due_on            date not null,
  severity          text not null check (severity in ('critical','high','normal')),
  status            text not null check (status in ('open','done','dismissed','superseded')),
  assigned_to       text not null,
  authority         text not null,
  dismissed_reason  text,
  completed_at      timestamptz,
  completed_by      text,
  source_fact       jsonb,
  is_manual         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.deadlines (firm_id, due_on) where status = 'open';

-- days_remaining de types.ts est dérivé de due_on : calculé à la lecture,
-- jamais stocké, pour ne pas devenir faux au fil du temps.

-- ---------------------------------------------------------------------
-- Référentiels partagés
-- ---------------------------------------------------------------------

create table public.government_fees (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  label_fr         text not null,
  label_en         text not null,
  authority        text not null check (authority in ('IRCC','MIFI','ASFC','CISR')),
  jurisdiction     text not null check (jurisdiction in ('federal','QC','ON')),
  category         text not null check (category in ('processing','pr_right','biometrics','permit','citizenship')),
  amount_cents     bigint not null,
  currency         text not null default 'CAD',
  calc_rule        text not null check (calc_rule in ('per_principal','per_dependant','per_family','flat')),
  source_url       text,
  effective_from   date not null,
  is_active        boolean not null default true
);

create table public.clauses (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  category       text not null check (category in ('mandate','fees','cicc_compliance','trust','cancellation','custom')),
  level          text not null check (level in ('structural','cicc_required','free')),
  title_fr       text not null,
  title_en       text not null,
  body_fr        text not null,
  body_en        text not null,
  is_editable    boolean not null default true,
  is_optional    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Journal d'audit (chaîne d'empreintes SHA-256)
-- ---------------------------------------------------------------------

create table public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references public.firms(id) on delete cascade,
  legacy_id         text,
  occurred_at       timestamptz not null default now(),
  actor_member_id   text not null,
  actor_email       text not null,
  actor_name        text not null,
  actor_role        text not null check (actor_role in ('owner','rcic','risia','staff','bookkeeper','system')),
  action            text not null check (action in ('view','create','update','delete','download','export','login','trust_transfer','approval')),
  entity_type       text not null check (entity_type in ('matter','agreement','invoice','document','trust_account','approval_queue')),
  entity_id         text,
  matter_id         text,
  summary           text not null,
  changes           jsonb,
  ip_address        text,
  user_agent        text,
  prev_hash         text not null,
  row_hash          text not null
);

create index on public.audit_logs (firm_id, occurred_at desc);
create index on public.audit_logs (firm_id, entity_type, entity_id);

comment on table public.audit_logs is
  'Journal inaltérable. Aucune politique update/delete n''est définie : les lignes sont en insertion seule.';

-- ---------------------------------------------------------------------
-- File d'approbation (actes réservés au consultant réglementé)
-- ---------------------------------------------------------------------

create table public.action_approvals (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references public.firms(id) on delete cascade,
  matter_id          uuid references public.matters(id) on delete set null,
  legacy_id          text,
  matter_title       text not null,
  client_name        text not null,
  action_type        text not null check (action_type in ('sign_contract','submit_ircc','trust_transfer','close_matter')),
  action_title       text not null,
  summary            text not null,
  payload            jsonb not null default '{}'::jsonb,
  prepared_by        text not null,
  prepared_by_role   text not null check (prepared_by_role in ('staff','risia')),
  prepared_at        timestamptz not null default now(),
  approved_by        text,
  approved_at        timestamptz,
  rejected_reason    text,
  status             text not null check (status in ('pending','approved','rejected','executed')),
  amount_cents       bigint
);

create index on public.action_approvals (firm_id, status);

-- ---------------------------------------------------------------------
-- Connecteur IA
-- ---------------------------------------------------------------------

create table public.ai_connector_settings (
  firm_id                  uuid primary key references public.firms(id) on delete cascade,
  enabled                  boolean not null default false,
  enabled_by               text,
  enabled_at               timestamptz,
  allowed_member_ids       text[] not null default '{}',
  allowed_actions          text[] not null default '{}',
  reserved_human_actions   text[] not null default '{}',
  guide_url                text
);

create table public.ai_api_keys (
  id                        uuid primary key default gen_random_uuid(),
  firm_id                   uuid not null references public.firms(id) on delete cascade,
  legacy_id                 text,
  name                      text not null,
  key_prefix                text not null,
  secret_hash               text not null,
  created_for_member_id     text not null,
  created_for_member_name   text not null,
  created_at                timestamptz not null default now(),
  last_used_at              timestamptz,
  is_active                 boolean not null default true
);

create index on public.ai_api_keys (firm_id) where is_active;

create table public.ai_connector_logs (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  legacy_id      text,
  occurred_at    timestamptz not null default now(),
  api_key_prefix text not null,
  client_ip      text,
  action         text not null,
  resource_id    text,
  status         text not null check (status in ('success','forbidden_reserved','disabled','error')),
  summary        text not null,
  row_hash       text not null
);

create index on public.ai_connector_logs (firm_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'firms','clients','matters','leads','invoices','documents',
    'calendar_events','agreements','deadlines'
  ] loop
    execute format(
      'create trigger %I_touch before update on public.%I
         for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Activée sur toutes les tables. La clé service_role utilisée côté
-- serveur contourne RLS : les politiques ci-dessous ne mordent que sur
-- les clés anon/authenticated, donc dès que l'auth sera branchée.
-- Aucune politique n'est créée pour anon : par défaut, tout est refusé.
-- ---------------------------------------------------------------------

alter table public.firms                 enable row level security;
alter table public.firm_members          enable row level security;
alter table public.clients               enable row level security;
alter table public.matters               enable row level security;
alter table public.leads                 enable row level security;
alter table public.invoices              enable row level security;
alter table public.documents             enable row level security;
alter table public.calendar_events       enable row level security;
alter table public.agreements            enable row level security;
alter table public.agreement_persons     enable row level security;
alter table public.agreement_services    enable row level security;
alter table public.deadlines             enable row level security;
alter table public.deadline_rules        enable row level security;
alter table public.government_fees       enable row level security;
alter table public.clauses               enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.action_approvals      enable row level security;
alter table public.ai_connector_settings enable row level security;
alter table public.ai_api_keys           enable row level security;
alter table public.ai_connector_logs     enable row level security;

-- Cabinet de l'utilisateur courant, déduit de firm_members.
create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from public.firm_members where user_id = auth.uid() limit 1;
$$;

-- Tables cloisonnées par firm_id : lecture et écriture réservées au cabinet.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','matters','leads','invoices','documents','calendar_events',
    'agreements','deadlines','action_approvals','ai_api_keys','ai_connector_logs'
  ] loop
    execute format(
      'create policy %I_firm_access on public.%I
         for all to authenticated
         using (firm_id = public.current_firm_id())
         with check (firm_id = public.current_firm_id())',
      t, t
    );
  end loop;
end;
$$;

-- Le journal d'audit est en insertion et lecture seule : ni update ni delete.
create policy audit_logs_select on public.audit_logs
  for select to authenticated using (firm_id = public.current_firm_id());
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated with check (firm_id = public.current_firm_id());

-- Tables filles des ententes : cloisonnement hérité du parent.
create policy agreement_persons_firm_access on public.agreement_persons
  for all to authenticated
  using (exists (select 1 from public.agreements a
                 where a.id = agreement_id and a.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.agreements a
                      where a.id = agreement_id and a.firm_id = public.current_firm_id()));

create policy agreement_services_firm_access on public.agreement_services
  for all to authenticated
  using (exists (select 1 from public.agreements a
                 where a.id = agreement_id and a.firm_id = public.current_firm_id()))
  with check (exists (select 1 from public.agreements a
                      where a.id = agreement_id and a.firm_id = public.current_firm_id()));

-- Le cabinet lui-même et ses membres.
create policy firms_self on public.firms
  for select to authenticated using (id = public.current_firm_id());
create policy firm_members_self on public.firm_members
  for select to authenticated using (firm_id = public.current_firm_id());

create policy ai_connector_settings_firm_access on public.ai_connector_settings
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Référentiels réglementaires : lecture pour tout membre authentifié,
-- écriture réservée au service_role (donc aucune politique d'écriture).
create policy deadline_rules_read on public.deadline_rules
  for select to authenticated using (true);
create policy government_fees_read on public.government_fees
  for select to authenticated using (true);
create policy clauses_read on public.clauses
  for select to authenticated using (true);
