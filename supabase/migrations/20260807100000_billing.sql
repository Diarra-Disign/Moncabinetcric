-- ============================================================================
-- Facturation récurrente : abonnements Stripe
-- ============================================================================
--
-- Jusqu'ici, l'accès d'un cabinet s'ouvrait et se fermait à la main depuis la
-- console d'exploitation. Rien ne reliait cet accès à un paiement : un
-- cabinet restait ouvert indéfiniment sans jamais rien devoir, et rien ne se
-- fermait quand il cessait de payer.
--
-- Choix d'architecture — le même qu'en 20260802180000 : le verrou reste
-- firm_access_open(). C'est déjà le point unique auquel s'adossent les trente
-- politiques RLS et le connecteur d'intelligence artificielle. L'abonnement
-- n'ajoute donc pas un second contrôle à côté du premier ; il ajoute une
-- condition à l'intérieur du seul qui existe. Un impayé ferme l'application
-- ET le connecteur, sans qu'aucun écran n'ait à y penser.
--
-- Ce qui n'est PAS ici, volontairement : aucun numéro de carte, aucun numéro
-- de compte bancaire, aucun mandat. Ces données vivent chez Stripe, derrière
-- une page hébergée par lui. La base ne conserve que des identifiants opaques
-- et l'état de l'abonnement — de quoi décider si la porte s'ouvre, rien de
-- plus. La même base contient des dossiers d'immigration : tout ce qu'on peut
-- ne pas y stocker vaut mieux ne pas y être.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Ce que chaque plan donne droit de faire
-- ---------------------------------------------------------------------------
-- Une table plutôt que des constantes dans le code : ces limites sont
-- consultées par des fonctions SQL appelées à chaque écriture. Les tenir en
-- TypeScript obligerait la base à faire confiance à l'application, ce qui est
-- exactement l'inverse du parti pris de ce projet.
--
-- NULL vaut « sans limite ». Ce n'est pas une commodité d'écriture : une
-- limite absente et une limite à zéro doivent se distinguer.

create table if not exists public.plan_limits (
  plan          text primary key,
  -- Nombre de comptes rattachables au cabinet, invitations en attente
  -- comprises. Une invitation non encore acceptée occupe une place : sans
  -- cela, on inviterait dix personnes sous un plan qui en autorise une, et le
  -- refus n'arriverait qu'au moment le plus désagréable — à l'acceptation.
  max_seats     int,
  -- Le connecteur d'intelligence artificielle est-il ouvrable ?
  ai_connector  boolean not null default false,
  label_fr      text not null,
  label_en      text not null
);

insert into public.plan_limits (plan, max_seats, ai_connector, label_fr, label_en) values
  ('trial',      1,    false, 'Essai',       'Trial'),
  ('solo',       1,    false, 'Solo',        'Solo'),
  ('cabinet',    null, true,  'Cabinet Pro', 'Firm Pro'),
  -- Accès de courtoisie : accordé à la main, sans paiement. Il ne doit rien
  -- brider, sinon il ne sert pas à ce pour quoi il existe — faire essayer
  -- l'outil complet à un confrère ou à un testeur.
  ('courtoisie', null, true,  'Courtoisie',  'Complimentary')
on conflict (plan) do update set
  max_seats    = excluded.max_seats,
  ai_connector = excluded.ai_connector,
  label_fr     = excluded.label_fr,
  label_en     = excluded.label_en;

alter table public.plan_limits enable row level security;

-- Lisible par tout compte authentifié : ce sont les conditions commerciales
-- publiques, pas un secret. Aucune politique d'écriture — ces lignes ne
-- changent que par migration, donc sous revue.
drop policy if exists plan_limits_read on public.plan_limits;
create policy plan_limits_read on public.plan_limits
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. L'abonnement d'un cabinet
-- ---------------------------------------------------------------------------
-- Un cabinet, un abonnement : la contrainte d'unicité sur firm_id l'impose.
-- Deux abonnements simultanés pour un même cabinet ne voudraient rien dire,
-- et rendraient firm_access_open() ambiguë.

