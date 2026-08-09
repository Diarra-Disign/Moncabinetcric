-- ============================================================================
-- Documents requis : réception, vérification, et blocage d'un dossier incomplet
-- ============================================================================
--
-- La liste de contrôle du dossier existait déjà à l'écran. Elle n'existait
-- nulle part ailleurs : generateChecklistForProgram() la REGÉNÈRE à chaque
-- affichage, avec des statuts codés en dur dans lib/data/programs.ts.
--
-- Deux conséquences que rien ne signalait :
--
--   · cocher n'aurait eu aucun effet — il n'y avait rien où l'écrire ;
--   · un dossier vide s'ouvrait en affichant « Passeport — valide », parce que
--     le modèle porte defaultStatus: "valid". Un consultant lisant cet écran
--     pouvait croire qu'une pièce était au dossier alors qu'aucun fichier
--     n'existait.
--
-- Cette migration donne un état RÉEL à chaque exigence, par dossier.
--
-- ---------------------------------------------------------------------------
-- RÉCEPTION ET VÉRIFICATION SONT DEUX FAITS DISTINCTS
-- ---------------------------------------------------------------------------
-- Le brief insiste, et il a raison : « document reçu » n'est pas « document
-- validé ». Un passeport peut être au dossier et périmé ; un relevé bancaire
-- peut être reçu et illisible.
--
-- Les deux sont donc stockés comme des FAITS DATÉS ET SIGNÉS — reçu quand, par
-- qui ; vérifié quand, par qui — et non comme deux cases à cocher. Une case
-- cochée ne dit pas qui l'a cochée, et c'est précisément ce qu'on demande à un
-- consultant réglementé de pouvoir établir.
--
-- Le statut, lui, ne se stocke pas : il se déduit de ces faits et de la date du
-- jour. Un statut stocké se serait figé sur « validé » le lendemain de
-- l'expiration de la pièce.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le modèle, par programme
-- ---------------------------------------------------------------------------
-- Engendré depuis lib/data/programs.ts, qui reste la source. Recopier ces
-- trente-cinq lignes à la main aurait introduit des écarts invisibles entre ce
-- que l'écran annonce et ce que la base exige.

create table if not exists public.program_requirements (
  program_id text not null,
  code       text not null,
  label_fr   text not null,
  label_en   text not null,
  mandatory  boolean not null default true,
  rank       int not null default 0,
  primary key (program_id, code)
);

comment on table public.program_requirements is
  'Modèle des pièces exigées par programme. Engendré depuis lib/data/programs.ts.';

