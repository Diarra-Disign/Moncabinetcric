-- ============================================================================
-- Statuts de membre : suspendre sans effacer
-- ============================================================================
--
-- Retirer un membre supprimait sa ligne de `profiles`. Or ce n'est pas une
-- ligne d'annuaire : c'est le rattachement qui relie un compte à son cabinet,
-- et à travers lui toute la traçabilité de ce qu'il a fait. La supprimer, ce
-- n'est pas fermer un accès — c'est effacer la réponse à « qui a déposé cette
-- pièce », dans une application où cette réponse a une valeur déontologique.
--
-- Le cabinet perdait aussi le seul moyen de suspendre quelqu'un
-- temporairement : un adjoint en congé, un agent dont on vérifie une
-- irrégularité. Il fallait choisir entre tout garder et tout effacer.
--
-- ---------------------------------------------------------------------------
-- L'ENDROIT LE PLUS DANGEREUX DU SCHÉMA
-- ---------------------------------------------------------------------------
-- Cette migration modifie current_firm_id(), sur laquelle s'adossent une
-- trentaine de politiques RLS, le portail client et le connecteur. Une erreur
-- ici ne casse pas un écran : elle ferme l'application à tous les cabinets à
-- la fois, ou pire, l'ouvre.
--
-- Trois précautions, dans cet ordre :
--
--   1. La colonne est créée avec DEFAULT 'active' AVANT que la fonction ne la
--      lise. Toute ligne existante est donc déjà conforme au moment où la
--      condition entre en vigueur — aucune fenêtre pendant laquelle un membre
--      légitime serait refusé.
--
--   2. La condition est ajoutée à current_firm_id() et à current_cicc_role(),
--      jamais recopiée dans une politique. Il reste un seul endroit à lire
--      pour savoir qui entre.
--
--   3. current_firm_id_unchecked() n'est PAS touchée. C'est elle qui permet à
--      un membre suspendu de lire le nom de son cabinet et de comprendre ce
--      qui lui arrive, au lieu de voir une application vide.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le statut d'un rattachement
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists status       text not null default 'active';
alter table public.profiles add column if not exists status_at    timestamptz;
alter table public.profiles add column if not exists status_by    uuid references auth.users(id) on delete set null;
-- Motif facultatif, à l'usage du cabinet. Jamais montré au membre : ce serait
-- une notification, et ce champ sert à se souvenir, pas à annoncer.
alter table public.profiles add column if not exists status_note  text;

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('active', 'suspended', 'revoked'));

comment on column public.profiles.status is
  'active : entre normalement. suspended : accès fermé, réversible, place libérée. revoked : accès fermé définitivement, rattachement conservé pour la traçabilité. Aucun de ces états ne supprime quoi que ce soit.';

create index if not exists profiles_firm_status_idx on public.profiles (firm_id, status);

-- ---------------------------------------------------------------------------
-- 2. Le verrou
-- ---------------------------------------------------------------------------
-- Un membre non actif se comporte exactement comme un membre d'un cabinet
-- suspendu : current_firm_id() renvoie NULL, et les trente politiques qui
-- comparent firm_id à ce résultat refusent d'elles-mêmes. Aucune politique
-- n'a besoin d'être modifiée, et aucune ne peut oublier ce contrôle.

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
    and p.status = 'active'
    and public.firm_access_open(p.firm_id)
  limit 1;
$$;

-- Le rôle suit le statut. Sans cette condition, un propriétaire suspendu
-- resterait « owner » aux yeux de is_firm_owner() — et conserverait donc les
-- droits d'un propriétaire sur les rares politiques qui n'exigent pas aussi
-- current_firm_id().
create or replace function public.current_cicc_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select cicc_role
  from public.profiles
  where user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. Les places
-- ---------------------------------------------------------------------------
-- Seul un membre actif occupe une place. Suspendre en libère une aussitôt,
-- ce qui est le comportement attendu : on ne paie pas pour quelqu'un qui ne
-- peut pas entrer. Un membre révoqué n'en occupe évidemment aucune, mais sa
-- ligne demeure — c'est toute la différence avec une suppression.
--
-- Les invitations en attente continuent d'occuper une place : sans cela, on
-- inviterait dix personnes sous un forfait qui en autorise trois, et le refus
-- n'arriverait qu'au moment le plus désagréable — à l'acceptation.

create or replace function public.firm_seats_taken(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles p
      where p.firm_id = f_id and p.status = 'active')
  + (select count(*) from public.invitations i
      where i.firm_id = f_id
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now());
$$;

revoke all on function public.firm_seats_taken(uuid) from public;
grant execute on function public.firm_seats_taken(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Qui peut changer un statut
-- ---------------------------------------------------------------------------
-- La politique d'écriture de `profiles` doit permettre au propriétaire de
-- suspendre un membre — mais jamais de se suspendre lui-même : un cabinet
-- dont le propriétaire s'est fermé la porte n'a plus personne pour la rouvrir,
-- et se retrouve dans l'impasse qu'on a déjà rencontrée avec les cabinets sans
-- propriétaire.

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and public.is_firm_owner()
    and user_id <> auth.uid()
  )
  with check (
    firm_id = public.current_firm_id()
    and public.is_firm_owner()
    and user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. Un membre reste lisible sous suspension
-- ---------------------------------------------------------------------------
-- Même raison qu'au point 3 de la migration des abonnements : sans lecture,
-- l'écran d'explication n'aurait rien à afficher, et le membre conclurait que
-- ses données ont disparu.

drop policy if exists profiles_read_firm on public.profiles;
create policy profiles_read_firm on public.profiles
  for select to authenticated
  using (firm_id = public.current_firm_id_unchecked() or public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select f.name, p.full_name, p.cicc_role, p.status,
--          public.firm_seats_taken(f.id) || '/' ||
--            coalesce(public.firm_seat_limit(f.id)::text, '∞') as places
--     from public.profiles p
--     join public.firms f on f.id = p.firm_id
--    order by f.name, p.created_at;
--
--   -- Aucune ligne ne doit avoir un statut hors des trois prévus :
--   select status, count(*) from public.profiles group by 1;
-- ============================================================================
