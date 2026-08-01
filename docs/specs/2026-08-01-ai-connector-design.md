# SPEC-2026-08-01 — Connecteur IA (ChatGPT / Claude Connector)

## 📌 Vue d'Ensemble & Objectifs
Le **Connecteur IA (ChatGPT / Claude Connector)** permet aux consultants accrédités CICC de connecter leurs assistants IA externes (Custom GPTs d'OpenAI, Anthropic Claude Desktop via MCP Server, ou tout client HTTP compatible) directement à leur compte réel **MonCabinetCRIC**.

Plutôt que d'effectuer des copier-coller manuels risqués, l'assistant IA interagit de manière structurée et sécurisée via une API REST / OpenAPI dédiée.

---

## 🛑 Garde-fous Réglementaires CICC (HARD SAFETY GATE)
L'assistant IA est un **exécutant préparatoire**. Il **NE PEUT JAMAIS** engager juridiquement le cabinet.

### ✅ Actions Autorisées par l'IA (API Handlers)
1. `GET /api/v1/connector/agreements` — Lister les ententes de service
2. `POST /api/v1/connector/agreements/draft` — Ouvrir un brouillon d'entente
3. `POST /api/v1/connector/agreements/:id/persons` — Ajouter des personnes rattachées
4. `POST /api/v1/connector/agreements/:id/services` — Ajouter des services d'honoraires
5. `POST /api/v1/connector/agreements/:id/government-fees` — Ajouter des frais gouvernementaux depuis le catalogue officiel IRCC/MIFI
6. `POST /api/v1/connector/agreements/:id/validate` — Lancer une validation de conformité
7. `POST /api/v1/connector/agreements/:id/ai-review` — Demander une analyse/révision par IA

### 🚫 Actions Explicitement Exclues (Réservées exclusivement à l'humain dans le dashboard)
- **Finaliser** (`POST /api/v1/connector/agreements/:id/finalize`) ➔ **HTTP 403 Forbidden**
- **Envoyer au client** (`POST /api/v1/connector/agreements/:id/send`) ➔ **HTTP 403 Forbidden**
- **Signer / Contresigner** (`POST /api/v1/connector/agreements/:id/sign`) ➔ **HTTP 403 Forbidden**
- **Annuler / Résilier** (`POST /api/v1/connector/agreements/:id/cancel`) ➔ **HTTP 403 Forbidden**

---

## 🏛️ Architecture & Gouvernance Sécurité

### 🔑 Contrôle d'Accès à 3 Niveaux
1. **Désactivé par défaut** (`enabled: false`) : Le connecteur est inactif lors de la création d'un cabinet.
2. **Activation par le Propriétaire (`owner`) uniquement** : Seul le rôle Owner peut basculer l'interrupteur général et générer les clés API.
3. **Matrice d'Autorisation par Membre** : Le Propriétaire coche les membres du cabinet (RCIC / RISIA / Staff) autorisés à émettre des tokens API pour leur propre assistant.
4. **Audit Cryptographique Inaltérable** : Chaque appel API est journalisé dans la table `audit_log` avec `actorRole: "ai_connector"`, le détail du payload, l'adresse IP client, et la signature d'empreinte SHA-256.

---

## 📂 Structure des Fichiers

### API Routes & Schema (`app/api/v1/connector/`)
- `app/api/v1/connector/agreements/route.ts`
- `app/api/v1/connector/agreements/[id]/persons/route.ts`
- `app/api/v1/connector/agreements/[id]/services/route.ts`
- `app/api/v1/connector/agreements/[id]/government-fees/route.ts`
- `app/api/v1/connector/agreements/[id]/validate/route.ts`
- `app/api/v1/connector/agreements/[id]/ai-review/route.ts`
- `app/api/v1/connector/agreements/[id]/finalize/route.ts` (RESERVED -> HTTP 403)
- `app/api/v1/connector/agreements/[id]/send/route.ts` (RESERVED -> HTTP 403)
- `app/api/v1/connector/agreements/[id]/sign/route.ts` (RESERVED -> HTTP 403)
- `app/api/v1/connector/agreements/[id]/cancel/route.ts` (RESERVED -> HTTP 403)
- `app/api/v1/connector/openapi.json/route.ts` — Spécification OpenAPI / Custom GPT Schema
- `app/api/v1/connector/mcp-schema/route.ts` — Manifeste du serveur MCP (Claude Desktop)

### Frontend & Interface (`app/[locale]/(app)/settings/connector/`)
- `app/[locale]/(app)/settings/connector/page.tsx`
- `app/[locale]/(app)/settings/connector/connector-client.tsx`

### Data & Logic (`lib/data/`)
- `lib/data/types.ts` — Interfaces `AiConnectorSettings`, `AiApiKeyRecord`
- `lib/data/mock/connector.ts` — Mock data & initial connector state
- `lib/data/actions.ts` — Mutations & validation handlers
