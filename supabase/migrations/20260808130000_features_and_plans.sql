-- ============================================================================
-- Catalogue : forfaits, fonctionnalités, exceptions
-- ============================================================================
--
-- Trois choses vivaient jusqu'ici en dur, chacune à un endroit différent :
--
--   · les prix, dans lib/billing/plans.ts, donc dans le code déployé ;
--   · les droits, dans plan_limits, avec deux colonnes en tout et pour tout
--     (max_seats, ai_connector) ;
--   · la liste des forfaits, dans une contrainte CHECK à quatre valeurs.
--
-- Ajouter un forfait demandait donc de modifier une contrainte, un fichier
-- TypeScript et un déploiement. Accorder exceptionnellement une fonctionnalité
-- à un cabinet était tout simplement impossible.
--
-- Cette migration fait du catalogue une donnée. Trois tables et une règle de
-- résolution en trois temps :
--
--   1. une fonctionnalité « toujours incluse » l'est, sans condition ;
--   2. sinon, une exception accordée au cabinet fait foi ;
--   3. sinon, le forfait effectivement payé décide.
--
-- Ce qui n'y est PAS, volontairement : aucune fonctionnalité qui n'existe pas
-- dans l'application. La tentation est grande de semer « rapports avancés » ou
-- « intégration fiscale » pour garnir la grille — c'est ainsi que la page
-- publique s'est retrouvée à promettre des choses qu'il a fallu retirer une
-- par une. Une ligne n'est ajoutée ici que lorsque le code qui la tient
-- existe.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les forfaits deviennent une donnée
-- ---------------------------------------------------------------------------
-- plan_limits garde son nom malgré son nouveau rôle : firm_subscriptions.plan
-- la référence, connector_firm() et firm_seat_limit() la joignent. Un
-- renommage n'apporterait rien qu'un risque, sur une base en service.

alter table public.plan_limits add column if not exists rank                     int not null default 100;
-- Souscriptible par le cabinet lui-même, depuis Réglages → Abonnement.
-- « trial » et « courtoisie » s'accordent, « enterprise » se négocie : aucun
-- des trois ne doit apparaître dans un tunnel de paiement.
alter table public.plan_limits add column if not exists purchasable              boolean not null default false;
-- Montants en cents CAD. NULL = pas de tarif public (sur mesure).
alter table public.plan_limits add column if not exists monthly_cents            int;
alter table public.plan_limits add column if not exists annual_cents             int;
alter table public.plan_limits add column if not exists extra_seat_monthly_cents int not null default 0;
alter table public.plan_limits add column if not exists extra_seat_annual_cents  int not null default 0;
-- Places comprises dans le prix de base. Distinct de max_seats : Cabinet Pro
-- en comprend trois et n'en plafonne aucune.
alter table public.plan_limits add column if not exists seats_included           int not null default 1;
alter table public.plan_limits add column if not exists tagline_fr               text;
alter table public.plan_limits add column if not exists tagline_en               text;
alter table public.plan_limits add column if not exists updated_at               timestamptz not null default now();

-- Les montants ne peuvent pas être négatifs, et un prix annuel inférieur à un
-- mois n'a aucun sens : une faute de frappe dans l'administration facturerait
-- l'année au prix du mois.
alter table public.plan_limits drop constraint if exists plan_limits_amounts_check;
alter table public.plan_limits add constraint plan_limits_amounts_check check (
  coalesce(monthly_cents, 0) >= 0
  and coalesce(annual_cents, 0) >= 0
  and extra_seat_monthly_cents >= 0
  and extra_seat_annual_cents >= 0
  and seats_included >= 1
  and (annual_cents is null or monthly_cents is null or annual_cents >= monthly_cents)
);

-- Un forfait souscriptible doit avoir un prix : sans cela, le tunnel de
-- paiement se déclencherait sur un montant nul.
alter table public.plan_limits drop constraint if exists plan_limits_purchasable_check;
alter table public.plan_limits add constraint plan_limits_purchasable_check check (
  not purchasable or (monthly_cents is not null and annual_cents is not null)
);

