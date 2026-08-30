-- ============================================================================
-- Durcir la réservation publique
-- ============================================================================
--
-- Correctif EN AVANT des six migrations de la nuit du 20 au 21 août. Celles-ci
-- sont déjà appliquées : rien ici ne les réécrit, tout s'ajoute par-dessus.
--
-- Ce que ce fichier ferme, dans l'ordre de gravité :
--
--   1. `cabinet_public` rendait `meeting_room_url` au rôle `anon`. La salle de
--      rencontre est PERMANENTE et commune à tous les clients du cabinet :
--      qui la connaît peut se présenter à n'importe quelle consultation.
--   2. `creneaux_pris` ignorait `f.status` et n'avait aucune borne de plage —
--      un cabinet suspendu diffusait encore son calendrier, et une seule
--      requête rendait tout son historique d'occupation.
--   3. `e.time::time` s'appliquait à une colonne `text` sans contrainte, dont
--      le défaut est la chaîne vide. Une seule ligne mal formée faisait tomber
--      la page publique en silence.
--   4. Le verrou consultatif portait sur la MINUTE de début. C'est exactement
--      ce que l'en-tête de `reserver_un_creneau` reproche à l'index unique :
--      14 h et 14 h 15 ne partagent aucune clé, donc aucune sérialisation.
--   5. Le quota de réservations vivait dans la Server Action, hors du chemin
--      PostgREST. La fonction est appelable avec la clé publique du bundle.
--   6. Courriel et téléphone étaient écrits en texte libre dans `notes` :
--      aucun consentement horodaté, aucune voie de suppression. Loi 25, art. 28.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Lire l'heure d'un événement sans jamais lever
-- ---------------------------------------------------------------------------
--
-- `calendar_events.time` est un TEXT dont le défaut est '' (schéma initial), et
-- `createEvent` y écrit ce qu'on lui donne. Or `''::time` lève 22007, et
-- `coalesce` ne rattrape rien : le cast est évalué AVANT que le coalesce ne
-- voie un NULL. Une seule ligne à '' ou à '9h30' suffisait donc à faire
-- échouer `creneaux_pris` pour tous les visiteurs du cabinet — et l'erreur
-- était avalée côté application, qui affichait « aucune disponibilité ».
--
-- On vérifie la forme AVANT de convertir. Le CASE n'évalue que la branche
-- retenue : la conversion ne s'exécute que sur une chaîne dont la syntaxe est
-- déjà garantie. Pas de bloc d'exception, donc pas de sous-transaction par
-- ligne.

