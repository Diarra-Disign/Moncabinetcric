# SPEC-PILIERS-METIER.md — moncabinetcric

Spécification des deux piliers métier : **Ententes de service** et **Recherche juridique**.
À lire après `SPEC-FONDATIONS.md`, qui reste le prérequis technique.

---

## Avertissement de séquencement

| Pilier | Nature | Dépendances | Risque principal |
| :--- | :--- | :--- | :--- |
| **Ententes de service** | Extension du Module 6 | Modules 1, 3, 4 (fondations) | Maintenance du catalogue de frais |
| **Recherche juridique** | Produit distinct | Modules 1, 3, 4 + entente de licence | **Source des données** |

La recherche juridique ne doit pas démarrer avant que le pilier Ententes soit en production et que la question des droits sur la jurisprudence soit tranchée. Un onglet de recherche à moitié peuplé fait plus de tort à la crédibilité qu'un onglet absent.

**Sur la source d'inspiration.** Les fonctionnalités ne sont pas protégeables — tu peux t'en inspirer librement. Le **texte des clauses** l'est. Ne reprends jamais le libellé d'articles d'un contrat existant d'un autre éditeur : rédige les tiens à partir de tes propres modèles déjà audités contre le guide du CICC.

---

# PILIER A — Ententes de service

## A.1 Le choix structurant : personne × service

L'entente ne porte pas un honoraire global mais une somme de services rattachés à des personnes. C'est le bon modèle, et il détermine tout le reste.

```sql
CREATE TABLE agreements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id            UUID NOT NULL REFERENCES firms(id),
  matter_id          UUID NOT NULL REFERENCES matters(id),
  reference          TEXT NOT NULL,              -- SA-2026-000142
  source_type        TEXT,                       -- intake_form | service_proposal | manual
  source_code        TEXT,                       -- IF-AAAA-XXXXXX | SP-AAAA-XXXXXX
  locale             TEXT NOT NULL DEFAULT 'fr',
  status             TEXT NOT NULL DEFAULT 'draft',
                     -- draft | pending_signatures | fully_signed | amended | terminated | cancelled
  clause_set_version INTEGER NOT NULL,           -- gel des clauses au moment de l'envoi
  discount_cents     INTEGER NOT NULL DEFAULT 0,
  discount_label     TEXT,                       -- fidélité | client estimé | recommandation
  currency           TEXT NOT NULL DEFAULT 'CAD',
  rendered_pdf_key   TEXT,
  rendered_sha256    TEXT,
  sent_at            TIMESTAMPTZ,
  fully_signed_at    TIMESTAMPTZ,
  countersigned_by   UUID REFERENCES firm_members(id),
  parent_agreement_id UUID REFERENCES agreements(id),   -- avenant
  UNIQUE (firm_id, reference)
);

-- Personnes rattachées à l'entente (max 20)
CREATE TABLE agreement_persons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id),
  agreement_id  UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES persons(id),
  party_role    TEXT NOT NULL,   -- principal | conjoint | enfant | répondant | employeur | tiers_payeur
  is_signatory  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order    SMALLINT NOT NULL,
  UNIQUE (agreement_id, person_id)
);

-- Services : max 10 par personne. Source unique des honoraires.
CREATE TABLE agreement_services (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id              UUID NOT NULL REFERENCES firms(id),
  agreement_id         UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  agreement_person_id  UUID NOT NULL REFERENCES agreement_persons(id) ON DELETE CASCADE,
  template_id          UUID REFERENCES service_templates(id),
  template_version     INTEGER,
  label_fr             TEXT NOT NULL,
  label_en             TEXT NOT NULL,
  scope_included       TEXT NOT NULL,
  scope_excluded       TEXT NOT NULL,
  fee_cents            INTEGER NOT NULL CHECK (fee_cents >= 0),
  sort_order           SMALLINT NOT NULL
);
```