create table if not exists public.firm_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  firm_id                uuid not null unique references public.firms(id) on delete cascade,

  -- Identifiants opaques chez Stripe. C'est tout ce qui relie les deux
  -- systèmes : ni montant, ni moyen de paiement, ni mandat.
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,

  plan                   text not null references public.plan_limits(plan),
  cadence                text not null default 'monthly'
                         check (cadence in ('monthly', 'annual')),

  -- Places facturées. Distinct de plan_limits.max_seats : sous Cabinet Pro,
  -- trois places sont comprises et les suivantes s'achètent. C'est donc
  -- l'abonnement qui fait foi dès qu'il en existe un.
  seats                  int not null default 1 check (seats >= 1),

  -- Statut repris de Stripe sans traduction. Le renommer créerait une
  -- correspondance à maintenir des deux côtés, et une divergence silencieuse
  -- le jour où Stripe ajoute un état.
  status                 text not null default 'incomplete'
                         check (status in ('incomplete', 'incomplete_expired', 'trialing',
                                           'active', 'past_due', 'canceled', 'unpaid', 'paused')),

  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,

  -- Délai laissé après un échec de prélèvement. Ces cabinets ont des
  -- échéances d'immigration au calendrier : une carte expirée un mardi ne
  -- doit pas leur retirer leurs dossiers le mardi.
  grace_until            timestamptz,

  -- Purement informatif, pour l'écran d'abonnement. 'card' ou 'acss_debit'
  -- (prélèvement préautorisé canadien), et les quatre derniers chiffres que
  -- Stripe accepte de rendre. Rien qui permette de débiter quoi que ce soit.
  payment_method         text,
  payment_last4          text,

  currency               text not null default 'cad',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists firm_subscriptions_status_idx
  on public.firm_subscriptions (status);

alter table public.firm_subscriptions enable row level security;

