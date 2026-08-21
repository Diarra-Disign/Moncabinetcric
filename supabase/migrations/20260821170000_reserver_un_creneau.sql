-- ============================================================================
-- Réserver un créneau, sans jamais en donner deux fois le même
-- ============================================================================
--
-- ─── LA COURSE, ET POURQUOI ELLE N'EST PAS THÉORIQUE ───────────────────────
--
-- Deux visiteurs ouvrent la page, voient tous deux « mardi 14 h libre », et
-- cliquent à une seconde d'intervalle. Vérifier en JavaScript puis écrire ne
-- suffit pas : entre la vérification et l'écriture, l'autre est passé. Le
-- consultant se retrouve avec deux clients à 14 h, l'apprend le jour même, et
-- doit en renvoyer un.
--
-- La parade tient en deux lignes de cette fonction :
--
--   1. `pg_advisory_xact_lock` sérialise les prétendants au MÊME créneau. Les
--      autres créneaux ne sont pas gênés — le verrou porte sur le couple
--      (cabinet, instant), non sur la table.
--   2. La vérification de chevauchement se fait APRÈS le verrou, donc dans la
--      même transaction que l'écriture. Le second candidat lit un calendrier
--      qui contient déjà le rendez-vous du premier.
--
-- Un index unique n'aurait pas suffi : les rendez-vous ont des durées
-- variables, et 14 h-15 h chevauche 14 h 30-15 h sans partager aucune clé.
--
-- ─── POURQUOI ELLE LÈVE, ALORS QUE LES AUTRES RENDENT VIDE ─────────────────
--
-- Les fonctions de lecture de cette base rendent une liste vide quand l'accès
-- est refusé. Celle-ci écrit, et son échec doit être VU : un client qui croit
-- avoir un rendez-vous et n'en a pas se présente devant une porte fermée. Le
-- message est rédigé pour être montré tel quel.
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.reserver_creneau(
  p_slug     text,
  p_debut    timestamptz,
  p_nom      text,
  p_courriel text,
  p_telephone text default null,
  p_motif    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cab           record;
  duree         integer;
  fin           timestamptz;
  local_debut   timestamp;
  nouvel_id     uuid;
begin
  -- ── Le cabinet, et son ouverture ────────────────────────────────────────
  select f.id, f.booking_slot_minutes, f.booking_lead_hours,
         f.booking_horizon_days, f.meeting_room_url
    into cab
    from public.firms f
   where f.booking_slug = p_slug and f.booking_enabled and f.status = 'active';

  if cab.id is null then
    raise exception 'Cette page de réservation n''est pas disponible.'
      using errcode = 'no_data_found';
  end if;

  duree := cab.booking_slot_minutes;
  fin   := p_debut + make_interval(mins => duree);

  -- ── Les bornes, revérifiées ICI ─────────────────────────────────────────
  --
  -- L'écran les respecte déjà, mais l'écran n'est pas une garde : la fonction
  -- est appelable directement avec la clé publique. Un robot qui poste
  -- « demain 3 h du matin » doit être refusé par la base, pas par le
  -- JavaScript qu'il n'a pas exécuté.
  if p_debut < now() + make_interval(hours => cab.booking_lead_hours) then
    raise exception 'Ce créneau est trop proche. Choisissez un moment plus éloigné.'
      using errcode = 'check_violation';
  end if;

  if p_debut > now() + make_interval(days => cab.booking_horizon_days) then
    raise exception 'Ce créneau est trop éloigné dans le temps.'
      using errcode = 'check_violation';
  end if;

  if coalesce(trim(p_nom), '') = '' or coalesce(trim(p_courriel), '') = '' then
    raise exception 'Votre nom et votre courriel sont nécessaires.'
      using errcode = 'check_violation';
  end if;

  if p_courriel !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'Cette adresse de courriel ne semble pas valide.'
      using errcode = 'check_violation';
  end if;

  -- ── LE VERROU ───────────────────────────────────────────────────────────
  -- Deux entiers dérivés du cabinet et de l'instant. Deux prétendants au même
  -- créneau attendent l'un après l'autre ; un créneau voisin n'attend pas.
  perform pg_advisory_xact_lock(
    hashtext(cab.id::text),
    hashtext(to_char(p_debut at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI'))
  );

  -- ── L'instant demandé tombe-t-il dans une plage déclarée ? ──────────────
  local_debut := p_debut at time zone 'America/Toronto';

  if not exists (
    select 1 from public.firm_availability a
     where a.firm_id = cab.id
       and a.weekday = extract(dow from local_debut)::smallint
       and local_debut::time >= a.start_time
       and (local_debut + make_interval(mins => duree))::time <= a.end_time
  ) then
    raise exception 'Ce moment ne fait pas partie des disponibilités du cabinet.'
      using errcode = 'check_violation';
  end if;

  -- ── Le chevauchement, APRÈS le verrou ───────────────────────────────────
  -- `(a, b) overlaps (c, d)` est l'opérateur de Postgres pour cela : il traite
  -- correctement les bornes, là où une comparaison à la main se trompe d'un
  -- côté et laisse deux rendez-vous se toucher.
  if exists (
    select 1 from public.calendar_events e
     where e.firm_id = cab.id
       and coalesce(e.status, 'confirmed') <> 'cancelled'
       and e.date between (p_debut at time zone 'America/Toronto')::date - 1
                      and (p_debut at time zone 'America/Toronto')::date + 1
       and (
         (e.date + coalesce(e.time::time, make_time(coalesce(e.hour, 9), 0, 0))) at time zone 'America/Toronto',
         (e.date + coalesce(e.time::time, make_time(coalesce(e.hour, 9), 0, 0))
            + make_interval(mins => coalesce(e.duration_minutes, 60))) at time zone 'America/Toronto'
       ) overlaps (p_debut, fin)
  ) then
    raise exception 'Ce créneau vient d''être pris. Choisissez-en un autre.'
      using errcode = 'unique_violation';
  end if;

  -- ── L'écriture ──────────────────────────────────────────────────────────
  --
  -- `client_id` reste NULL : un inconnu qui réserve n'est pas encore un
  -- client, et créer une fiche à chaque réservation remplirait la liste
  -- d'essais et d'annulations. Le consultant convertit s'il le décide.
  --
  -- Le courriel va dans `notes` : c'est par lui qu'on rappellera la personne,
  -- et il n'a pas d'autre colonne où vivre.
  insert into public.calendar_events (
    firm_id, title, client_name, type, platform, link,
    date, time, hour, duration_minutes, status, source, notes
  ) values (
    cab.id,
    coalesce(nullif(trim(p_motif), ''), 'Consultation'),
    trim(p_nom),
    'consultation',
    case when coalesce(cab.meeting_room_url, '') <> '' then 'google_meet' else null end,
    nullif(cab.meeting_room_url, ''),
    local_debut::date,
    to_char(local_debut, 'HH24:MI'),
    extract(hour from local_debut)::int,
    duree,
    'confirmed',
    'reservation',
    'Réservé en ligne — ' || trim(p_courriel)
      || case when coalesce(trim(p_telephone), '') <> ''
              then ' — ' || trim(p_telephone) else '' end
  )
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;

comment on function public.reserver_creneau(text, timestamptz, text, text, text, text) is
  'Réserve un créneau depuis la page publique. Sérialise les prétendants au '
  'même créneau par un verrou consultatif, puis revérifie le chevauchement '
  'DANS la transaction qui écrit : deux clics simultanés ne produisent jamais '
  'deux rendez-vous superposés.';

-- La source « reservation » rejoint « manuel » et « calendly ».
alter table public.calendar_events drop constraint if exists calendar_events_source_connue;
alter table public.calendar_events
  add constraint calendar_events_source_connue
  check (source in ('manuel', 'calendly', 'reservation'));

revoke all on function public.reserver_creneau(text, timestamptz, text, text, text, text) from public;
grant execute on function public.reserver_creneau(text, timestamptz, text, text, text, text) to anon, authenticated;

commit;
