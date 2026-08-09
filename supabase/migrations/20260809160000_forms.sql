-- ============================================================================
-- Formulaires officiels au dossier — IMM 5476 et les suivants
-- ============================================================================
--
-- L'IMM 5476 n'existait que comme document de démonstration : un fichier au
-- nom évocateur, avec du texte à l'intérieur. Rien ne le reliait à un dossier,
-- rien n'en suivait le sort, et il n'existait aucune version.
--
-- ---------------------------------------------------------------------------
-- CE QUE CE MODÈLE REFUSE DE FAIRE, ET POURQUOI
-- ---------------------------------------------------------------------------
-- Il ne DESSINE pas le formulaire. IRCC refuse un formulaire qui n'est pas le
-- sien : reproduire la mise en page produirait un document d'apparence
-- correcte et juridiquement inutile, découvert au moment du refus — c'est-à-
-- dire des mois plus tard, aux frais du client.
--
-- Le PDF officiel est donc STOCKÉ tel quel, et ses champs sont REMPLIS. La
-- correspondance entre nos données et les champs du formulaire n'est pas
-- devinée : elle est relevée dans le fichier lui-même, à l'importation. Un
-- nom de champ inventé remplirait la mauvaise case en silence.
--
-- ---------------------------------------------------------------------------
-- LA VERSION DU FORMULAIRE EST UNE DONNÉE, PAS UNE CONSTANTE
-- ---------------------------------------------------------------------------
-- IRCC révise ses formulaires, et une version périmée est refusée. La version
-- accompagne donc le fichier, et chaque exemplaire produit garde la trace de
-- celle qui a servi : le jour où une révision paraît, on sait exactement quels
-- dossiers portent l'ancienne.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les formulaires connus
-- ---------------------------------------------------------------------------

