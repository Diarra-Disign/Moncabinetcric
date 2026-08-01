# 📜 GEMINI.md — Documentation & Architecture de `moncabinetcric`

Ce document constitue la référence centrale et permanente du projet **`moncabinetcric`**. Il est conçu pour servir de guide exhaustif à toute intelligence artificielle ou développeur travaillant sur le projet.

---

## 🎯 1. Mission & Présentation de l'Application

**`moncabinetcric`** est un SaaS professionnel (Software as a Service) sur mesure conçu pour les **Consultants Réglementés en Immigration Canadienne (CRIC / RCIC)** accrédités par le **Collège des consultants en immigration et en citoyenneté (CICC)**.

L'application permet de gérer l'intégralité du cycle de vie des dossiers d'immigration canadienne et des opérations de cabinet :
- Suivi réglementaire des programmes (Entrée Express, PEQ, EIMT, Parrainage Familial, Permis d'Études).
- Gestion stricte de la conformité CICC et du **Compte Fidéicommis (Trust Account - Art. 13)**.
- Planification des consultations et visioconférences clients.
- Coffre-fort documentaire sécurisé pour les pièces justificatives IRCC.
- Suivi commercial (CRM & Pipeline) des candidats à l'immigration.

---

## 🛠️ 2. Stack Technique & Technologies Utilisées

| Composant | Technologie & Version | Rôle & Usage |
| :--- | :--- | :--- |
| **Framework Core** | **Next.js 16.2.12 (App Router, Turbopack)** | Rendus hybrides (RSC & Client components), routage localisé. |
| **Interface UI** | **React 19.2.4** | Gestion d'état réactive, hooks personnalisés. |
| **Langage** | **TypeScript** | Typage strict et interfaces de données centralisées (`lib/data/types.ts`). |
| **Styling & Thèmes** | **Tailwind CSS v4** | Configuration native dans `app/globals.css` via variables CSS dynamiques. |
| **Internationalisation** | **`next-intl` v4** | Support bilingue Français (par défaut) / Anglais (`messages/fr.json` & `en.json`). |
| **Icônes & Visuels** | **`lucide-react`** | Bibliothèque d'icônes vectorielles épurées. |
| **Gestionnaire de Paquets** | **pnpm / npm** | Node.js localisé dans le workspace (`.local-node/bin`). |
| **Routage / Proxy** | **`proxy.ts`** | Gestion du middleware de routage et de la localisation i18n (`/fr`, `/en`). |
| **Tests Automatisés** | **Node.js Native Test Runner (`tsx`) + Playwright** | Unit tests pour les données et E2E pour la navigation. |

---

## 🔥 3. Fonctionnalités Implémentées

### 1. Navigation & App Shell Unifié
- **Sidebar & Mobile Drawer** (`components/app-shell/sidebar.tsx`, `mobile-nav.tsx`) : Menu latéral dynamique sur desktop et tiroir coulissant accessible sur mobile.
- **Topbar & Recherche Globale** (`components/app-shell/topbar.tsx`) : Recherche multicritère instantanée à travers l'ensemble des dossiers, clients et factures.
- **En-tête Unifié `<PageHeader />`** (`components/app-shell/page-header.tsx`) : Titre, sous-titre, badge et zone d'actions principales harmonisés sur toutes les pages.

### 2. Tableau de Bord (`/fr/dashboard`)
- KPIs en temps réel (Dossiers actifs, Taux de conformité CICC, Solde Fidéicommis, Rendez-vous du jour).
- Raccourcis d'actions rapides et widgets d'activité récente.

### 3. Gestion des Dossiers Réglementés CICC (`/fr/matters` & `/fr/matters/[id]`)
- Suivi granulaire par programme (PEQ, EIMT, Entrée Express).
- Checklist automatique des étapes IRCC et barre de progression du dossier.
- **Téléversement natif de fichiers** (`direct-actions-tabs.tsx`) : Ouverture du sélecteur de fichiers OS (`<input type="file" />`), raccordement direct au dossier et mises à jour réactives.
- Signature électronique du mandat de représentation IMM 5476.

### 4. Agenda Virtuel & Visioconférence CICC (`/fr/calendar`)
- **Design système inspiré de Untitled UI v6.0** : Interface haute densité, cartes pastel (bleu ciel, violet, émeraude, ambre, pêche), ligne temps réel pointillée d'heure (14:20 PM).
- **Sélecteur de modes d'affichage** : Jours ouvrés (Lun-Ven), Semaine (7J), Mois (31J), Jour.
- **Interactivité Glisser-Déposer (Drag & Drop)** : Prise en main des rendez-vous à la souris et déplacement instantané sur les créneaux d'heure.
- Filtres par type (Visios, Échéances IRCC) et recherche intégrée avec raccourci `⌘K`.

### 5. CRM & Pipeline Commercial (`/fr/pipeline`)
- Suivi du pipeline de qualification des candidats (Prospect, Consultation, Mandat transmis, Signé).
- Assistant d'embarquement intelligent **`smart-intake-wizard.tsx`** pour la collecte initiale des informations candidat.

### 6. Facturation, Fidéicommis & Conformité CICC (`/fr/billing`)
- **Compte Fidéicommis (Art. 13)** : Gestion séparée des fonds en fiducie et du compte général.
- **Saisie de la Description du Service Facturé** : Champ explicite dans le modal "Nouvelle Facture" pour détailler les honoraires.
- **Ventilation Fiscale automatique** : Calcul direct TPS (5.00%) + TVQ (9.975%) et prise en charge de l'exonération internationale (0$ taxes pour clients hors Canada).
- **Rendus PDF interactifs** :
  1. *Facture Officielle CICC* avec tableau détaillé des services.
  2. *Reçu de Dépôt Fidéicommis* conforme à l'art. 13 avec mention explicite du service facturé.
  3. *Rapport Mensuel de Rapprochement & Audit CICC* intégrant un **tableau complet d'audit de l'ensemble des clients, dates et services facturés**.

### 7. Coffre-fort Documentaire IRCC (`/fr/documents`)
- Classement par catégorie (Passeports, TEF/TCF, Diplômes, Attestations de travail).
- Téléversement natif sécurisé AES-256.

### 8. Paramètres du Cabinet & Design System (`/fr/settings`)
- Sélecteur de nuancier dynamique **`ThemePicker`** (Saphir, Émeraude, Ambre, Violet).
- Informations officielles du cabinet centralisées dans `lib/data/firm.ts`.

---

## 📂 4. Structure de l'Arborescence du Projet

```
moncabinetcric/
├── app/
│   ├── [locale]/                 # Application bilingue (FR/EN)
│   │   ├── (app)/                # Section interne du cabinet
│   │   │   ├── billing/          # Module Facturation & Fidéicommis
│   │   │   ├── calendar/         # Agenda interactif Untitled UI
│   │   │   ├── clients/          # Annuaire des candidats & clients
│   │   │   ├── dashboard/        # Tableau de bord principal
│   │   │   ├── documents/        # Coffre-fort documentaire IRCC
│   │   │   ├── matters/          # Dossiers d'immigration & détails [id]
│   │   │   ├── pipeline/         # Pipeline commercial CRM
│   │   │   └── settings/         # Paramètres cabinet & thèmes
│   │   └── (portal)/             # Portail client sécurisé
│   ├── globals.css               # Design tokens Tailwind v4 & thèmes CSS
│   ├── layout.tsx                # Configuration SEO & métadonnées globales
│   ├── sitemap.ts                # Sitemap XML dynamique
│   └── robots.ts                 # Directives d'indexation robots.txt
├── components/
│   ├── app-shell/                # Composants d'infrastructure (sidebar, topbar, mobile-nav, page-header, theme-picker)
│   └── ui/                       # Composants UI atomiques (button, card, badge, etc.)
├── lib/
│   ├── data/                     # Source de données & queries
│   │   ├── mock/                 # Jeux de données de test (invoices, matters, clients, events)
│   │   ├── firm.ts               # Constantes officielles du cabinet (Permis, Adresse, Initiales)
│   │   ├── types.ts              # Interfaces TypeScript centrales (InvoiceRecord, Matter, ClientRecord, etc.)
│   │   ├── queries.ts            # Requêtes de données
│   │   └── actions.ts            # Mutations de données
│   └── i18n/                     # Configuration du routage bilingue
├── messages/
│   ├── fr.json                   # Dictionnaire des chaînes en Français
│   └── en.json                   # Dictionnaire des chaînes en Anglais
├── e2e/                          # Suites de tests End-to-End Playwright
├── proxy.ts                      # Proxy/Middleware de routage Next.js 16
├── package.json                  # Dépendances et scripts de build/test
└── GEMINI.md                     # Ce document de référence
```

---

## 🎨 5. Charte Graphique & Décisions de Design

1. **Esthétique Haute Performance ("WOW Effect")** :
   - Interface moderne, minimale et contrastée s'inspirant des standards Untitled UI.
   - Thème dynamique compatible avec le `ThemePicker` via la propriété `data-cabinet-theme` appliquée sur l'élément racine.
   - Palette d'événements en nuances pastel douces (`sky`, `purple`, `emerald`, `amber`, `orange`).

2. **Règles Typographiques & UI** :
   - En-têtes uniformes avec le composant réutilisable `<PageHeader />`.
   - Pas de fichier `tailwind.config.ts` : la totalité de la configuration réside dans `app/globals.css` pour exploiter pleinement Tailwind CSS v4.

---

## 🏛️ 6. Spécification des 7 Modules Fondamentaux (`SPEC-FONDATIONS.md`)

Le document [SPEC-FONDATIONS.md](file:///Users/adamadiarra/Desktop/Antigravity/moncabinetcric/SPEC-FONDATIONS.md) définit la feuille de route d'architecture backend et de conformité CICC pour le passage en production (*prêt pour un audit par défaut*) :

| Module | Objet & Architecture |
| :--- | :--- |
| **1. Multi-locataire** | PostgreSQL + RLS (`firm_id NOT NULL` sur toutes les tables métier), hébergement en région canadienne (Loi 25), séparation `persons` vs `matters`. |
| **2. Moteur d'échéances** | Règles réglementaires en base (`deadline_rules`), versionnées avec autorité et dates d'effet (jamais de délais codés en dur). |
| **3. Journal d'audit inaltérable** | Table `audit_log` en ajout seul avec chaîne de hachage `row_hash = sha256(...)` et verrouillage par privilèges PostgreSQL. |
| **4. Rôles et supervision** | Rôles CICC (`owner`, `rcic`, `risia`, `staff`, `bookkeeper`, `readonly`), validation en 2 temps (`action_approvals`) pour les actes réservés aux CRIC. |
| **5. Registres réglementaires** | Registres des clients, des plaintes, des conflits d'intérêts, de la formation continue (UFC) et de l'assurance responsabilité professionnelle. |
| **6. Contrats de services** | Modèles versionnés, clauses obligatoires CICC validées à l'émission, signature traçable (IP, empreinte SHA-256) et blocage d'ouverture sans contrat. |
| **7. Export & conservation** | Export ZIP d'un dossier avec manifeste SHA-256 pour audit CICC, export complet du cabinet, conservation obligatoire 6 ans et gel de conservation (`retention_holds`). |

---

## ⚖️ 7. Spécification des 2 Piliers Métier (`SPEC-PILIERS-METIER.md`)

Le document [SPEC-PILIERS-METIER.md](file:///Users/adamadiarra/Desktop/Antigravity/moncabinetcric/SPEC-PILIERS-METIER.md) définit les deux piliers métier avancés :

| Pilier | Description & Fonctionnalités clés |
| :--- | :--- |
| **Pilier A — Ententes de service** | Modèle structurant **Personne × Service**, catalogue dynamique des frais gouvernementaux (débours vs honoraires), système de clauses à 3 niveaux de verrouillage (structurelles, CICC, libres), remises avant taxes, signature multi-parties opposable, avenants versionnés, facturation automatique et garde-fous IA (pré-remplissage & révision assistés sans pouvoir de signature autonome). |
| **Pilier B — Recherche juridique** | Déploiement en 6 phases (Phase 1 : Législation fédérale LIPR/RIPR en bilingue & recherche plein texte TSVECTOR ; Phase 2 : Espaces de travail & instantanés de citations ; Phases 3-6 : Jurisprudence & assistant IA RAG strict avec vérification automatisée des citations sans hallucination ni avis juridique). |

---

## 🤖 8. Directives & Instructions Obligatoires pour les Futurs Agents IA

Si vous êtes un modèle IA travaillant sur ce codebase, vous **MUST** appliquer scrupuleusement les règles suivantes :

### 1. Variables Fictives Officiellement Validées (À conserver obligatoirement)
- **Nom officiel du cabinet** : `Cabinet Immigration Boréale Inc.`
- **Numéro de permis CICC / RCIC** : `R-514982` (Titulaire : Adama Diarra, RCIC)
- **Initiale du Logo** : **`M`** (pour *MonCabinetCRIC*)

### 2. Environnement de Commande Terminal (Obligatoire)
Avant toute exécution de commande Node.js, `npm` ou `npx` dans le terminal, vous **DEVEZ** exporter le `PATH` local du projet :
```bash
export PATH="/Users/adamadiarra/Desktop/Antigravity/moncabinetcric/.local-node/bin:$PATH"
cd /Users/adamadiarra/Desktop/Antigravity/moncabinetcric
```

### 3. Commandes de Validation après modification
Après **CHAQUE** modification de code :
- **ESLint** (doit toujours retourner 0 erreur) :
  ```bash
  PATH="$PWD/.local-node/bin:$PATH" npx eslint app components lib --quiet
  ```
- **Tests Unitaires** :
  ```bash
  PATH="$PWD/.local-node/bin:$PATH" npm run test
  ```

### 4. Directives d'Architecture Multi-locataire & Audit (SPEC-FONDATIONS.md)
1. **Toute nouvelle table métier** porte obligatoirement `firm_id UUID NOT NULL REFERENCES firms(id)` et une politique RLS (`tenant_isolation`).
2. **Toute mutation de données** passe obligatoirement par l'enveloppe `mutate()` — aucun appel direct au client de base de données.
3. **Toute action réservée** vérifie la politique d'autorisation `can(member, action, resource)` exclusivement côté serveur.
4. **Aucun délai ni règle réglementaire codé en dur** dans le code frontend ou backend : toutes les règles vivent dans la table `deadline_rules`.
5. **Aucun import direct de `lib/data/mock`** dans `app/` et `components/` (règle ESLint `no-restricted-imports` bloquante).

### 5. Règle d'Aperçu & Liens Directs (Règle AGENTS.md)
À la fin de chaque intervention modifiant l'interface ou le code, vous **DEVEZ** fournir à l'utilisateur les liens d'accès direct cliquables vers les pages impactées :
- `http://localhost:3000/fr/dashboard`
- `http://localhost:3000/fr/matters`
- `http://localhost:3000/fr/calendar`
- `http://localhost:3000/fr/pipeline`
- `http://localhost:3000/fr/billing`
- `http://localhost:3000/fr/documents`
- `http://localhost:3000/fr/settings`

### 6. Règle Global de Publication
Avant toute publication sur un serveur externe ou un service d'hébergement, vous **DEVEZ** poser la question à l'utilisateur :
> *"Est-ce que tu peux le faire ?"*
