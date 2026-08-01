# SPEC-FONDATIONS.md — moncabinetcric

Spécification des sept modules fondamentaux. À lire conjointement avec `GEMINI.md`.

**Statut du projet à la rédaction :** interface complète sur données fictives (`lib/data/mock/`), cabinet unique codé en dur (`lib/data/firm.ts`), aucune persistance, aucune authentification.

**Principe directeur :** *prêt pour un audit par défaut*. Chaque décision d'architecture se juge à cette question — si le CICC réclame un dossier demain, l'application peut-elle le produire intégralement, avec la preuve de qui a fait quoi et quand?

---

## Ordre d'exécution

| Phase | Modules | Livrable de fin de phase |
| :--- | :--- | :--- |
| **0** | Audit de couture | Rapport : aucune page n'importe `lib/data/mock` directement |
| **1** | 1 · Multi-locataire · 3 · Journal d'audit · 4 · Rôles | Deux cabinets coexistent, cloisonnés, avec traçabilité |
| **2** | 2 · Moteur d'échéances | Alertes fonctionnelles sur dossiers réels |
| **3** | 6 · Contrats · 5 · Registres | Conformité CICC opérationnelle |
| **4** | 7 · Export & conservation | Sortie de plateforme et audit CICC possibles |

Les modules 1, 3 et 4 sont indissociables : le cloisonnement sans traçabilité ni rôles est incomplet, et rajouter l'audit après coup implique de retoucher chaque mutation.

---

## Phase 0 — Audit de couture (à faire avant toute ligne de code)

```bash
grep -rn "lib/data/mock" app/ components/ --include="*.tsx" --include="*.ts"
```

**Résultat attendu :** aucune occurrence. Seuls `lib/data/queries.ts` et `lib/data/actions.ts` doivent connaître la provenance des données.

Chaque occurrence trouvée est une page à refactoriser avant la migration. Si le compte est élevé, cette remédiation devient la tâche 1 — elle est pénible mais mécanique, et la faire maintenant évite de la faire deux fois.

**Renforcement à ajouter** — règle ESLint bloquante :

```js
// eslint.config.mjs
{
  files: ["app/**/*.tsx", "components/**/*.tsx"],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [{
        group: ["**/lib/data/mock/**"],
        message: "Passer par queries.ts / actions.ts."
      }]
    }]
  }
}
```

---

## Module 1 — Multi-locataire

### 1.1 Choix techniques

| Élément | Décision | Motif |
| :--- | :--- | :--- |
| Base | PostgreSQL | RLS native, indispensable au cloisonnement |
| Hébergement | **Région canadienne obligatoire** | Loi 25 + argument commercial central |
| ORM | Drizzle ou Prisma | Drizzle : plus proche du SQL, meilleur contrôle des politiques RLS |
| Auth | Better Auth, Auth.js ou Supabase Auth | 2FA obligatoire, sessions révocables |
| Stockage fichiers | S3 canadien (Backblaze B2, Wasabi, AWS ca-central-1) | Chiffrement au repos réel, URLs signées à durée courte |

### 1.2 Modèle de données — noyau

```sql
-- Cabinets (locataires)
CREATE TABLE firms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name        TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  cicc_licence_no   TEXT,                    -- permis du cabinet si applicable
  gst_number        TEXT,
  qst_number        TEXT,
  address           JSONB,
  locale_default    TEXT NOT NULL DEFAULT 'fr',
  theme             TEXT NOT NULL DEFAULT 'sapphire',
  is_demo           BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | suspended | closed
  retention_years   SMALLINT NOT NULL DEFAULT 6,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ
);

-- Utilisateurs (identité globale, peut appartenir à plusieurs cabinets)
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT NOT NULL UNIQUE,
  full_name      TEXT NOT NULL,
  locale         TEXT NOT NULL DEFAULT 'fr',
  mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appartenance + rôle (voir Module 4)
CREATE TABLE firm_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               UUID NOT NULL REFERENCES firms(id) ON DELETE RESTRICT,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role                  TEXT NOT NULL,       -- voir enum Module 4
  cicc_licence_no       TEXT,                -- obligatoire si role = 'rcic'
  licence_status        TEXT,                -- active | suspended | revoked
  licence_verified_at   DATE,
  supervising_member_id UUID REFERENCES firm_members(id),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (firm_id, user_id)
);
```

