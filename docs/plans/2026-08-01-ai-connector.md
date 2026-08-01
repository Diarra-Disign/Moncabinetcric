# Plan d'Implémentation - Connecteur IA (ChatGPT / Claude Connector)

> **Note aux Agents :** Suivre strictement chaque étape séquentiellement. Exécuter un cycle complet (Test -> Code -> Verification -> Commit) pour chaque tâche.

## 1. Périmètre & Architecture Fichiers

### [Nouveau] Modèles de Données & Logic
- `[MODIFIER]` `lib/data/types.ts` — Interfaces `AiConnectorSettings`, `AiApiKeyRecord`, `AiConnectorLogRecord`
- `[Nouveau]` `lib/data/mock/connector.ts` — État initial et mock keys du connecteur IA
- `[MODIFIER]` `lib/data/queries.ts` — Obtention des paramètres du connecteur et validation des clés API
- `[MODIFIER]` `lib/data/actions.ts` — Activation par le Owner, génération de clé, rérogation et exécution des requêtes IA avec blocage strict des actes réservés
- `[Nouveau]` `lib/data/__tests__/connector.test.ts` — Tests unitaires pour l'autorisation et le blocage des 4 actions réservées

### [Nouveau] API REST & Endpoints OpenAPI / MCP (`app/api/v1/connector/`)
- `[Nouveau]` `app/api/v1/connector/agreements/route.ts` — GET (lister) & POST (brouillon)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/persons/route.ts` — POST (ajouter personne)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/services/route.ts` — POST (ajouter service)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/government-fees/route.ts` — POST (ajouter débours IRCC/MIFI)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/validate/route.ts` — POST (valider conformité)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/ai-review/route.ts` — POST (demander révision IA)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/finalize/route.ts` — POST (RESERVED -> 403 Forbidden)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/send/route.ts` — POST (RESERVED -> 403 Forbidden)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/sign/route.ts` — POST (RESERVED -> 403 Forbidden)
- `[Nouveau]` `app/api/v1/connector/agreements/[id]/cancel/route.ts` — POST (RESERVED -> 403 Forbidden)
- `[Nouveau]` `app/api/v1/connector/openapi.json/route.ts` — Schema JSON OpenAPI 3.0 pour Custom GPTs
- `[Nouveau]` `app/api/v1/connector/mcp-schema/route.ts` — Manifeste du serveur MCP pour Claude Desktop

### [Nouveau] Interface de Gestion & Dashboard (`app/[locale]/(app)/settings/connector/`)
- `[Nouveau]` `app/[locale]/(app)/settings/connector/page.tsx` — Page Serveur i18n
- `[Nouveau]` `app/[locale]/(app)/settings/connector/connector-client.tsx` — Composant Client avec :
  - Interrupteur d'activation par le Propriétaire
  - Générateur et gestionnaire de clés API (`cric_live_...`)
  - Matrice d'autorisation des membres du cabinet
  - Guide d'installation interactif (`rcicapp.ca/connector`) avec schémas copiables pour ChatGPT et Claude
  - Live log d'audit des requêtes IA
- `[MODIFIER]` `components/app-shell/nav-items.ts` — Ajout du lien vers le Connecteur IA sous Paramètres

---

## 2. Découpage des Tâches Séquentielles

### Tâche 1 : Modèles de données & fonctions de gouvernance (Est. 5 min)
- Rédiger les interfaces TypeScript `AiConnectorSettings` & `AiApiKeyRecord` dans `lib/data/types.ts`
- Créer `lib/data/mock/connector.ts`
- Rédiger les fonctions de validation de clé API et de bascule d'activation Owner dans `lib/data/actions.ts`

### Tâche 2 : Tests unitaires de blocage des actes réservés (Est. 5 min)
- Écrire `lib/data/__tests__/connector.test.ts` testant l'échec HTTP 403 pour `finalize`, `send`, `sign`, `cancel`
- Exécuter les tests via `npm run test` et valider le succès 100% vert

### Tâche 3 : Implémentation des Routes API REST & OpenAPI / MCP (Est. 10 min)
- Créer les endpoints `app/api/v1/connector/*`
- Créer l'endpoint OpenAPI `app/api/v1/connector/openapi.json/route.ts`
- Créer l'endpoint MCP `app/api/v1/connector/mcp-schema/route.ts`

### Tâche 4 : Interface Utilisateur `/fr/settings/connector` (Est. 10 min)
- Développer `connector-client.tsx` avec l'interrupteur Owner, le gestionnaire de clés API, le guide pas à pas `rcicapp.ca/connector`, et le journal d'audit
- Ajouter l'onglet dans `components/app-shell/nav-items.ts` et `app/[locale]/(app)/settings/settings-client.tsx`

### Tâche 5 : Validation ESLint & Sauvegarde Git (Est. 3 min)
- Lancer `npx eslint app components lib --quiet`
- Effectuer un commit de sauvegarde avec tag
