-- ============================================================================
-- Rôles applicatifs et administration de la plateforme
-- ============================================================================
--
-- Deux manques traités ensemble, parce qu'ils se recouvrent.
--
-- 1. Les rôles n'étaient pas appliqués. La politique posée précédemment
--    était « for all to authenticated using (firm_id = current_firm_id()) ».
--    « for all » couvre select, insert, update ET delete : dans un cabinet
--    donné, un profil readonly avait exactement les mêmes droits que le
--    propriétaire et pouvait supprimer un dossier client.
--
-- 2. Aucune notion d'administrateur de plateforme n'existait.
--
-- Règle structurante : un administrateur de plateforme gère les cabinets,
-- jamais leurs dossiers. Aucune politique ci-dessous ne lui ouvre clients,
-- matters, documents, invoices, calendar_events ni audit_logs. C'est ce qui
-- permet de l'affirmer à un cabinet abonné.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Administrateurs de la plateforme
-- ---------------------------------------------------------------------------
-- Table distincte de profiles, et non un rôle supplémentaire dans
-- cicc_role : un administrateur n'est pas un membre de cabinet d'un genre
-- particulier, c'est quelqu'un qui n'en est pas membre du tout.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Un administrateur voit la liste des administrateurs ; personne d'autre.
-- Aucune politique d'écriture : on ne se promeut pas administrateur depuis
-- l'application. L'ajout passe par scripts/grant-platform-admin.mjs, qui
-- emploie la clé de service.
drop policy if exists platform_admins_read on public.platform_admins;
create policy platform_admins_read on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- 2. Capacités déduites du rôle
-- ---------------------------------------------------------------------------
-- Exprimées en fonctions plutôt qu'en listes répétées dans chaque politique :
-- une matrice de droits recopiée sur sept tables diverge au premier
-- changement.

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_cicc_role() in ('owner', 'rcic', 'risia', 'staff');
$$;

-- La suppression d'un dossier client engage la responsabilité
-- professionnelle et les obligations de conservation : elle reste aux
-- consultants réglementés.
create or replace function public.can_delete()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_cicc_role() in ('owner', 'rcic');
$$;

create or replace function public.can_bill()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_cicc_role() in ('owner', 'rcic', 'bookkeeper');
$$;

create or replace function public.is_firm_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_cicc_role() = 'owner';
$$;

do $$
declare f text;
begin
  foreach f in array array['can_write', 'can_delete', 'can_bill', 'is_firm_owner']
  loop
    execute format('revoke all on function public.%I() from public', f);
    execute format('grant execute on function public.%I() to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Politiques par opération
-- ---------------------------------------------------------------------------
-- Le « for all » précédent est remplacé par quatre politiques distinctes.
-- La lecture reste ouverte à tout membre du cabinet ; l'écriture et la
-- suppression dépendent du rôle.

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'matters', 'leads', 'documents', 'calendar_events', 'deadline_rules'
  ]
  loop
    execute format('drop policy if exists %I_firm_access on public.%I', t, t);

    execute format(
      'create policy %I_select on public.%I for select to authenticated
         using (firm_id = public.current_firm_id())', t, t);

    execute format(
      'create policy %I_insert on public.%I for insert to authenticated
         with check (firm_id = public.current_firm_id() and public.can_write())', t, t);

    execute format(
      'create policy %I_update on public.%I for update to authenticated
         using (firm_id = public.current_firm_id() and public.can_write())
         with check (firm_id = public.current_firm_id() and public.can_write())', t, t);

    execute format(
      'create policy %I_delete on public.%I for delete to authenticated
         using (firm_id = public.current_firm_id() and public.can_delete())', t, t);
  end loop;
end $$;

-- Facturation et fidéicommis : le teneur de livres écrit, le personnel non.
drop policy if exists invoices_firm_access on public.invoices;
drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_update on public.invoices;
drop policy if exists invoices_delete on public.invoices;

create policy invoices_select on public.invoices
  for select to authenticated
  using (firm_id = public.current_firm_id());

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.can_bill());

create policy invoices_update on public.invoices
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.can_bill())
  with check (firm_id = public.current_firm_id() and public.can_bill());

-- Une facture émise ne se supprime pas : elle s'annule. Réservé au
-- propriétaire, conformément aux obligations de tenue de livres.
create policy invoices_delete on public.invoices
  for delete to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner());

-- ---------------------------------------------------------------------------
-- 4. Membres du cabinet
-- ---------------------------------------------------------------------------
-- Inviter, promouvoir et retirer un membre relève du seul propriétaire.

drop policy if exists profiles_read_firm on public.profiles;
create policy profiles_read_firm on public.profiles
  for select to authenticated
  using (firm_id = public.current_firm_id() or public.is_platform_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Empêche l'auto-promotion : un membre modifie son nom, pas son rôle
    -- ni son cabinet.
    and firm_id = public.current_firm_id()
    and cicc_role = public.current_cicc_role()
  );

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.is_firm_owner());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner())
  with check (firm_id = public.current_firm_id() and public.is_firm_owner());

drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles
  for delete to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_owner());

-- ---------------------------------------------------------------------------
-- 5. Cabinets
-- ---------------------------------------------------------------------------
-- L'administrateur de plateforme voit tous les cabinets — leur identité et
-- leur statut d'abonnement, jamais leurs dossiers.

drop policy if exists firms_read_own on public.firms;
create policy firms_read_own on public.firms
  for select to authenticated
  using (id = public.current_firm_id() or public.is_platform_admin());

drop policy if exists firms_owner_update on public.firms;
create policy firms_owner_update on public.firms
  for update to authenticated
  using (id = public.current_firm_id() and public.is_firm_owner())
  with check (id = public.current_firm_id() and public.is_firm_owner());

drop policy if exists firms_admin_manage on public.firms;
create policy firms_admin_manage on public.firms
  for insert to authenticated
  with check (public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
-- Aucune politique ne doit plus être en « for all » sur les tables métier :
--
--   select tablename, policyname, cmd, roles from pg_policies
--   where schemaname = 'public' order by tablename, cmd;
--
-- Et aucune politique ne doit accorder les tables de dossiers à un
-- administrateur de plateforme :
--
--   select tablename, policyname, qual from pg_policies
--   where schemaname = 'public'
--     and qual like '%is_platform_admin%'
--     and tablename in ('clients','matters','documents','invoices',
--                       'calendar_events','audit_logs');
-- ============================================================================
