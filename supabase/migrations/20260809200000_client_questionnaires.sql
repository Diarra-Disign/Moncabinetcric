-- ============================================================================
-- Formulaires et Questionnaires Clients Intégrés (Portail & Dossier)
-- ============================================================================

begin;

create table if not exists public.client_questionnaires (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  matter_id   uuid not null references public.matters(id) on delete cascade,
  title       text not null,
  description text,
  form_type   text not null check (form_type in ('study_permit', 'work_permit', 'pr')),
  status      text not null default 'draft'
              check (status in ('draft', 'in_progress', 'submitted', 'to_correct', 'corrected', 'validated', 'locked')),
  progress    integer not null default 0 check (progress >= 0 and progress <= 100),
  due_date    timestamptz,
  answers     jsonb not null default '{}'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_saved_at timestamptz
);

comment on table public.client_questionnaires is
  'Questionnaires clients dynamiques reliés aux dossiers d''immigration.';

-- Index de recherche et performance
create index if not exists client_questionnaires_matter_idx on public.client_questionnaires(matter_id);
create index if not exists client_questionnaires_client_idx on public.client_questionnaires(client_id);
create index if not exists client_questionnaires_firm_idx   on public.client_questionnaires(firm_id, status);

-- Activer RLS
alter table public.client_questionnaires enable row level security;

-- Politiques RLS pour les membres du cabinet
drop policy if exists client_questionnaires_member on public.client_questionnaires;
create policy client_questionnaires_member on public.client_questionnaires
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Politiques RLS pour le portail client (lecture)
drop policy if exists client_questionnaires_portal on public.client_questionnaires;
create policy client_questionnaires_portal on public.client_questionnaires
  for select to authenticated
  using (
    public.is_portal_client()
    and client_id = public.current_client_id()
  );

-- Politiques RLS pour le portail client (mise à jour/remplissage)
drop policy if exists client_questionnaires_portal_update on public.client_questionnaires;
create policy client_questionnaires_portal_update on public.client_questionnaires
  for update to authenticated
  using (
    public.is_portal_client()
    and client_id = public.current_client_id()
    and status not in ('validated', 'locked')
  )
  with check (
    public.is_portal_client()
    and client_id = public.current_client_id()
    and status not in ('validated', 'locked')
  );

commit;
