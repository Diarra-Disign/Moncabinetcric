-- ============================================================================
-- Invitations
-- ============================================================================
--
-- Jusqu'ici, ouvrir l'accès à un nouveau membre ou à un cabinet testeur
-- exigeait de lancer un script à la main et de fixer soi-même un mot de
-- passe. Cette table permet d'inviter par lien, la personne choisissant
-- elle-même son mot de passe.
--
-- Le jeton n'est PAS stocké. Seule son empreinte l'est, exactement comme
-- un mot de passe : si la base fuite, les invitations en attente restent
-- inutilisables. Le jeton en clair n'existe qu'une fois, au moment de la
-- création, et n'est plus jamais récupérable.
--
-- Idempotente.
-- ============================================================================

begin;

-- pgcrypto est déjà installé par Supabase dans le schéma « extensions »,
-- pas dans « public ». Les appels doivent donc être qualifiés : un
-- search_path restreint à public ne le trouve pas, et une fonction
-- security definer ne doit pas élargir son chemin pour autant.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  email        text not null,
  cicc_role    text not null default 'staff',
  -- Empreinte SHA-256 du jeton, jamais le jeton lui-même.
  token_hash   text not null unique,
  invited_by   uuid references auth.users(id) on delete set null,
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.invitations drop constraint if exists invitations_role_check;
alter table public.invitations add constraint invitations_role_check
  check (cicc_role in ('owner', 'rcic', 'risia', 'staff', 'bookkeeper', 'readonly'));

create index if not exists invitations_firm_idx on public.invitations (firm_id);
create index if not exists invitations_email_idx on public.invitations (lower(email));

-- Une seule invitation vivante par adresse et par cabinet : sans cela, on
-- accumule des liens valides qu'on ne sait plus révoquer.
create unique index if not exists invitations_pending_unique
  on public.invitations (firm_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;

-- Lecture : le propriétaire du cabinet suit ses invitations, l'exploitant
-- les siennes. Personne d'autre — et surtout pas le rôle anon, qui pourrait
-- sinon énumérer les adresses invitées.
drop policy if exists invitations_read on public.invitations;
create policy invitations_read on public.invitations
  for select to authenticated
  using (
    (firm_id = public.current_firm_id() and public.is_firm_owner())
    or public.is_platform_admin()
  );

drop policy if exists invitations_owner_create on public.invitations;
create policy invitations_owner_create on public.invitations
  for insert to authenticated
  with check (
    (firm_id = public.current_firm_id() and public.is_firm_owner())
    or public.is_platform_admin()
  );

-- Révoquer, oui ; modifier une invitation acceptée, non.
drop policy if exists invitations_revoke on public.invitations;
create policy invitations_revoke on public.invitations
  for update to authenticated
  using (
    accepted_at is null
    and (
      (firm_id = public.current_firm_id() and public.is_firm_owner())
      or public.is_platform_admin()
    )
  )
  with check (
    (firm_id = public.current_firm_id() and public.is_firm_owner())
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- Consultation d'une invitation par son jeton
-- ---------------------------------------------------------------------------
-- La page d'accueil de l'invité doit pouvoir afficher « vous êtes invité
-- au cabinet X » AVANT toute authentification. Une politique de lecture
-- ouverte exposerait la liste des invitations ; cette fonction ne rend
-- donc que le strict nécessaire, et seulement contre un jeton valide.
--
-- Aucune information n'est renvoyée pour un jeton inconnu, expiré, révoqué
-- ou déjà utilisé : impossible de distinguer ces cas de l'extérieur, ce
-- qui évite d'en faire un oracle.

create or replace function public.invitation_preview(raw_token text)
returns table (email text, firm_name text, cicc_role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.email, f.name, i.cicc_role
  from public.invitations i
  join public.firms f on f.id = i.firm_id
  where i.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now();
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;

commit;

-- ============================================================================
-- Contrôles
-- ============================================================================
--   select i.email, f.name, i.cicc_role, i.expires_at, i.accepted_at
--   from public.invitations i join public.firms f on f.id = i.firm_id
--   order by i.created_at desc;
-- ============================================================================