**Règle transversale absolue :** *toute* table métier porte `firm_id UUID NOT NULL REFERENCES firms(id)`. Sans exception, y compris les tables de liaison. Une table sans `firm_id` est une fuite en attente.

### 1.3 Personnes, clients, dossiers

Modélise la personne séparément du dossier. Un dossier d'immigration implique couramment quatre personnes liées; si tu poses « un client = une personne », la refonte plus tard est douloureuse.

```sql
CREATE TABLE persons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id          UUID NOT NULL REFERENCES firms(id),
  family_name      TEXT NOT NULL,
  given_names      TEXT NOT NULL,
  date_of_birth    DATE,
  citizenships     TEXT[],
  uci              TEXT,                     -- identifiant client IRCC
  email            CITEXT,
  phone            TEXT,
  address          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES firm_members(id)
);

-- Statut au Canada : historisé, jamais écrasé
CREATE TABLE person_statuses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id        UUID NOT NULL REFERENCES firms(id),
  person_id      UUID NOT NULL REFERENCES persons(id),
  status_type    TEXT NOT NULL,   -- visitor | study_permit | work_permit | maintained | pr | citizen | none
  document_no    TEXT,
  issued_on      DATE,
  expires_on     DATE,
  is_current     BOOLEAN NOT NULL DEFAULT TRUE,
  source         TEXT,            -- déclaré | document vérifié | portail IRCC
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id),
  reference       TEXT NOT NULL,             -- ex. DGV-2026-0142
  program         TEXT NOT NULL,             -- express_entry | peq | lmia | study_permit | family_sponsorship | ...
  stream          TEXT,
  jurisdiction    TEXT,                      -- federal | quebec | autre province
  status          TEXT NOT NULL,             -- prospect | open | submitted | awaiting_decision | closed
  opened_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_on       DATE,
  responsible_rcic_id UUID NOT NULL REFERENCES firm_members(id),
  UNIQUE (firm_id, reference)
);

-- Rattachement des personnes au dossier
CREATE TABLE matter_parties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id),
  matter_id    UUID NOT NULL REFERENCES matters(id),
  person_id    UUID NOT NULL REFERENCES persons(id),
  role         TEXT NOT NULL,   -- principal | conjoint | enfant | garant | employeur
  is_client    BOOLEAN NOT NULL DEFAULT TRUE,   -- distingue le client contractuel du simple participant
  UNIQUE (matter_id, person_id)
);
```

`is_client` compte : le garant et le demandeur peuvent avoir des intérêts divergents, ce que le module conflits d'intérêts (5.3) exploite.

### 1.4 Isolation par ligne (RLS)

```sql
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters FORCE ROW LEVEL SECURITY;  -- s'applique même au propriétaire de la table

CREATE POLICY tenant_isolation ON matters
  USING (firm_id = current_setting('app.current_firm_id', true)::uuid)
  WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);
```

À répliquer sur chaque table. Écris un script de génération plutôt que de le faire à la main — et un test qui échoue si une table métier n'a pas RLS activée :

```sql
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relrowsecurity = FALSE
  AND c.relname NOT IN ('firms','users','deadline_rules','schema_migrations');
```

**Application des variables de session.** L'application se connecte avec un rôle non privileged (`app_user`, jamais le propriétaire). Chaque transaction pose son contexte :

