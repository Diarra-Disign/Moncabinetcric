-- ============================================================================
-- Signature électronique
-- ============================================================================
--
-- La loi québécoise fait dépendre l'opposabilité d'une signature de deux
-- conditions : l'intégrité du document doit être assurée, et le lien entre
-- la signature et le document maintenu depuis la signature et par la suite.
--
-- Toute la conception en découle. Ce qui fait preuve n'est pas le tracé
-- manuscrit — un dessin se recopie — mais l'empreinte du fichier figée à
-- l'instant de la signature. Comparer cette empreinte à celle du fichier
-- actuel répond à la seule question qui compte : est-ce bien ce
-- document-là qui a été signé ?
--
-- Ce fichier suppose acquis :
--   - un fichier réellement déposé (migration document_storage)
--   - une empreinte calculée côté serveur sur ses octets
--   - un journal d'audit chaîné et infalsifiable
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Demandes de signature
-- ---------------------------------------------------------------------------
-- Une demande dit qui doit signer quoi. Elle fige l'empreinte du document
-- au moment de l'envoi : si le fichier change ensuite, la demande devient
-- caduque plutôt que de porter sur un contenu différent de celui présenté.

create table if not exists public.signature_requests (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  document_id    uuid not null references public.documents(id) on delete cascade,
  client_id      uuid references public.clients(id) on delete set null,
  -- Empreinte au moment de l'envoi en signature.
  document_sha256 text not null,
  requested_by   uuid references auth.users(id) on delete set null,
  requested_at   timestamptz not null default now(),
  expires_at     timestamptz,
  status         text not null default 'pending'
                 check (status in ('pending', 'completed', 'cancelled', 'stale')),
  cancelled_at   timestamptz,
  note           text
);

create index if not exists signature_requests_firm_idx on public.signature_requests (firm_id);
create index if not exists signature_requests_doc_idx on public.signature_requests (document_id);

-- ---------------------------------------------------------------------------
-- 2. Signatures apposées
-- ---------------------------------------------------------------------------

create table if not exists public.signatures (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.signature_requests(id) on delete cascade,
  firm_id         uuid not null references public.firms(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,

  signer_kind     text not null check (signer_kind in ('member', 'client')),
  signer_user_id  uuid references auth.users(id) on delete set null,
  signer_name     text not null,
  signer_email    text not null,
  -- Rôle CICC du signataire s'il est membre : un acte réservé doit pouvoir
  -- être rattaché à un consultant réglementé nommément.
  signer_role     text,
  rcic_number     text,

  -- Empreinte du fichier au moment précis de la signature. C'est la pièce
  -- maîtresse : sans elle, la signature ne se rattache à aucun contenu.
  document_sha256 text not null,

  -- Horodatage serveur, jamais fourni par l'appelant.
  signed_at       timestamptz not null default now(),
  ip_address      text,
  user_agent      text,
  -- Tracé manuscrit, conservé à titre illustratif. Il ne fait pas la
  -- preuve à lui seul.
  signature_image text,

  unique (request_id, signer_user_id)
);

create index if not exists signatures_firm_idx on public.signatures (firm_id);
create index if not exists signatures_doc_idx on public.signatures (document_id);

-- ---------------------------------------------------------------------------
-- 3. Horodatage et empreinte imposés par la base
-- ---------------------------------------------------------------------------
-- Une date de signature fournie par le client serait antidatable, et une
-- empreinte fournie n'attesterait que de ce que l'appelant a bien voulu
-- déclarer. Le déclencheur les recalcule.

create or replace function public.signatures_seal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  empreinte_actuelle text;
begin
  new.signed_at := now();

  select d.sha256 into empreinte_actuelle
  from public.documents d
  where d.id = new.document_id;

  if empreinte_actuelle is null then
    raise exception 'Aucun fichier déposé pour ce document : rien à signer.';
  end if;

  -- L'empreinte vient de la fiche, pas de l'appelant.
  new.document_sha256 := empreinte_actuelle;

  -- Le document ne doit pas avoir changé depuis l'envoi en signature.
  if exists (
    select 1 from public.signature_requests r
    where r.id = new.request_id
      and r.document_sha256 is distinct from empreinte_actuelle
  ) then
    raise exception
      'Le document a été modifié depuis la demande de signature : la demande doit être refaite.';
  end if;

  return new;
end;
$$;

drop trigger if exists signatures_seal_trg on public.signatures;
create trigger signatures_seal_trg
  before insert on public.signatures
  for each row execute function public.signatures_seal();

-- Une signature ne se modifie pas. Comme le journal d'audit, le refus vaut
-- aussi pour service_role : un script ne doit pas pouvoir antidater.
create or replace function public.signatures_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Une signature ne peut être ni modifiée ni supprimée.';
end;
$$;

drop trigger if exists signatures_no_change on public.signatures;
create trigger signatures_no_change
  before update or delete on public.signatures
  for each row execute function public.signatures_immutable();

-- ---------------------------------------------------------------------------
-- 4. Accès
-- ---------------------------------------------------------------------------

alter table public.signature_requests enable row level security;
alter table public.signatures enable row level security;

-- Demandes : le cabinet les gère, le client voit celles qui le concernent.
drop policy if exists sig_req_firm on public.signature_requests;
create policy sig_req_firm on public.signature_requests
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and public.can_write());

drop policy if exists sig_req_client on public.signature_requests;
create policy sig_req_client on public.signature_requests
  for select to authenticated
  using (public.is_portal_client() and client_id = public.current_client_id());

-- Signatures : lecture par le cabinet et par le client concerné.
drop policy if exists sig_read_firm on public.signatures;
create policy sig_read_firm on public.signatures
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists sig_read_client on public.signatures;
create policy sig_read_client on public.signatures
  for select to authenticated
  using (
    public.is_portal_client()
    and document_id in (
      select d.id from public.documents d where d.client_id = public.current_client_id()
    )
  );

-- On ne signe que pour soi-même : signer_user_id doit être l'appelant.
drop policy if exists sig_insert_member on public.signatures;
create policy sig_insert_member on public.signatures
  for insert to authenticated
  with check (
    signer_user_id = auth.uid()
    and signer_kind = 'member'
    and firm_id = public.current_firm_id()
  );

drop policy if exists sig_insert_client on public.signatures;
create policy sig_insert_client on public.signatures
  for insert to authenticated
  with check (
    signer_user_id = auth.uid()
    and signer_kind = 'client'
    and public.is_portal_client()
    and document_id in (
      select d.id from public.documents d where d.client_id = public.current_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Certificat de signature
-- ---------------------------------------------------------------------------
-- Reconstitue la preuve : qui a signé, quand, sur quelle empreinte, et si
-- le fichier actuel correspond toujours.

create or replace function public.signature_certificate(doc_id uuid)
returns table (
  signer_name     text,
  signer_email    text,
  signer_kind     text,
  signer_role     text,
  rcic_number     text,
  signed_at       timestamptz,
  ip_address      text,
  signed_sha256   text,
  current_sha256  text,
  still_matching  boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.signer_name, s.signer_email, s.signer_kind, s.signer_role, s.rcic_number,
    s.signed_at, s.ip_address,
    s.document_sha256,
    d.sha256,
    s.document_sha256 = d.sha256
  from public.signatures s
  join public.documents d on d.id = s.document_id
  where s.document_id = doc_id
    and (
      d.firm_id = public.current_firm_id()
      or (public.is_portal_client() and d.client_id = public.current_client_id())
    )
  order by s.signed_at asc;
$$;

revoke all on function public.signature_certificate(uuid) from public;
grant execute on function public.signature_certificate(uuid) to authenticated;

commit;