-- Tout membre lit l'abonnement de SON cabinet : un adjoint doit pouvoir
-- comprendre pourquoi l'application se ferme dans huit jours. Personne ne
-- l'écrit depuis l'application — seul le webhook le fait, avec la clé de
-- service, à partir de ce que Stripe affirme. Une écriture applicative
-- permettrait à un propriétaire de se déclarer payé.
drop policy if exists firm_subscriptions_read on public.firm_subscriptions;
create policy firm_subscriptions_read on public.firm_subscriptions
  for select to authenticated
  using (firm_id = public.current_firm_id_unchecked() or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 3. Événements Stripe déjà traités
-- ---------------------------------------------------------------------------
-- Stripe réémet un événement tant qu'il n'a pas reçu un 200, et peut le
-- livrer deux fois même après. Sans cette table, un renvoi de
-- « invoice.payment_failed » repousserait le délai de grâce à chaque
-- livraison, et un cabinet qui ne paie plus resterait ouvert indéfiniment.

create table if not exists public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- Aucune politique : cette table n'appartient à personne d'autre qu'au
-- webhook, qui écrit avec la clé de service.

-- ---------------------------------------------------------------------------
-- 4. L'accès est-il ouvert ? — la question désormais posée au paiement
-- ---------------------------------------------------------------------------
-- Trois chemins mènent à un accès ouvert, et un seul suffit :
--
--   · un essai en cours, sans paiement, avec une échéance ;
--   · un accès de courtoisie, accordé à la main ;
--   · un abonnement payant en règle, ou en retard mais dans son délai.
--
-- Ce qui n'y figure pas mérite d'être dit : current_period_end n'entre PAS
-- dans la décision pour un abonnement actif. La tentation est grande — elle
-- rendrait le verrou insensible à une panne de webhook. Elle ferait surtout
-- l'inverse : si un événement de renouvellement se perdait, la date resterait
-- au mois précédent et TOUS les cabinets se fermeraient d'un coup, alors
-- qu'ils ont payé. Le statut est la seule source ; Stripe le corrige de
-- lui-même à la livraison suivante.

create or replace function public.firm_access_open(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.firms f
    left join public.firm_subscriptions s on s.firm_id = f.id
    where f.id = f_id
      -- La suspension décidée depuis la console reste souveraine : elle ferme
      -- même un cabinet parfaitement à jour de ses paiements.
      and f.status = 'active'
      and (
        (f.plan = 'trial'
          and (f.trial_ends_at is null or f.trial_ends_at >= current_date))
        or f.plan = 'courtoisie'
        or (s.status in ('active', 'trialing'))
        or (s.status in ('past_due', 'unpaid')
            and s.grace_until is not null
            and s.grace_until >= now())
      )
  );
$$;

revoke all on function public.firm_access_open(uuid) from public;
grant execute on function public.firm_access_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Le connecteur d'intelligence artificielle suit le plan
-- ---------------------------------------------------------------------------
-- Redéfinie ici plutôt que corrigée depuis le code appelant : la condition
-- doit tenir dans la fonction que l'API interroge, sinon un oubli côté
-- application rouvrirait le connecteur à un plan qui ne le comprend pas.

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
  join public.firms f on f.id = k.firm_id
  join public.plan_limits l on l.plan = f.plan
  where k.key_hash = encode(extensions.digest(raw_key, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now())
    and s.enabled
    and l.ai_connector
    and public.firm_access_open(k.firm_id);
$$;

revoke all on function public.connector_firm(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Places : combien de comptes ce cabinet peut-il rattacher ?
-- ---------------------------------------------------------------------------

create or replace function public.firm_seat_limit(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- L'abonnement prime sur le plan dès qu'il en existe un en règle : c'est
  -- lui qui porte les places achetées au-delà de celles comprises.
  select coalesce(
    (select s.seats
       from public.firm_subscriptions s
      where s.firm_id = f_id
        and s.status in ('active', 'trialing', 'past_due')),
    (select l.max_seats
       from public.firms f
       join public.plan_limits l on l.plan = f.plan
      where f.id = f_id)
  );
$$;

revoke all on function public.firm_seat_limit(uuid) from public;
grant execute on function public.firm_seat_limit(uuid) to authenticated;

-- Places occupées : comptes rattachés + invitations encore vivantes.
create or replace function public.firm_seats_taken(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles p where p.firm_id = f_id)
  + (select count(*) from public.invitations i
      where i.firm_id = f_id
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now());
$$;

revoke all on function public.firm_seats_taken(uuid) from public;
grant execute on function public.firm_seats_taken(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Le refus, porté par un déclencheur et non par une politique
-- ---------------------------------------------------------------------------
-- Une politique RLS ne s'applique pas à la clé de service, dont se servent
-- l'acceptation d'invitation et les scripts d'administration. Un déclencheur,
-- lui, s'applique à toute écriture quelle qu'en soit l'origine. C'est le seul
-- moyen que la limite de places ne dépende pas du chemin emprunté.

create or replace function public.enforce_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  limite int;
  occupees int;
begin
  limite := public.firm_seat_limit(new.firm_id);
  if limite is null then
    return new;  -- sans limite
  end if;

  occupees := public.firm_seats_taken(new.firm_id);
  if occupees >= limite then
    raise exception
      'Plan limité à % place(s), déjà % occupée(s) — invitations en attente comprises.',
      limite, occupees
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists invitations_seat_limit on public.invitations;
create trigger invitations_seat_limit
  before insert on public.invitations
  for each row execute function public.enforce_seat_limit();

drop trigger if exists profiles_seat_limit on public.profiles;
create trigger profiles_seat_limit
  before insert on public.profiles
  for each row execute function public.enforce_seat_limit();

-- ---------------------------------------------------------------------------
-- 8. Reprise des cabinets antérieurs à la facturation
-- ---------------------------------------------------------------------------
-- C'est le passage le plus dangereux de cette migration, et il a échoué à son
-- premier essai.
--
-- Jusqu'ici, un cabinet en plan « solo » ou « cabinet » avait accès parce
-- qu'on l'avait décidé à la main : aucun abonnement n'existait, la notion
-- même n'existait pas. La nouvelle firm_access_open() exige désormais un
-- abonnement en règle pour ces plans-là. Appliquée sans cette reprise, elle
-- fermait donc la porte de TOUS les cabinets déjà ouverts — à commencer par
-- celui de l'exploitant, dont le plan était « cabinet ».
--
-- Ils passent en « courtoisie » : accès conservé, sans paiement, révocable
-- depuis la console. À l'exploitant de décider ensuite qui doit souscrire.
--
-- La condition « aucun abonnement n'existe encore » fait de cette instruction
-- une reprise ponctuelle plutôt qu'une règle permanente. Sans elle, une
-- réapplication ultérieure offrirait la gratuité à tout cabinet dont la ligne
-- d'abonnement aurait été effacée.

update public.firms
   set plan = 'courtoisie'
 where plan in ('solo', 'cabinet')
   and not exists (select 1 from public.firm_subscriptions);

-- Le cabinet exploitant n'est pas un client : il édite l'application. Cette
-- règle-ci, contrairement à la précédente, vaut à chaque application.
update public.firms f
   set plan = 'courtoisie'
 where f.plan <> 'courtoisie'
   and exists (
     select 1 from public.profiles p
     join public.platform_admins a on a.user_id = p.user_id
     where p.firm_id = f.id
   );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select f.name, f.plan, f.status,
--          s.status as abonnement, s.seats, s.current_period_end,
--          public.firm_access_open(f.id) as acces_ouvert,
--          public.firm_seats_taken(f.id) || '/' ||
--            coalesce(public.firm_seat_limit(f.id)::text, '∞') as places
--     from public.firms f
--     left join public.firm_subscriptions s on s.firm_id = f.id
--    order by f.created_at;
-- ============================================================================