```ts
// lib/db/withTenant.ts
export async function withTenant<T>(ctx: SessionContext, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_firm_id', ${ctx.firmId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_member_id', ${ctx.memberId}, true)`);
    return fn(tx);
  });
}
```

Le troisième argument `true` limite la portée à la transaction — essentiel avec un pool de connexions, sinon le contexte fuit vers la requête suivante.

### 1.5 Tests de cloisonnement (bloquants en CI)

1. Deux cabinets, données identiques. Une requête sous le contexte A ne retourne jamais de ligne de B.
2. Un `INSERT` avec un `firm_id` étranger est rejeté par `WITH CHECK`.
3. Un accès direct par UUID à une ressource d'un autre cabinet retourne 404, **jamais 403** — un 403 confirme l'existence de la ressource.
4. Sans `app.current_firm_id`, toute requête retourne zéro ligne (et non l'ensemble).
5. Le pool ne conserve pas le contexte entre deux requêtes.

### 1.6 Stockage documentaire

Le libellé « AES-256 » de `GEMINI.md` n'est pas encore fondé — sans backend, le fichier ne quitte pas le navigateur. À rendre vrai avant toute allégation commerciale :

- chiffrement au repos côté fournisseur (SSE), bucket privé;
- clé d'objet préfixée par le cabinet : `firms/{firm_id}/matters/{matter_id}/{uuid}`;
- accès uniquement par URL signée, expiration ≤ 5 minutes, générée après vérification du droit d'accès en base;
- l'antivirus à l'ingestion peut attendre, mais prévois le point d'accroche;
- `documents.sha256` calculé à l'ingestion : sert à l'intégrité et à la détection de doublons.

---

## Module 3 — Journal d'audit inaltérable

Spécifié avant le module 2 : chaque mutation ajoutée ensuite doit déjà écrire dedans.

### 3.1 Table

```sql
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  firm_id       UUID NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  actor_member_id UUID,               -- NULL = système
  actor_email   TEXT,                 -- dénormalisé : survit à la suppression du membre
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,        -- view | create | update | delete | download | export | login | permission_change
  entity_type   TEXT NOT NULL,
  entity_id     UUID,
  matter_id     UUID,                 -- pour l'export par dossier
  summary       TEXT NOT NULL,        -- lisible par un humain, bilingue via clé i18n
  changes       JSONB,                -- { champ: { avant, après } } — jamais de données sensibles brutes
  ip_address    INET,
  user_agent    TEXT,
  prev_hash     TEXT,
  row_hash      TEXT NOT NULL
);

CREATE INDEX ON audit_log (firm_id, occurred_at DESC);
CREATE INDEX ON audit_log (firm_id, matter_id, occurred_at DESC);
```

### 3.2 Inaltérabilité

Trois couches, car aucune ne suffit seule :

**a) Privilèges.** Le rôle applicatif n'obtient que `INSERT` et `SELECT`.

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_user;
GRANT INSERT, SELECT ON audit_log TO app_user;
```

**b) Déclencheur de blocage.** Ceinture et bretelles contre une erreur de migration :

```sql
CREATE FUNCTION audit_log_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log est en ajout seul';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_change
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
```

**c) Chaîne de hachage.** `row_hash = sha256(prev_hash || firm_id || occurred_at || actor || action || entity || changes)`, où `prev_hash` est celui de l'entrée précédente **du même cabinet**. Une tâche quotidienne revalide la chaîne et alerte en cas de rupture. C'est ce qui transforme le journal d'un simple registre en élément de preuve : toute suppression rétroactive devient détectable.

### 3.3 Écriture

Pas d'appel manuel dispersé dans le code — il sera oublié. Enveloppe unique dans `lib/data/actions.ts` :

```ts
export async function mutate<T>(ctx, spec: AuditSpec, fn: (tx) => Promise<T>) {
  return withTenant(ctx, async (tx) => {
    const before = spec.captureBefore ? await spec.captureBefore(tx) : null;
    const result = await fn(tx);
    await appendAudit(tx, ctx, spec, before, result);
    return result;
  });
}
```

L'écriture d'audit partage la transaction de la mutation : si l'une échoue, les deux échouent. Pas de mutation sans trace.

### 3.4 Consultations

`action = 'view'` sur les entités sensibles seulement (dossier, document, écriture fidéicommis). Journaliser chaque affichage de liste noierait le signal et gonflerait la table. La consultation d'un document et son téléchargement sont deux événements distincts.

### 3.5 Interface

- Onglet **Historique** sur chaque dossier — filtrable, exportable.
- Page cabinet `/fr/settings/audit` réservée aux rôles `owner` et `rcic` : filtres par acteur, période, type d'action; export CSV et PDF.
- Bandeau d'état de la chaîne d'intégrité (dernière validation, résultat).

---

## Module 4 — Rôles et supervision

### 4.1 Rôles

| Rôle | Description | Peut représenter un client devant IRCC |
| :--- | :--- | :--- |
| `owner` | Propriétaire du cabinet, forcément CRIC en règle | Oui |
| `rcic` | Consultant réglementé | Oui |
| `risia` | Stagiaire-étudiant en immigration, sous supervision | Non |
| `staff` | Personnel administratif non réglementé | **Non** |
| `bookkeeper` | Comptabilité seulement | Non |
| `readonly` | Vérificateur externe, accès temporaire | Non |