insert into public.program_requirements (program_id, code, label_fr, label_en, mandatory, rank) values
  ('prog-ee', 'PASSPORT', 'Passeport valide au moins 6 mois', 'Passport valid for at least 6 months', true, 10),
  ('prog-ee', 'LANG_TEST', 'Test de langue (TEF / IELTS)', 'Language test (TEF / IELTS)', true, 20),
  ('prog-ee', 'ECA', 'Évaluation des diplômes (EDE/ECA)', 'Educational credential assessment (ECA)', true, 30),
  ('prog-ee', 'FUNDS', 'Preuve de fonds suffisants', 'Proof of sufficient funds', true, 40),
  ('prog-ee', 'POLICE', 'Certificat de police du pays d''origine', 'Police clearance certificate', true, 50),
  ('prog-ee', 'IMM5476', 'Formulaire IMM 5476 signé (Représentation)', 'IMM 5476 signed form (Representation)', true, 60),
  ('prog-ee', 'IMM0008', 'Formulaire IMM 0008 (Demande générique)', 'IMM 0008 form (Generic application)', true, 70),
  ('prog-peq', 'CSQ', 'CSQ - Certificat de sélection du Québec', 'CSQ - Quebec Selection Certificate', true, 10),
  ('prog-peq', 'PASSPORT', 'Passeport valide au moins 6 mois', 'Passport valid for at least 6 months', true, 20),
  ('prog-peq', 'TEFAQ', 'Test de langue française de niveau B2 minimum', 'French language test level B2 min', true, 30),
  ('prog-peq', 'IMM5476', 'Formulaire IMM 5476 signé (Représentation)', 'IMM 5476 signed form (Representation)', true, 40),
  ('prog-peq', 'POLICE', 'Certificats de police', 'Police certificates', true, 50),
  ('prog-tr-visa', 'PASSPORT', 'Passeport valide pour la durée du séjour', 'Valid Passport', true, 10),
  ('prog-tr-visa', 'TIES', 'Preuve de liens avec le pays d''origine', 'Proof of ties to home country', true, 20),
  ('prog-tr-visa', 'INVITATION', 'Lettre d''invitation et preuves financières', 'Invitation letter & financial proof', true, 30),
  ('prog-tr-visa', 'IMM5257', 'Formulaire IMM 5257 (Demande de VTR)', 'IMM 5257 Form', true, 40),
  ('prog-super-visa', 'BIRTH_CERT', 'Preuve de filiation (Acte de naissance)', 'Proof of relationship', true, 10),
  ('prog-super-visa', 'INSURANCE', 'Assurance médicale canadienne (100k$ CAD min)', 'Canadian medical insurance (100k$ min)', true, 20),
  ('prog-super-visa', 'INCOME_PROOF', 'Preuve de revenu du répondant (NOA / T4)', 'Host income proof (NOA / T4)', true, 30),
  ('prog-super-visa', 'MEDICAL', 'Examen médical préalable', 'Upfront medical exam', true, 40),
  ('prog-lmia', 'LMIA_POS', 'Offre d''emploi validée (EIMT positive)', 'Validated job offer (Positive LMIA)', true, 10),
  ('prog-lmia', 'CONTRACT', 'Contrat de travail signé', 'Signed employment contract', true, 20),
  ('prog-lmia', 'PASSPORT', 'Passeport valide au moins 1 an', 'Passport valid for at least 1 year', true, 30),
  ('prog-lmia', 'EXPERIENCE', 'Preuves d''expérience professionnelle (lettres)', 'Proof of work experience (reference letters)', true, 40),
  ('prog-lmia', 'IMM1295', 'Formulaire IMM 1295 (Permis de travail)', 'IMM 1295 form (Work permit)', true, 50),
  ('prog-study', 'LOA', 'Lettre d''admission d''un établissement (EED)', 'Letter of acceptance from DLI', true, 10),
  ('prog-study', 'CAQ', 'CAQ - Certificat d''acceptation du Québec', 'CAQ - Quebec Acceptance Certificate', true, 20),
  ('prog-study', 'FUNDS_STUDY', 'Preuves de ressources financières suffisantes', 'Proof of sufficient financial support', true, 30),
  ('prog-study', 'IMM1294', 'Formulaire IMM 1294 (Permis d''études)', 'IMM 1294 form (Study permit)', true, 40),
  ('prog-study', 'IMM5257', 'Formulaire IMM 5257 (Visa de visiteur)', 'IMM 5257 form (Visitor visa)', false, 50),
  ('prog-sponsorship', 'MARRIAGE', 'Certificat de mariage ou preuve de conjoint de fait', 'Marriage certificate or common-law proof', true, 10),
  ('prog-sponsorship', 'IMM1344', 'Formulaire IMM 1344 (Demande de parrainage)', 'IMM 1344 form (Application to sponsor)', true, 20),
  ('prog-sponsorship', 'IMM5532', 'Formulaire IMM 5532 (Relation et évaluation)', 'IMM 5532 form (Relationship assessment)', true, 30),
  ('prog-sponsorship', 'ID_DOCS', 'Preuves d''identité du parrain et du parrainé', 'Identity documents for sponsor and sponsored', true, 40),
  ('prog-sponsorship', 'COHABITATION', 'Photos et preuves de vie commune', 'Photos and cohabitation proofs', true, 50)
on conflict (program_id, code) do update set
  label_fr = excluded.label_fr, label_en = excluded.label_en,
  mandatory = excluded.mandatory, rank = excluded.rank;


-- ---------------------------------------------------------------------------
-- 2. Quel modèle s'applique à un dossier
-- ---------------------------------------------------------------------------
-- Jumelle SQL de generateChecklistForProgram(). La duplication est assumée :
-- le déclencheur qui garnit un dossier ne peut pas appeler du TypeScript, et
-- faire remonter la décision dans l'application laisserait sans exigences tout
-- dossier créé autrement — par un script, par le connecteur, à la main.
--
-- Elle est VÉRIFIÉE : ./cric documents compare les deux sur une liste de noms
-- de programmes. Une duplication contrôlée vaut mieux qu'une dépendance qui
-- n'existe pas.

