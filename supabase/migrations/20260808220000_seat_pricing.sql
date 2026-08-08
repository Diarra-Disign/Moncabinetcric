-- ============================================================================
-- Tarification par type de place
-- ============================================================================
--
-- Une place supplémentaire coûtait le même prix quelle que soit la personne
-- qui l'occupait. Or un consultant réglementé et une adjointe administrative
-- ne représentent ni la même valeur pour le cabinet, ni le même usage de
-- l'outil : le premier ouvre des dossiers, la seconde classe des pièces.
--
-- Cette migration fournit la MATIÈRE du calcul — combien de places de chaque
-- type, à quel prix — et rien d'autre. La répartition et la réconciliation
-- avec Stripe vivent dans lib/billing/seats.ts, où elles sont éprouvables sans
-- toucher à un compte de paiement.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE DÉCIDE PAS
-- ---------------------------------------------------------------------------
-- Quelles places sont « comprises » quand plusieurs types se côtoient. Un
-- forfait à trois places comprises occupé par deux consultants et deux
-- adjointes peut absorber les plus chères ou les moins chères, et l'écart se
-- retrouve sur la facture. Ce choix est explicite dans le code TypeScript, il
-- est commenté, et il est couvert par des tests — le mettre ici, en SQL,
-- l'aurait rendu invisible et intestable.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le prix d'une place, par forfait et par rôle
-- ---------------------------------------------------------------------------
-- Une ligne absente vaut « le tarif générique du forfait »
-- (plan_limits.extra_seat_*). Il n'est donc pas nécessaire de décrire les six
-- rôles pour les six forfaits : seuls les écarts se déclarent.

create table if not exists public.plan_seat_prices (
  plan          text not null references public.plan_limits(plan) on delete cascade,
  cicc_role     text not null,
  monthly_cents int not null check (monthly_cents >= 0),
  annual_cents  int not null check (annual_cents >= 0),
  updated_at    timestamptz not null default now(),
  primary key (plan, cicc_role)
);

comment on table public.plan_seat_prices is
  'Prix d''une place supplémentaire selon le rôle de son occupant. Une absence de ligne renvoie au tarif générique du forfait.';

-- Cabinet Pro et Business : un consultant coûte le tarif générique, le
-- personnel de soutien coûte moins. Les valeurs viennent du brief ; elles se
-- modifient depuis la console au même titre que les forfaits.
insert into public.plan_seat_prices (plan, cicc_role, monthly_cents, annual_cents) values
  ('cabinet','rcic',       2500, 25000),
  ('cabinet','risia',      1500, 15000),
  ('cabinet','staff',      1500, 15000),
  ('cabinet','bookkeeper', 1500, 15000),
  ('cabinet','readonly',    500,  5000),

  ('business','rcic',      2000, 20000),
  ('business','risia',     1200, 12000),
  ('business','staff',     1200, 12000),
  ('business','bookkeeper',1200, 12000),
  ('business','readonly',   500,  5000)
on conflict (plan, cicc_role) do update set
  monthly_cents = excluded.monthly_cents,
  annual_cents  = excluded.annual_cents,
  updated_at    = now();

alter table public.plan_seat_prices enable row level security;

drop policy if exists plan_seat_prices_read on public.plan_seat_prices;
create policy plan_seat_prices_read on public.plan_seat_prices
  for select to authenticated using (true);

drop policy if exists plan_seat_prices_admin on public.plan_seat_prices;
create policy plan_seat_prices_admin on public.plan_seat_prices
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. Combien de places, de quel type
-- ---------------------------------------------------------------------------
-- Exactement la même définition d'une place occupée que firm_seats_taken() :
-- membres ACTIFS, plus invitations vivantes. Deux définitions divergentes
-- produiraient un plafond et une facture qui ne parlent pas du même cabinet —
-- et c'est le genre d'écart qu'on ne découvre qu'en relisant un relevé.

create or replace function public.firm_seat_counts(f_id uuid)
returns table (cicc_role text, n int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.cicc_role, count(*)::int as n
  from (
    select p.cicc_role
      from public.profiles p
     where p.firm_id = f_id and p.status = 'active'
    union all
    select i.cicc_role
      from public.invitations i
     where i.firm_id = f_id
       and i.accepted_at is null
       and i.revoked_at is null
       and i.expires_at > now()
  ) r
  group by r.cicc_role;
$$;

revoke all on function public.firm_seat_counts(uuid) from public;
grant execute on function public.firm_seat_counts(uuid) to authenticated;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select f.name, c.cicc_role, c.n
--     from public.firms f, lateral public.firm_seat_counts(f.id) c
--    order by f.name, c.cicc_role;
--
--   -- La somme doit valoir firm_seats_taken(), sans exception :
--   select f.name,
--          (select sum(n) from public.firm_seat_counts(f.id)) as par_role,
--          public.firm_seats_taken(f.id)                      as total
--     from public.firms f;
-- ============================================================================