`staff` et `risia` exigent un `supervising_member_id` pointant vers un `rcic` actif. Contrainte à faire respecter en base, pas seulement dans l'interface.

### 4.2 Actions réservées

Certaines actions ne peuvent être **accomplies** que par un CRIC en règle :

- signer ou contresigner un contrat de services;
- transmettre une demande à IRCC / MIFI;
- donner un avis juridique consigné au dossier;
- autoriser un virement du fidéicommis vers le compte général;
- fermer un dossier.

Le personnel non réglementé peut **préparer** ces actions. D'où une mécanique en deux temps qui est ton véritable différenciateur :

```sql
CREATE TABLE action_approvals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id),
  matter_id         UUID REFERENCES matters(id),
  action_type       TEXT NOT NULL,
  payload           JSONB NOT NULL,
  prepared_by       UUID NOT NULL REFERENCES firm_members(id),
  prepared_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by       UUID REFERENCES firm_members(id),   -- doit être rcic ou owner
  approved_at       TIMESTAMPTZ,
  rejected_reason   TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'     -- pending | approved | rejected | executed
);
```

L'action ne s'exécute qu'après approbation, et le journal d'audit conserve les deux acteurs. C'est exactement la preuve qu'un CRIC doit produire lorsqu'on lui reproche d'avoir laissé un non-réglementé agir en son nom.

### 4.3 Vérification du permis

`firm_members.licence_status` et `licence_verified_at`. Si le statut passe à `suspended` ou `revoked`, le membre perd immédiatement les actions réservées et le cabinet reçoit une alerte. La vérification reste manuelle au départ — le registre public du CICC est consultable, mais ne présume pas d'une API tant que tu ne l'as pas confirmée.

### 4.4 Autorisation dans le code

Deux niveaux, non redondants :

1. **RLS** = cloisonnement entre cabinets. Ne gère pas les rôles.
2. **Couche d'autorisation applicative** = ce que ce rôle peut faire sur cette entité.

```ts
// lib/auth/policy.ts
export const can = (member: Member, action: Action, resource?: Resource): boolean => { /* ... */ };
```

Vérification exclusivement côté serveur (Server Actions / route handlers). Le masquage de boutons dans l'interface est du confort, jamais de la sécurité.

---

## Module 2 — Moteur d'échéances et d'alertes

Ta fonctionnalité signature. Un consultant à qui elle sauve un dossier une fois ne change plus d'outil.

### 2.1 Principe fondamental : règles en données, pas en code

Les délais réglementaires changent. Ne code jamais « 90 jours » en dur : stocke les règles en base, versionnées, avec source et date d'entrée en vigueur.

```sql
CREATE TABLE deadline_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,           -- ex. restoration_window
  label_fr          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  trigger_event     TEXT NOT NULL,           -- status_expiry | biometrics_request | ita_received | ...
  offset_days       INTEGER NOT NULL,
  offset_direction  TEXT NOT NULL,           -- after | before
  severity          TEXT NOT NULL,           -- critical | high | normal
  reminder_offsets  INTEGER[] NOT NULL,      -- ex. {90,60,30,14,7,1}
  authority         TEXT NOT NULL,           -- référence réglementaire
  source_url        TEXT,
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  verified_on       DATE NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);
```

Le champ `verified_on` est un engagement de maintenance : une règle non revérifiée depuis douze mois s'affiche en avertissement dans l'administration. C'est aussi ta protection en responsabilité — tu fournis un outil de suivi, pas un avis juridique, et l'application doit le dire explicitement.

### 2.2 Règles à implanter au lancement

**Vérifie chaque valeur auprès de la source officielle avant de peupler la table.** La liste ci-dessous indique *quoi* suivre; les durées exactes doivent être confirmées et datées :

*Statut au Canada*
- Expiration de permis de travail / d'études / de séjour de visiteur
- Fenêtre de rétablissement de statut après perte
- Statut maintenu (demande de prolongation déposée avant expiration) — le suivi porte sur la décision, pas sur une date fixe
- Expiration du passeport (bloque souvent la durée du permis accordé)

*Fédéral*
- Délai de soumission d'une demande complète après invitation Entrée express
- Délai de fourniture des données biométriques après la lettre d'instruction
- Validité de l'examen médical
- Validité de la CPRPR et du visa avant atterrissage
- Demande de documents supplémentaires (délai variable indiqué dans la lettre — saisie manuelle)
- Délai d'appel devant la SAI, délai de contrôle judiciaire