create or replace function public.programme_modele(nom text)
returns text language sql immutable as $$
  select case
    when lower(nom) like '%super%'                                   then 'prog-super-visa'
    when lower(nom) similar to '%(visa|visiteur|trv)%'               then 'prog-tr-visa'
    when lower(nom) similar to '%(ee|express)%'                      then 'prog-ee'
    when lower(nom) similar to '%(peq|québec|quebec)%'               then 'prog-peq'
    when lower(nom) similar to '%(lmia|eimt|travail|work)%'          then 'prog-lmia'
    when lower(nom) similar to '%(étude|study|caq)%'                 then 'prog-study'
    when lower(nom) similar to '%(parrainage|sponsorship|spousal)%'  then 'prog-sponsorship'
    else 'prog-ee'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Les exigences d'un dossier
-- ---------------------------------------------------------------------------

create table if not exists public.matter_requirements (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  matter_id   uuid not null references public.matters(id) on delete cascade,

  code        text not null,
  label_fr    text not null,
  label_en    text not null,
  mandatory   boolean not null default true,
  rank        int not null default 0,

  -- La pièce demandée au client, s'il y a lieu.
  requested_at  timestamptz,
  requested_by  uuid references public.profiles(id) on delete set null,

  -- LE FAIT « REÇU » : quand, par qui, et quel fichier.
  document_id   uuid references public.documents(id) on delete set null,
  received_at   timestamptz,
  received_by   uuid references public.profiles(id) on delete set null,
  -- « firm » ou « client » : le brief exige qu'on sache qui a déposé.
  received_from text check (received_from in ('firm','client')),

  -- LE FAIT « VÉRIFIÉ », distinct du précédent.
  verified_at   timestamptz,
  verified_by   uuid references public.profiles(id) on delete set null,

  -- Le refus, qui renvoie la pièce à corriger.
  rejected_at     timestamptz,
  rejected_by     uuid references public.profiles(id) on delete set null,
  rejection_reason text,

  expires_on  date,
  notes       text,
  created_at  timestamptz not null default now(),

  unique (matter_id, code)
);

create index if not exists matter_requirements_matter_idx on public.matter_requirements(matter_id, rank);
create index if not exists matter_requirements_firm_idx   on public.matter_requirements(firm_id);

comment on table public.matter_requirements is
  'Une pièce exigée par dossier. Réception et vérification sont deux faits datés et signés, distincts.';

-- ---------------------------------------------------------------------------
-- 4. Le statut se déduit, il ne se stocke pas
-- ---------------------------------------------------------------------------
-- Un statut stocké se serait figé sur « validé » le lendemain de l'expiration
-- de la pièce, et personne ne l'aurait vu.

create or replace function public.requirement_status(
  requested_at timestamptz, received_at timestamptz, verified_at timestamptz,
  rejected_at timestamptz, expires_on date
) returns text language sql stable as $$
  select case
    -- Un refus postérieur au dépôt l'emporte : la pièce est à refaire.
    when rejected_at is not null
     and (received_at is null or rejected_at >= received_at)       then 'to_correct'
    when received_at is not null and expires_on is not null
     and expires_on < current_date                                 then 'expired'
    when verified_at is not null                                   then 'verified'
    when received_at is not null                                   then 'received'
    when requested_at is not null                                  then 'requested'
    else 'missing'
  end;
$$;

