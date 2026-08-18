<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Directives de Validation Préalable du Plan
- **Présentation & Validation Obligatoire du Plan** : Avant d'exécuter tout plan d'implémentation, modification architecturale ou nouvelle fonctionnalité, l'agent doit TOUJOURS présenter le plan d'action clair et détaillé à l'utilisateur et attendre sa validation explicite avant de commencer à coder.

# Directives de Publication & Déploiement
- **Règle Globale de Publication** : Avant toute publication sur un serveur externe ou un service d'hébergement (ou push GitHub / déploiement), l'agent doit TOUJOURS demander à l'utilisateur : *"Est-ce que je peux le faire ?"*

# Directives d'Aperçu & Rendu (Preview Links)
- À la fin de chaque modification de code ou d'interface utilisateur, fournir à l'utilisateur les liens d'accès direct / URL d'aperçu vers les pages ou composants modifiés (ex: `http://localhost:3000/fr/landing`, `http://localhost:3000/fr/dashboard`).

# Rules — Directives Développement Backend (backend-dev-guidelines)
- **Architecture en Couches Obligatoire** : Les handlers d'API et routes ne doivent contenir AUCUNE logique métier. Le flux doit impérativement respecter `Routes → Controllers → Services → Repositories → DB`.
- **Validation Systématique** : Valider toutes les requêtes (body, query, params) via Zod ou des schémas de typage stricts avant toute exécution métier.
- **Gestion des Erreurs & Frontières** : Interdiction absolue de silencier les exceptions (`catch` vide). Tout échec doit retourner une enveloppe JSON standardisée `{ success: false, error: { code, message } }`.
- **Calcul du Risque Backend (BFRI)** : Évaluer la faisabilité et le risque opérationnel (données, facturation, auth) avant toute mutation backend critique.

