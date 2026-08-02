-- ============================================================================
-- Abonnements : plan, statut, essai et accès de courtoisie
-- ============================================================================
--
-- Rien ne disait jusqu'ici si un cabinet était abonné, en essai ou suspendu.
-- Il était donc impossible de retirer un accès autrement qu'en supprimant
-- des comptes.
--
-- Choix d'architecture : le verrou est porté par current_firm_id(), et non
-- par une condition ajoutée à chacune des trente politiques existantes.
-- Un cabinet dont l'accès est fermé voit cette fonction renvoyer NULL ;
-- toutes les politiques comparent firm_id à ce résultat, et refusent donc
-- d'elles-mêmes. Un seul point d'application, qu'on ne peut pas oublier en
-- ajoutant une table.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Colonnes d'abonnement
-- ---------------------------------------------------------------------------

alter table public.firms add column if not exists plan          text not null default 'trial';
alter table public.firms add column if not exists status        text not null default 'active';
alter table public.firms add column if not exists trial_ends_at date;
-- Qui a accordé cet accès, et donc qui en répond.
alter table public.firms add column if not exists granted_by    uuid references auth.users(id) on delete set null;
alter table public.firms add column if not exists suspended_at  timestamptz;
alter table public.firms add column if not exists notes         text;

alter table public.firms drop constraint if exists firms_plan_check;
alter table public.firms add constraint firms_plan_check
  check (plan in ('trial', 'solo', 'cabinet', 'courtoisie'));

alter table public.firms drop constraint if exists firms_status_check;
alter table public.firms add constraint firms_status_check
  check (status in ('active', 'suspended', 'expired'));

comment on column public.firms.plan is
  'trial : essai limité dans le temps. solo / cabinet : abonnements payants. courtoisie : accès gratuit accordé à un testeur, sans échéance mais révocable.';
comment on column public.firms.status is
  'active : accès ouvert. suspended : fermé par décision. expired : essai échu.';

-- ---------------------------------------------------------------------------
-- 2. L'accès est-il ouvert ?
-- ---------------------------------------------------------------------------
-- Un essai échu ferme l'accès sans qu'aucune tâche planifiée n'ait à
-- repasser derrière : la date est évaluée à chaque requête. Une bascule de
-- statut par traitement différé laisserait une fenêtre ouverte.

create or replace function public.firm_access_open(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.firms f
    where f.id = f_id
      and f.status = 'active'
      and (f.plan <> 'trial' or f.trial_ends_at is null or f.trial_ends_at >= current_date)
  );
$$;

revoke all on function public.firm_access_open(uuid) from public;
grant execute on function public.firm_access_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Le cabinet de l'utilisateur, sous condition d'abonnement
-- ---------------------------------------------------------------------------
-- current_firm_id() devient le point de contrôle. Toutes les politiques
-- métier s'y adossent déjà ; aucune n'a besoin d'être modifiée.

create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.firm_id
  from public.profiles p
  where p.user_id = auth.uid()
    and public.firm_access_open(p.firm_id)
  limit 1;
$$;

-- Rattachement brut, sans condition d'abonnement.
--
-- Réservé aux écrans qui doivent expliquer la suspension : sans lui, un
-- cabinet suspendu ne pourrait même pas lire son propre nom, et
-- l'utilisateur verrait une application vide sans savoir pourquoi.
create or replace function public.current_firm_id_unchecked()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select firm_id from public.profiles where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_firm_id_unchecked() from public;
grant execute on function public.current_firm_id_unchecked() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lecture du cabinet, même suspendu
-- ---------------------------------------------------------------------------

drop policy if exists firms_read_own on public.firms;
create policy firms_read_own on public.firms
  for select to authenticated
  using (id = public.current_firm_id_unchecked() or public.is_platform_admin());

-- Le propriétaire d'un cabinet suspendu ne doit pas pouvoir se réactiver
-- lui-même : la condition d'accès ouvert reste dans la politique d'écriture.
drop policy if exists firms_owner_update on public.firms;
create policy firms_owner_update on public.firms
  for update to authenticated
  using (id = public.current_firm_id() and public.is_firm_owner())
  with check (id = public.current_firm_id() and public.is_firm_owner());

-- L'administrateur de plateforme accorde, suspend et change les plans.
drop policy if exists firms_admin_update on public.firms;
create policy firms_admin_update on public.firms
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. Profils : rester lisible pour s'expliquer
-- ---------------------------------------------------------------------------
-- Même raison qu'au point 4 : un membre suspendu doit pouvoir constater son
-- rattachement, sans quoi l'écran d'explication n'aurait rien à afficher.

drop policy if exists profiles_read_firm on public.profiles;
create policy profiles_read_firm on public.profiles
  for select to authenticated
  using (firm_id = public.current_firm_id_unchecked() or public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select name, plan, status, trial_ends_at,
--          public.firm_access_open(id) as acces_ouvert
--   from public.firms order by created_at;
-- ============================================================================
