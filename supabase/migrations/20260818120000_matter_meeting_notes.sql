-- ============================================================================
-- Registre officiel des Rencontres & Notes de Dossier (CICC)
-- ============================================================================
--
-- Chaque rencontre avec le client (consultation, appel, rendez-vous, visio, etc.)
-- génère une fiche indépendante avec sa référence unique (REN-YYYY-XXXX), sa date,
-- son auteur, son contenu détaillé et son statut.
--
-- Règles d'intégrité :
-- 1. Une nouvelle rencontre ne doit JAMAIS écraser une note existante.
-- 2. Toute note est interne au cabinet par défaut (visibility = 'internal').
-- 3. Une note finalisée ne peut pas être modifiée silencieusement : toute
--    modification ultérieure consigne une entrée dans son historique (history).
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Table principale : matter_meeting_notes
-- ---------------------------------------------------------------------------

create table if not exists public.matter_meeting_notes (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references public.firms(id) on delete cascade,
  matter_id           uuid not null references public.matters(id) on delete cascade,
  client_id           uuid references public.clients(id) on delete set null,
  calendar_event_id   uuid references public.calendar_events(id) on delete set null,

  reference           text not null,
  meeting_date        date not null default current_date,
  meeting_time        time,
  duration_minutes    integer not null default 60,

  meeting_type        text not null default 'consultation'
                      check (meeting_type in (
                        'consultation', 'appointment', 'in_person',
                        'phone', 'videoconference', 'google_meet',
                        'zoom', 'whatsapp', 'email_exchange', 'other'
                      )),
  meeting_type_other  text,

  reason              text not null default 'suivi_dossier'
                      check (reason in (
                        'consultation_initiale', 'suivi_dossier',
                        'verification_documents', 'preparation_demande',
                        'signature_document', 'explication_procedure',
                        'mise_a_jour', 'demande_info', 'autre'
                      )),
  reason_other        text,

  subject             text not null,
  content             text not null,

  -- Sections structurées du compte rendu
  sections            jsonb not null default '{}'::jsonb,

  -- Prochain rendez-vous / suivi convenu (facultatif)
  next_meeting_date   date,
  next_meeting_time   time,
  next_meeting_reason text,
  next_meeting_notes  text,

  -- Statut et visibilité
  status              text not null default 'draft'
                      check (status in ('draft', 'finalized', 'archived')),
  visibility          text not null default 'internal'
                      check (visibility in ('internal', 'shared_client')),

  shared_at           timestamptz,
  shared_by           uuid references public.profiles(id) on delete set null,

  -- Auteur et traçabilité
  created_by          uuid references public.profiles(id) on delete set null,
  created_by_name     text,
  created_at          timestamptz not null default now(),

  updated_by          uuid references public.profiles(id) on delete set null,
  updated_by_name     text,
  updated_at          timestamptz not null default now(),

  finalized_at        timestamptz,
  finalized_by        uuid references public.profiles(id) on delete set null,

  -- Historique inaltérable des révisions après finalisation
  history             jsonb not null default '[]'::jsonb
);

create index if not exists matter_meeting_notes_matter_idx
  on public.matter_meeting_notes(matter_id, meeting_date desc, created_at desc);

create index if not exists matter_meeting_notes_firm_idx
  on public.matter_meeting_notes(firm_id, meeting_date desc);

create index if not exists matter_meeting_notes_client_idx
  on public.matter_meeting_notes(client_id)
  where client_id is not null;

comment on table public.matter_meeting_notes is
  'Registre officiel des rencontres et notes de dossier CICC. Jamais écrasées.';

-- ---------------------------------------------------------------------------
-- 2. Table de liaison avec les documents du dossier : meeting_note_documents
-- ---------------------------------------------------------------------------

create table if not exists public.meeting_note_documents (
  meeting_note_id uuid not null references public.matter_meeting_notes(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  firm_id         uuid not null references public.firms(id) on delete cascade,
  added_at        timestamptz not null default now(),
  primary key (meeting_note_id, document_id)
);

create index if not exists meeting_note_docs_doc_idx
  on public.meeting_note_documents(document_id);

-- ---------------------------------------------------------------------------
-- 3. Fonction pour générer la prochaine référence par cabinet (REN-YYYY-XXXX)
-- ---------------------------------------------------------------------------

create or replace function public.prochaine_reference_rencontre(f_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  annee text := to_char(current_date, 'YYYY');
  prefixe text := 'REN-' || annee || '-';
  max_num integer := 0;
  dernier text;
begin
  select reference into dernier
    from public.matter_meeting_notes
   where firm_id = f_id
     and reference like prefixe || '%'
   order by reference desc
   limit 1;

  if dernier is not null then
    max_num := coalesce(substring(dernier from 'REN-[0-9]{4}-([0-9]+)')::integer, 0);
  end if;

  return prefixe || lpad((max_num + 1)::text, 4, '0');
end;
$$;

revoke all on function public.prochaine_reference_rencontre(uuid) from public;
grant execute on function public.prochaine_reference_rencontre(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cloisonnement et sécurité RLS
-- ---------------------------------------------------------------------------

alter table public.matter_meeting_notes enable row level security;
alter table public.meeting_note_documents enable row level security;

-- Membres du cabinet : lecture de toutes les notes de leur cabinet
drop policy if exists meeting_notes_firm_read on public.matter_meeting_notes;
create policy meeting_notes_firm_read on public.matter_meeting_notes
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- Membres du cabinet : écriture / modification
drop policy if exists meeting_notes_firm_write on public.matter_meeting_notes;
create policy meeting_notes_firm_write on public.matter_meeting_notes
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('records.write'))
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

-- Documents associés
drop policy if exists meeting_note_docs_firm_read on public.meeting_note_documents;
create policy meeting_note_docs_firm_read on public.meeting_note_documents
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists meeting_note_docs_firm_write on public.meeting_note_documents;
create policy meeting_note_docs_firm_write on public.meeting_note_documents
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('records.write'))
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

commit;