**Règle non négociable :** `agreements` ne porte aucune colonne `total_fee`. Le total professionnel est *calculé* — `SUM(agreement_services.fee_cents) - discount_cents`. Dès qu'un total est stocké quelque part, il finit par diverger du détail, et une entente dont le total ne concorde pas avec sa ventilation est indéfendable en audit.

Contraintes de volume (20 personnes, 10 services) à faire respecter par déclencheur, pas seulement en interface.

## A.2 Catalogue de frais gouvernementaux

C'est la fonctionnalité la plus utile **et** le plus gros engagement de maintenance du produit. Un montant périmé dans une entente signée, c'est une plainte.

```sql
CREATE TABLE government_fees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,            -- ircc_pr_processing_principal
  label_fr          TEXT NOT NULL,
  label_en          TEXT NOT NULL,
  authority         TEXT NOT NULL,            -- IRCC | ASFC | CISR | MIFI | autre province
  jurisdiction      TEXT NOT NULL,            -- federal | QC | ON | ...
  category          TEXT NOT NULL,            -- traitement | droit_rp | biométrie | permis | citoyenneté
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CAD',
  calc_rule         TEXT NOT NULL,
                    -- per_principal | per_dependant_under_22 | per_family | per_person
                    -- | per_biometrics_family_cap | flat
  max_per_family_cents INTEGER,               -- plafond familial (biométrie, p. ex.)
  source_url        TEXT NOT NULL,
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  verified_on       DATE NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX ON government_fees (authority, jurisdiction, is_active, effective_from DESC);
```

**Historisation obligatoire.** Ne mets jamais à jour `amount_cents` : ferme l'entrée avec `effective_to` et crée la version suivante. Une entente signée en mars doit continuer d'afficher le montant de mars.

**Gel au moment de la signature.** L'entente copie le montant retenu dans sa propre ligne, avec l'identifiant et la version de l'entrée du catalogue :

```sql
CREATE TABLE agreement_government_fees (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id              UUID NOT NULL REFERENCES firms(id),
  agreement_id         UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  agreement_person_id  UUID REFERENCES agreement_persons(id),
  fee_id               UUID NOT NULL REFERENCES government_fees(id),
  label_snapshot       TEXT NOT NULL,
  amount_cents_snapshot INTEGER NOT NULL,
  quantity             SMALLINT NOT NULL DEFAULT 1,
  computed_from_rule   TEXT NOT NULL
);
```

**Réalisme sur la maintenance.** Trois cents entrées à surveiller sur des dizaines de sites gouvernementaux, c'est un poste de travail récurrent, pas une tâche ponctuelle. Prévois :

- un moteur de collecte qui relève les pages sources et signale les écarts, sans jamais publier automatiquement;
- une file de validation humaine — une modification de montant exige une approbation explicite;
- un tableau de fraîcheur : toute entrée non revérifiée depuis 90 jours passe en avertissement;
- une bannière dans l'outil de rédaction si une entrée utilisée est marquée périmée.

Commence avec 40 à 60 frais couvrant les programmes réellement pratiqués. Trois cents entrées mal tenues valent moins que cinquante entrées fiables.

**Distinction comptable capitale.** Les frais gouvernementaux sont des **débours**, pas des honoraires : hors TPS/TVQ, et normalement encaissés en fidéicommis puis versés à IRCC. Ta ventilation fiscale doit les traiter séparément de la base taxable. Fais valider ce traitement par un comptable — les règles de refacturation de débours ne sont pas triviales.

## A.3 Système de clauses

```sql
CREATE TABLE clause_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id),   -- NULL = clause système
  code            TEXT NOT NULL,
  category        TEXT NOT NULL,
  is_structural   BOOLEAN NOT NULL DEFAULT FALSE,  -- verrouillée
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,  -- exigée par le CICC
  body_fr         TEXT NOT NULL,
  body_en         TEXT NOT NULL,
  variables       TEXT[],
  version         INTEGER NOT NULL,
  effective_from  DATE NOT NULL
);
```