create or replace function public.heure_evenement(p_time text, p_hour integer)
returns time
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when btrim(coalesce(p_time, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
      then btrim(p_time)::time
    else make_time(least(greatest(coalesce(p_hour, 9), 0), 23), 0, 0)
  end;
$$;

comment on function public.heure_evenement(text, integer) is
  'L''heure d''un événement, quelle que soit la propreté de `calendar_events.time`. '
  'Cette colonne est un TEXT sans contrainte dont le défaut est la chaîne vide : '
  'un cast direct lève 22007 et fait tomber la page publique. Repli sur `hour`.';

-- ---------------------------------------------------------------------------
-- 2. La salle de rencontre ne descend plus au public
-- ---------------------------------------------------------------------------
--
-- La page n'avait besoin que de SAVOIR s'il y a une salle, pour annoncer
-- « en visioconférence » : `app/[locale]/rdv/[slug]/page.tsx` ne transmettait
-- déjà qu'un booléen. Mais une fonction accordée à `anon` s'appelle en RPC
-- direct, sans passer par l'écran — la prudence de l'application ne protégeait
-- pas la fonction. On rend donc le booléen lui-même.
--
-- Le courriel de confirmation n'en souffre pas : `reservation-actions.ts`
-- relit `meeting_room_url` côté serveur avec la clé de service, après coup.
--
-- Le type de retour change, donc `create or replace` ne suffit pas.

drop function if exists public.cabinet_public(text);

create function public.cabinet_public(p_slug text)
returns table (
  firm_id uuid, nom text, logo_url text, a_une_salle boolean,
  slot_minutes integer, lead_hours integer, horizon_days integer
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select f.id, f.name, f.logo_url,
         coalesce(nullif(btrim(f.meeting_room_url), ''), '') <> '',
         f.booking_slot_minutes, f.booking_lead_hours, f.booking_horizon_days
    from public.firms f
   where f.booking_slug = p_slug
     and f.booking_enabled
     and f.status = 'active';
$$;

comment on function public.cabinet_public(text) is
  'Ce qu''une page de réservation a besoin de montrer, et rien de plus. Aucun '
  'courriel, aucun téléphone, aucun client — et PAS l''adresse de la salle de '
  'rencontre : elle est permanente et commune à tous les clients du cabinet, '
  'donc qui la lit peut se présenter à n''importe quelle consultation.';

-- ---------------------------------------------------------------------------
-- 3. Les instants occupés : bornés, et fermés avec l'abonnement
-- ---------------------------------------------------------------------------
--
-- Deux manques, tous deux exploitables sans compte :
--
--   • `f.status` n'était pas vérifié, alors que `cabinet_public` et
--     `plages_publiques` le font. Un cabinet suspendu fermait sa page mais
--     continuait de répondre à qui appelait la fonction.
--   • Aucune borne : `creneaux_pris(slug, '1900-01-01', '2999-12-31')` rendait
--     l'historique complet. Le contenu reste anodin — deux colonnes, aucun nom
--     — mais l'agrégat ne l'est pas : volume, rythme, jours de fermeture. Et
--     si l'appelant sait par ailleurs qu'une personne avait rendez-vous tel
--     jour, la présence de l'intervalle le lui CONFIRME. Pour un consultant
--     réglementé, le fait qu'une personne soit sa cliente est confidentiel.
--
-- On borne en silence plutôt qu'en levant : une page de réservation ne demande
-- jamais plus de `booking_horizon_days + 2`, plafonné à 180 par
-- `firms_booking_reglages_sains`. Aucun appel légitime n'est rogné.

create or replace function public.creneaux_pris(p_slug text, p_du date, p_au date)
returns table (debut timestamptz, fin timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    (e.date + public.heure_evenement(e.time, e.hour)) at time zone 'America/Toronto',
    (e.date + public.heure_evenement(e.time, e.hour)
      + make_interval(mins => coalesce(e.duration_minutes, 60)))
      at time zone 'America/Toronto'
  from public.calendar_events e
  join public.firms f on f.id = e.firm_id
  where f.booking_slug = p_slug
    and f.booking_enabled
    and f.status = 'active'
    -- Le passé ne sert à personne pour réserver, et le livrer dessine le
    -- carnet de commandes du cabinet.
    and e.date between greatest(p_du, current_date)
                   and least(p_au, current_date + 200)
    -- Un rendez-vous annulé libère son créneau.
    and coalesce(e.status, 'confirmed') <> 'cancelled';
$$;

comment on function public.creneaux_pris(text, date, date) is
  'Les instants occupés d''un cabinet, pour une page publique. Ne rend NI '
  'identifiant, NI titre, NI client. Bornée au futur et à 200 jours : sans '
  'cela, un seul appel dessinait tout le carnet de commandes du consultant.';

-- ---------------------------------------------------------------------------
-- 4. Les renseignements personnels sortent du texte libre
-- ---------------------------------------------------------------------------
--
-- `reserver_creneau` écrivait le courriel et le téléphone DANS `notes`, faute
-- de colonne où les mettre. Conséquence : impossible de retrouver ce qu'on
-- détient sur une personne autrement qu'avec un LIKE sur toute la table,
-- impossible de prouver quand elle a consenti, impossible de supprimer.
--
-- La Loi 25 et la LPRPDE demandent les trois. D'où une table dédiée, et une
-- fonction d'oubli qui efface AUSSI la copie logée dans `notes` — sans quoi la
-- suppression ne serait qu'apparente.

create table if not exists public.reservations_publiques (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms(id) on delete cascade,
  -- Le rendez-vous supprimé emporte les coordonnées : elles n'ont pas d'autre
  -- raison d'exister.
  event_id        uuid references public.calendar_events(id) on delete cascade,
  nom             text not null,
  courriel        text not null,
  telephone       text,
  motif           text,
  -- L'instant du consentement, pas celui de la ligne : c'est lui qu'il faut
  -- pouvoir montrer si la personne le demande.
  consentement_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.reservations_publiques is
  'Les coordonnées laissées par un visiteur sur la page publique. Séparées de '
  '`calendar_events` pour qu''un droit d''accès ou de suppression (Loi 25, '
  'LPRPDE) soit exécutable : ici on retrouve, on date, et on efface.';

create index if not exists reservations_publiques_cabinet
  on public.reservations_publiques (firm_id, created_at desc);
create index if not exists reservations_publiques_courriel
  on public.reservations_publiques (lower(courriel));
-- Unique : un rendez-vous ne porte qu'un jeu de coordonnées. C'est aussi ce qui
-- rend la reprise ci-dessous rejouable sans créer de doublon.
create unique index if not exists reservations_publiques_evenement
  on public.reservations_publiques (event_id);

alter table public.reservations_publiques enable row level security;

drop policy if exists reservations_publiques_du_cabinet on public.reservations_publiques;
create policy reservations_publiques_du_cabinet on public.reservations_publiques
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Le public n'y touche jamais : il écrit à travers `reserver_creneau`, qui est
-- `security definer`.
revoke all on table public.reservations_publiques from anon;

-- ── Reprise de l'existant ───────────────────────────────────────────────────
--
-- Les réservations déjà prises portent leurs coordonnées dans `notes`, sous la
-- forme « Réservé en ligne — courriel — téléphone ». On les extrait. Le
-- consentement est daté de la création du rendez-vous : c'est une déduction,
-- non un enregistrement — la distinction compte si la donnée est un jour
-- produite en preuve.

insert into public.reservations_publiques
  (firm_id, event_id, nom, courriel, telephone, motif, consentement_at, created_at)
select
  e.firm_id,
  e.id,
  nullif(btrim(e.client_name), ''),
  x.m[1],
  nullif(btrim(coalesce(x.m[3], '')), ''),
  nullif(btrim(e.title), ''),
  e.created_at,
  e.created_at
from public.calendar_events e
cross join lateral (
  select regexp_match(e.notes, '^Réservé en ligne — ([^[:space:]]+@[^[:space:]]+?)( — (.+))?$') as m
) x
where e.source = 'reservation'
  and x.m is not null
  and btrim(coalesce(e.client_name, '')) <> ''
  and not exists (
    select 1 from public.reservations_publiques r where r.event_id = e.id
  );

/**
 * Oublier une réservation, pour de bon.
 *
 * Efface la ligne structurée ET la trace laissée dans `notes` : une suppression
 * qui laisserait le courriel dans le champ libre n'en serait pas une.
 *
 * Le cabinet n'est pas un paramètre — il est déduit de la session. Une fonction
 * `security definer` qui accepte le cabinet en argument laisse son appelant
 * choisir la victime.
 */
create or replace function public.oublier_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cible record;
begin
  select r.id, r.event_id, r.firm_id
    into cible
    from public.reservations_publiques r
   where r.id = p_reservation_id
     and r.firm_id = public.current_firm_id();

  if cible.id is null then
    return false;
  end if;

  if cible.event_id is not null then
    update public.calendar_events
       set notes = 'Coordonnées supprimées à la demande de la personne, le '
                   || to_char(now() at time zone 'America/Toronto', 'YYYY-MM-DD')
     where id = cible.event_id
       and firm_id = cible.firm_id;
  end if;

  delete from public.reservations_publiques where id = cible.id;
  return true;
end;
$$;

comment on function public.oublier_reservation(uuid) is
  'Supprime les coordonnées d''une réservation publique, y compris la copie '
  'logée dans `calendar_events.notes`. Le cabinet vient de la session, jamais '
  'd''un paramètre.';

revoke all on function public.oublier_reservation(uuid) from public;
grant execute on function public.oublier_reservation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Le compteur de réservations, EN BASE
-- ---------------------------------------------------------------------------
--
-- Le quota de trois par heure vit dans `lib/securite/limiter.ts`, c'est-à-dire
-- dans la Server Action. Mais `reserver_creneau` est accordée à `anon`, et la
-- clé anonyme est publiée dans le bundle du navigateur : un script poste
-- directement sur /rest/v1/rpc/ et ne voit jamais ce quota.
--
-- Limite connue, assumée : la fonction s'exécute dans une seule transaction,
-- donc un essai REFUSÉ voit son compteur annulé avec le reste. Ce compteur
-- borne les écritures RÉUSSIES — celles qui remplissent l'agenda. Freiner les
-- essais infructueux relève de la couche HTTP, pas de Postgres.

create table if not exists public.reservations_tentatives (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references public.firms(id) on delete cascade,
  -- Le courriel normalisé. Pas d'adresse IP : on n'en dispose pas ici, et en
  -- conserver une serait un renseignement personnel de plus à justifier.
  empreinte  text not null,
  created_at timestamptz not null default now()
);

comment on table public.reservations_tentatives is
  'Compteur de réservations abouties, pour brider un robot qui appellerait '
  '`reserver_creneau` directement avec la clé publique. Purgeable sans perte.';

create index if not exists reservations_tentatives_cabinet
  on public.reservations_tentatives (firm_id, created_at desc);
create index if not exists reservations_tentatives_empreinte
  on public.reservations_tentatives (empreinte, created_at desc);

alter table public.reservations_tentatives enable row level security;
revoke all on table public.reservations_tentatives from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. `reserver_creneau` : le verrou au bon endroit, et les gardes manquantes
-- ---------------------------------------------------------------------------
--
-- ─── POURQUOI LE VERROU CHANGE DE CLÉ ──────────────────────────────────────
--
-- Il portait sur (cabinet, minute de début). C'est précisément le reproche que
-- l'en-tête d'origine adresse à l'index unique : « 14 h-15 h chevauche
-- 14 h 30-15 h sans partager aucune clé ». Deux demandes à 14 h 00 et 14 h 15
-- prenaient donc deux verrous distincts, ne se voyaient pas en READ COMMITTED,
-- et passaient toutes les deux.
--
-- Le verrou porte désormais sur le CABINET. Les réservations sont rares — un
-- consultant, quelques par jour — et sérialiser par cabinet ne coûte rien,
-- alors que sérialiser par minute ne garantit rien.
--
-- ─── CE QUI RESTE OUVERT, ET QUI SE DÉCIDE AILLEURS ────────────────────────
--
-- `createEvent` (writes.ts) insère dans `calendar_events` sans verrou ni test
-- de chevauchement. Un rendez-vous saisi à la main pendant qu'un visiteur
-- réserve peut donc encore se superposer. Une contrainte d'exclusion GiST
-- fermerait le cas définitivement — mais elle interdirait AUSSI les
-- chevauchements légitimes du calendrier (un rappel posé sur une rencontre),
-- ce qui n'est pas une décision à prendre dans un correctif de sécurité.

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
  courriel_net  text;
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

  -- ── Les longueurs ───────────────────────────────────────────────────────
  --
  -- Rien ne les bornait : chaque champ partait tel quel dans `title`,
  -- `client_name` et `notes`, donc une seule réservation pouvait peser
  -- plusieurs mégaoctets. Les limites sont larges — un nom légitime n'atteint
  -- jamais 120 caractères.
  if length(trim(p_nom)) > 120
     or length(trim(p_courriel)) > 200
     or length(coalesce(trim(p_telephone), '')) > 40
     or length(coalesce(trim(p_motif), '')) > 500 then
    raise exception 'Un des champs dépasse la longueur permise.'
      using errcode = 'check_violation';
  end if;

  courriel_net := lower(trim(p_courriel));

  -- ── LE VERROU ───────────────────────────────────────────────────────────
  -- Sur le CABINET, non sur la minute : deux créneaux voisins se chevauchent
  -- sans partager de clé horaire. Voir l'en-tête.
  perform pg_advisory_xact_lock(hashtext('reserver_creneau'), hashtext(cab.id::text));

  -- ── Le quota, une fois le verrou tenu ───────────────────────────────────
  if (
    select count(*) from public.reservations_tentatives t
     where t.empreinte = courriel_net and t.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Trop de réservations depuis cette adresse. Réessayez dans une heure.'
      using errcode = 'check_violation';
  end if;

  if (
    select count(*) from public.reservations_tentatives t
     where t.firm_id = cab.id and t.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Ce cabinet reçoit trop de demandes en ce moment. Réessayez plus tard.'
      using errcode = 'check_violation';
  end if;

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
         (e.date + public.heure_evenement(e.time, e.hour)) at time zone 'America/Toronto',
         (e.date + public.heure_evenement(e.time, e.hour)
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
  -- `notes` garde le courriel lisible, parce que c'est là que le consultant
  -- le cherche dans son calendrier. La copie qui fait FOI vit désormais dans
  -- `reservations_publiques`, avec sa date de consentement et sa voie de
  -- suppression : `oublier_reservation()` efface les deux d'un coup.
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
    'Réservé en ligne — ' || courriel_net
      || case when coalesce(trim(p_telephone), '') <> ''
              then ' — ' || trim(p_telephone) else '' end
  )
  returning id into nouvel_id;

  insert into public.reservations_publiques
    (firm_id, event_id, nom, courriel, telephone, motif)
  values (
    cab.id, nouvel_id, trim(p_nom), courriel_net,
    nullif(trim(coalesce(p_telephone, '')), ''),
    nullif(trim(coalesce(p_motif, '')), '')
  );

  insert into public.reservations_tentatives (firm_id, empreinte)
  values (cab.id, courriel_net);

  return nouvel_id;
end;
$$;

comment on function public.reserver_creneau(text, timestamptz, text, text, text, text) is
  'Réserve un créneau depuis la page publique. Sérialise par CABINET — non par '
  'minute, qui ne garantissait rien pour deux créneaux voisins — puis revérifie '
  'le chevauchement DANS la transaction qui écrit. Borne les longueurs et le '
  'nombre de réservations par heure, l''écran n''étant pas sur le chemin d''un '
  'appel RPC direct.';

-- ---------------------------------------------------------------------------
-- 7. Trois lignes d'hygiène, tant qu'on y est
-- ---------------------------------------------------------------------------

-- Le grant à `authenticated` n'ajoutait aucun privilège — l'application appelle
-- toujours avec la clé anonyme — mais il offrait à tout compte connecté, y
-- compris suspendu, un chemin d'écriture `security definer` vers N'IMPORTE
-- QUEL cabinet.
revoke execute on function
  public.reserver_creneau(text, timestamptz, text, text, text, text)
  from authenticated;

-- Reliquat de `20260803140000_public_operator_grant.sql`. La politique qui
-- l'accompagnait a été retirée le 16/08, donc ce grant ne rend plus aucune
-- ligne — la RLS refuse par défaut. Il n'a plus de raison d'exister, et le
-- laisser signifierait qu'une future politique `anon` sur `firms` ouvrirait
-- les 40 colonnes d'un coup.
revoke select on public.firms from anon;

-- Rien n'empêchait deux plages identiques pour un même jour : un double clic
-- dans les réglages, et le visiteur voyait chaque horaire en double.
--
-- On dédoublonne d'abord, sinon l'index unique échouerait et emporterait avec
-- lui tout le correctif de sécurité de ce fichier. Ne sont supprimées que des
-- lignes RIGOUREUSEMENT identiques — même cabinet, même jour, mêmes bornes —
-- dont on garde la première. Aucune plage déclarée ne disparaît.
delete from public.firm_availability a
 using public.firm_availability b
 where a.firm_id    = b.firm_id
   and a.weekday    = b.weekday
   and a.start_time = b.start_time
   and a.end_time   = b.end_time
   and a.id > b.id;

create unique index if not exists firm_availability_sans_doublon
  on public.firm_availability (firm_id, weekday, start_time, end_time);

revoke all on function public.cabinet_public(text) from public;
grant execute on function public.cabinet_public(text) to anon, authenticated;

commit;