/** Les pièces d'un dossier, avec leur statut calculé. */
create or replace function public.matter_requirements_view(m_id uuid)
returns table (
  id uuid, code text, label_fr text, label_en text, mandatory boolean, rank int,
  status text, document_id uuid, received_from text,
  received_at timestamptz, verified_at timestamptz, expires_on date, rejection_reason text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.id, r.code, r.label_fr, r.label_en, r.mandatory, r.rank,
         public.requirement_status(r.requested_at, r.received_at, r.verified_at,
                                   r.rejected_at, r.expires_on),
         r.document_id, r.received_from, r.received_at, r.verified_at,
         r.expires_on, r.rejection_reason
    from public.matter_requirements r
   where r.matter_id = m_id
   order by r.rank, r.label_fr;
$$;

/**
 * Ce qui empêche un dossier d'être déclaré complet.
 *
 * Une pièce obligatoire qui n'est pas VÉRIFIÉE bloque — reçue ne suffit pas.
 * C'est tout l'objet de la distinction : un dossier soumis sur des pièces non
 * vérifiées engage le consultant réglementé, pas le logiciel.
 */
create or replace function public.matter_blocking_requirements(m_id uuid)
returns table (code text, label_fr text, status text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select v.code, v.label_fr, v.status
    from public.matter_requirements_view(m_id) v
   where v.mandatory and v.status <> 'verified'
   order by v.rank;
$$;

revoke all on function public.matter_requirements_view(uuid) from public;
revoke all on function public.matter_blocking_requirements(uuid) from public;
grant execute on function public.matter_requirements_view(uuid) to authenticated;
grant execute on function public.matter_blocking_requirements(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Un dossier neuf reçoit ses exigences
-- ---------------------------------------------------------------------------

create or replace function public.seed_matter_requirements()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.matter_requirements
    (firm_id, matter_id, code, label_fr, label_en, mandatory, rank)
  select new.firm_id, new.id, pr.code, pr.label_fr, pr.label_en, pr.mandatory, pr.rank
    from public.program_requirements pr
   where pr.program_id = public.programme_modele(coalesce(new.program, ''))
  on conflict (matter_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists matters_seed_requirements on public.matters;
create trigger matters_seed_requirements
  after insert on public.matters
  for each row execute function public.seed_matter_requirements();

-- Les dossiers déjà ouverts en reçoivent aussi : sans cela, ils resteraient
-- sans aucune exigence et paraîtraient complets — l'inverse du but poursuivi.
insert into public.matter_requirements
  (firm_id, matter_id, code, label_fr, label_en, mandatory, rank)
select m.firm_id, m.id, pr.code, pr.label_fr, pr.label_en, pr.mandatory, pr.rank
  from public.matters m
  join public.program_requirements pr
    on pr.program_id = public.programme_modele(coalesce(m.program, ''))
on conflict (matter_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Un dossier incomplet ne peut pas être déclaré prêt
-- ---------------------------------------------------------------------------

alter table public.matters drop constraint if exists matters_status_check;
alter table public.matters add constraint matters_status_check
  check (status in ('valid','alert','review','pending','complete','ready_to_submit'));

create or replace function public.enforce_matter_completeness()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  manquants text;
  combien   int;
begin
  if new.status not in ('complete','ready_to_submit') then return new; end if;
  if old.status = new.status then return new; end if;

  select count(*), string_agg(b.label_fr || ' — ' ||
           case b.status
             when 'missing'    then 'manquant'
             when 'requested'  then 'demandé, non reçu'
             when 'received'   then 'reçu mais non vérifié'
             when 'to_correct' then 'à corriger'
             when 'expired'    then 'expiré'
             else b.status
           end, E'\n  · ' order by b.label_fr)
    into combien, manquants
    from public.matter_blocking_requirements(new.id) b;

  if combien > 0 then
    raise exception
      'Le dossier ne peut pas être validé : % document(s) obligatoire(s) encore manquant(s) ou non vérifié(s).%',
      combien, E'\n  · ' || manquants
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists matters_completeness_guard on public.matters;
create trigger matters_completeness_guard
  before update on public.matters
  for each row execute function public.enforce_matter_completeness();

-- ---------------------------------------------------------------------------
-- 7. Cloisonnement
-- ---------------------------------------------------------------------------

alter table public.program_requirements enable row level security;
alter table public.matter_requirements  enable row level security;

drop policy if exists program_requirements_read on public.program_requirements;
create policy program_requirements_read on public.program_requirements
  for select to authenticated using (true);

drop policy if exists program_requirements_admin on public.program_requirements;
create policy program_requirements_admin on public.program_requirements
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists matter_requirements_read on public.matter_requirements;
create policy matter_requirements_read on public.matter_requirements
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists matter_requirements_write on public.matter_requirements;
create policy matter_requirements_write on public.matter_requirements
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('records.write'))
  with check (firm_id = public.current_firm_id() and public.member_can('records.write'));

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select m.reference, count(*) filter (where v.status = 'verified') as verifiees,
--          count(*) as total
--     from public.matters m, lateral public.matter_requirements_view(m.id) v
--    group by m.reference;
--
--   -- Aucun dossier ne doit être « complete » avec des pièces bloquantes :
--   select m.reference from public.matters m
--    where m.status in ('complete','ready_to_submit')
--      and exists (select 1 from public.matter_blocking_requirements(m.id));
-- ============================================================================
