-- ============================================================================
-- Portail client : comptes, cloisonnement et vues restreintes
-- ============================================================================
--
-- Le portail était public et ne réclamait aucune authentification. Il
-- présentait un dossier d'immigration fabriqué et un questionnaire
-- demandant passeport, antécédents sur dix ans et composition familiale.
-- Rien n'était enregistré — donc aucune fuite — mais un client aurait cru
-- ses renseignements transmis à son consultant.
--
-- Deux principes structurent cette migration.
--
-- 1. Un client n'est pas un membre du cabinet. Il ne passe donc pas par
--    profiles, qui donnerait accès à tout le cabinet. Il lui faut son
--    propre rattachement et ses propres politiques.
--
-- 2. La RLS filtre des lignes, pas des colonnes. Or un dossier porte des
--    notes internes et un client porte un motif d'admission qui ne lui
--    sont pas destinés. On expose donc des VUES restreintes, et jamais
--    les tables elles-mêmes.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Rattachement d'un compte à un dossier client
-- ---------------------------------------------------------------------------

create table if not exists public.client_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  firm_id    uuid not null references public.firms(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create index if not exists client_users_client_idx on public.client_users (client_id);
create index if not exists client_users_firm_idx on public.client_users (firm_id);

alter table public.client_users enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Identité du client connecté
-- ---------------------------------------------------------------------------
-- Le cabinet doit être actif : un abonnement suspendu ferme aussi l'accès
-- des clients, sans quoi la suspension serait contournable par le portail.

create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cu.client_id
  from public.client_users cu
  where cu.user_id = auth.uid()
    and public.firm_access_open(cu.firm_id)
  limit 1;
$$;

revoke all on function public.current_client_id() from public;
grant execute on function public.current_client_id() to authenticated;

-- Un compte ne peut pas être à la fois membre d'un cabinet et client :
-- les deux jeux de politiques se cumuleraient.
create or replace function public.is_portal_client()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_client_id() is not null
     and not exists (select 1 from public.profiles where user_id = auth.uid());
$$;

revoke all on function public.is_portal_client() from public;
grant execute on function public.is_portal_client() to authenticated;

-- Le cabinet gère les accès de ses propres clients.
drop policy if exists client_users_firm_manage on public.client_users;
create policy client_users_firm_manage on public.client_users
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner())
  with check (firm_id = public.current_firm_id() and public.is_firm_owner());

-- Un client voit son propre rattachement, et lui seul.
drop policy if exists client_users_read_self on public.client_users;
create policy client_users_read_self on public.client_users
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Accès du client à ses propres lignes
-- ---------------------------------------------------------------------------
-- Lecture seule, et strictement limitée à son dossier. Aucune politique
-- d'écriture : un client ne modifie pas son dossier depuis le portail.

drop policy if exists clients_portal_self on public.clients;
create policy clients_portal_self on public.clients
  for select to authenticated
  using (id = public.current_client_id());

drop policy if exists matters_portal_self on public.matters;
create policy matters_portal_self on public.matters
  for select to authenticated
  using (client_id = public.current_client_id());

-- Les notes internes du consultant ne sont pas destinées au client :
-- la catégorie consultant_upload est exclue au niveau de la ligne.
drop policy if exists documents_portal_self on public.documents;
create policy documents_portal_self on public.documents
  for select to authenticated
  using (
    client_id = public.current_client_id()
    and category <> 'consultant_upload'
    and status <> 'archived'
  );

-- Les factures qui le concernent, sans les mouvements internes.
drop policy if exists invoices_portal_self on public.invoices;
create policy invoices_portal_self on public.invoices
  for select to authenticated
  using (client_id = public.current_client_id());

-- Ses propres rendez-vous.
drop policy if exists events_portal_self on public.calendar_events;
create policy events_portal_self on public.calendar_events
  for select to authenticated
  using (client_id = public.current_client_id());

-- ---------------------------------------------------------------------------
-- 4. Vues restreintes
-- ---------------------------------------------------------------------------
-- security_invoker : la vue s'exécute avec les droits de l'appelant, donc
-- les politiques ci-dessus s'appliquent. Sans cette option, une vue
-- contournerait la RLS et exposerait le dossier de tous les clients.
--
-- Les colonnes absentes sont le vrai sujet : notes de dossier, motif
-- d'admission, empreintes et chemins de stockage restent hors de portée.

create or replace view public.portal_matters
with (security_invoker = true) as
  select id, reference, program, category, status, opened_date, deadline, rcic
  from public.matters
  where client_id = public.current_client_id();

create or replace view public.portal_documents
with (security_invoker = true) as
  select id, name, type, category, date, expiration, status, file_size
  from public.documents
  where client_id = public.current_client_id()
    and category <> 'consultant_upload'
    and status <> 'archived';

create or replace view public.portal_invoices
with (security_invoker = true) as
  select id, invoice_number, service_description, amount, date, status
  from public.invoices
  where client_id = public.current_client_id();

create or replace view public.portal_events
with (security_invoker = true) as
  select id, title, type, platform, link, date, time, status
  from public.calendar_events
  where client_id = public.current_client_id();

create or replace view public.portal_profile
with (security_invoker = true) as
  select c.id, c.file_number, c.name, c.email, c.phone, c.program, c.status,
         f.name as firm_name, f.rcic_license_number, f.owner_name, f.email as firm_email,
         f.phone as firm_phone
  from public.clients c
  join public.firms f on f.id = c.firm_id
  where c.id = public.current_client_id();

do $$
declare v text;
begin
  foreach v in array array['portal_matters','portal_documents','portal_invoices',
                           'portal_events','portal_profile']
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
end $$;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
-- Les vues doivent toutes être en security_invoker :
--
--   select c.relname, c.reloptions
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'portal_%';
-- ============================================================================
