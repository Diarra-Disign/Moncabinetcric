-- ============================================================================
-- Demandes d'aide : joindre l'exploitant depuis un écran d'accès fermé
-- ============================================================================
--
-- L'écran d'accès fermé offrait un seul recours : un lien `mailto:` vers
-- l'adresse de la plateforme. Deux défauts l'ont rendu inutilisable, et il a
-- fallu qu'un cabinet reste bloqué pour qu'on les voie.
--
--   · UN LIEN `mailto:` NE FAIT RIEN chez qui lit son courrier dans un onglet.
--     Pas d'erreur, pas de fenêtre : le bouton semble mort. C'est le cas le
--     plus courant aujourd'hui, et c'est le pire moment pour l'imposer — la
--     personne est déjà bloquée dehors.
--
--   · L'ADRESSE VISÉE NE RECEVAIT PAS. `acces@moncabinetcric.com` sert à
--     expédier ; le domaine n'a aucun serveur de courrier entrant, donc tout
--     ce qu'on lui écrit rebondit. Corrigé depuis, mais le fait qu'un écran
--     entier ait dépendu d'une configuration DNS extérieure au produit reste
--     un défaut de conception à lui seul.
--
-- Une demande écrite ici ne dépend plus de rien : ni du client de messagerie
-- du visiteur, ni d'un enregistrement DNS. Elle est une LIGNE, que la console
-- d'exploitation montre. Le courriel qui l'accompagne n'est qu'un rappel ; s'il
-- se perd, la demande demeure.
--
-- ---------------------------------------------------------------------------
-- LE POINT QUI COMMANDE TOUTE LA MIGRATION
-- ---------------------------------------------------------------------------
-- `current_firm_id()` renvoie NULL dès que l'accès du cabinet est fermé — elle
-- appelle firm_access_open() dans sa propre définition. C'est voulu, et c'est
-- ce qui ferme les trente autres politiques d'un coup sans qu'aucune n'ait à y
-- penser.
--
-- Mais c'est aussi ce qui rendrait CETTE table inaccessible précisément quand
-- on en a besoin. Une politique d'insertion écrite sur le modèle des autres
-- refuserait toute demande d'aide venant d'un cabinet fermé, c'est-à-dire la
-- totalité de celles qu'on attend.
--
-- La politique s'appuie donc sur deux fonctions existantes plutôt que sur
-- current_firm_id() :
--
--   · current_firm_id_unchecked() — le cabinet du compte, sans regarder si
--     son accès est ouvert. Déjà employée par les écrans qui doivent
--     EXPLIQUER une fermeture.
--   · current_cicc_role() — non nulle seulement si le profil est `active`.
--
-- Leur conjonction dit exactement ce qu'il faut : « un membre actif, écrivant
-- pour son propre cabinet, que celui-ci soit ouvert ou fermé ». Aucune
-- troisième variante de current_firm_id() n'est introduite — il y en a déjà
-- deux, et une de plus serait une de trop à confondre.
--
-- Idempotente.
-- ============================================================================

begin;

create table if not exists public.support_requests (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firms (id) on delete cascade,
  requested_by    uuid references auth.users (id) on delete set null,
  requester_name  text not null default '',
  requester_email text not null default '',

  -- ─── L'ÉTAT AU MOMENT DE LA DEMANDE ────────────────────────────────────
  --
  -- Recopié, et non joint. Un exploitant qui ouvre la demande trois jours
  -- plus tard verrait sinon l'état COURANT du cabinet, éventuellement déjà
  -- modifié par lui-même — et ne saurait plus ce que la personne avait sous
  -- les yeux quand elle a écrit. C'est le premier renseignement dont il a
  -- besoin, et le seul qu'on ne puisse pas reconstituer après coup.
  firm_plan           text not null default '',
  firm_status         text not null default '',
  subscription_status text not null default '',

  message text not null check (length(btrim(message)) between 1 and 2000),
  -- La réponse doit repartir dans la langue de l'écran où la demande a été
  -- écrite, pas dans celle de l'exploitant.
  locale  text not null default 'fr' check (locale in ('fr', 'en')),

  status     text not null default 'new' check (status in ('new', 'handled')),
  handled_by uuid references auth.users (id) on delete set null,
  handled_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists support_requests_firm_idx
  on public.support_requests (firm_id, created_at desc);

create index if not exists support_requests_pending_idx
  on public.support_requests (created_at desc) where status = 'new';

-- Une seule demande en attente par cabinet.
--
-- Ce n'est pas une limite de débit déguisée, c'est ce que produit l'écran :
-- quelqu'un de bloqué clique, ne voit rien changer, et clique encore. Sans
-- cet index, l'exploitant traite six fois la même demande — et le sixième
-- clic n'aide personne. Le même motif protège déjà `seat_requests`.
create unique index if not exists support_requests_une_seule_en_attente
  on public.support_requests (firm_id) where status = 'new';

alter table public.support_requests enable row level security;

-- Le cabinet relit ce qu'il a envoyé. Une demande qui disparaît sans trace
-- laisse croire qu'elle n'est jamais partie — et fait recommencer.
drop policy if exists support_requests_read on public.support_requests;
create policy support_requests_read on public.support_requests
  for select to authenticated
  using (
    firm_id = public.current_firm_id_unchecked()
    or public.is_platform_admin()
  );

-- L'insertion, seule politique de tout le schéma qui doit fonctionner ALORS
-- QUE L'ACCÈS EST FERMÉ. Voir l'en-tête : d'où l'emploi de la variante
-- `_unchecked` conjuguée au rôle, qui exige un profil actif.
drop policy if exists support_requests_create on public.support_requests;
create policy support_requests_create on public.support_requests
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id_unchecked()
    and public.current_cicc_role() is not null
    -- Un cabinet ne clôt pas sa propre demande : il l'écrit, l'exploitant la
    -- traite. Aucune politique d'UPDATE ne lui est ouverte.
    and status = 'new'
    and handled_by is null
    and handled_at is null
  );

drop policy if exists support_requests_admin on public.support_requests;
create policy support_requests_admin on public.support_requests
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- La politique tient-elle sur un cabinet FERMÉ ? C'est tout l'enjeu.
--   select f.name, public.firm_access_open(f.id) as ouvert
--     from public.firms f order by f.created_at;
--
--   select count(*) from public.support_requests where status = 'new';
-- ============================================================================
