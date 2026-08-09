-- ============================================================================
-- Échéances du dossier
-- ============================================================================
--
-- Un dossier ne portait qu'UNE date : matters.deadline. Or un dossier
-- d'immigration en compte plusieurs — dépôt de la demande, réponse à une
-- demande de documents, biométrie, examen médical, expiration d'un statut — et
-- chacune a son responsable, sa priorité et son sort propre.
--
-- Il existait aussi `deadline_rules` : des RÈGLES par programme (un nom
-- d'étape, un délai en jours), jamais transformées en occurrences. Une règle
-- ne rappelle rien à personne.
--
-- ---------------------------------------------------------------------------
-- UNE SEULE VÉRITÉ, PAS DEUX
-- ---------------------------------------------------------------------------
-- Ajouter une table d'échéances à côté de matters.deadline aurait créé deux
-- sources : les listes et le calcul d'urgence lisent la colonne, les écrans
-- neufs liraient la table, et les deux divergeraient au premier report de date.
--
-- La colonne est donc MIGRÉE dans la table, puis MAINTENUE comme une
-- projection : elle vaut désormais la plus proche échéance encore ouverte. Rien
-- de ce qui la lit aujourd'hui ne change de comportement, et il n'y a qu'un
-- endroit où l'écrire.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les échéances
-- ---------------------------------------------------------------------------

create table if not exists public.matter_deadlines (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  matter_id   uuid not null references public.matters(id) on delete cascade,

  title       text not null,
  description text,
  due_on      date not null,
  -- Facultative : « avant 16 h » n'a de sens que pour certaines démarches.
  due_time    time,

  priority    text not null default 'normal'
              check (priority in ('low','normal','high','critical')),

  -- Le responsable. `set null` : le départ d'un membre ne doit pas emporter
  -- l'échéance — c'est au contraire le moment où elle compte le plus.
  assignee_id uuid references public.profiles(id) on delete set null,

  -- Seuls les états DÉCIDÉS sont stockés. « En retard » se déduit de la date,
  -- et le stocker obligerait à repasser sur toutes les lignes chaque nuit —
  -- un traitement qui, le jour où il ne tourne pas, laisse des échéances
  -- dépassées affichées comme à faire.
  status      text not null default 'todo'
              check (status in ('todo','in_progress','done','cancelled')),

  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,

  -- Une échéance réglementaire ne se supprime pas à la légère : elle vient
  -- d'un délai imposé, pas d'une organisation interne.
  is_regulatory boolean not null default false,
  notes        text,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists matter_deadlines_matter_idx on public.matter_deadlines(matter_id, due_on);
create index if not exists matter_deadlines_firm_idx   on public.matter_deadlines(firm_id, due_on)
  where status in ('todo','in_progress');
create index if not exists matter_deadlines_assignee_idx on public.matter_deadlines(assignee_id)
  where status in ('todo','in_progress');

comment on table public.matter_deadlines is
  'Échéances d''un dossier. « En retard » ne se stocke pas : il se déduit de la date du jour.';

-- ---------------------------------------------------------------------------
-- 2. Les pièces rattachées à une échéance
-- ---------------------------------------------------------------------------
-- Une table de liaison plutôt qu'une colonne : une échéance peut appeler
-- plusieurs pièces, et une même pièce servir à plusieurs échéances.

create table if not exists public.deadline_documents (
  deadline_id uuid not null references public.matter_deadlines(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (deadline_id, document_id)
);

-- ---------------------------------------------------------------------------
-- 3. Le statut effectif
-- ---------------------------------------------------------------------------

create or replace function public.deadline_status(statut text, due_on date)
returns text language sql stable as $$
  select case
    when statut in ('done','cancelled')      then statut
    when due_on < current_date               then 'overdue'
    else statut
  end;
$$;

/** Les échéances d'un dossier, avec leur statut effectif et leur responsable. */
create or replace function public.matter_deadlines_view(m_id uuid)
returns table (
  id uuid, title text, description text, due_on date, due_time time,
  priority text, status text, is_regulatory boolean,
  assignee_id uuid, assignee_name text,
  completed_at timestamptz, notes text, documents int
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select d.id, d.title, d.description, d.due_on, d.due_time,
         d.priority,
         public.deadline_status(d.status, d.due_on),
         d.is_regulatory,
         d.assignee_id, p.full_name,
         d.completed_at, d.notes,
         (select count(*)::int from public.deadline_documents dd where dd.deadline_id = d.id)
    from public.matter_deadlines d
    left join public.profiles p on p.id = d.assignee_id
   where d.matter_id = m_id
   order by
     case public.deadline_status(d.status, d.due_on)
       when 'overdue' then 0 when 'in_progress' then 1 when 'todo' then 2 else 3 end,
     d.due_on, d.due_time nulls last;
$$;

/**
 * Ce qu'il faut savoir sans ouvrir un dossier.
 *
 * Trois nombres, calculés en une passe : dépassées, aujourd'hui, à venir.
 * Le tableau de bord et le dossier lisent la même fonction — deux comptages
 * écrits séparément finissent par ne plus s'accorder, et c'est celui qui
 * rassure qu'on croit.
 */
create or replace function public.firm_deadline_alerts(f_id uuid, jours int default 7)
returns table (depassees int, aujourdhui int, a_venir int)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    count(*) filter (where d.due_on <  current_date)::int,
    count(*) filter (where d.due_on =  current_date)::int,
    count(*) filter (where d.due_on >  current_date
                       and d.due_on <= current_date + jours)::int
    from public.matter_deadlines d
   where d.firm_id = f_id and d.status in ('todo','in_progress');
$$;

revoke all on function public.matter_deadlines_view(uuid) from public;
revoke all on function public.firm_deadline_alerts(uuid, int) from public;
grant execute on function public.matter_deadlines_view(uuid) to authenticated;
grant execute on function public.firm_deadline_alerts(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. matters.deadline devient une projection
-- ---------------------------------------------------------------------------
-- Elle vaut la plus proche échéance encore ouverte. Tout ce qui la lit —
-- listes, calcul d'urgence, tableau de bord — continue de fonctionner sans
-- rien changer, et cesse de pouvoir contredire la table.

create or replace function public.sync_matter_deadline()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cible uuid := coalesce(new.matter_id, old.matter_id);
begin
  update public.matters m
     set deadline = (
       select min(d.due_on) from public.matter_deadlines d
        where d.matter_id = cible and d.status in ('todo','in_progress')
     )
   where m.id = cible;
  return coalesce(new, old);
end;
$$;

drop trigger if exists matter_deadlines_sync on public.matter_deadlines;
create trigger matter_deadlines_sync
  after insert or update or delete on public.matter_deadlines
  for each row execute function public.sync_matter_deadline();

-- La date déjà saisie devient une échéance à part entière, pour qu'aucune ne
-- se perde au passage. Sans cette reprise, les dossiers en cours perdraient
-- leur seule date le jour du déploiement.
insert into public.matter_deadlines (firm_id, matter_id, title, due_on, is_regulatory, notes)
select m.firm_id, m.id, 'Échéance principale', m.deadline, true,
       'Reprise de la date portée par le dossier avant la gestion des échéances.'
  from public.matters m
 where m.deadline is not null
   and not exists (select 1 from public.matter_deadlines d where d.matter_id = m.id);

-- ---------------------------------------------------------------------------
-- 5. Les règles par programme deviennent des échéances
-- ---------------------------------------------------------------------------
-- `deadline_rules` existait sans jamais produire d'occurrence. Un dossier neuf
-- reçoit désormais les échéances de son programme, comptées depuis sa date
-- d'ouverture. Un cabinet sans règle n'en reçoit aucune : rien n'est inventé.

create or replace function public.seed_matter_deadlines()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.matter_deadlines
    (firm_id, matter_id, title, due_on, is_regulatory, notes)
  select new.firm_id, new.id, r.step_name,
         coalesce(new.opened_date, current_date) + (r.delay_days || ' days')::interval,
         r.is_regulatory,
         'Engendrée depuis les règles de délai du programme.'
    from public.deadline_rules r
   where r.firm_id = new.firm_id
     and lower(r.program) = lower(coalesce(new.program, ''));
  return new;
end;
$$;

drop trigger if exists matters_seed_deadlines on public.matters;
create trigger matters_seed_deadlines
  after insert on public.matters
  for each row execute function public.seed_matter_deadlines();

-- ---------------------------------------------------------------------------
-- 6. Terminer une échéance, c'est un fait daté
-- ---------------------------------------------------------------------------

create or replace function public.stamp_deadline_completion()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();

  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;

  -- Rouvrir efface la date de réalisation : la laisser ferait d'une échéance
  -- en cours une échéance qui prétend avoir été terminée.
  if new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists matter_deadlines_stamp on public.matter_deadlines;
create trigger matter_deadlines_stamp
  before update on public.matter_deadlines
  for each row execute function public.stamp_deadline_completion();

-- ---------------------------------------------------------------------------
-- 7. Cloisonnement
-- ---------------------------------------------------------------------------

alter table public.matter_deadlines   enable row level security;
alter table public.deadline_documents enable row level security;

drop policy if exists matter_deadlines_read on public.matter_deadlines;
create policy matter_deadlines_read on public.matter_deadlines
  for select to authenticated using (firm_id = public.current_firm_id());

drop policy if exists matter_deadlines_write on public.matter_deadlines;
create policy matter_deadlines_write on public.matter_deadlines
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('records.write'))
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

drop policy if exists deadline_documents_read on public.deadline_documents;
create policy deadline_documents_read on public.deadline_documents
  for select to authenticated using (firm_id = public.current_firm_id());

drop policy if exists deadline_documents_write on public.deadline_documents;
create policy deadline_documents_write on public.deadline_documents
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('records.write'))
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- matters.deadline doit toujours égaler la plus proche échéance ouverte :
--   select m.reference, m.deadline,
--          (select min(d.due_on) from public.matter_deadlines d
--            where d.matter_id = m.id and d.status in ('todo','in_progress')) as calculee
--     from public.matters m
--    where m.deadline is distinct from
--          (select min(d.due_on) from public.matter_deadlines d
--            where d.matter_id = m.id and d.status in ('todo','in_progress'));
--
--   select * from public.firm_deadline_alerts((select id from public.firms limit 1));
-- ============================================================================
