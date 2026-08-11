# 📜 GEMINI.md — Documentation & Architecture de `moncabinetcric`

Ce document constitue la référence centrale et permanente du projet **`moncabinetcric`**. Il est conçu pour servir de guide exhaustif à toute intelligence artificielle ou développeur travaillant sur le projet.

**Documents de référence complémentaires :**
- **PRD V1 (source de vérité produit)** : [planning_prd-moncabinetcric.md](file:///Users/adamadiarra/Desktop/Antigravity/PRD/planning_prd-moncabinetcric.md)
- **Design Brief (source de vérité esthétique)** : [planning_design-moncabinetcric.md](file:///Users/adamadiarra/Desktop/Antigravity/PRD/planning_design-moncabinetcric.md)
- **Architecture backend & conformité CICC** : [SPEC-FONDATIONS.md](file:///Users/adamadiarra/Desktop/Antigravity/moncabinetcric/SPEC-FONDATIONS.md)
- **Piliers métier avancés** : [SPEC-PILIERS-METIER.md](file:///Users/adamadiarra/Desktop/Antigravity/moncabinetcric/SPEC-PILIERS-METIER.md)

---

## 🎯 1. Mission & Présentation de l'Application

**Pitch :** Moncabinetcric est le SaaS de gestion tout-en-un pour les consultants réglementés en immigration canadienne (CRIC) qui centralise chaque dossier client, automatise le fidéicommis et le rapprochement bancaire, et élimine le chaos de communication entre le consultant et ses clients.

**Différenciants clés (vs Migrawise, VisaFlo, Officio, RCIC App) :**
1. **Rapprochement fidéicommis automatisé** — Chaque mouvement est lié au bon dossier ; l'état de rapprochement conforme CICC est généré en un clic.
2. **Portail client en temps réel** — Le client voit l'avancement de son dossier, les documents manquants, et échange avec son CRIC sans passer par le courriel.
3. **Un seul endroit pour un dossier** — Documents, communications, factures, contrat, checklist et échéances centralisés.

**Personas cibles :**
- **Fatou** (CRIC solo, 25-40 dossiers, Montréal) — Cherche à éliminer le jonglage entre 6 outils et le rapprochement Excel mensuel.
- **Jean-Marc** (directeur petit cabinet, 80-120 dossiers, 3 consultants) — Cherche la visibilité consolidée et le fidéicommis multi-consultants.
- **Marie** (cliente/immigrante, Lyon) — Veut savoir où en est son dossier sans envoyer 5 courriels/semaine.

---

## 🛠️ 2. Stack Technique & Technologies Utilisées

| Composant | Technologie & Version | Rôle & Usage |
| :--- | :--- | :--- |
| **Framework Core** | **Next.js 16.2.12 (App Router, Turbopack)** | Rendus hybrides (RSC & Client components), routage localisé. |
| **Interface UI** | **React 19.2.4** | Gestion d'état réactive, hooks personnalisés. |
| **Langage** | **TypeScript** | Typage strict et interfaces de données centralisées (`lib/data/types.ts`). |
| **Backend & BDD** | **Supabase (PostgreSQL + RLS + Auth + Storage)** | 61 migrations, multi-tenant `firm_id`, audit hash chain, hébergement canadien. |
| **Styling & Thèmes** | **Tailwind CSS v4** | Configuration native dans `app/globals.css` via variables CSS dynamiques. Pas de `tailwind.config.ts`. |
| **Internationalisation** | **`next-intl` v4** | Français uniquement en V1 (marché Québec prioritaire). Anglais prévu V2. |
| **Icônes & Visuels** | **`lucide-react`** | Bibliothèque d'icônes vectorielles épurées. |
| **Gestionnaire de Paquets** | **pnpm** (fallback : `npm run <script>`) | Node.js localisé dans le workspace (`.local-node/bin`). |
| **Routage / Proxy** | **`proxy.ts`** | Gestion du middleware de routage et de la localisation i18n (`/fr`, `/en`). |
| **Paiements** | **Stripe** | Abonnements plateforme (99 CAD/mois Solo). |
| **Tests Automatisés** | **Node.js Native Test Runner (`tsx`) + Playwright** | Unit tests pour les données et E2E pour la navigation. |

---

## 🔥 3. Fonctionnalités — État d'avancement MVP V1

Référence : PRD V1 §4 (36 features, F1-F36). Statuts : ✅ Implémenté | 🟡 Partiel | ❌ À implémenter.

### Gestion des clients et prospects (F1-F4)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F1 | Création de client/prospect | P0 | ✅ | `clients-client.tsx`, `actions.ts` |
| F2 | Fiche client centralisée | P0 | 🟡 | Existe en vue latérale, pas en page dédiée `/clients/[id]` |
| F3 | Liste et recherche de clients | P0 | ✅ | `clients-client.tsx` (59 Ko) |
| F4 | Questionnaire de recueil | P0 | ✅ | `questionnaires-client.tsx`, DB templates, accès token |

### Gestion des dossiers (F5-F10)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F5 | Création de dossier | P0 | ✅ | `matter-creation.ts`, `matter-actions.ts` |
| F6 | Suivi de statut du dossier | P0 | ✅ | `dossier-onglets.tsx` (110 Ko) |
| F7 | Checklist dynamique par type | P0 | ✅ | `matter_requirements.sql`, `requirement_kind.sql` |
| F8 | Gestion des documents | P0 | ✅ | `document_storage.sql`, `direct-actions-tabs.tsx` |
| F9 | Notes internes sur le dossier | P1 | 🟡 | Champ `notes` dans Matter, pas de module dédié |
| F10 | Échéances et rappels | P1 | 🟡 | `deadlines-client.tsx` (35 Ko), `matter_deadlines.sql` — rappels dashboard à compléter |

### Communication centralisée (F11-F14)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F11 | Envoi de courriel depuis la plateforme | P0 | ❌ | **Module inexistant — priorité critique** |
| F12 | Historique de communication par dossier | P0 | ❌ | Dépend de F11 |
| F13 | Notifications client (courriel auto) | P0 | ❌ | Table `notifications` existe en DB, aucun trigger d'envoi |
| F14 | Pièces jointes dans les messages | P1 | ❌ | Dépend de F11/F12 |

### Contrats et signatures (F15-F17)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F15 | Modèles de contrats | P1 | ✅ | `smart-agreement-builder.tsx` (57 Ko) |
| F16 | Génération de contrat | P1 | ✅ | `agreements-client.tsx` (37 Ko) |
| F17 | Signature électronique | P1 | ✅ | `signatures.sql`, `signature-pad.tsx` |

### Facturation et débours (F18-F21)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F18 | Création de facture | P0 | ✅ | `billing.sql`, `invoice-actions.ts` |
| F19 | Séquence de paiement | P1 | ❌ | Jalons financiers (50% signature, 25% soumission…) non implémentés |
| F20 | Enregistrement de paiement et reçu | P0 | ✅ | `payments_and_trust.sql` |
| F21 | Détail des débours | P1 | 🟡 | Lignes de facture existent, séparation honoraires/débours à structurer |

### Fidéicommis et rapprochement (F22-F25)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F22 | Registre du fidéicommis | P0 | ✅ | `trust-actions.ts`, `trust.ts` |
| F23 | Rattachement au dossier | P0 | ✅ | Via `matter_id` dans les mouvements |
| F24 | État de rapprochement | P0 | ✅ | `reconciliation_freeze_breakdown.sql` |
| F25 | Alertes fidéicommis | P1 | ❌ | Alertes (solde négatif, 30+ jours, écarts) non implémentées |

### Portail client (F26-F31)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F26 | Accès sécurisé au portail | P0 | 🟡 | `portal-access.ts`, `client_portal.sql` — flow par token, pas identifiants |
| F27 | Vue avancement du dossier | P0 | 🟡 | Page portail (15 Ko) — complétude à vérifier |
| F28 | Upload documents via portail | P0 | ✅ | `client-document-uploader.tsx`, `portal_uploads_and_reviews.sql` |
| F29 | Messagerie client (portail) | P0 | ❌ | **Module inexistant — priorité critique** |
| F30 | Signature contrat via portail | P1 | ❌ | Pas de page signature côté portail |
| F31 | Consultation factures (portail) | P1 | ❌ | Pas de vue factures côté portail |

### Tableau de bord et gestion de cabinet (F32-F36)

| # | Feature | Priorité | Statut | Fichier(s) clé(s) |
| :--- | :--- | :---: | :---: | :--- |
| F32 | Tableau de bord | P0 | ✅ | `dashboard-client.tsx` (56 Ko) |
| F33 | Gestion des tâches | P1 | ❌ | Aucune table, aucun composant |
| F34 | Gestion de l'équipe | P1 | ✅ | `member-actions.ts`, `permissions.sql`, `seat_requests.sql` |
| F35 | Dépenses d'entreprise | P2 | ❌ | Aucune table, aucun composant |
| F36 | Paramètres du cabinet | P1 | ✅ | `settings-client.tsx` (40 Ko) |

**Synthèse : 20/36 (✅) | 5/36 (🟡) | 11/36 (❌) — 4 trous P0 critiques : F11, F12, F13, F29**

---

## 📂 4. Structure de l'Arborescence du Projet

```
moncabinetcric/
├── app/
│   ├── [locale]/
│   │   ├── (app)/                    # Section interne du cabinet
│   │   │   ├── agreements/           # Contrats de service & constructeur intelligent
│   │   │   ├── billing/              # Facturation (factures, lignes, taxes TPS/TVQ)
│   │   │   ├── calendar/             # Agenda interactif (hors scope V1 PRD, mais existant)
│   │   │   ├── clients/              # Liste clients/prospects & fiches
│   │   │   ├── dashboard/            # Tableau de bord principal & KPIs
│   │   │   ├── deadlines/            # Échéances réglementaires
│   │   │   ├── documents/            # Coffre-fort documentaire IRCC
│   │   │   ├── fideicommis/          # Registre fidéicommis & rapprochement bancaire
│   │   │   ├── matters/              # Dossiers d'immigration & détails [id]
│   │   │   ├── pipeline/             # Pipeline CRM (hors scope V1 PRD, mais existant)
│   │   │   ├── questionnaires/       # Questionnaires de recueil d'informations
│   │   │   ├── research/             # Recherche juridique (hors scope V1 PRD)
│   │   │   ├── settings/             # Paramètres, abonnement, audit, connecteurs
│   │   │   └── signatures/           # Signatures électroniques
│   │   ├── (marketing)/              # Site vitrine public
│   │   │   ├── landing/              # Page d'accueil marketing
│   │   │   ├── connexion/            # Connexion (courriel + mot de passe)
│   │   │   ├── bienvenue/            # Acceptation d'invitation
│   │   │   ├── demo/                 # Demande de démonstration
│   │   │   ├── conditions/           # Conditions d'utilisation
│   │   │   └── confidentialite/      # Politique de confidentialité
│   │   ├── (portal)/                 # Portail client sécurisé
│   │   │   ├── page.tsx              # Accueil portail (statut dossier, documents)
│   │   │   └── portal/questionnaires/# Questionnaire client par token
│   │   └── (admin)/                  # Administration plateforme
│   ├── api/                          # Routes API (auth, invoices, payments, stripe, trust)
│   ├── globals.css                   # Design tokens Tailwind v4 & thèmes CSS
│   └── layout.tsx                    # Configuration SEO & métadonnées globales
├── components/
│   ├── app-shell/                    # Infrastructure (sidebar, topbar, mobile-nav, page-header, notifications, member-menu)
│   └── ui/                           # Composants atomiques (button, card, badge, input, modal, signature-pad, side-sheet)
├── lib/
│   ├── data/                         # Couche données (43 fichiers : actions, queries, types, trust, invoices, signatures, questionnaires, etc.)
│   │   ├── mock/                     # Jeux de données de test
│   │   ├── supabase/                 # Client Supabase & helpers
│   │   └── legislation/              # Données législation (hors scope V1)
│   └── i18n/                         # Configuration du routage bilingue
├── messages/
│   ├── fr.json                       # Dictionnaire FR (langue unique V1)
│   └── en.json                       # Dictionnaire EN (prévu V2)
├── supabase/
│   └── migrations/                   # 61 migrations SQL (schema, RLS, auth, billing, trust, etc.)
├── e2e/                              # Tests E2E Playwright
├── proxy.ts                          # Middleware de routage Next.js 16
└── GEMINI.md                         # Ce document de référence
```

---

## 🎨 5. Charte Graphique & Décisions de Design

**Référence absolue :** [Design Brief](file:///Users/adamadiarra/Desktop/Antigravity/PRD/planning_design-moncabinetcric.md)

### Direction artistique
- **L'interface doit ressembler à un cabinet professionnel sérieux — pas à une fintech.** Moncabinetcric gère des dossiers d'immigration, des données sensibles, des obligations légales. L'UI doit dégager **autorité et précision** : dense là où il faut, aérée là où ça respire.
- **Pense moins « app colorée » et plus « outil que tu confies à ton avocat ».** La pire option pour Moncabinetcric, c'est le tiède.

### Anti-patterns à éradiquer (« AI slop »)
- ❌ Gradients violet→rose partout, glow animé sur chaque bouton/card
- ❌ Sparkles ✨ et étoiles décoratives sur les CTAs
- ❌ Glassmorphism violet générique
- ❌ Hero avec 6+ CTAs, 12 logos clients placeholder, 8 chips
- ❌ Stock photos d'équipe générique (sourires forcés + MacBooks)
- ❌ Animated underline sur chaque lien
- ❌ Toute UI interchangeable qui marcherait pour 50 autres SaaS

### Règles UI/Typographiques
- En-têtes uniformes avec le composant réutilisable `<PageHeader />`.
- Pas de fichier `tailwind.config.ts` : toute la configuration réside dans `app/globals.css` (Tailwind CSS v4).

---

## 🏛️ 6. Spécifications Backend & Conformité CICC

### 7 Modules Fondamentaux (`SPEC-FONDATIONS.md`)

| Module | Objet & Architecture |
| :--- | :--- |
| **1. Multi-locataire** | PostgreSQL + RLS (`firm_id NOT NULL` sur toutes les tables métier), hébergement en région canadienne (Loi 25), séparation `persons` vs `matters`. |
| **2. Moteur d'échéances** | Règles réglementaires en base (`deadline_rules`), versionnées avec autorité et dates d'effet (jamais de délais codés en dur). |
| **3. Journal d'audit inaltérable** | Table `audit_log` en ajout seul avec chaîne de hachage `row_hash = sha256(...)` et verrouillage par privilèges PostgreSQL. |
| **4. Rôles et supervision** | Rôles CICC (`owner`, `rcic`, `risia`, `staff`, `bookkeeper`, `readonly`), validation en 2 temps (`action_approvals`) pour les actes réservés aux CRIC. |
| **5. Registres réglementaires** | Registres des clients, des plaintes, des conflits d'intérêts, de la formation continue (UFC) et de l'assurance responsabilité professionnelle. |
| **6. Contrats de services** | Modèles versionnés, clauses obligatoires CICC validées à l'émission, signature traçable (IP, empreinte SHA-256) et blocage d'ouverture sans contrat. |
| **7. Export & conservation** | Export ZIP d'un dossier avec manifeste SHA-256 pour audit CICC, export complet du cabinet, conservation obligatoire 6 ans et gel de conservation (`retention_holds`). |

### 2 Piliers Métier (`SPEC-PILIERS-METIER.md`)

| Pilier | Description & Fonctionnalités clés |
| :--- | :--- |
| **Pilier A — Ententes de service** | Modèle structurant **Personne × Service**, catalogue dynamique des frais gouvernementaux, système de clauses à 3 niveaux, signature multi-parties opposable, facturation automatique et garde-fous IA. |
| **Pilier B — Recherche juridique** | ⚠️ **Hors scope V1** (voir § 7). Déploiement prévu en 6 phases dans les versions ultérieures. |

---

## 🚫 7. Scope V1 — Ce qui est HORS SCOPE

Les fonctionnalités suivantes sont explicitement exclues de la V1 (réf. PRD §8) :

| Feature exclue | Raison |
| :--- | :--- |
| Remplissage automatique des formulaires IRCC | Complexité parsing PDF gouvernementaux — V2 |
| Rédaction de lettres par IA | Nécessite modèle entraîné sur lettres d'immigration — V2 |
| Recherche juridique et jurisprudence IA | Nécessite bases CanLII/CISR + RAG — V2/V3 |
| Paiement en ligne par le client via portail | V1 : enregistrement manuel des paiements — V2 |
| Importation automatique de relevés bancaires | V1 : saisie manuelle du solde — V2 via agrégateur |
| Application mobile native | Web responsive uniquement |
| Multi-langue | V1 en français uniquement (Québec prioritaire). Anglais en V2 |
| Comptabilité avancée (bilan, état des résultats) | Export vers le comptable, pas de logiciel comptable |

**Modules existants dans le codebase mais hors scope V1 PRD :**
- `calendar/` (87 Ko) — Agenda interactif. Garder mais ne pas prioriser.
- `pipeline/` (67 Ko) — CRM Kanban. Le PRD demande une simple liste clients.
- `research/` (33 Ko) — Recherche juridique. Désactiver pour V1.

---

## 🤖 8. Directives & Instructions Obligatoires pour les Futurs Agents IA

Si vous êtes un modèle IA travaillant sur ce codebase, vous **MUST** appliquer scrupuleusement les règles suivantes :

### 1. Documents de Référence (À consulter avant toute décision)
- **PRD V1** → `/Users/adamadiarra/Desktop/Antigravity/PRD/planning_prd-moncabinetcric.md` — Source de vérité pour les fonctionnalités, personas, user stories.
- **Design Brief** → `/Users/adamadiarra/Desktop/Antigravity/PRD/planning_design-moncabinetcric.md` — Source de vérité pour toute décision esthétique. **L'UI doit ressembler à un cabinet professionnel sérieux.**

### 2. Variables Fictives Officiellement Validées (À conserver obligatoirement)
- **Nom officiel du cabinet** : `Cabinet Immigration Boréale Inc.`
- **Numéro de permis CICC / RCIC** : `R-514982` (Titulaire : Adama Diarra, RCIC)
- **Initiale du Logo** : **`M`** (pour *MonCabinetCRIC*)

### 3. Environnement de Commande Terminal (Obligatoire)
Avant toute exécution de commande Node.js, `npm` ou `npx` dans le terminal, vous **DEVEZ** exporter le `PATH` local du projet :
```bash
export PATH="/Users/adamadiarra/Desktop/Antigravity/moncabinetcric/.local-node/bin:$PATH"
cd /Users/adamadiarra/Desktop/Antigravity/moncabinetcric
```

### 4. Commandes de Validation après modification
Après **CHAQUE** modification de code :
- **ESLint** (doit toujours retourner 0 erreur) :
  ```bash
  PATH="$PWD/.local-node/bin:$PATH" npx eslint app components lib --quiet
  ```
- **Tests Unitaires** :
  ```bash
  PATH="$PWD/.local-node/bin:$PATH" npm run test
  ```

### 5. Directives d'Architecture Multi-locataire & Audit (SPEC-FONDATIONS.md)
1. **Toute nouvelle table métier** porte obligatoirement `firm_id UUID NOT NULL REFERENCES firms(id)` et une politique RLS (`tenant_isolation`).
2. **Toute mutation de données** passe obligatoirement par l'enveloppe `mutate()` — aucun appel direct au client de base de données.
3. **Toute action réservée** vérifie la politique d'autorisation `can(member, action, resource)` exclusivement côté serveur.
4. **Aucun délai ni règle réglementaire codé en dur** dans le code frontend ou backend : toutes les règles vivent dans la table `deadline_rules`.
5. **Aucun import direct de `lib/data/mock`** dans `app/` et `components/` (règle ESLint `no-restricted-imports` bloquante).

### 6. Règle d'Aperçu & Liens Directs (Règle AGENTS.md)
À la fin de chaque intervention modifiant l'interface ou le code, vous **DEVEZ** fournir à l'utilisateur les liens d'accès direct cliquables vers les pages impactées :
- `http://localhost:3000/fr/dashboard`
- `http://localhost:3000/fr/matters`
- `http://localhost:3000/fr/clients`
- `http://localhost:3000/fr/billing`
- `http://localhost:3000/fr/fideicommis`
- `http://localhost:3000/fr/documents`
- `http://localhost:3000/fr/agreements`
- `http://localhost:3000/fr/questionnaires`
- `http://localhost:3000/fr/deadlines`
- `http://localhost:3000/fr/settings`
- `http://localhost:3000/fr/calendar`
- `http://localhost:3000/fr/pipeline`

### 7. Règle Globale de Publication
Avant toute publication sur un serveur externe ou un service d'hébergement, vous **DEVEZ** poser la question à l'utilisateur :
> *"Est-ce que tu peux le faire ?"*
