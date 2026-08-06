-- ============================================================================
-- Connecteur d'intelligence artificielle : authentification et cloisonnement
-- ============================================================================
--
-- Ce que remplace cette migration.
--
-- Les routes du connecteur lisaient l'en-tête Authorization, en tronquaient
-- les seize premiers caractères, et s'en servaient **uniquement pour écrire
-- dans un journal**. La valeur n'était comparée à rien. En l'absence
-- d'en-tête, une constante était même inventée. N'importe quelle requête
-- anonyme passait donc l'authentification — il n'y en avait pas.
--
-- Les réglages et les garde-fous vivaient dans une variable de processus,
-- partagée par toute l'application : un cabinet qui activait son connecteur
-- l'activait pour tous, et les actes réservés étaient communs.
--
-- Trois principes gouvernent ce qui suit.
--
-- 1. La clé n'est jamais stockée. Seule son empreinte l'est. Une fuite de
--    la table ne permet d'appeler aucune API.
--
-- 2. Le cabinet se déduit de la clé, jamais de la requête. Aucune fonction
--    exposée ici n'accepte d'identifiant de cabinet en paramètre : il n'y a
--    donc rien à falsifier. Un appelant ne peut pas demander les données
--    d'un autre cabinet, faute de pouvoir seulement les désigner.
--
-- 3. Le cloisonnement est en base. Les fonctions de lecture filtrent
--    elles-mêmes sur le cabinet résolu ; le code applicatif n'a aucun
--    filtre à écrire, donc aucun à oublier.
--
-- Idempotente.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Clés d'API
-- ---------------------------------------------------------------------------

create table if not exists public.ai_api_keys (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  label        text not null,
  -- Douze premiers caractères, affichés pour reconnaître une clé sans la
  -- révéler. Ne sert jamais à authentifier.
  key_prefix   text not null,
  -- Empreinte SHA-256 de la clé entière.
  --
  -- Un SHA nu suffit ici, contrairement à un mot de passe : la clé est
  -- tirée de 256 bits d'aléa, hors de portée d'une recherche exhaustive
  -- quelle que soit la vitesse du hachage. Les algorithmes lents existent
  -- pour compenser la faible entropie des secrets choisis par un humain ;
  -- ce n'en est pas un.
  key_hash     text not null unique,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz
);

create index if not exists ai_api_keys_firm_idx on public.ai_api_keys (firm_id);
create index if not exists ai_api_keys_hash_idx on public.ai_api_keys (key_hash);

-- ---------------------------------------------------------------------------
-- 2. Réglages, par cabinet
-- ---------------------------------------------------------------------------

