-- ============================================================================
-- La page de réservation publique du cabinet
-- ============================================================================
--
-- `moncabinetcric.com/rdv/<cabinet>` : le client choisit un créneau libre et le
-- rendez-vous entre dans le calendrier du consultant. Remplace Calendly.
--
-- ─── CE QU'UNE PAGE OUVERTE À TOUS NE DOIT JAMAIS LAISSER VOIR ─────────────
--
-- La difficulté n'est pas d'afficher des créneaux : c'est de les afficher SANS
-- rien révéler d'autre. Un visiteur anonyme demande les disponibilités d'un
-- cabinet ; la réponse ne doit contenir aucun nom de client, aucun motif de
-- rendez-vous, aucun dossier — pour un consultant réglementé, le simple fait
-- qu'une personne soit sa cliente est confidentiel.
--
-- D'où deux fonctions étroites plutôt qu'une politique RLS ouverte à `anon` :
--
--   cabinet_public(slug)          le nom, le logo, la salle, les réglages
--   creneaux_pris(slug, du, au)   des INSTANTS, et rien d'autre
--
-- `creneaux_pris` ne rend ni identifiant, ni titre, ni client — seulement
-- « occupé de telle heure à telle heure ». Une politique RLS sur
-- `calendar_events` aurait, elle, exposé la ligne entière : c'est la raison
-- pour laquelle aucune politique `anon` n'existe dans cette base, et il ne faut
-- pas en créer une ici.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. L'adresse publique et les règles du cabinet
-- ---------------------------------------------------------------------------

alter table public.firms
  add column if not exists booking_slug          text,
  add column if not exists booking_enabled       boolean not null default false,
  add column if not exists booking_slot_minutes  integer not null default 30,
  -- Le préavis. Sans lui, on réserve le consultant pour dans dix minutes.
  add column if not exists booking_lead_hours    integer not null default 24,
  add column if not exists booking_horizon_days  integer not null default 30;

comment on column public.firms.booking_slug is
  'Identifiant de la page publique de réservation : /rdv/<slug>. Minuscules, '
  'chiffres et tirets. Unique sur toute la plateforme.';

comment on column public.firms.booking_lead_hours is
  'Préavis minimal, en heures. Un créneau plus proche que cela n''est pas '
  'offert : sans ce garde-fou, on réserverait le consultant pour dans dix '
  'minutes.';

alter table public.firms drop constraint if exists firms_booking_slug_forme;
alter table public.firms
  add constraint firms_booking_slug_forme
  check (booking_slug is null or booking_slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- Unique, mais seulement quand il existe : la plupart des cabinets n'auront
-- pas de page publique, et mille NULL ne doivent pas se heurter. Postgres tient
-- déjà deux NULL pour distincts, l'index simple suffit donc.
create unique index if not exists firms_booking_slug_unique
  on public.firms (booking_slug);

alter table public.firms drop constraint if exists firms_booking_reglages_sains;
alter table public.firms
  add constraint firms_booking_reglages_sains
  check (
        booking_slot_minutes between 10 and 240
    and booking_lead_hours   between 0  and 720
    and booking_horizon_days between 1  and 180
  );

-- ---------------------------------------------------------------------------
-- 2. Les plages hebdomadaires
-- ---------------------------------------------------------------------------

create table if not exists public.firm_availability (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  -- 0 = dimanche, conforme à Date.getDay() en JavaScript. Un décalage ici
  -- offrirait les créneaux du mauvais jour.
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  created_at timestamptz not null default now(),
  constraint firm_availability_ordre check (end_time > start_time)
);

comment on table public.firm_availability is
  'Plages hebdomadaires pendant lesquelles le cabinet accepte des rendez-vous. '
  '« Lundi au jeudi, 9 h-12 h et 13 h 30-17 h » tient en huit lignes.';

create index if not exists firm_availability_firm_jour
  on public.firm_availability (firm_id, weekday);

alter table public.firm_availability enable row level security;

drop policy if exists firm_availability_du_cabinet on public.firm_availability;
create policy firm_availability_du_cabinet on public.firm_availability
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Aucune politique pour `anon` : le public passe par les fonctions ci-dessous,
-- qui ne rendent que ce qu'il faut.
revoke all on table public.firm_availability from anon;

-- ---------------------------------------------------------------------------
-- 3. Ce que le public a le droit de savoir
-- ---------------------------------------------------------------------------

create or replace function public.cabinet_public(p_slug text)
returns table (
  firm_id uuid, nom text, logo_url text, salle text,
  slot_minutes integer, lead_hours integer, horizon_days integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select f.id, f.name, f.logo_url, f.meeting_room_url,
         f.booking_slot_minutes, f.booking_lead_hours, f.booking_horizon_days
    from public.firms f
   where f.booking_slug = p_slug
     -- L'interrupteur ET l'abonnement : un cabinet suspendu ne prend pas de
     -- rendez-vous, et sa page doit se fermer d'elle-même.
     and f.booking_enabled
     and f.status = 'active';
$$;

comment on function public.cabinet_public(text) is
  'Ce qu''une page de réservation a besoin de montrer, et rien de plus. '
  'Aucun courriel, aucun téléphone, aucun client.';

create or replace function public.plages_publiques(p_slug text)
returns table (weekday smallint, start_time time, end_time time)
language sql stable security definer set search_path = public, pg_temp
as $$
  select a.weekday, a.start_time, a.end_time
    from public.firm_availability a
    join public.firms f on f.id = a.firm_id
   where f.booking_slug = p_slug and f.booking_enabled and f.status = 'active'
   order by a.weekday, a.start_time;
$$;

/**
 * Les instants déjà occupés — SANS DIRE PAR QUI.
 *
 * Deux colonnes, et deux seulement. Ni identifiant, ni titre, ni client, ni
 * motif : un visiteur anonyme apprend qu'un cabinet est pris de 14 h à 15 h,
 * jamais qu'il reçoit Madame Une Telle pour une demande d'asile.
 */
create or replace function public.creneaux_pris(p_slug text, p_du date, p_au date)
returns table (debut timestamptz, fin timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    (e.date + coalesce(e.time::time, make_time(coalesce(e.hour, 9), 0, 0)))
      at time zone 'America/Toronto',
    (e.date + coalesce(e.time::time, make_time(coalesce(e.hour, 9), 0, 0))
      + make_interval(mins => coalesce(e.duration_minutes, 60)))
      at time zone 'America/Toronto'
  from public.calendar_events e
  join public.firms f on f.id = e.firm_id
  where f.booking_slug = p_slug
    and f.booking_enabled
    and e.date between p_du and p_au
    -- Un rendez-vous annulé libère son créneau.
    and coalesce(e.status, 'confirmed') <> 'cancelled';
$$;

comment on function public.creneaux_pris(text, date, date) is
  'Les instants occupés d''un cabinet, pour une page publique. Ne rend NI '
  'identifiant, NI titre, NI client : pour un consultant réglementé, le fait '
  'qu''une personne soit sa cliente est confidentiel.';

revoke all on function public.cabinet_public(text) from public;
revoke all on function public.plages_publiques(text) from public;
revoke all on function public.creneaux_pris(text, date, date) from public;
grant execute on function public.cabinet_public(text) to anon, authenticated;
grant execute on function public.plages_publiques(text) to anon, authenticated;
grant execute on function public.creneaux_pris(text, date, date) to anon, authenticated;

commit;