-- Le catalogue, avec les quatre paliers. Business à 169 $ n'est pas arbitraire :
-- huit places à la carte sous Cabinet Pro coûteraient 79 + 5 × 25 = 204 $. Un
-- palier plus cher que l'addition qu'il remplace ne fait monter personne.
insert into public.plan_limits (
  plan, max_seats, ai_connector, label_fr, label_en, rank, purchasable,
  monthly_cents, annual_cents, extra_seat_monthly_cents, extra_seat_annual_cents,
  seats_included, tagline_fr, tagline_en
) values
  ('trial',      1,    false, 'Essai',           'Trial',           10, false,
   null, null, 0, 0, 1,
   'Découverte limitée dans le temps.', 'Time-limited trial.'),

  ('solo',       1,    false, 'Solo',            'Solo',            20, true,
   4900, 49000, 0, 0, 1,
   'Le consultant qui exerce seul.', 'For the consultant practising alone.'),

  ('cabinet',    null, true,  'Cabinet Pro',     'Firm Pro',        30, true,
   7900, 79000, 2500, 25000, 3,
   'Le cabinet qui travaille à plusieurs.', 'For firms working as a team.'),

  ('business',   null, true,  'Cabinet Business','Firm Business',   40, true,
   16900, 169000, 2000, 20000, 8,
   'Le cabinet établi, plusieurs consultants et du personnel.',
   'Established firms with several consultants and staff.'),

  ('enterprise', null, true,  'Entreprise',      'Enterprise',      50, false,
   null, null, 0, 0, 8,
   'Réseaux et grands cabinets, conditions négociées.',
   'Networks and large firms, negotiated terms.'),

  ('courtoisie', null, true,  'Courtoisie',      'Complimentary',   60, false,
   null, null, 0, 0, 1,
   'Accès gratuit accordé à la main, révocable.',
   'Complimentary access, granted by hand, revocable.')
on conflict (plan) do update set
  max_seats                = excluded.max_seats,
  ai_connector             = excluded.ai_connector,
  label_fr                 = excluded.label_fr,
  label_en                 = excluded.label_en,
  rank                     = excluded.rank,
  purchasable              = excluded.purchasable,
  monthly_cents            = excluded.monthly_cents,
  annual_cents             = excluded.annual_cents,
  extra_seat_monthly_cents = excluded.extra_seat_monthly_cents,
  extra_seat_annual_cents  = excluded.extra_seat_annual_cents,
  seats_included           = excluded.seats_included,
  tagline_fr               = excluded.tagline_fr,
  tagline_en               = excluded.tagline_en,
  updated_at               = now();

-- La contrainte CHECK sur firms.plan cède la place à une clé étrangère : le
-- catalogue devient la seule autorité sur ce qu'est un forfait valide, et
-- ajouter un palier ne demande plus de toucher à une contrainte.
alter table public.firms drop constraint if exists firms_plan_check;
alter table public.firms drop constraint if exists firms_plan_fkey;
alter table public.firms add constraint firms_plan_fkey
  foreign key (plan) references public.plan_limits(plan);

-- ---------------------------------------------------------------------------
-- 2. Les fonctionnalités
-- ---------------------------------------------------------------------------

create table if not exists public.features (
  key             text primary key,
  label_fr        text not null,
  label_en        text not null,
  description_fr  text,
  description_en  text,
  category        text not null default 'general',
  rank            int not null default 100,
  -- Ce qui ne se vend pas. Le journal d'audit répond d'une obligation de
  -- tenue de dossiers : le placer derrière un palier reviendrait à vendre
  -- la conformité, et à laisser un confrère sur le forfait d'entrée sans de
  -- quoi répondre à une vérification.
  always_on       boolean not null default false,
  created_at      timestamptz not null default now()
);

insert into public.features (key, label_fr, label_en, category, rank, always_on, description_fr, description_en) values
  ('matters',        'Dossiers et échéances',      'Matters and deadlines',   'coeur',     10, true,  null, null),
  ('clients',        'Clients',                     'Clients',                 'coeur',     20, true,  null, null),
  ('documents',      'Documents',                   'Documents',               'coeur',     30, true,  null, null),
  ('audit_log',      'Journal d''audit inaltérable','Tamper-evident audit log','conformite',40, true,
   'Chaîné par empreinte. Répond à l''obligation de tenue de dossiers : jamais conditionné à un forfait.',
   'Hash-chained. Meets record-keeping obligations: never gated behind a plan.'),
  ('client_portal',  'Portail client',              'Client portal',           'coeur',     50, true,  null, null),
  ('agreements',     'Ententes de représentation',  'Retainer agreements',     'coeur',     60, false, null, null),
  ('esignature',     'Signature électronique',      'Electronic signature',    'coeur',     70, false, null, null),
  ('invoicing',      'Facturation des clients',     'Client invoicing',        'coeur',     80, false, null, null),
  ('research',       'Recherche législative',       'Legislative research',    'coeur',     90, false, null, null),
  ('team_roles',     'Rôles et permissions',        'Roles and permissions',   'equipe',   100, false,
   'Plusieurs membres, chacun avec son rôle. Sans cette fonctionnalité, le cabinet reste à une place.',
   'Several members, each with a role. Without it the firm stays at one seat.'),
  ('ai_connector',   'Connecteur d''intelligence artificielle', 'AI connector', 'avance',  110, false,
   'Ouvre l''accès d''un assistant aux données du cabinet, cloisonné et journalisé.',
   'Opens an assistant''s access to firm data, walled off and logged.'),
  ('priority_support','Soutien prioritaire',        'Priority support',        'service',  120, false, null, null)