create table if not exists public.form_definitions (
  code        text primary key,
  label_fr    text not null,
  label_en    text not null,
  issuer      text not null default 'IRCC',

  -- Telle que le formulaire l'affiche lui-même, par exemple « 05-2024 ».
  version     text,
  official_url text,

  -- Le PDF vierge officiel, dans le stockage. Nul tant qu'il n'a pas été
  -- importé : le système dit alors qu'il ne peut pas produire le document,
  -- plutôt que d'en fabriquer un approximatif.
  blank_path  text,

  -- Relevée dans le PDF à l'importation : { "champ_du_pdf": "clé_de_donnée" }.
  field_map   jsonb not null default '{}'::jsonb,

  requires_signature boolean not null default true,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

comment on table public.form_definitions is
  'Formulaires officiels. Le PDF vierge est stocké tel quel ; ses champs sont relevés, jamais devinés.';

insert into public.form_definitions (code, label_fr, label_en, issuer, requires_signature, official_url) values
  ('IMM5476', 'IMM 5476 — Recours aux services d''un représentant',
              'IMM 5476 — Use of a Representative', 'IRCC', true,
   'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/formulaires-demande-guides/imm5476.html')
on conflict (code) do update set
  label_fr = excluded.label_fr, label_en = excluded.label_en,
  official_url = excluded.official_url, updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Un exemplaire par dossier, et toutes ses versions
-- ---------------------------------------------------------------------------

create table if not exists public.matter_forms (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  matter_id   uuid not null references public.matters(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  form_code   text not null references public.form_definitions(code),

  -- Numéro d'ordre de l'exemplaire pour ce dossier. Rien n'est écrasé : une
  -- correction produit une version de plus, et l'ancienne reste consultable.
  version     int not null default 1,

  -- Ce qui a servi à remplir, figé au moment de la production. Relire les
  -- données du client aujourd'hui pour expliquer un formulaire signé l'an
  -- dernier donnerait le formulaire d'aujourd'hui.
  data        jsonb not null default '{}'::jsonb,
  -- La version du formulaire officiel employée.
  form_version text,

  status      text not null default 'to_prepare'
              check (status in ('to_prepare','in_preparation','ready_for_review',
                                'sent_to_client','awaiting_signature','signed',
                                'to_correct','archived')),

  -- Le PDF produit, quand il l'a été.
  document_id uuid references public.documents(id) on delete set null,
  signature_request_id uuid references public.signature_requests(id) on delete set null,

  prepared_by uuid references public.profiles(id) on delete set null,
  prepared_at timestamptz,
  sent_at     timestamptz,
  signed_at   timestamptz,

  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (matter_id, form_code, version)
);

create index if not exists matter_forms_matter_idx on public.matter_forms(matter_id, form_code, version desc);
create index if not exists matter_forms_firm_idx   on public.matter_forms(firm_id, status);

-- Un seul exemplaire vivant par formulaire et par dossier. Sans cette
-- contrainte, deux versions « en attente de signature » coexisteraient, et
-- personne ne saurait laquelle le client a reçue.
create unique index if not exists matter_forms_un_vivant
  on public.matter_forms(matter_id, form_code)
  where status <> 'archived';

comment on table public.matter_forms is
  'Un exemplaire de formulaire par dossier. Les versions précédentes sont archivées, jamais supprimées.';

-- ---------------------------------------------------------------------------
-- 3. Le pré-remplissage
-- ---------------------------------------------------------------------------
-- En SQL, et non dans l'application : le même remplissage doit valoir pour un
-- exemplaire créé depuis un écran, depuis le connecteur, ou par reprise.

create or replace function public.form_prefill(m_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'client_nom',            c.last_name,
    'client_prenom',         c.first_name,
    'client_nom_complet',    c.name,
    'client_courriel',       c.email,
    'client_telephone',      c.phone,
    'client_citoyennete',    c.citizenship,
    'client_residence',      c.residence,
    'client_province',       c.province,
    'client_numero_dossier', c.file_number,
    'client_type',           c.client_type,
    'client_neq',            c.neq_number,

    'dossier_reference',     m.reference,
    'dossier_programme',     m.program,
    'dossier_ouvert_le',     to_char(m.opened_date, 'YYYY-MM-DD'),

    'cabinet_nom',           f.name,
    'cabinet_adresse',       f.address,
    'cabinet_telephone',     f.phone,
    'cabinet_courriel',      f.email,
    'representant_nom',      f.owner_name,
    -- Le numéro de permis du consultant réglementé. Il n'est jamais inventé :
    -- un faux numéro sur un IMM 5476 est une fausse déclaration à IRCC.
    'representant_permis',   f.rcic_license_number,
    'representant_organisme','CCIC'
  ))
    from public.matters m
    join public.clients c on c.id = m.client_id
    join public.firms   f on f.id = m.firm_id
   where m.id = m_id;
$$;

revoke all on function public.form_prefill(uuid) from public;
grant execute on function public.form_prefill(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Créer ou reprendre un exemplaire
-- ---------------------------------------------------------------------------
-- Une correction n'écrase pas : elle archive l'exemplaire en cours et en ouvre
-- un nouveau, en repartant de ses données. Le brief l'exige, et la déontologie
-- aussi — on doit pouvoir montrer ce que le client a signé, pas ce qu'on aurait
-- voulu qu'il signe.

create or replace function public.open_matter_form(m_id uuid, code text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cabinet uuid; client uuid; ancienne public.matter_forms; nouvelle uuid;
begin
  select m.firm_id, m.client_id into cabinet, client
    from public.matters m where m.id = m_id;
  if cabinet is null then
    raise exception 'Dossier introuvable.' using errcode = 'no_data_found';
  end if;
  if cabinet <> public.current_firm_id() then
    raise exception 'Dossier hors du cabinet.' using errcode = 'insufficient_privilege';
  end if;
  if not public.member_can('records.write') then
    raise exception 'Droit d''écriture requis.' using errcode = 'insufficient_privilege';
  end if;

  select * into ancienne from public.matter_forms
   where matter_id = m_id and form_code = code and status <> 'archived'
   limit 1;

  if found then
    update public.matter_forms set status = 'archived', updated_at = now()
     where id = ancienne.id;
  end if;

  insert into public.matter_forms
    (firm_id, matter_id, client_id, form_code, version, data, form_version, status, prepared_at)
  values
    (cabinet, m_id, client, code,
     coalesce(ancienne.version, 0) + 1,
     coalesce(ancienne.data, '{}'::jsonb) || public.form_prefill(m_id),
     (select fd.version from public.form_definitions fd where fd.code = code),
     'in_preparation', now())
  returning id into nouvelle;

  return nouvelle;
end;
$$;

revoke all on function public.open_matter_form(uuid, text) from public;
grant execute on function public.open_matter_form(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Les dates suivent le statut, sans qu'on ait à y penser
-- ---------------------------------------------------------------------------

create or replace function public.stamp_matter_form()
returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'sent_to_client'     and old.status <> 'sent_to_client'     then new.sent_at   := coalesce(new.sent_at, now()); end if;
  if new.status = 'signed'             and old.status <> 'signed'             then new.signed_at := coalesce(new.signed_at, now()); end if;
  -- Un exemplaire renvoyé à corriger n'est plus signé : laisser la date
  -- ferait d'un brouillon un document qui prétend avoir été signé.
  if new.status in ('to_correct','in_preparation') then new.signed_at := null; end if;
  return new;
end;
$$;

drop trigger if exists matter_forms_stamp on public.matter_forms;
create trigger matter_forms_stamp
  before update on public.matter_forms
  for each row execute function public.stamp_matter_form();

-- ---------------------------------------------------------------------------
-- 6. Cloisonnement
-- ---------------------------------------------------------------------------

alter table public.form_definitions enable row level security;
alter table public.matter_forms     enable row level security;

drop policy if exists form_definitions_read on public.form_definitions;
create policy form_definitions_read on public.form_definitions
  for select to authenticated using (true);

drop policy if exists form_definitions_admin on public.form_definitions;
create policy form_definitions_admin on public.form_definitions
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists matter_forms_firm on public.matter_forms;
create policy matter_forms_firm on public.matter_forms
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

-- Le client voit les exemplaires qui lui sont destinés — pas les brouillons.
-- Un formulaire en préparation porte des valeurs qui changeront encore ; le
-- montrer inviterait à discuter d'un document qui n'existe pas encore.
drop policy if exists matter_forms_portal on public.matter_forms;
create policy matter_forms_portal on public.matter_forms
  for select to authenticated
  using (
    public.is_portal_client()
    and client_id = public.current_client_id()
    and status in ('sent_to_client','awaiting_signature','signed')
  );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select public.form_prefill((select id from public.matters limit 1));
--
--   -- Un seul exemplaire vivant par dossier et par formulaire :
--   select matter_id, form_code, count(*) from public.matter_forms
--    where status <> 'archived' group by 1,2 having count(*) > 1;
--
--   -- Formulaires dont le PDF officiel manque encore :
--   select code, label_fr from public.form_definitions where blank_path is null;
-- ============================================================================
