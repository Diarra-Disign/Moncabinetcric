-- ============================================================================
-- Permissions : le rôle propose, la permission décide
-- ============================================================================
--
-- Les droits d'écriture reposaient sur trois fonctions à listes fermées :
--
--   can_write()  : owner, rcic, risia, staff
--   can_delete() : owner, rcic
--   can_bill()   : owner, rcic, bookkeeper
--
-- Cela fonctionnait, mais n'admettait aucune nuance. Un cabinet ne pouvait pas
-- confier la facturation à son adjointe sans lui donner tout le reste, ni
-- retirer la suppression à un consultant sans le rétrograder. Et modifier un
-- droit demandait une migration.
--
-- ---------------------------------------------------------------------------
-- CE QUI EST FAIT, ET CE QUI NE L'EST PAS
-- ---------------------------------------------------------------------------
-- Vingt politiques RLS appellent ces trois fonctions. On ne les touche PAS :
-- les fonctions gardent leur nom et leur signature, et changent seulement
-- d'implémentation. C'est le même geste que pour firm_effective_plan() — la
-- règle se déplace au point unique, et les vingt politiques en héritent sans
-- qu'aucune ne soit réécrite. Une réécriture de vingt politiques est une
-- occasion d'en oublier une, et une politique oubliée ne se voit pas.
--
-- Trois niveaux, du plus général au plus précis :
--
--   1. le rôle porte des permissions par défaut (role_permissions) ;
--   2. le cabinet peut les ajuster pour un membre (profile_permissions) ;
--   3. le propriétaire garde tout, sans condition — sans quoi un cabinet
--      pourrait se retrouver sans personne pour rouvrir quoi que ce soit.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le vocabulaire
-- ---------------------------------------------------------------------------

create table if not exists public.permissions (
  key          text primary key,
  label_fr     text not null,
  label_en     text not null,
  category     text not null default 'general',
  rank         int not null default 100,
  -- Une permission « réservée » ne se délègue pas : elle reste au
  -- propriétaire quoi qu'on écrive dans role_permissions. Y toucher
  -- reviendrait à laisser un adjoint modifier l'abonnement du cabinet.
  owner_only   boolean not null default false,
  description_fr text
);

insert into public.permissions (key, label_fr, label_en, category, rank, owner_only, description_fr) values
  ('records.write',   'Créer et modifier les dossiers', 'Create and edit records', 'dossiers', 10, false,
   'Clients, dossiers, documents, prospects et rendez-vous.'),
  ('records.delete',  'Supprimer',                      'Delete',                 'dossiers', 20, false,
   'Geste irréversible : à réserver à qui répond du dossier.'),
  ('invoices.write',  'Facturer',                       'Invoicing',              'argent',   30, false,
   'Émettre et modifier les factures des clients du cabinet.'),
  ('portal.manage',   'Ouvrir les accès du portail',    'Manage portal access',   'clients',  40, false,
   'Créer le compte d''un client et lui remettre son mot de passe temporaire.'),
  ('signatures.request','Demander une signature',       'Request signatures',     'dossiers', 50, false, null),
  ('audit.read',      'Consulter le journal d''audit',  'Read the audit log',     'conformite',60, false, null),
  ('firm.settings',   'Modifier l''identité du cabinet','Firm identity',          'cabinet',  70, true, null),
  ('firm.members',    'Gérer les membres',              'Manage members',         'cabinet',  80, true,
   'Inviter, suspendre, révoquer, changer les rôles et les permissions.'),
  ('firm.billing',    'Gérer l''abonnement',            'Manage the subscription','cabinet',  90, true,
   'Souscrire, changer de forfait, accéder au portail de facturation Stripe.'),
  ('firm.connector',  'Régler le connecteur IA',        'AI connector settings',  'cabinet', 100, true, null)
on conflict (key) do update set
  label_fr = excluded.label_fr, label_en = excluded.label_en,
  category = excluded.category, rank = excluded.rank,
  owner_only = excluded.owner_only, description_fr = excluded.description_fr;

-- ---------------------------------------------------------------------------
-- 2. Ce que chaque rôle porte par défaut
-- ---------------------------------------------------------------------------
-- Reprend exactement les trois listes actuelles, pour que la bascule ne change
-- le droit de personne. Une migration qui modifie les droits ET leur mécanisme
-- rend impossible de savoir lequel des deux a causé un refus.

