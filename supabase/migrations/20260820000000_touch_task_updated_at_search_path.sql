-- ============================================================================
-- Sécurisation du search_path pour touch_task_updated_at
-- ============================================================================

begin;

create or replace function public.touch_task_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
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

commit;
