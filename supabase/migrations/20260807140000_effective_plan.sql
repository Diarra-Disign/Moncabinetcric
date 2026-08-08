-- ============================================================================
-- Le plan qui donne des droits est celui qui est payé
-- ============================================================================
--
-- Deux colonnes prétendaient dire de quel plan relève un cabinet :
--
--   · firms.plan               — ce que l'exploitant a accordé
--   · firm_subscriptions.plan  — ce que le cabinet paie réellement
--
-- La console d'exploitation écrit librement la première. Rien ne garantissait
-- qu'elles concordent, et les droits se lisaient sur la mauvaise.
--
-- Le cas concret, éprouvé : un cabinet souscrit Solo à 49 $. L'exploitant
-- passe sa ligne à « cabinet » depuis la console — geste anodin en apparence,
-- l'écran l'offre. connector_firm() joint alors plan_limits sur firms.plan,
-- y lit ai_connector = true, et **ouvre le connecteur d'intelligence
-- artificielle à un cabinet qui ne l'a pas payé**. Stripe continue de
-- prélever 49 $.
--
-- Portée réelle du défaut, après vérification : les places n'étaient PAS
-- touchées. firm_seat_limit() lit déjà firm_subscriptions.seats en priorité
-- et ne retombe sur le plan qu'à défaut d'abonnement. Seul le connecteur
-- lisait firms.plan sans condition.
--
-- Le remède n'est pas d'exiger que les deux colonnes soient égales : ce
-- serait fermer l'accès d'un cabinet à jour de ses paiements parce que
-- l'exploitant a cliqué au mauvais endroit. On introduit plutôt la notion de
-- plan effectif — l'abonnement quand il en existe un en règle, le plan
-- accordé sinon. Un cabinet ne peut alors jamais obtenir plus que ce qu'il
-- paie, ni se voir fermer la porte pour une erreur de saisie.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le plan effectif
-- ---------------------------------------------------------------------------
-- L'ordre du coalesce porte toute la règle : l'abonnement l'emporte sur ce
-- que la console a écrit. La courtoisie et l'essai, eux, n'ont pas
-- d'abonnement — ils passent donc par le second terme, ce qui est
-- exactement leur raison d'être : des droits accordés sans paiement.

create or replace function public.firm_effective_plan(f_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.plan
       from public.firm_subscriptions s
      where s.firm_id = f_id
        and (
          s.status in ('active', 'trialing')
          or (s.status in ('past_due', 'unpaid')
              and s.grace_until is not null
              and s.grace_until >= now())
        )),
    (select f.plan from public.firms f where f.id = f_id)
  );
$$;

comment on function public.firm_effective_plan(uuid) is
  'Plan dont relèvent réellement les droits du cabinet : celui de l''abonnement en règle s''il en existe un, celui accordé par l''exploitant sinon. Toute lecture de plan_limits doit passer par ici, jamais par firms.plan directement.';

revoke all on function public.firm_effective_plan(uuid) from public;
grant execute on function public.firm_effective_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le connecteur suit le plan payé
-- ---------------------------------------------------------------------------
-- Seule ligne modifiée : la jointure sur plan_limits. Elle passait par
-- f.plan, elle passe par le plan effectif.

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
  join public.plan_limits l on l.plan = public.firm_effective_plan(k.firm_id)
  where k.key_hash = encode(extensions.digest(raw_key, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now())
    and s.enabled
    and l.ai_connector
    and public.firm_access_open(k.firm_id);
$$;

revoke all on function public.connector_firm(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Les places, exprimées avec la même notion
-- ---------------------------------------------------------------------------
-- Aucun changement de comportement : le second terme ne s'évalue que faute
-- d'abonnement en règle, cas où le plan effectif vaut déjà firms.plan. La
-- réécriture ne sert qu'à ce qu'il n'existe plus, dans tout le schéma, une
-- seule lecture de plan_limits qui parte de firms.plan — la prochaine
-- fonction écrite copiera celle-ci.

create or replace function public.firm_seat_limit(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.seats
       from public.firm_subscriptions s
      where s.firm_id = f_id
        and s.status in ('active', 'trialing', 'past_due')),
    (select l.max_seats
       from public.plan_limits l
      where l.plan = public.firm_effective_plan(f_id))
  );
$$;

revoke all on function public.firm_seat_limit(uuid) from public;
grant execute on function public.firm_seat_limit(uuid) to authenticated;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select f.name,
--          f.plan                            as accorde,
--          s.plan                            as paye,
--          s.status,
--          public.firm_effective_plan(f.id)  as effectif,
--          l.ai_connector                    as connecteur_permis
--     from public.firms f
--     left join public.firm_subscriptions s on s.firm_id = f.id
--     left join public.plan_limits l on l.plan = public.firm_effective_plan(f.id)
--    order by f.created_at;
-- ============================================================================