*Québec*
- Validité du CAQ (études) et échéance de renouvellement
- Validité du CSQ
- Échéances Arrima / PSTQ
- Validité d'une décision EIMT et fenêtre de dépôt du permis de travail

*Cabinet*
- Échéance de renouvellement du permis CICC
- Renouvellement de l'assurance responsabilité professionnelle
- Date limite de déclaration UFC
- Rapprochement mensuel du fidéicommis
- Remises TPS/TVQ

### 2.3 Échéances calculées

```sql
CREATE TABLE deadlines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id        UUID NOT NULL REFERENCES firms(id),
  matter_id      UUID REFERENCES matters(id),
  person_id      UUID REFERENCES persons(id),
  rule_code      TEXT,                 -- NULL si saisie manuelle
  title          TEXT NOT NULL,
  due_on         DATE NOT NULL,
  severity       TEXT NOT NULL,
  source_fact    JSONB,                -- fait déclencheur : { type, date, document_id }
  status         TEXT NOT NULL DEFAULT 'open',  -- open | done | dismissed | superseded
  assigned_to    UUID REFERENCES firm_members(id),
  completed_at   TIMESTAMPTZ,
  completed_by   UUID REFERENCES firm_members(id),
  dismissed_reason TEXT,
  is_manual      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX ON deadlines (firm_id, status, due_on);
```

**Recalcul.** Déclenché par tout changement du fait source (nouveau statut, nouvelle date saisie, document ajouté). L'ancienne échéance passe à `superseded` — jamais supprimée, pour préserver l'historique de ce que le consultant voyait à un moment donné.

**Ignorer une échéance** exige un motif écrit, journalisé. C'est la preuve d'une décision réfléchie plutôt que d'un oubli.

### 2.4 Rappels

