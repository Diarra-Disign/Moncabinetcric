-- ============================================================================
-- Demandes de places : le cabinet demande, l'exploitant accorde
-- ============================================================================
--
-- Un cabinet qui atteint la limite de son forfait se heurtait à un refus sec :
-- le déclencheur enforce_seat_limit rejetait l'invitation, sans autre issue que
-- de changer de forfait ou d'écrire un courriel. Rien dans l'application ne
-- permettait de demander une place de plus, et rien ne permettait d'en
-- accorder une.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE FAIT PAS
-- ---------------------------------------------------------------------------
-- Accorder une place ne la facture pas. Les places accordées ici s'ajoutent au
-- plafond du forfait ; leur facturation suivra au prochain changement
-- d'abonnement, où sessionPaiement() recompte les places occupées. Automatiser
-- ce prélèvement — ajuster la quantité de l'abonnement Stripe en cours, avec
-- proratisation — est un travail distinct, et qui touche à ce que des clients
-- paient réellement. Il ne se glisse pas en passant.
--
-- L'écran de réponse le dit à l'exploitant au moment où il accorde, plutôt que
-- de le lui laisser découvrir sur son relevé.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les places accordées à la main
-- ---------------------------------------------------------------------------
-- Sur `firms` et non sur l'abonnement : elles survivent à un changement de
-- forfait, et un cabinet en essai ou en courtoisie peut en recevoir.

alter table public.firms add column if not exists extra_seats int not null default 0;

alter table public.firms drop constraint if exists firms_extra_seats_check;
alter table public.firms add constraint firms_extra_seats_check check (extra_seats >= 0);

comment on column public.firms.extra_seats is
  'Places accordées par l''exploitant en plus du forfait. Non facturées automatiquement : voir seat_requests et la tranche Stripe.';

-- ---------------------------------------------------------------------------
-- 2. Le plafond en tient compte
-- ---------------------------------------------------------------------------
-- Un plafond absent reste absent : ajouter des places à « sans limite » n'a
-- pas de sens, et produirait un nombre là où l'application attend NULL.

create or replace function public.firm_seat_limit(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select coalesce(
      (select s.seats
         from public.firm_subscriptions s
        where s.firm_id = f_id
          and s.status in ('active', 'trialing', 'past_due')),
      (select l.max_seats
         from public.plan_limits l
        where l.plan = public.firm_effective_plan(f_id))
    ) as n
  )
  select case
    when (select n from base) is null then null
    else (select n from base) + coalesce((select f.extra_seats from public.firms f where f.id = f_id), 0)
  end;
$$;

revoke all on function public.firm_seat_limit(uuid) from public;
grant execute on function public.firm_seat_limit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Les demandes
-- ---------------------------------------------------------------------------

create table if not exists public.seat_requests (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  requested_by   uuid references auth.users(id) on delete set null,
  requester_name text not null default '',
  -- Nombre demandé. Le type de membre visé est indicatif : une place est une
  -- place, et rien n'empêchera le cabinet d'y mettre quelqu'un d'autre.
  seats          int not null check (seats between 1 and 50),
  role_hint      text,
  justification  text,

  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'refused', 'info_requested')),
  -- Ce qui a réellement été accordé, qui peut différer du demandé.
  granted_seats  int not null default 0 check (granted_seats >= 0),
  response       text,
  handled_by     uuid references auth.users(id) on delete set null,
  handled_at     timestamptz,

  created_at     timestamptz not null default now()
);

create index if not exists seat_requests_firm_idx   on public.seat_requests (firm_id, created_at desc);
create index if not exists seat_requests_status_idx on public.seat_requests (status) where status = 'pending';

-- Une seule demande en attente par cabinet : sans cela, un clic répété en
-- empile dix, et l'exploitant traite dix fois la même chose.
create unique index if not exists seat_requests_une_seule_en_attente
  on public.seat_requests (firm_id) where status in ('pending', 'info_requested');

alter table public.seat_requests enable row level security;

-- Le cabinet lit son propre historique — y compris les refus. Une demande qui
-- disparaît sans trace laisse croire qu'elle n'a jamais été envoyée.
drop policy if exists seat_requests_read on public.seat_requests;
create policy seat_requests_read on public.seat_requests
  for select to authenticated
  using (firm_id = public.current_firm_id_unchecked() or public.is_platform_admin());

-- Demander exige firm.members : c'est la même personne qui invitera ensuite.
drop policy if exists seat_requests_create on public.seat_requests;
create policy seat_requests_create on public.seat_requests
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and public.member_can('firm.members')
    -- Un cabinet ne s'accorde rien à lui-même : il dépose une demande, et
    -- seul l'exploitant écrit `status` et `granted_seats`.
    and status = 'pending'
    and granted_seats = 0
  );

-- Répondre appartient à l'exploitant, et à lui seul. Aucune politique
-- d'UPDATE n'est ouverte au cabinet : il ne peut ni se répondre, ni effacer
-- un refus.
drop policy if exists seat_requests_admin on public.seat_requests;
create policy seat_requests_admin on public.seat_requests
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select f.name, f.extra_seats,
--          public.firm_seats_taken(f.id) || '/' ||
--            coalesce(public.firm_seat_limit(f.id)::text, '∞') as places
--     from public.firms f order by f.created_at;
--
--   ./cric sieges
-- ============================================================================