**Trois niveaux de verrouillage :**

1. **Structurelles** — parties, définitions, mandat, honoraires, calendrier de paiement, signatures, intégralité de l'entente. Ni masquables ni modifiables : le reste de la plateforme (facturation, fidéicommis, échéances) s'appuie sur leur présence.
2. **Exigées par le CICC** — traitement des plaintes avec coordonnées du Collège, politique de remboursement, conditions de résiliation, services exclus, fidéicommis, langue de prestation, protection des renseignements personnels. Le texte est adaptable, la clause ne peut pas disparaître.
3. **Libres** — masquables, modifiables, ou remplacées par des clauses propres au cabinet.

Le validateur bloque l'envoi si une clause de niveau 1 ou 2 manque. Vérifie la liste exacte des clauses obligatoires contre la version courante du guide du CICC — **et fais-la valider par un juriste avant la mise en marché.** Tu vends un gabarit contractuel à des professionnels réglementés; l'exposition en responsabilité est réelle.

**Gel des clauses.** `agreements.clause_set_version` fixe l'ensemble au moment de l'envoi. Une entente signée s'affiche toujours telle que signée, quoi qu'il advienne des modèles.

## A.4 Remise et calcul

Ordre de calcul, à implanter une seule fois dans une fonction pure et testée :

```
1. honoraires_bruts   = Σ services.fee_cents
2. honoraires_nets    = honoraires_bruts − remise
3. TPS                = honoraires_nets × taux_tps
4. TVQ                = honoraires_nets × taux_tvq
5. débours            = Σ frais_gouvernementaux (hors taxes)
6. total_entente      = honoraires_nets + TPS + TVQ + débours
```

La remise s'applique **avant** taxes. Le taux applicable dépend du lieu de fourniture et du statut du client — l'exonération pour client hors Canada existe mais ses conditions sont précises. Fais valider les règles de taxation par un comptable plutôt que de les déduire; le champ `tax_treatment` doit stocker la justification retenue pour chaque entente.

Le calendrier de paiement se rééchelonne automatiquement après application d'une remise, chaque jalon conservant sa proportion.

## A.5 Signature multi-parties

```sql
CREATE TABLE agreement_signatures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id),
  agreement_id        UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  signer_person_id    UUID REFERENCES persons(id),
  signer_member_id    UUID REFERENCES firm_members(id),   -- CRIC contresignataire
  signer_role         TEXT NOT NULL,
  signer_email        CITEXT NOT NULL,
  order_index         SMALLINT NOT NULL,
  token_hash          TEXT NOT NULL,       -- jamais le jeton en clair
  token_expires_at    TIMESTAMPTZ NOT NULL,
  viewed_at           TIMESTAMPTZ,
  signed_at           TIMESTAMPTZ,
  signature_image_key TEXT,
  ip_address          INET,
  user_agent          TEXT,
  auth_method         TEXT NOT NULL,       -- courriel + jeton | + code SMS | + question
  declined_at         TIMESTAMPTZ,
  declined_reason     TEXT
);
```

**Opposabilité.** Chaque signature conserve horodatage, IP, méthode d'authentification et empreinte du document *au moment de la signature*. Sans ces éléments, une signature électronique se conteste facilement. La contresignature du CRIC est une action réservée au sens du Module 4 — jamais déléguée au personnel administratif.

**Rappels.** Envoi quotidien aux signataires manquants, avec plafond (10 rappels, puis alerte au cabinet). Idempotence obligatoire : contrainte unique sur `(signature_id, reminder_day)`.

**Ordre.** Les signataires peuvent signer en parallèle, sauf `order_index` explicite. La contresignature du CRIC vient toujours en dernier.

## A.6 Avenants

Un avenant est une nouvelle `agreements` avec `parent_agreement_id` renseigné, contenant uniquement les modifications, et renvoyant à l'original par référence. L'original conserve le statut `amended` — jamais `cancelled`. La chaîne complète s'affiche sur la page du dossier et s'exporte ensemble.

