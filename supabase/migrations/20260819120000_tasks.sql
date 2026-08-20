-- ============================================================================
-- Registre & Gestion des Tâches Opérationnelles de Cabinet & Dossier (F33)
-- ============================================================================
--
-- Les tâches représentent les micro-actions opérationnelles quotidiennes
-- d'un cabinet (rappeler un client, relancer un employeur, vérifier une pièce).
--
-- Règles d'intégrité :
-- 1. Multi-tenant strict : firm_id NOT NULL avec RLS sur current_firm_id().
-- 2. Rattachement souple : matter_id optionnel (tâche de dossier ou générale).
-- 3. Traçabilité : auteur (created_by), responsable (assigned_to), compléteur (completed_by).
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Table principale : tasks
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  matter_id      uuid references public.matters(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,

  title          text not null,
  description    text,

  priority       text not null default 'normal'
                 check (priority in ('low', 'normal', 'high', 'urgent')),

  status         text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'done', 'cancelled')),

  due_date       date,

  created_by     uuid references public.profiles(id) on delete set null,
  assigned_to    uuid references public.profiles(id) on delete set null,

  completed_at   timestamptz,
  completed_by   uuid references public.profiles(id) on delete set null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Index de performance
-- ---------------------------------------------------------------------------

create index if not exists idx_tasks_firm_id on public.tasks(firm_id);
create index if not exists idx_tasks_firm_matter on public.tasks(firm_id, matter_id);
create index if not exists idx_tasks_firm_assigned_status on public.tasks(firm_id, assigned_to, status);
create index if not exists idx_tasks_firm_due_date on public.tasks(firm_id, due_date);
create index if not exists idx_tasks_firm_status on public.tasks(firm_id, status);

-- ---------------------------------------------------------------------------
-- 3. Sécurité RLS multi-locataire étanche
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;

drop policy if exists tasks_tenant_isolation on public.tasks;
create policy tasks_tenant_isolation on public.tasks
  for all
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 4. Déclencheur d'horodatage updated_at
-- ---------------------------------------------------------------------------

create or replace function public.touch_task_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (old is null or old.status <> 'done') and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' and old is not null and old.status = 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch
  before update on public.tasks
  for each row execute function public.touch_task_updated_at();

commit;