Table `deadline_reminders` (échéance, date d'envoi, canal, statut). Tâche planifiée quotidienne, exécutée en heure locale du cabinet, qui matérialise les rappels dus.

Canaux : courriel (obligatoire), notification dans l'application, résumé hebdomadaire du lundi matin. Les SMS peuvent attendre.

**Idempotence obligatoire :** contrainte unique sur `(deadline_id, offset_days)`. Une tâche relancée ne doit jamais renvoyer un rappel déjà transmis.

### 2.5 Interface

- **Tableau de bord** : bandeau des échéances critiques dans les 30 jours, en tête de page, avant les KPI. C'est la première chose que le consultant doit voir en ouvrant l'application.
- **`/fr/deadlines`** : vue liste consolidée, filtres par gravité, dossier, responsable.
- **Agenda** : superposition des échéances sur la vue calendrier existante, code couleur distinct des rendez-vous.
- **Dossier** : bloc « Prochaines échéances » et historique des échéances passées.

### 2.6 Redéfinition du KPI de conformité

Le « Taux de conformité CICC » du tableau de bord a besoin d'une définition défendable, sinon ton premier client la contestera. Score sur items binaires vérifiables :

| Item | Poids |
| :--- | :--- |
| Contrat de services signé au dossier | 20 |
| Mandat de représentation signé et versé | 15 |
| Aucune échéance critique dépassée | 20 |
| Rapprochement du mois précédent complété | 15 |
| Aucun retrait fidéicommis sans facture rattachée | 15 |
| Registre des conflits d'intérêts vérifié à l'ouverture | 10 |
| Permis CICC et assurance en règle | 5 |

Le survol affiche le détail item par item. Un score sans ventilation est un chiffre décoratif.

---

## Module 6 — Contrats de services générés

Tu disposes déjà de modèles conformes (standard, pro bono, entente de consultation initiale) audités contre le guide du CICC. Ils deviennent un module.

### 6.1 Modèle de données

```sql
CREATE TABLE contract_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID REFERENCES firms(id),   -- NULL = modèle système fourni par la plateforme
  kind          TEXT NOT NULL,               -- retainer | pro_bono | initial_consultation
  locale        TEXT NOT NULL,
  version       INTEGER NOT NULL,
  body          JSONB NOT NULL,              -- blocs structurés, pas du HTML libre
  required_clauses TEXT[] NOT NULL,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id),
  matter_id         UUID NOT NULL REFERENCES matters(id),
  template_id       UUID NOT NULL REFERENCES contract_templates(id),
  template_version  INTEGER NOT NULL,
  variables         JSONB NOT NULL,          -- honoraires, échéancier, portée, exclusions
  rendered_pdf_key  TEXT,
  rendered_sha256   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft',  -- draft | sent | signed | terminated
  sent_at           TIMESTAMPTZ,
  signed_at         TIMESTAMPTZ,
  terminated_at     TIMESTAMPTZ,
  terminated_reason TEXT
);
```

**Versionnement figé.** Le contrat conserve `template_version` et le PDF rendu avec son empreinte. Modifier un modèle n'altère jamais un contrat déjà signé — c'est l'erreur classique et elle est irrattrapable en audit.

### 6.2 Clauses obligatoires

Le générateur valide la présence de chaque clause de `required_clauses` avant publication. Blocs à couvrir : identification du CRIC et numéro de permis; description précise des services inclus **et exclus**; honoraires, débours et taxes ventilés; modalités de paiement et échéancier; traitement des fonds en fidéicommis; politique de remboursement; conditions de résiliation de part et d'autre; procédure de traitement des plaintes avec les coordonnées du CICC; langue de la prestation; protection des renseignements personnels.

Vérifie la liste exacte contre la version courante du guide du CICC avant de figer `required_clauses` — cette liste évolue.

### 6.3 Signature

Le lien vers `matters` déclenche automatiquement, à la signature, la création du dossier de facturation et la levée du blocage d'ouverture (voir 6.4). Le mandat IMM 5476 suit un flux parallèle, distinct du contrat de services.

Conserve pour chaque signature : horodatage, adresse IP, méthode d'authentification du signataire, empreinte du document signé. C'est ce qui rend la signature opposable.

### 6.4 Blocage d'ouverture

Un dossier ne peut pas passer de `prospect` à `open` sans contrat signé au dossier. Blocage contournable avec motif écrit et journalisé — il existe des situations d'urgence légitimes, mais elles doivent laisser une trace.

---

## Module 5 — Registres réglementaires

Cinq registres, structure commune : entrée horodatée, immuable une fois validée, exportable.

### 5.1 Registre des clients

Dérivé de `persons` + `matters`, avec vue dédiée exportable : nom, coordonnées, dossiers, dates d'ouverture et de fermeture, CRIC responsable, état du contrat.

### 5.2 Registre des plaintes

```sql
CREATE TABLE complaints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id),
  matter_id         UUID REFERENCES matters(id),
  received_on       DATE NOT NULL,
  channel           TEXT NOT NULL,           -- courriel | téléphone | courrier | portail
  complainant       TEXT NOT NULL,
  summary           TEXT NOT NULL,
  acknowledged_on   DATE,
  resolution        TEXT,
  resolved_on       DATE,
  escalated_to_cicc BOOLEAN NOT NULL DEFAULT FALSE,
  handled_by        UUID REFERENCES firm_members(id)
);
```

Génère automatiquement une échéance d'accusé de réception — le délai de réponse est justement ce qui se perd dans une boîte courriel.

### 5.3 Conflits d'intérêts

Vérification déclenchée à l'ouverture de dossier : recherche par nom, date de naissance et UCI dans l'ensemble des personnes du cabinet, y compris les dossiers fermés. Signale les parties adverses potentielles (garant contre demandeur, employeur contre travailleur, ex-conjoints dans deux dossiers distincts).

Le résultat de la vérification est consigné même lorsqu'il est négatif — l'absence de conflit doit être prouvable.

### 5.4 UFC (formation continue)

Table `cpd_records` : activité, date, heures, catégorie, pièce justificative téléversée, année de déclaration. Tableau de bord par membre CRIC avec cumul et écart par rapport à l'exigence annuelle, plus une échéance automatique avant la date limite de déclaration.

### 5.5 Assurance responsabilité professionnelle

Table `insurance_policies` : assureur, numéro de police, couverture, période de validité, attestation téléversée. Échéance de renouvellement générée à 60 et 30 jours. Alerte bloquante si la police expire — un CRIC sans assurance valide ne peut pas exercer.

---

## Module 7 — Export et conservation

Deux fonctions distinctes, souvent confondues.

### 7.1 Export d'un dossier (audit CICC, transfert au client)

Un bouton produit une archive ZIP contenant :

```
DGV-2026-0142/
├── 00-sommaire.pdf              # identité, programme, chronologie, intervenants
├── 01-contrat/                  # contrat signé, mandat IMM 5476, avenants
├── 02-documents/                # pièces classées par catégorie, noms d'origine préservés
├── 03-correspondance/           # journal des communications, PDF
├── 04-facturation/              # factures, reçus, écritures fidéicommis du dossier
├── 05-journal-audit.csv         # historique complet des actions sur ce dossier
└── manifeste.json               # inventaire + SHA-256 de chaque fichier
```

Le manifeste avec empreintes permet à un tiers de vérifier que rien n'a été retiré. Export lui-même journalisé (`action = 'export'`).

### 7.2 Export complet du cabinet (sortie de plateforme)

Argument de vente, pas seulement contrainte : un consultant hésite à s'engager s'il craint d'être captif.

Format : JSON structuré (toutes les tables du cabinet) + arborescence de fichiers + jeu de PDF lisibles sans l'application. Déclenchement autonome depuis les paramètres, sans passer par ton support. Livraison par lien signé à expiration courte.

### 7.3 Conservation

`firms.retention_years` par défaut à 6 — **confirme la période exigée par le CICC et par les autorités fiscales avant de figer cette valeur**, et retiens la plus longue des deux.

```sql
CREATE TABLE retention_holds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id),
  matter_id   UUID NOT NULL REFERENCES matters(id),
  reason      TEXT NOT NULL,      -- plainte | litige | demande CICC
  placed_on   DATE NOT NULL,
  placed_by   UUID NOT NULL REFERENCES firm_members(id),
  released_on DATE
);
```

Aucune purge possible sur un dossier sous blocage. La purge éventuelle est proposée, jamais automatique : elle exige une confirmation du `owner` et laisse une entrée d'audit indiquant ce qui a été détruit et quand.

### 7.4 Continuité

Deux scénarios à traiter dans les conditions de service dès maintenant, même si l'implantation vient plus tard :

- **Cessation d'activité du cabinet** : compte en lecture seule pendant la période de conservation, export intégral disponible.
- **Décès ou suspension du CRIC** : procédure d'accès pour un successeur désigné, avec pièces justificatives. Prévois le champ « CRIC successeur désigné » dans les paramètres du cabinet — c'est un excellent signal de sérieux professionnel.

---

## Points de vigilance transversaux

**Allégations de sécurité.** Ne publie « chiffrement AES-256 », « conforme au CICC » ou « conforme à la Loi 25 » que lorsque c'est vérifiablement le cas. Une affirmation non fondée en matière de sécurité est un risque juridique, pas une formule marketing.

**Loi 25.** Comme fournisseur SaaS, tu deviens sous-traitant des renseignements personnels de tes clients. Prévois : entente écrite de traitement, responsable de la protection des renseignements personnels désigné, registre des incidents de confidentialité, évaluation des facteurs relatifs à la vie privée si des données franchissent la frontière. Fais valider ces documents par un juriste — c'est hors de mon champ.

**Références réglementaires.** `GEMINI.md` fixe « Art. 13 » pour le fidéicommis. Les numéros d'articles bougent lors des refontes du Code de conduite professionnelle. Stocke la référence en données (comme `deadline_rules.authority`) plutôt que dans le code et l'interface, et vérifie la version courante.

**Cabinet de démonstration.** Conserve `Cabinet Immigration Boréale Inc.` mais isole-le comme locataire avec `is_demo = TRUE` dès la mise en place de la base — sinon il se mêlera aux données réelles de DGV lorsque tu commenceras à utiliser la plateforme toi-même.

**Client zéro.** Fais tourner DGV Immigration sur la plateforme pendant plusieurs mois avant de vendre. Peu de fondateurs SaaS ont cet avantage : tu découvriras les frictions que tes futurs clients ne t'expliqueraient jamais.

---

## Mise à jour requise de GEMINI.md

Après la phase 1, ajoute aux directives pour les agents IA :

1. Toute nouvelle table métier porte `firm_id NOT NULL` et une politique RLS.
2. Toute mutation passe par l'enveloppe `mutate()` — jamais d'appel direct au client de base de données.
3. Toute action réservée vérifie `can(member, action, resource)` côté serveur.
4. Aucun délai réglementaire codé en dur : ils vivent dans `deadline_rules`.
5. Les tests de cloisonnement multi-locataire sont bloquants en CI.
