-- ============================================================================
-- Authentification Supabase et verrouillage RLS
-- ============================================================================
--
-- Contexte : la migration initiale a créé des politiques « for dev » en
-- USING (true), sans restriction de rôle. Elles s'appliquaient donc aussi
-- au rôle anon, dont la clé est publique par conception puisqu'elle est
-- livrée au navigateur. N'importe quel visiteur pouvait lire, modifier et
-- supprimer l'intégralité des clients, dossiers, factures, documents — et
-- réécrire le journal d'audit censé être inaltérable.
--
-- Cette migration :
--   1. rattache public.profiles aux comptes auth.users ;
--   2. donne une fonction de résolution du cabinet de l'utilisateur ;
--   3. supprime toutes les politiques ouvertes ;
--   4. les remplace par des politiques réservées au rôle authenticated et
--      cloisonnées par cabinet ;
--   5. rend le journal d'audit réellement inaltérable (insertion seule).
--
-- Idempotente : rejouable sans effet de bord.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Rattachement des profils aux comptes
-- ---------------------------------------------------------------------------
-- La colonne id de profiles est un uuid autonome, sans lien avec auth.users.
-- On ajoute user_id plutôt que de redéfinir la clé primaire, afin de ne pas
-- casser d'éventuelles références existantes.

alter table public.profiles
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;

create index if not exists profiles_user_id_idx on public.profiles (user_id);
create index if not exists profiles_firm_id_idx on public.profiles (firm_id);

-- ---------------------------------------------------------------------------
-- 2. Cabinet de l'utilisateur courant
-- ---------------------------------------------------------------------------
-- security definer : la fonction doit pouvoir lire profiles même quand la
-- politique de profiles n'accorde pas encore l'accès à l'appelant, sans quoi
-- la résolution du cabinet serait circulaire.
-- search_path figé : sans cela, un schéma malveillant en tête de chemin
-- pourrait détourner la résolution des noms dans une fonction privilégiée.

create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select firm_id from public.profiles where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_firm_id() from public;
grant execute on function public.current_firm_id() to authenticated;

-- Rôle CICC de l'utilisateur courant, pour les politiques qui en dépendent.
create or replace function public.current_cicc_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cicc_role from public.profiles where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_cicc_role() from public;
grant execute on function public.current_cicc_role() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Suppression de toutes les politiques ouvertes
-- ---------------------------------------------------------------------------
-- On supprime par balayage plutôt que par nom : la migration initiale a
-- réutilisé le même libellé sur huit tables, et une suppression nominative
-- en oublierait au premier renommage.

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (policyname ilike '%for dev%' or policyname ilike '%public %access%')
  loop
    execute format('drop policy if exists %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    raise notice 'Politique ouverte supprimée : % sur %', pol.policyname, pol.tablename;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Politiques réelles, cloisonnées par cabinet
-- ---------------------------------------------------------------------------
-- « to authenticated » est essentiel : sans cette mention, la politique
-- s'appliquerait aussi au rôle anon, ce qui était précisément le défaut.

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'matters', 'leads', 'invoices',
    'documents', 'calendar_events', 'deadline_rules'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_firm_access on public.%I', t, t);
    execute format(
      'create policy %I_firm_access on public.%I
         for all
         to authenticated
         using (firm_id = public.current_firm_id())
         with check (firm_id = public.current_firm_id())',
      t, t
    );
  end loop;
end $$;

-- Cabinets : un membre voit son cabinet, et lui seul. Aucune écriture par
-- l'application ; la création d'un cabinet relève de l'administration.
alter table public.firms enable row level security;
drop policy if exists firms_read_own on public.firms;
create policy firms_read_own on public.firms
  for select to authenticated
  using (id = public.current_firm_id());

-- Profils : chacun lit les membres de son cabinet et ne modifie que le sien.
alter table public.profiles enable row level security;

drop policy if exists profiles_read_firm on public.profiles;
create policy profiles_read_firm on public.profiles
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Journal d'audit réellement inaltérable
-- ---------------------------------------------------------------------------
-- Lecture et insertion seulement. Aucune politique update ni delete : en RLS,
-- l'absence de politique vaut refus. Une entrée écrite ne peut donc plus être
-- modifiée ni supprimée par l'application, quel que soit le rôle applicatif.

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_read_firm on public.audit_logs;
create policy audit_logs_read_firm on public.audit_logs
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists audit_logs_insert_firm on public.audit_logs;
create policy audit_logs_insert_firm on public.audit_logs
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 6. Retrait des droits résiduels du rôle anonyme
-- ---------------------------------------------------------------------------
-- Ceinture et bretelles : même sans politique, un GRANT de table laissé
-- ouvert reste une surface inutile.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

commit;

-- ============================================================================
-- Vérification manuelle après application
-- ============================================================================
-- Ne doit renvoyer AUCUNE ligne : plus aucune politique ouverte.
--
--   select tablename, policyname, roles, qual
--   from pg_policies
--   where schemaname = 'public' and qual = 'true';
--
-- Doit lister les politiques *_firm_access, toutes en roles = {authenticated} :
--
--   select tablename, policyname, roles from pg_policies
--   where schemaname = 'public' order by tablename;
-- ============================================================================
