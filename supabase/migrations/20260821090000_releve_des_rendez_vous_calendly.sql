-- ============================================================================
-- La relève des rendez-vous Calendly
-- ============================================================================
--
-- ─── POURQUOI L'APPLICATION DEMANDE, AU LIEU D'ÊTRE PRÉVENUE ───────────────
--
-- La voie normale serait un webhook : Calendly appelle l'application au moment
-- où un client réserve. Elle est fermée — les webhooks Calendly exigent un
-- abonnement payant, et le cabinet est au forfait gratuit.
--
-- Mais la documentation de Calendly dit deux fois, en deux pages, que l'API de
-- LECTURE reste ouverte à tous les forfaits : seuls trois points d'accès sont
-- réservés à Enterprise, et ce sont les journaux d'activité et deux
-- suppressions. Lister les rendez-vous n'en fait pas partie.
--
-- D'où ce chantier : l'application interroge Calendly quand on ouvre le
-- calendrier, au lieu d'attendre un appel qui ne viendra jamais.
--
-- ─── LE JETON NE PEUT PAS VIVRE DANS `firms` ───────────────────────────────
--
-- Un jeton d'accès personnel Calendly lit TOUT le compte : tous les rendez-vous,
-- tous les types d'événement, l'agenda entier du consultant. Calendly ne permet
-- pas de le restreindre à un seul usage.
--
-- Or `firms` est lue par l'écran de réglages, et son contenu part au navigateur.
-- Y ranger le jeton l'exposerait à quiconque ouvre les outils de développement.
-- Il lui faut donc sa propre table, et cette table est FERMÉE :
--
--     alter table … enable row level security;      ← et AUCUNE politique
--
-- La RLS activée sans politique vaut refus pour tout le monde. Seule la clé de
-- service — donc le serveur, jamais le navigateur — peut lire cette table. Ce
-- n'est pas un oubli de politique : c'est la politique.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le raccordement du cabinet à son compte Calendly
-- ---------------------------------------------------------------------------

create table if not exists public.firm_calendly (
  firm_id            uuid primary key references public.firms(id) on delete cascade,

  -- Le secret. Ne quitte jamais le serveur.
  access_token       text not null,

  -- L'URI du compte Calendly, résolue une fois par `GET /users/me` au moment
  -- où le jeton est enregistré. La stocker évite un appel réseau à chaque
  -- relève — et vérifie du même coup que le jeton fonctionne AVANT de
  -- l'écrire : un jeton refusé n'est jamais enregistré.
  calendly_user_uri  text,

  last_synced_at     timestamptz,

  -- La dernière erreur, montrée dans les réglages. Sans elle, un jeton révoqué
  -- se traduirait par un calendrier qui cesse simplement de se remplir, sans
  -- que personne ne sache pourquoi.
  last_error         text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.firm_calendly is
  'Raccordement d''un cabinet à son compte Calendly. FERMÉE PAR RLS SANS '
  'AUCUNE POLITIQUE : le jeton lit tout le compte Calendly du consultant et ne '
  'doit jamais atteindre le navigateur. Seule la clé de service y accède.';

alter table public.firm_calendly enable row level security;

-- Aucune politique, volontairement. Voir l'en-tête.
revoke all on table public.firm_calendly from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. D'où vient un rendez-vous, et lequel est-ce chez Calendly
-- ---------------------------------------------------------------------------

alter table public.calendar_events
  add column if not exists source text not null default 'manuel';

alter table public.calendar_events
  add column if not exists external_id text;

alter table public.calendar_events
  drop constraint if exists calendar_events_source_connue;

alter table public.calendar_events
  add constraint calendar_events_source_connue
  check (source in ('manuel', 'calendly'));

comment on column public.calendar_events.source is
  'Qui a créé ce rendez-vous : « manuel » (saisi dans l''application) ou '
  '« calendly » (relevé chez le fournisseur). Un rendez-vous relevé se '
  'reconnaît, donc se remplace sans écraser une saisie du consultant.';

comment on column public.calendar_events.external_id is
  'Identifiant de l''événement chez le fournisseur. Null pour une saisie '
  'manuelle.';

-- ---------------------------------------------------------------------------
-- 3. LA PIÈCE QUI EMPÊCHE LA DUPLICATION
-- ---------------------------------------------------------------------------
--
-- La relève tourne à chaque ouverture du calendrier. Sans cet index, la
-- deuxième ouverture recréerait tous les rendez-vous déjà relevés, la
-- troisième aussi, et le calendrier deviendrait illisible en une journée.
--
-- Partiel — `where external_id is not null` — parce que les saisies manuelles
-- n'ont pas d'identifiant externe : sans cette clause, deux rendez-vous saisis
-- à la main se heurteraient sur (firm_id, 'manuel', null).

create unique index if not exists calendar_events_source_externe_unique
  on public.calendar_events (firm_id, source, external_id)
  where external_id is not null;

commit;
