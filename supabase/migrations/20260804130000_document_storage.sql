-- ============================================================================
-- Stockage des fichiers : compartiment privé, cloisonnement et conservation
-- ============================================================================
--
-- Jusqu'ici le coffre-fort ne conservait que des métadonnées : aucun fichier
-- n'était déposé nulle part, alors que l'interface annonçait un stockage
-- chiffré. Cette migration ouvre le dépôt réel.
--
-- Convention de chemin, imposée par les politiques :
--
--   {firm_id}/{client_id}/{document_id}/{nom du fichier}
--
-- Le premier segment porte le cloisonnement : une politique qui compare ce
-- segment à current_firm_id() suffit à isoler chaque cabinet, sans qu'aucun
-- filtre applicatif n'ait à y penser.
--
-- Conservation : la suspension d'un cabinet ferme l'accès, elle ne détruit
-- rien. Aucune suppression automatique n'existe dans ce fichier — c'est
-- délibéré. Les dossiers d'immigration d'un cabinet suspendu restent les
-- siens, et il demeure tenu envers ses propres clients par le Code de
-- déontologie du Collège.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Compartiment privé
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 Mo : au-delà, c'est un envoi hors plateforme
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/heic', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Colonnes du fichier réel
-- ---------------------------------------------------------------------------

alter table public.documents add column if not exists mime_type    text;
alter table public.documents add column if not exists size_bytes   bigint;
alter table public.documents add column if not exists uploaded_by  uuid references auth.users(id) on delete set null;
alter table public.documents add column if not exists archived_at  timestamptz;

comment on column public.documents.sha256 is
  'Empreinte du contenu réel du fichier, calculée côté serveur au dépôt. Nulle tant qu''aucun fichier n''est déposé.';
comment on column public.documents.storage_path is
  'Chemin dans le compartiment « documents ». Nul tant qu''aucun fichier n''est déposé.';

-- ---------------------------------------------------------------------------
-- 3. Cloisonnement du compartiment
-- ---------------------------------------------------------------------------
-- storage.foldername(name) découpe le chemin : [1] est le cabinet, [2] le
-- client. Les politiques s'appuient sur les mêmes fonctions que le reste de
-- l'application, si bien qu'une suspension d'abonnement ferme aussi l'accès
-- aux fichiers — current_firm_id() renvoyant alors NULL.

-- Membres du cabinet : lecture de tout le cabinet.
drop policy if exists documents_firm_read on storage.objects;
create policy documents_firm_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
  );

-- Dépôt : réservé aux rôles autorisés à écrire.
drop policy if exists documents_firm_insert on storage.objects;
create policy documents_firm_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.can_write()
  );

-- Remplacement d'une version : mêmes droits que le dépôt.
drop policy if exists documents_firm_update on storage.objects;
create policy documents_firm_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.can_write()
  );

-- Suppression : consultants réglementés seulement, comme pour les dossiers.
drop policy if exists documents_firm_delete on storage.objects;
create policy documents_firm_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_firm_id()::text
    and public.can_delete()
  );

-- ---------------------------------------------------------------------------
-- 4. Le client dans son propre dossier
-- ---------------------------------------------------------------------------
-- Il lit et dépose ses pièces — le circuit « je télécharge, je signe à la
-- main, je renvoie » l'exige. Il ne peut ni supprimer ni écraser : une pièce
-- déposée fait partie du dossier, et son retrait appartient au cabinet.

drop policy if exists documents_client_read on storage.objects;
create policy documents_client_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_portal_client()
    and (storage.foldername(name))[2] = public.current_client_id()::text
  );

drop policy if exists documents_client_insert on storage.objects;
create policy documents_client_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_portal_client()
    and (storage.foldername(name))[2] = public.current_client_id()::text
  );

-- ---------------------------------------------------------------------------
-- 5. Suspension : avertir, jamais détruire
-- ---------------------------------------------------------------------------

alter table public.firms add column if not exists suspension_notice_at timestamptz;

comment on column public.firms.suspension_notice_at is
  'Date de l''avis envoyé au cabinet après 30 jours de suspension. Informatif : aucune suppression automatique n''en découle.';

-- Cabinets suspendus depuis plus de 30 jours et non encore avertis.
create or replace view public.firms_needing_notice as
select
  f.id,
  f.name,
  f.email,
  f.suspended_at,
  (current_date - f.suspended_at::date) as jours_suspendu
from public.firms f
where f.status = 'suspended'
  and f.suspended_at is not null
  and f.suspended_at < now() - interval '30 days'
  and f.suspension_notice_at is null;

comment on view public.firms_needing_notice is
  'Cabinets à avertir. La suppression des fichiers reste une décision humaine, prise depuis la console d''exploitation : elle n''est jamais déclenchée par l''écoulement du temps.';

commit;
