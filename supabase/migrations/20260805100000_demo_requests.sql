-- ============================================================================
-- Demandes de démonstration
-- ============================================================================
--
-- Les demandes déposées depuis la page publique atterrissaient dans la
-- table `leads` du cabinet exploitant. Deux défauts.
--
-- D'abord elles se mélangeaient aux prospects d'immigration de ce
-- cabinet : un consultant qui cherche une demande de visa dans son
-- pipeline y trouvait des demandes d'essai du logiciel.
--
-- Ensuite et surtout, le compte exploitant n'est membre d'aucun cabinet —
-- c'est ce qui lui interdit l'accès aux dossiers clients. Il ne pouvait
-- donc pas voir les demandes qui lui étaient pourtant destinées. Il
-- fallait se connecter avec un compte de cabinet pour les lire, ce qui
-- revenait à confondre les deux rôles que la séparation des identités
-- avait justement pour but de tenir à part.
--
-- Un prospect de la plateforme n'est pas un prospect d'immigration. Table
-- distincte, visible de l'exploitant seul.
--
-- Idempotente.
-- ============================================================================

begin;

create table if not exists public.demo_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  company      text,
  phone        text,
  message      text,
  -- Langue de la page d'où vient la demande : la réponse et le courriel
  -- d'invitation doivent partir dans celle-là, pas dans celle de l'exploitant.
  locale       text not null default 'fr',
  status       text not null default 'new',
  -- Cabinet ouvert à la suite de cette demande, s'il l'a été. Garde le lien
  -- entre la demande et son aboutissement, sans dupliquer les coordonnées.
  firm_id      uuid references public.firms(id) on delete set null,
  handled_at   timestamptz,
  handled_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.demo_requests drop constraint if exists demo_requests_status_check;
alter table public.demo_requests add constraint demo_requests_status_check
  check (status in ('new', 'opened', 'dismissed'));

create index if not exists demo_requests_status_idx
  on public.demo_requests (status, created_at desc);

alter table public.demo_requests enable row level security;

-- Lecture et traitement : l'exploitant, personne d'autre. Un membre de
-- cabinet n'a rien à connaître des prospects de la plateforme.
drop policy if exists demo_requests_admin_read on public.demo_requests;
create policy demo_requests_admin_read on public.demo_requests
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists demo_requests_admin_update on public.demo_requests;
create policy demo_requests_admin_update on public.demo_requests
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Aucune politique d'insertion, volontairement.
--
-- Le formulaire public écrit avec la clé de service, depuis une action de
-- serveur qui valide, borne les longueurs et rejette le remplissage
-- automatique. Ouvrir l'insertion au rôle anon reviendrait à exposer la
-- table à l'API REST : n'importe qui pourrait la remplir directement, sans
-- passer par aucun de ces contrôles.
revoke all on public.demo_requests from anon;

comment on table public.demo_requests is
  'Demandes de démonstration venues de la page publique. Lisibles par les administrateurs de plateforme seuls ; écrites par la clé de service via l''action du formulaire.';

commit;

-- ============================================================================
-- Contrôles
-- ============================================================================
--   select name, email, company, status, created_at
--   from public.demo_requests order by created_at desc;
-- ============================================================================
