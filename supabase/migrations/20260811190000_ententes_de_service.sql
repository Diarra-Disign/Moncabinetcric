-- ============================================================================
-- Le socle des ententes de service — modèles, articles, ententes, parties
-- ============================================================================
--
-- CE QUI EXISTAIT AVANT CETTE MIGRATION : rien.
--
--   export async function getAgreements(): Promise<AgreementRecord[]> {
--     if (isSupabaseSource()) return []      // ← toujours vide
--     return _mockStores.agreements
--   }
--
-- Aucune table `agreements`, `contracts` ou `ententes` dans le catalogue —
-- vérifié dans information_schema.tables, pas dans les fichiers de migration.
-- L'archive _archive/0001_init_schema.sql en déclare une qui n'a jamais été
-- appliquée. Mille neuf cent quarante-neuf lignes d'interface reposaient donc
-- sur rien : pour un cabinet réel, « En attente de service » était vide et le
-- serait resté quoi qu'on y fasse.
--
-- UN CONTRAT EST UN DOCUMENT, et c'est la décision qui structure le reste.
-- signature_requests et signatures existent déjà, et s'accrochent à
-- `documents` — avec l'empreinte SHA-256, l'adresse IP et l'agent utilisateur
-- du signataire. Créer une chaîne de signature propre aux contrats
-- dupliquerait ce qui fonctionne. `agreements.document_id` désigne donc le PDF
-- une fois émis, et la signature passe par le chemin déjà éprouvé.
--
-- LES QUATRE TABLES, ET POURQUOI QUATRE :
--
--   agreement_templates          le modèle, système ou du cabinet
--   agreement_template_articles  ses articles, UNE LIGNE CHACUN
--   agreements                   l'entente émise, avec son instantané
--   agreement_parties            qui signe, et à quel titre
--
-- Les articles sont des LIGNES et non un jsonb : le brief demande de les
-- réordonner, d'en masquer un, d'en modifier un seul. Sur un jsonb, chacun de
-- ces gestes réécrit le document entier — et deux consultants du même cabinet
-- qui éditent deux articles différents en même temps s'effacent l'un l'autre.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les modèles
-- ---------------------------------------------------------------------------
-- firm_id NULL = modèle système, partagé par tous les cabinets. La politique
-- d'écriture est reprise MOT POUR MOT de questionnaire_templates, où elle est
-- éprouvée : le « with check » impose un firm_id non nul, donc même un UPDATE
-- ne peut pas fabriquer un modèle système ni s'approprier celui d'un autre.
create table if not exists public.agreement_templates (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid references public.firms(id) on delete cascade,
  code        text not null,
  -- Le TYPE d'entente. « Pro bono » n'est pas un montant à zéro : c'est un
  -- modèle dont les articles d'honoraires sont remplacés, pas vidés.
  kind        text not null check (kind in (
                'consultation', 'consultation_probono',
                'services', 'services_probono',
                'amendment', 'termination', 'other')),
  title_fr    text not null,
  title_en    text not null,
  description_fr text not null default '',
  description_en text not null default '',
  version     text not null default '1.0',
  is_default  boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un code par cabinet, et un code par modèle système. Deux index partiels
-- plutôt qu'un seul : NULL n'est égal à rien en SQL, donc un unique ordinaire
-- sur (firm_id, code) laisserait passer autant de modèles système homonymes
-- qu'on voudrait.
create unique index if not exists agreement_templates_code_cabinet
  on public.agreement_templates (firm_id, code) where firm_id is not null;
create unique index if not exists agreement_templates_code_systeme
  on public.agreement_templates (code) where firm_id is null;

alter table public.agreement_templates enable row level security;

drop policy if exists agreement_templates_lecture on public.agreement_templates;
create policy agreement_templates_lecture on public.agreement_templates
  for select to authenticated
  using (firm_id is null or firm_id = public.current_firm_id());

drop policy if exists agreement_templates_ecriture on public.agreement_templates;
create policy agreement_templates_ecriture on public.agreement_templates
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 2. Les articles d'un modèle
-- ---------------------------------------------------------------------------
create table if not exists public.agreement_template_articles (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid references public.firms(id) on delete cascade,
  template_id  uuid not null references public.agreement_templates(id) on delete cascade,
  position     integer not null default 0,
  code         text not null,
  title_fr     text not null,
  title_en     text not null,
  body_fr      text not null default '',
  body_en      text not null default '',
  -- « structural » : l'article ne se retire pas. Ce sont ceux dont l'absence
  -- rendrait l'entente incomplète pour un consultant réglementé — portée du
  -- mandat, absence de garantie de résultat, recours au Collège.
  -- « free » : le cabinet en fait ce qu'il veut.
  level        text not null default 'free' check (level in ('structural', 'free')),
  optional     boolean not null default false,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Deux articles de même code dans un modèle : la substitution des variables ne
-- saurait lequel garder, et l'un des deux disparaîtrait du contrat sans le
-- dire. C'est le défaut silencieux qu'on ne découvre qu'en relisant un contrat
-- signé.
create unique index if not exists agreement_template_articles_code
  on public.agreement_template_articles (template_id, code);
create index if not exists agreement_template_articles_ordre
  on public.agreement_template_articles (template_id, position);

alter table public.agreement_template_articles enable row level security;

drop policy if exists agreement_template_articles_lecture on public.agreement_template_articles;
create policy agreement_template_articles_lecture on public.agreement_template_articles
  for select to authenticated
  using (firm_id is null or firm_id = public.current_firm_id());

drop policy if exists agreement_template_articles_ecriture on public.agreement_template_articles;
create policy agreement_template_articles_ecriture on public.agreement_template_articles
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 3. L'entente émise
-- ---------------------------------------------------------------------------
create table if not exists public.agreements (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firms(id) on delete cascade,

  -- Un client OU un prospect, jamais les deux. Le §22 veut qu'une entente
  -- créée pour un prospect SUIVE la conversion : la contrainte impose alors le
  -- même geste que pour les questionnaires et la famille — un seul UPDATE,
  -- client_id posé et lead_id vidé ensemble.
  client_id        uuid references public.clients(id) on delete cascade,
  lead_id          uuid references public.leads(id) on delete cascade,
  matter_id        uuid references public.matters(id) on delete set null,

  template_id      uuid references public.agreement_templates(id) on delete set null,
  template_version text not null default '1.0',

  reference        text not null,
  title            text not null,
  kind             text not null,

  -- L'INSTANTANÉ. Le §18 exige qu'un contrat déjà émis ne change pas quand son
  -- modèle change. La même garantie protège client_questionnaires.sections, et
  -- elle a été éprouvée : on réécrit le modèle de fond en comble, l'envoi garde
  -- ses questions. Sans elle, un client pourrait contester un contrat dont le
  -- texte ne serait plus celui qu'il a signé.
  articles_snapshot jsonb not null default '[]'::jsonb,

  status           text not null default 'draft' check (status in (
                     'draft', 'ready', 'sent', 'viewed',
                     'partially_signed', 'signed', 'declined', 'expired', 'cancelled')),

  -- Les montants sont RETENUS au moment de l'émission. Les tarifs vivent dans
  -- les Paramètres et peuvent changer ; une entente signée à 4 500 $ ne devient
  -- pas une entente à 4 800 $ parce que le cabinet a revu sa grille.
  fees_amount      numeric(12,2) not null default 0,
  taxes_amount     numeric(12,2) not null default 0,
  total_amount     numeric(12,2) not null default 0,
  is_probono       boolean not null default false,

  -- Le PDF, une fois émis. Un contrat EST un document : la signature passe par
  -- signature_requests, qui s'accroche à documents.
  document_id      uuid references public.documents(id) on delete set null,

  -- Ce que ce document remplace : avenant, services additionnels. Une colonne
  -- plutôt que trois modèles de plus — c'est une entente qui référence la
  -- précédente, pas un texte différent à maintenir.
  replaces_id      uuid references public.agreements(id) on delete set null,

  created_by       uuid references public.profiles(id) on delete set null,
  issued_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint agreements_destinataire
    check ((client_id is not null) <> (lead_id is not null))
);

create unique index if not exists agreements_reference_cabinet
  on public.agreements (firm_id, reference);
create index if not exists idx_agreements_firm_id on public.agreements (firm_id);
create index if not exists idx_agreements_client on public.agreements (client_id);
create index if not exists idx_agreements_lead on public.agreements (lead_id);
create index if not exists idx_agreements_matter on public.agreements (matter_id);

alter table public.agreements enable row level security;

drop policy if exists agreements_firm_all on public.agreements;
create policy agreements_firm_all on public.agreements
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- Le client voit ses ententes une fois qu'elles lui sont adressées — jamais un
-- brouillon que le cabinet prépare encore.
drop policy if exists agreements_portal_read on public.agreements;
create policy agreements_portal_read on public.agreements
  for select to authenticated
  using (
    client_id is not null
    and client_id = public.current_client_id()
    and status not in ('draft', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- 4. Les parties au contrat
-- ---------------------------------------------------------------------------
-- Le §8 : client principal, conjoint, codemandeur, parent. Et le consultant,
-- qui signe aussi — c'est pour cela que « consultant » figure parmi les rôles.
--
-- Les coordonnées sont RECOPIÉES ici plutôt que lues depuis la fiche, et c'est
-- le §6 : une correction faite pour les besoins du contrat ne doit pas
-- réécrire la fiche client sans confirmation. La fiche reste la source ; ceci
-- est ce que le contrat a retenu.
create table if not exists public.agreement_parties (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  agreement_id  uuid not null references public.agreements(id) on delete cascade,

  role          text not null check (role in (
                  'client', 'spouse', 'co_applicant', 'parent',
                  'representative', 'consultant', 'other')),
  civility      text check (civility is null or civility in ('mr','mrs','mx','other')),
  first_name    text not null default '',
  last_name     text not null default '',
  legal_name    text not null default '',
  email         text not null default '',
  phone         text not null default '',
  address       text not null default '',
  city          text not null default '',
  province      text not null default '',
  postal_code   text not null default '',
  country       text not null default '',
  birth_date    date,

  -- L'ordre de signature. Le brief prévoit séquentiel comme simultané : un
  -- rang égal pour tous vaut « en même temps ».
  signing_order integer not null default 1,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_agreement_parties_firm_id on public.agreement_parties (firm_id);
create index if not exists idx_agreement_parties_agreement on public.agreement_parties (agreement_id);

alter table public.agreement_parties enable row level security;

drop policy if exists agreement_parties_firm_all on public.agreement_parties;
create policy agreement_parties_firm_all on public.agreement_parties
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 5. L'horodatage
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['agreement_templates', 'agreement_template_articles',
                           'agreements', 'agreement_parties'] loop
    execute format('drop trigger if exists touch_%I_updated_at on public.%I', t, t);
    execute format(
      'create trigger touch_%I_updated_at before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

comment on column public.agreements.articles_snapshot is
  'Instantané des articles au moment de l''émission. Remanier le modèle '
  'ensuite ne doit pas réécrire un contrat déjà envoyé ou signé : le client '
  'pourrait contester un texte qui n''est plus celui qu''il a lu.';

commit;