create table if not exists public.role_permissions (
  cicc_role  text not null,
  permission text not null references public.permissions(key) on delete cascade,
  granted    boolean not null default true,
  primary key (cicc_role, permission)
);

insert into public.role_permissions (cicc_role, permission, granted) values
  -- Propriétaire : tout, y compris les permissions réservées.
  ('owner','records.write',true),      ('owner','records.delete',true),
  ('owner','invoices.write',true),     ('owner','portal.manage',true),
  ('owner','signatures.request',true), ('owner','audit.read',true),
  ('owner','firm.settings',true),      ('owner','firm.members',true),
  ('owner','firm.billing',true),       ('owner','firm.connector',true),

  -- Consultant réglementé : tout l'opérationnel, rien du cabinet.
  ('rcic','records.write',true),       ('rcic','records.delete',true),
  ('rcic','invoices.write',true),      ('rcic','portal.manage',true),
  ('rcic','signatures.request',true),  ('rcic','audit.read',true),
  ('rcic','firm.settings',false),      ('rcic','firm.members',false),
  ('rcic','firm.billing',false),       ('rcic','firm.connector',false),

  -- Stagiaire en immigration : travaille sous supervision. Il écrit, mais ne
  -- supprime pas et n'engage pas le cabinet par une signature.
  ('risia','records.write',true),      ('risia','records.delete',false),
  ('risia','invoices.write',false),    ('risia','portal.manage',false),
  ('risia','signatures.request',false),('risia','audit.read',false),
  ('risia','firm.settings',false),     ('risia','firm.members',false),
  ('risia','firm.billing',false),      ('risia','firm.connector',false),

  -- Personnel administratif : la matière courante, sans les actes réservés.
  ('staff','records.write',true),      ('staff','records.delete',false),
  ('staff','invoices.write',false),    ('staff','portal.manage',false),
  ('staff','signatures.request',false),('staff','audit.read',false),
  ('staff','firm.settings',false),     ('staff','firm.members',false),
  ('staff','firm.billing',false),      ('staff','firm.connector',false),

  -- Tenue de livres : l'argent, et rien d'autre. Il ne voit pas moins de
  -- dossiers pour autant — la RLS borne au cabinet, pas au métier.
  ('bookkeeper','records.write',false),('bookkeeper','records.delete',false),
  ('bookkeeper','invoices.write',true),('bookkeeper','portal.manage',false),
  ('bookkeeper','signatures.request',false),('bookkeeper','audit.read',false),
  ('bookkeeper','firm.settings',false),('bookkeeper','firm.members',false),
  ('bookkeeper','firm.billing',false), ('bookkeeper','firm.connector',false),

  -- Lecture seule.
  ('readonly','records.write',false),  ('readonly','records.delete',false),
  ('readonly','invoices.write',false), ('readonly','portal.manage',false),
  ('readonly','signatures.request',false),('readonly','audit.read',false),
  ('readonly','firm.settings',false),  ('readonly','firm.members',false),
  ('readonly','firm.billing',false),   ('readonly','firm.connector',false)
on conflict (cicc_role, permission) do update set granted = excluded.granted;

-- ---------------------------------------------------------------------------
-- 3. L'ajustement pour un membre précis
-- ---------------------------------------------------------------------------
-- C'est ce qui permet de confier la facturation à une adjointe sans lui donner
-- le reste, ou de retirer la suppression à quelqu'un sans le rétrograder.

create table if not exists public.profile_permissions (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  permission  text not null references public.permissions(key) on delete cascade,
  granted     boolean not null,
  granted_by  uuid references auth.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (profile_id, permission)
);

create index if not exists profile_permissions_profile_idx
  on public.profile_permissions (profile_id);

-- ---------------------------------------------------------------------------
-- 4. La résolution
-- ---------------------------------------------------------------------------
-- L'ordre des quatre termes EST la règle, et elle ne se lit qu'ici.