## A.7 Facturation à la signature

Au passage à `fully_signed` :

1. génération de la facture selon le premier jalon du calendrier;
2. si le paiement est destiné au fidéicommis, création de l'écriture attendue (voir Module fidéicommis);
3. levée du blocage d'ouverture du dossier (`prospect` → `open`);
4. création des échéances des jalons suivants;
5. entrée d'audit unique décrivant l'ensemble.

Le tout dans une seule transaction : une entente signée sans facture, ou l'inverse, laisse le cabinet dans un état incohérent.

## A.8 Fonctionnalités IA

**Pré-remplissage.** Document téléversé → valeurs de brouillon proposées pour client, personnes, portée, frais. Trois règles : (a) chaque valeur proposée est marquée comme suggestion et doit être acceptée explicitement; (b) le document ne sert qu'à cette demande et n'est pas conservé; (c) aucune suggestion ne porte sur un montant d'honoraires — c'est un jugement professionnel.

**Révision.** Audit du brouillon contre une liste de contrôle : clauses manquantes, portée floue, frais absents pour le programme visé, incohérence entre personnes et services. Le résultat est une liste de signalements, jamais une réécriture automatique.

**Connecteur MCP.** Ton découpage est le bon et mérite d'être maintenu tel quel : lecture, ajout de personnes et services, validation, révision — mais **finaliser, envoyer, signer et annuler restent hors de portée de l'IA**. Désactivé par défaut, activé par le propriétaire, autorisation par membre, chaque appel consigné au journal d'audit avec `actor_role = 'ai_connector'`. C'est exactement la ligne qu'un régulateur voudra voir tracée.

## A.9 Démarrage par code

