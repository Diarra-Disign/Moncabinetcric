-- ============================================================================
-- Le socle d'identité : civilité, structure familiale, rôle d'immigration
-- ============================================================================
--
-- Ce que la base ne savait pas dire jusqu'ici, vérifié colonne par colonne
-- dans information_schema et non dans les fichiers de migration — l'archive
-- _archive/0001_init_schema.sql décrit un schéma qui n'a pas été appliqué :
--
--   • aucune CIVILITÉ nulle part. Ni sur un prospect, ni sur un client, ni sur
--     le consultant — qui signe pourtant les ententes de service.
--   • aucune STRUCTURE FAMILIALE. Conjoint, enfants et personnes à charge
--     n'existent que comme QUESTIONS dans les questionnaires : du texte libre,
--     retapé à chaque formulaire, jamais recoupé.
--   • aucun CONTACT_INTENT, alors que le formulaire de création d'un prospect
--     le collecte depuis toujours. createLead() ne l'écrit pas : l'intention
--     choisie à l'écran est jetée entre le navigateur et la base.
--
-- POURQUOI DES TABLES ET NON DES CHAMPS TEXTE. Un dossier d'immigration
-- familial se compose : un requérant principal, un conjoint accompagnant, des
-- enfants à charge. Écrire « conjoint : Marie, 2 enfants » dans une note rend
-- impossible ce que le métier réclame — savoir si Marie figure au formulaire
-- IMM 5406, si le cadet a dépassé l'âge limite, si le conjoint accompagne ou
-- reste au pays. Une note ne se recoupe pas.
--
-- CE QUE JE NE COLLECTE PAS, et c'est délibéré : le GENRE. Il figurait dans la
-- recommandation à trois niveaux, en « optionnel selon le pays ». Sous la Loi
-- 25 et la LPRPDE, une donnée personnelle ne se collecte qu'avec une finalité
-- déclarée ; aucun formulaire du cabinet n'en a besoin aujourd'hui, et la
-- civilité suffit à s'adresser correctement à quelqu'un. La colonne s'ajoutera
-- le jour où un formulaire la réclamera, avec sa finalité écrite.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. La civilité — même vocabulaire pour tout le monde
-- ---------------------------------------------------------------------------
-- Un CODE stable, pas un libellé. « Monsieur » écrit en base serait à traduire
-- à chaque affichage anglais et à comparer à « Mr. », « M. », « Monsieur »
-- selon qui l'a saisi. Le libellé se rend à l'écran, à un seul endroit.
--
-- Le consultant en a une aussi : il signe les ententes de service, et
-- « Signé par Diarra » vaut moins que « Signé par Me Adama Diarra ».

do $$
declare t text;
begin
  foreach t in array array['leads', 'clients', 'profiles'] loop
    execute format(
      'alter table public.%I add column if not exists civility text', t);
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_civility_check');
    execute format(
      'alter table public.%I add constraint %I check (civility is null or civility in (''mr'',''mrs'',''mx'',''other''))',
      t, t || '_civility_check');
  end loop;
end $$;

comment on column public.clients.civility is
  'Code stable, jamais un libellé : mr | mrs | mx | other. Le texte affiché '
  'vit dans lib/data/identite.ts, en français et en anglais.';

-- ---------------------------------------------------------------------------
-- 2. L'intention de contact — la colonne qui manquait sous le formulaire
-- ---------------------------------------------------------------------------
-- « Renseignements », « Consultation initiale », « Mandat » : le formulaire
-- pose la question, l'interface la met en avant, et rien ne la recevait.
alter table public.leads
  add column if not exists contact_intent text;

alter table public.leads drop constraint if exists leads_contact_intent_check;
alter table public.leads
  add constraint leads_contact_intent_check
  check (contact_intent is null or contact_intent in ('info', 'consultation', 'mandate'));

-- ---------------------------------------------------------------------------
-- 3. La structure familiale
-- ---------------------------------------------------------------------------
-- Rattachée à un client OU à un prospect, jamais aux deux — même contrainte
-- que client_questionnaires, et pour la même raison : un enregistrement qui
-- pourrait viser les deux finit par en viser un troisième, personne.
create table if not exists public.family_members (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firms(id) on delete cascade,
  client_id        uuid references public.clients(id) on delete cascade,
  lead_id          uuid references public.leads(id) on delete cascade,

  -- Le LIEN de parenté : ce que cette personne est pour le requérant.
  relation         text not null check (relation in ('spouse', 'child', 'dependant', 'other')),

  -- Le RÔLE au dossier : ce qu'elle est pour IRCC. Les deux ne se confondent
  -- pas — un conjoint peut rester au pays, un enfant majeur peut ne pas être
  -- à charge. C'est cette distinction qui décide qui figure sur quel
  -- formulaire.
  immigration_role text check (immigration_role is null or immigration_role in
    ('principal', 'accompanying_spouse', 'non_accompanying_spouse', 'dependent_child', 'other')),

  civility         text check (civility is null or civility in ('mr','mrs','mx','other')),
  first_name       text not null default '',
  last_name        text not null default '',
  birth_date       date,
  notes            text not null default '',

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint family_members_rattachement
    check ((client_id is not null) <> (lead_id is not null))
);

create index if not exists idx_family_members_firm_id on public.family_members (firm_id);
create index if not exists idx_family_members_client on public.family_members (client_id);
create index if not exists idx_family_members_lead on public.family_members (lead_id);

drop trigger if exists touch_family_members_updated_at on public.family_members;
create trigger touch_family_members_updated_at
  before update on public.family_members
  for each row execute function public.touch_updated_at();

alter table public.family_members enable row level security;

-- Le cloisonnement vient d'ici, et de nulle part ailleurs. Le « with check »
-- interdit d'écrire une ligne dans un autre cabinet, y compris en la
-- déplaçant : sans lui, un membre pourrait rattacher une personne au cabinet
-- voisin par une simple mise à jour.
drop policy if exists family_members_firm_all on public.family_members;
create policy family_members_firm_all on public.family_members
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Le portail : un client voit sa propre famille, et ne la modifie pas. C'est
-- le cabinet qui tient la composition du dossier — une pièce que le client
-- pourrait réécrire ne vaudrait rien devant IRCC.
drop policy if exists family_members_portal_read on public.family_members;
create policy family_members_portal_read on public.family_members
  for select to authenticated
  using (client_id is not null and client_id = public.current_client_id());

comment on table public.family_members is
  'Composition familiale d''un prospect ou d''un client. « relation » dit le '
  'lien de parenté, « immigration_role » dit le rôle au dossier IRCC : les '
  'deux ne se confondent pas, et c''est leur écart qui décide qui figure sur '
  'quel formulaire.';

commit;