on conflict (key) do update set
  label_fr = excluded.label_fr, label_en = excluded.label_en,
  description_fr = excluded.description_fr, description_en = excluded.description_en,
  category = excluded.category, rank = excluded.rank, always_on = excluded.always_on;

-- ---------------------------------------------------------------------------
-- 3. Ce que chaque forfait comprend
-- ---------------------------------------------------------------------------

create table if not exists public.plan_features (
  plan        text not null references public.plan_limits(plan) on delete cascade,
  feature     text not null references public.features(key) on delete cascade,
  enabled     boolean not null default true,
  -- Plafond chiffré, quand la fonctionnalité en admet un. NULL = sans limite.
  -- Aucune n'en a aujourd'hui ; la colonne existe pour que la première ne
  -- demande pas de migration.
  limit_value int,
  primary key (plan, feature)
);

-- Chaque forfait payant reçoit d'emblée tout ce qui est « toujours inclus ».
insert into public.plan_features (plan, feature, enabled)
select p.plan, f.key, true
  from public.plan_limits p cross join public.features f
 where f.always_on
on conflict (plan, feature) do update set enabled = true;

-- Puis ce qui distingue les paliers. Rien ici qui ne soit construit.
insert into public.plan_features (plan, feature, enabled) values
  -- Essai : l'outil complet du consultant seul, pour juger sur pièces.
  ('trial','agreements',true), ('trial','esignature',true), ('trial','invoicing',true),
  ('trial','research',true),   ('trial','team_roles',false),('trial','ai_connector',false),
  ('trial','priority_support',false),

  ('solo','agreements',true),  ('solo','esignature',true),  ('solo','invoicing',true),
  ('solo','research',true),    ('solo','team_roles',false), ('solo','ai_connector',false),
  ('solo','priority_support',false),

  ('cabinet','agreements',true),('cabinet','esignature',true),('cabinet','invoicing',true),
  ('cabinet','research',true),  ('cabinet','team_roles',true),('cabinet','ai_connector',true),
  ('cabinet','priority_support',true),

  ('business','agreements',true),('business','esignature',true),('business','invoicing',true),
  ('business','research',true),  ('business','team_roles',true),('business','ai_connector',true),
  ('business','priority_support',true),

  ('enterprise','agreements',true),('enterprise','esignature',true),('enterprise','invoicing',true),
  ('enterprise','research',true),  ('enterprise','team_roles',true),('enterprise','ai_connector',true),
  ('enterprise','priority_support',true),

  -- La courtoisie ne bride rien : elle sert à faire essayer l'outil complet.
  ('courtoisie','agreements',true),('courtoisie','esignature',true),('courtoisie','invoicing',true),
  ('courtoisie','research',true),  ('courtoisie','team_roles',true),('courtoisie','ai_connector',true),
  ('courtoisie','priority_support',true)
on conflict (plan, feature) do update set enabled = excluded.enabled;

-- ---------------------------------------------------------------------------
-- 4. Les exceptions accordées à un cabinet
-- ---------------------------------------------------------------------------
-- Ouvrir une fonctionnalité à un cabinet sans changer son forfait — un essai
-- accordé, une compensation, une négociation en cours. L'inverse est prévu
-- aussi : `enabled = false` retire une fonctionnalité que le forfait comprend.
--
-- `expires_at` importe plus qu'il n'en a l'air : une faveur sans échéance
-- devient un droit acquis que personne ne pense à retirer, et l'écart entre
-- ce qui est facturé et ce qui est ouvert se creuse cabinet par cabinet.

create table if not exists public.firm_feature_overrides (
  firm_id     uuid not null references public.firms(id) on delete cascade,
  feature     text not null references public.features(key) on delete cascade,
  enabled     boolean not null,
  limit_value int,
  reason      text,
  granted_by  uuid references auth.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  primary key (firm_id, feature)
);

create index if not exists firm_feature_overrides_firm_idx
  on public.firm_feature_overrides (firm_id);

-- ---------------------------------------------------------------------------
-- 5. Le journal de l'exploitant
-- ---------------------------------------------------------------------------
-- audit_logs est le journal DU CABINET, chaîné par empreinte, et ne doit pas
-- accueillir les gestes de la plateforme : ce sont deux responsabilités
-- distinctes, et les mêler rendrait le premier inintelligible lors d'une
-- vérification déontologique.