create table if not exists public.ai_connector_settings (
  firm_id           uuid primary key references public.firms(id) on delete cascade,
  -- Désactivé à la création. Un connecteur qui s'ouvrirait de lui-même
  -- serait un connecteur que personne n'a décidé d'ouvrir.
  enabled           boolean not null default false,
  enabled_by        uuid references auth.users(id) on delete set null,
  enabled_at        timestamptz,
  allowed_actions   text[] not null default array['list_agreements','get_agreement','create_agreement_draft','update_agreement_draft'],
  -- Actes réservés à un consultant réglementé. Le garde-fou est ici, en
  -- base, et non dans l'application : il s'applique même à un appel qui
  -- contournerait entièrement le code de la plateforme.
  reserved_actions  text[] not null default array['finalize','send','sign','cancel'],
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Journal, par cabinet, en ajout seul
-- ---------------------------------------------------------------------------

create table if not exists public.ai_connector_logs (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  key_prefix  text,
  action      text not null,
  status      text not null,
  resource_id text,
  summary     text not null,
  client_ip   text
);

create index if not exists ai_connector_logs_firm_idx
  on public.ai_connector_logs (firm_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 4. Résolution du cabinet à partir de la clé
-- ---------------------------------------------------------------------------
--
-- Le cœur du dispositif. Renvoie le cabinet d'une clé valide, ou NULL.
--
-- NULL est renvoyé pour une clé inconnue, révoquée, expirée, dont le
-- cabinet est suspendu, ou dont le connecteur est désactivé. L'appelant ne
-- peut pas distinguer ces cas : sinon la fonction deviendrait un oracle
-- permettant de savoir quelles clés existent.

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
    and public.firm_access_open(k.firm_id);
$$;

-- ---------------------------------------------------------------------------
-- 5. Autorisation d'une action
-- ---------------------------------------------------------------------------
--
-- Renvoie le cabinet et le verdict. Les actes réservés sont refusés ici,
-- au même endroit que la résolution du cabinet : il n'existe pas de chemin
-- qui obtienne l'un sans passer par l'autre.

create or replace function public.connector_authorize(raw_key text, wanted_action text)
returns table (firm_id uuid, allowed boolean, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  f uuid;
  s public.ai_connector_settings%rowtype;
begin
  f := public.connector_firm(raw_key);

  if f is null then
    -- Message unique : ne pas révéler si la clé existe, si elle est
    -- révoquée, ou si le connecteur du cabinet est fermé.
    return query select null::uuid, false, 'UNAUTHORIZED';
    return;
  end if;

  select * into s from public.ai_connector_settings where ai_connector_settings.firm_id = f;

  if wanted_action = any (s.reserved_actions) then
    return query select f, false, 'RESERVED_HUMAN_ACTION';
    return;
  end if;

  if not (wanted_action = any (s.allowed_actions)) then
    return query select f, false, 'ACTION_NOT_ALLOWED';
    return;
  end if;

  return query select f, true, 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Journalisation et horodatage d'usage
-- ---------------------------------------------------------------------------
--
-- Le journal enregistre aussi les refus : c'est précisément ce qu'on veut
-- pouvoir relire après coup. Le cabinet vient de la clé, pas de l'appelant.

create or replace function public.connector_log(
  raw_key text,
  in_action text,
  in_status text,
  in_summary text,
  in_resource_id text default null,
  in_client_ip text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  k public.ai_api_keys%rowtype;
begin
  select * into k
  from public.ai_api_keys
  where key_hash = encode(extensions.digest(raw_key, 'sha256'), 'hex');

  -- Une clé inconnue n'a pas de cabinet à qui imputer la tentative. Rien
  -- n'est écrit : un journal alimentable par un inconnu se remplirait de
  -- ce qu'il voudrait y mettre.
  if k.id is null then
    return;
  end if;

  insert into public.ai_connector_logs (firm_id, key_prefix, action, status, resource_id, summary, client_ip)
  values (k.firm_id, k.key_prefix, in_action, in_status, in_resource_id, in_summary, in_client_ip);

  update public.ai_api_keys set last_used_at = now() where id = k.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
--
-- Les clés, les réglages et le journal appartiennent au cabinet. Le
-- propriétaire seul les gère.
--
-- L'exploitant de la plateforme n'y a délibérément AUCUN accès : le
-- journal du connecteur nomme des dossiers et des clients, et la règle qui
-- justifie toute la séparation des identités est qu'il ne voit jamais le
-- contenu d'un cabinet.

alter table public.ai_api_keys           enable row level security;
alter table public.ai_connector_settings enable row level security;
alter table public.ai_connector_logs     enable row level security;

drop policy if exists ai_keys_owner on public.ai_api_keys;
create policy ai_keys_owner on public.ai_api_keys
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner())
  with check (firm_id = public.current_firm_id() and public.is_firm_owner());

drop policy if exists ai_settings_read on public.ai_connector_settings;
create policy ai_settings_read on public.ai_connector_settings
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists ai_settings_owner_write on public.ai_connector_settings;
create policy ai_settings_owner_write on public.ai_connector_settings
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner())
  with check (firm_id = public.current_firm_id() and public.is_firm_owner());

-- Lecture par tout membre du cabinet : un journal que seul le propriétaire
-- peut consulter surveille mal.
drop policy if exists ai_logs_read on public.ai_connector_logs;
create policy ai_logs_read on public.ai_connector_logs
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- Aucune politique d'insertion, de modification ni de suppression : le
-- journal ne s'écrit que par connector_log(), et ne se réécrit jamais.

revoke all on public.ai_api_keys           from anon;
revoke all on public.ai_connector_settings from anon;
revoke all on public.ai_connector_logs     from anon;

-- Les fonctions du connecteur ne sont appelées que par le serveur de
-- l'application, avec la clé de service. Ni anon ni authenticated n'ont à
-- les exécuter : une clé d'API soumise depuis un navigateur serait déjà
-- une clé compromise.
revoke all on function public.connector_firm(text) from public;
revoke all on function public.connector_authorize(text, text) from public;
revoke all on function public.connector_log(text, text, text, text, text, text) from public;

-- ---------------------------------------------------------------------------
-- 8. Réglages initiaux pour les cabinets existants
-- ---------------------------------------------------------------------------
-- Désactivés, comme il se doit.

insert into public.ai_connector_settings (firm_id)
select id from public.firms
on conflict (firm_id) do nothing;

commit;

-- ============================================================================
-- Contrôles
-- ============================================================================
--   select f.name, s.enabled, count(k.id) as cles
--   from public.firms f
--   join public.ai_connector_settings s on s.firm_id = f.id
--   left join public.ai_api_keys k on k.firm_id = f.id and k.revoked_at is null
--   group by f.name, s.enabled;
--
--   -- Doit renvoyer NULL :
--   select public.connector_firm('cric_live_inexistante');
-- ============================================================================