`IF-AAAA-XXXXXX` (formulaire d'admission) et `SP-AAAA-XXXXXX` (proposition acceptée) ouvrent l'outil de rédaction préremplie. Référence croisée dans les deux sens. Format à valider : préfixe + année + six caractères alphanumériques sans caractères ambigus (ni O, ni 0, ni I, ni 1), limitation du taux de tentatives, expiration après usage.

---

# PILIER B — Recherche juridique

## B.1 À régler avant toute ligne de code

Trois questions. Aucune n'est technique, et deux peuvent tuer le pilier.

### a) D'où viennent les décisions?

Le point critique : **CanLII n'est pas une source de données librement exploitable.** Ses conditions d'utilisation encadrent la copie systématique et la réutilisation commerciale, et l'accès à son API est soumis à autorisation. Construire un index commercial à partir de CanLII sans entente écrite t'expose à une mise en demeure — et ce serait après avoir investi des mois.

Trois voies :

| Voie | Description | Faisabilité |
| :--- | :--- | :--- |
| **Licence** | Entente écrite avec CanLII ou Lexum | À explorer en premier — écris-leur avant de coder |
| **Sources primaires** | Décisions récupérées directement des sites de la CSC, CAF, CF, CISR, TCDP | Plus de travail, mais tu contrôles la chaîne |
| **Lien seulement** | Aucun index : recherche fédérée, redirection vers CanLII | Faible valeur, mais zéro risque |

Sur la voie des sources primaires : le **Décret sur la reproduction de la législation fédérale** permet, à certaines conditions, la reproduction des textes législatifs fédéraux ainsi que des décisions et motifs des tribunaux judiciaires et administratifs constitués sous le régime fédéral, sans autorisation — sous réserve d'une diligence raisonnable quant à l'exactitude et de la mention que la reproduction n'est pas la version officielle. Cette voie rend le pilier viable indépendamment de CanLII, **mais fais confirmer la portée exacte par un juriste avant d'investir.** Chaque tribunal a en outre ses propres conditions de publication à vérifier.

### b) Qui porte la responsabilité?

Tu vends un outil de recherche juridique à des professionnels qui **ne sont pas juristes** et dont le champ d'exercice est délimité. Une disposition périmée ou une décision infirmée peut se traduire par un dossier perdu.

Exigences minimales, non négociables :

- avertissement permanent et visible : outil de recherche documentaire, ne constitue pas un avis juridique;
- date de dernière mise à jour affichée sur chaque texte législatif consulté;
- indication explicite qu'il ne s'agit pas de la version officielle, avec lien vers celle-ci;
- **absence délibérée de tout indicateur de traitement judiciaire** — pas de « bon droit », pas de feu vert ou rouge. Ta position de ne fournir que des relations neutres « cite » et « citée par » est prudente et bien vue : ne t'en écarte jamais. Prétendre qu'une décision est toujours valide sans l'appareil éditorial des grands éditeurs serait une faute lourde;
- avis clair que l'index est partiel, avec périmètre exact affiché.

### c) Est-ce le bon moment?

Ce pilier représente un effort comparable à celui du reste de la plateforme. Il ne devrait pas précéder l'onglet Ententes en production ni le premier client payant. Deux atténuations possibles :

- **Positionnement Premium** — supplément distinct, jamais dans l'offre de base;
- **Livraison par phases**, ci-dessous, où la phase 1 est légalement propre et immédiatement utile.

## B.2 Livraison par phases

| Phase | Contenu | Source | Risque |
| :--- | :--- | :--- | :--- |
| **1** | Législation fédérale en texte intégral — LIPR, RIPR, Loi sur la citoyenneté, règles des cours et tribunaux | Site des lois du Canada, décret de reproduction | Faible |
| **2** | Espaces de travail, notes, rapport cité — sur la législation seulement | Interne | Nul |
| **3** | Index de jurisprudence par métadonnées | **Selon la voie retenue en B.1a** | Élevé |
| **4** | Graphe de citations | Dérivé de la phase 3 | Moyen |
| **5** | Veilles et alertes | Dérivé de la phase 3 | Faible |
| **6** | Assistant IA Premium | Dérivé des phases 1-4 | Moyen |

**La phase 1 se tient seule et vaut déjà l'onglet.** LIPR et RIPR consultables en bilingue, avec recherche plein texte, renvois entre articles et espaces de travail par dossier — c'est un usage quotidien réel pour un CRIC, et c'est réalisable sans dépendance externe risquée.

## B.3 Modèle de données

```sql
-- Législation (phases 1-2)
CREATE TABLE legislation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL,              -- lipr | ripr | loi_citoyennete
  short_title_fr  TEXT NOT NULL,
  short_title_en  TEXT NOT NULL,
  citation        TEXT NOT NULL,
  instrument_type TEXT NOT NULL,              -- loi | reglement | regles
  jurisdiction    TEXT NOT NULL DEFAULT 'federal',
  source_url_fr   TEXT NOT NULL,
  source_url_en   TEXT NOT NULL,
  consolidated_on DATE NOT NULL,              -- date de la version consultée
  fetched_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE legislation_provisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legislation_id  UUID NOT NULL REFERENCES legislation(id),
  provision_no    TEXT NOT NULL,              -- 38(1)c)
  hierarchy_path  TEXT NOT NULL,              -- partie/section/article/paragraphe
  heading_fr      TEXT,
  heading_en      TEXT,
  body_fr         TEXT NOT NULL,
  body_en         TEXT NOT NULL,
  amended_on      DATE,
  citing_case_count INTEGER NOT NULL DEFAULT 0,   -- alimenté en phase 4
  search_fr       TSVECTOR GENERATED ALWAYS AS (to_tsvector('french', body_fr)) STORED,
  search_en       TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', body_en)) STORED,
  UNIQUE (legislation_id, provision_no)
);
CREATE INDEX ON legislation_provisions USING GIN (search_fr);
CREATE INDEX ON legislation_provisions USING GIN (search_en);
```

La recherche plein texte native de PostgreSQL suffit largement à la phase 1. N'introduis un moteur dédié qu'en phase 3, quand le volume le justifie.

```sql
-- Espaces de travail (phase 2) — rattachés au cabinet, donc RLS
CREATE TABLE research_workspaces (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id),
  matter_id    UUID REFERENCES matters(id),
  title        TEXT NOT NULL,
  created_by   UUID NOT NULL REFERENCES firm_members(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE research_sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id),
  workspace_id      UUID NOT NULL REFERENCES research_workspaces(id) ON DELETE CASCADE,
  source_type       TEXT NOT NULL,            -- provision | case
  provision_id      UUID REFERENCES legislation_provisions(id),
  case_id           UUID,                     -- phase 3
  citation_snapshot TEXT NOT NULL,            -- gel : survit à la mise à jour de l'index
  text_snapshot     TEXT,                     -- extrait pertinent au moment de l'ajout
  external_url      TEXT NOT NULL,
  note              TEXT,
  sort_order        SMALLINT NOT NULL
);
```

Les instantanés de citation et de texte sont essentiels : une source enregistrée doit conserver ce que le consultant a effectivement lu, même si l'index sous-jacent évolue. C'est aussi ce qui rend le rapport exporté défendable six mois plus tard.

## B.4 Assistant IA — architecture obligatoire

Ta description pose déjà les bonnes contraintes. Traduites en exigences techniques :

1. **RAG strict.** Le modèle ne reçoit que des extraits de l'index, injectés dans le contexte. Aucun accès web, aucun outil de recherche externe.
2. **Vérification de conformité automatisée.** Après génération, chaque citation du mémoire est confrontée aux passages effectivement fournis. Toute citation absente du contexte fait **rejeter le mémoire entier** — pas de correction partielle, pas d'affichage avec avertissement.
3. **Traçabilité.** Chaque affirmation renvoie à un extrait identifié, avec lien vers la source intégrale.
4. **Document joint éphémère.** Traitement en mémoire, aucune persistance, aucune réutilisation pour l'entraînement. Dis-le explicitement dans l'interface et dans ta politique de confidentialité.
5. **Quota et journalisation.** Chaque appel consigné au journal d'audit; le coût par requête est significatif et doit être plafonné par abonnement.

**Positionnement.** Nomme-le « mémoire de recherche préliminaire », jamais « avis ». La distinction n'est pas cosmétique : elle est ce qui sépare un outil documentaire d'un exercice non autorisé de la profession d'avocat.

## B.5 Routes

```
/[locale]/(app)/research/
├── legislation/            # navigation et recherche plein texte
│   └── [code]/[provision]/ # texte intégral, versions, affaires citantes
├── cases/                  # phase 3
│   └── [id]/               # métadonnées, graphe de citations, lien externe
├── workspaces/
│   └── [id]/               # sources enregistrées, notes, export du rapport
├── alerts/                 # phase 5
└── assistant/              # phase 6, Premium
```

---

## Récapitulatif du chemin critique

```
Fondations (SPEC-FONDATIONS.md, phases 0-1)
        ↓
Ententes de service — noyau : personnes, services, clauses, signature
        ↓
Catalogue de frais + facturation à la signature + avenants
        ↓
Premiers clients payants ← ne pas franchir cette ligne avant
        ↓
Recherche juridique phase 1-2 (législation seule)
        ↓
Décision sur les droits de jurisprudence ← à explorer en parallèle, dès maintenant
        ↓
Recherche juridique phases 3-6
```

## Trois décisions à prendre cette semaine

1. **Écrire à CanLII / Lexum** pour connaître les conditions d'une licence commerciale. La réponse détermine des mois de travail — obtiens-la avant d'investir, pas après.
2. **Mandater un juriste** sur trois points : validation des clauses obligatoires du contrat de services, portée réelle du décret de reproduction, et rédaction des avertissements de responsabilité du module de recherche.
3. **Fixer le périmètre initial du catalogue de frais** — les 40 à 60 frais des programmes que tu pratiques réellement, plutôt qu'une couverture large mal tenue.