create table if not exists public.platform_audit (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text not null default '',
  action       text not null,
  firm_id      uuid references public.firms(id) on delete set null,
  firm_name    text not null default '',
  summary      text not null default '',
  details      jsonb
);

create index if not exists platform_audit_firm_idx on public.platform_audit (firm_id, occurred_at desc);
create index if not exists platform_audit_time_idx on public.platform_audit (occurred_at desc);

-- ---------------------------------------------------------------------------
-- 6. Résolution : ce cabinet a-t-il droit à cette fonctionnalité ?
-- ---------------------------------------------------------------------------
-- L'ordre des trois termes EST la règle, et il ne se lit qu'ici.

create or replace function public.firm_has_feature(f_id uuid, feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    -- 1. Ce qui ne se vend pas.
    (select true from public.features f
      where f.key = feature_key and f.always_on),
    -- 2. L'exception accordée au cabinet, tant qu'elle court.
    (select o.enabled from public.firm_feature_overrides o
      where o.firm_id = f_id and o.feature = feature_key
        and (o.expires_at is null or o.expires_at > now())),
    -- 3. Le forfait réellement payé — jamais celui écrit à la main dans
    --    firms.plan, cf. firm_effective_plan().
    (select pf.enabled from public.plan_features pf
      where pf.plan = public.firm_effective_plan(f_id) and pf.feature = feature_key),
    false
  );
$$;

comment on function public.firm_has_feature(uuid, text) is
  'Autorité unique sur les droits fonctionnels d''un cabinet : toujours-inclus, puis exception, puis forfait payé. Aucun écran ne doit reconstituer cette règle.';

revoke all on function public.firm_has_feature(uuid, text) from public;
grant execute on function public.firm_has_feature(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Le connecteur passe par la règle commune
-- ---------------------------------------------------------------------------
-- Il lisait plan_limits.ai_connector directement. Cette colonne demeure —
-- firm_effective_plan() et les écrans s'en servent — mais elle cesse d'être
-- le juge : sans ce passage, une exception accordée à un cabinet n'ouvrirait
-- pas son connecteur, et l'exploitant croirait l'avoir fait.

create or replace function public.connector_firm(raw_key text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select k.firm_id
  from public.ai_api_keys k
  join public.ai_connector_settings s on s.firm_id = k.firm_id
  where k.key_hash = encode(extensions.digest(raw_key, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now())
    and s.enabled
    and public.firm_has_feature(k.firm_id, 'ai_connector')
    and public.firm_access_open(k.firm_id);
$$;

revoke all on function public.connector_firm(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Qui lit, qui écrit
-- ---------------------------------------------------------------------------

alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.firm_feature_overrides enable row level security;
alter table public.platform_audit enable row level security;

-- Le catalogue est public par nature : ce sont les conditions commerciales.
drop policy if exists features_read on public.features;
create policy features_read on public.features
  for select to authenticated using (true);

drop policy if exists plan_features_read on public.plan_features;
create policy plan_features_read on public.plan_features
  for select to authenticated using (true);

-- Un cabinet voit les exceptions qui le concernent, et rien de plus : savoir
-- ce qui a été accordé à un confrère ne le regarde pas.
drop policy if exists firm_feature_overrides_read on public.firm_feature_overrides;
create policy firm_feature_overrides_read on public.firm_feature_overrides
  for select to authenticated
  using (firm_id = public.current_firm_id_unchecked() or public.is_platform_admin());

drop policy if exists firm_feature_overrides_admin on public.firm_feature_overrides;
create policy firm_feature_overrides_admin on public.firm_feature_overrides
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Le catalogue ne se modifie que par l'exploitant.
drop policy if exists features_admin on public.features;
create policy features_admin on public.features
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists plan_features_admin on public.plan_features;
create policy plan_features_admin on public.plan_features
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists plan_limits_admin on public.plan_limits;
create policy plan_limits_admin on public.plan_limits
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Le journal se lit, ne se modifie pas. Aucune politique d'écriture : il est
-- alimenté par la clé de service, depuis les actions d'administration. Un
-- journal qu'on peut corriger ne prouve rien.
drop policy if exists platform_audit_read on public.platform_audit;
create policy platform_audit_read on public.platform_audit
  for select to authenticated using (public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select plan, label_fr, seats_included,
--          coalesce(max_seats::text,'∞') as max,
--          monthly_cents/100.0 as mensuel, purchasable
--     from public.plan_limits order by rank;
--
--   select f.name, pf.feature, public.firm_has_feature(f.id, pf.feature) as droit
--     from public.firms f
--     join public.plan_features pf on pf.plan = public.firm_effective_plan(f.id)
--    order by f.name, pf.feature;
-- ============================================================================