create or replace function public.member_can(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with moi as (
    select p.id, p.cicc_role
    from public.profiles p
    where p.user_id = auth.uid()
      and p.status = 'active'
      and public.firm_access_open(p.firm_id)
    limit 1
  )
  select coalesce(
    -- 1. Le propriétaire garde tout. Sans cette ligne, un cabinet pourrait
    --    se retrouver sans personne pour rouvrir quoi que ce soit — l'impasse
    --    déjà rencontrée avec les cabinets sans propriétaire.
    (select true from moi where moi.cicc_role = 'owner'),
    -- 2. Une permission réservée ne se délègue pas, quoi qu'en dise la suite.
    (select false from public.permissions
      where key = permission_key and owner_only),
    -- 3. L'ajustement posé sur ce membre.
    (select pp.granted from public.profile_permissions pp, moi
      where pp.profile_id = moi.id and pp.permission = permission_key),
    -- 4. Le défaut de son rôle.
    (select rp.granted from public.role_permissions rp, moi
      where rp.cicc_role = moi.cicc_role and rp.permission = permission_key),
    false
  );
$$;

comment on function public.member_can(text) is
  'Autorité unique sur les droits d''un membre : propriétaire, puis permission réservée, puis ajustement individuel, puis défaut du rôle. Aucun écran ni aucune action ne doit reconstituer cette règle.';

revoke all on function public.member_can(text) from public;
grant execute on function public.member_can(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Les trois fonctions historiques changent de moteur, pas de nom
-- ---------------------------------------------------------------------------
-- Vingt politiques les appellent. Elles continuent de le faire, et héritent
-- du nouveau mécanisme sans qu'aucune ne soit réécrite.

create or replace function public.can_write()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select public.member_can('records.write'); $$;

create or replace function public.can_delete()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select public.member_can('records.delete'); $$;

create or replace function public.can_bill()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select public.member_can('invoices.write'); $$;

-- ---------------------------------------------------------------------------
-- 6. Qui lit, qui écrit
-- ---------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profile_permissions enable row level security;

-- Le vocabulaire et les défauts sont lisibles par tous : un membre doit
-- pouvoir comprendre ce qu'il n'a pas le droit de faire, et pourquoi.
drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions
  for select to authenticated using (true);

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);

-- Les défauts par rôle ne se modifient que par l'exploitant : ce sont les
-- conventions du produit, pas un réglage de cabinet.
drop policy if exists role_permissions_admin on public.role_permissions;
create policy role_permissions_admin on public.role_permissions
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists permissions_admin on public.permissions;
create policy permissions_admin on public.permissions
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Un membre voit les ajustements de son propre cabinet ; seul quelqu'un qui
-- porte `firm.members` les modifie. La condition sur le cabinet est portée par
-- une sous-requête sur profiles, car profile_permissions n'a pas de firm_id —
-- l'ajouter dupliquerait une information que profiles détient déjà, et deux
-- copies d'une clé étrangère finissent par diverger.
drop policy if exists profile_permissions_read on public.profile_permissions;
create policy profile_permissions_read on public.profile_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_permissions.profile_id
        and p.firm_id = public.current_firm_id_unchecked()
    )
  );

drop policy if exists profile_permissions_manage on public.profile_permissions;
create policy profile_permissions_manage on public.profile_permissions
  for all to authenticated
  using (
    public.member_can('firm.members')
    and exists (
      select 1 from public.profiles p
      where p.id = profile_permissions.profile_id
        and p.firm_id = public.current_firm_id()
        -- On n'ajuste pas ses propres permissions : c'est par là qu'on se
        -- donne des droits.
        and p.user_id <> auth.uid()
    )
  )
  with check (
    public.member_can('firm.members')
    and exists (
      select 1 from public.profiles p
      where p.id = profile_permissions.profile_id
        and p.firm_id = public.current_firm_id()
        and p.user_id <> auth.uid()
    )
  );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- Les droits n'ont pas dû changer pour les rôles existants :
--   select cicc_role,
--          bool_or(granted) filter (where permission = 'records.write')  as ecrit,
--          bool_or(granted) filter (where permission = 'records.delete') as supprime,
--          bool_or(granted) filter (where permission = 'invoices.write') as facture
--     from public.role_permissions group by 1 order by 1;
--
--   ./cric permissions
-- ============================================================================
