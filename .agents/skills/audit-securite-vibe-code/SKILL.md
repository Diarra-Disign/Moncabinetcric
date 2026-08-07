---
name: audit-securite-vibe-code
description: |
  Effectue un audit de sécurité complet et méthodique d'une application web vibe-codée (développée avec des assistants IA comme Claude, Cursor, Copilot).
  Parcours la base de code pour détecter les secrets exposés, les failles RLS/Supabase, l'authentification non sécurisée, le manque de validation côté serveur, les dépendances vulnérables et les failles de rate-limiting/CORS.

  Déclencher obligatoirement dès que :
  - L'utilisateur demande un audit de sécurité, un contrôle des vulnérabilités ou une revue de code axée sécurité.
  - L'utilisateur mentionne "audit de sécurité", "audit vibe-code", "revue de sécurité", "checkup sécurité", "faille de sécurité".

  NE PAS déclencher pour :
  - Les bugs UI/UX simples sans impact sécurité.
  - La refactorisation de code sans objectif de sécurité.
---

# Audit de Sécurité pour Application Web Vibe-Codée

Ce skill définit la méthodologie et la checklist d'audit systématique de sécurité pour les applications web développées en tout ou partie avec des assistants IA (Cursor, Claude, Copilot, ChatGPT, etc.).

---

## 🎯 Objectif
Identifier, documenter et proposer les corrections immédiates pour toutes les failles de sécurité, mauvaises configurations et fuites de données présentes dans l'application.

---

## 🔄 Méthodologie d'Audit en 2 Passes

### PASSE 1 — DÉCOUVERTE ET ARCHITECTURE
Avant de produire toute conclusion :
1. Lire l'intégralité de la base de code et des configurations (`.env.example`, `package.json`, middleware, schémas DB, routes API, webhooks).
2. Reconstruire le modèle mental d'architecture (Framework, DB, Auth, API, Déploiement).
3. Lister tous les points d'entrée (Pages, Routes API, Server Actions, Webhooks, Cron).
4. Tracer le flux de données de l'entrée utilisateur jusqu'à la base de données.

### PASSE 2 — AUDIT SYSTÉMATIQUE CHECKLIST
Parcourir chaque section de la checklist ci-dessous sans en sauter aucune. Pour chaque élément, attribuer l'un des 4 verdicts :
- ✅ **PASSE** — Correctement géré. Citer fichier et numéro de ligne.
- ❌ **ÉCHOUÉ** — Vulnérabilité présente. Documenter avec le format strict.
- ⚠️ **PARTIEL** — Couverture partielle mais lacunes subsistantes. Expliquer le manquement.
- ⬚ **N/A** — Non applicable. Expliquer brièvement pourquoi.

---

## 📋 Checklist d'Audit

### Section 1 : Variables d'Environnement et Gestion des Secrets
- **1.1 — Secrets codés en dur** : `sk_live_`, `sk_test_`, `sk-`, `pk_live_`, `Bearer`, `eyJ`, `ghp_`, `AKIA`, etc.
- **1.2 — Couverture .gitignore & Historique Git** : Vérifier la présence des `.env*` dans `.gitignore` et l'absence de secrets commités dans l'historique Git.
- **1.3 — Fuites de préfixe public** : Vérifier qu'aucun secret serveur n'est préfixé par `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`.
- **1.4 — Fuites dans la console/erreurs** : Vérifier que les `console.log` / error boundaries ne fuient pas de tokens ou variables.
- **1.5 — Exposition des artefacts de build** : Vérifier que les source maps ne sont pas activées en production (`productionBrowserSourceMaps`).
- **1.6 — Validation au démarrage** : Vérifier le plantage rapide au démarrage si des variables d'environnement requises sont manquantes (ex. via Zod / `env.mjs`).

### Section 2 : Sécurité de la Base de Données
- **2.1 — RLS activée** : RLS activée sur CHAQUE table du schéma public.
- **2.2 — Policies RLS existantes** : Chaque table RLS possède des policies `SELECT` et `INSERT` explicites.
- **2.3 — Clauses WITH CHECK** : Toutes les policies `INSERT` et `UPDATE` ont des clauses `WITH CHECK`.
- **2.4 — Source d'identité des policies** : Utilisation stricte de `auth.uid()`, JAMAIS `auth.jwt()->'user_metadata'`.
- **2.5 — Isolation de la clé service_role** : Clé `service_role` strictly réservée au backend et jamais importée côté client.
- **2.6 — Policies des buckets de stockage** : Les buckets de stockage (Supabase/S3) possèdent des règles RLS appropriées.
- **2.7 — Injection SQL** : Absence de concaténation de chaînes dans les requêtes SQL brutes (`.rpc()`, `postgres.js`).
- **2.8 — Fonctions SECURITY DEFINER** : Les fonctions `SECURITY DEFINER` ne contournent pas indûment le RLS.

### Section 3 : Authentification et Gestion des Sessions
- **3.1 — Middleware d'auth existant** : Middleware présent et s'exécutant sur toutes les routes protégées.
- **3.2 — Routage par défaut en refus** : Approche par liste blanche (refus par défaut des nouvelles routes).
- **3.3 — `getUser()` vs `getSession()`** : Vérification serveur avec `getUser()` (validation du JWT auprès du serveur Auth).
- **3.4 — Gestionnaire de callback auth** : Échange sécurisé de code auth sans fuite de token dans l'URL.
- **3.5 — Stockage de session** : Tokens stockés dans des cookies `httpOnly`, JAMAIS dans `localStorage`/`sessionStorage`.
- **3.6 — Routes API protégées** : Vérification d'auth systématique sur toutes les routes de données utilisateur.
- **3.7 — Sécurité OAuth** : Validation des redirections et présence du paramètre `state` anti-CSRF.
- **3.8 — Réinitialisation de mot de passe** : Tokens à usage unique avec expiration stricte.

### Section 4 : Validation Côté Serveur
- **4.1 — Validation par schéma** : Validation systématique des Server Actions et routes API via Zod/Yup/Valibot côté serveur.
- **4.2 — Identité depuis la session** : `userId` extrait exclusivement du token/session authentifié, jamais du body JSON.
- **4.3 — Nettoyage des entrées** : Protection contre le XSS (`dangerouslySetInnerHTML`, injection HTML).
- **4.4 — Application des méthodes HTTP** : Mutations d'état uniquement via POST/PUT/PATCH/DELETE (jamais GET).
- **4.5 — Fuites dans les réponses d'erreur** : Masquage des stacktraces et détails SQL internes au client.
- **4.6 — Signature de webhooks** : Validation cryptographique des signatures (Stripe, GitHub, etc.).

### Section 5 : Sécurité des Dépendances et Packages
- **5.1 — Audit des vulnérabilités** : Résultat propre de `npm audit` / `pnpm audit`.
- **5.2 — Packages hallucinés par l'IA** : Détection des packages obscurs ou inexistants créés par typosquatting.
- **5.3 — Lockfile commité** : Présence de `package-lock.json` ou `pnpm-lock.yaml` dans Git.
- **5.4 — Packages obsolètes** : Mise à jour des librairies d'auth/crypto et frameworks.
- **5.5 — Dépendances inutilisées** : Suppression des dépendances fantômes installées par l'IA et non réimportées.

### Section 6 : Limitation de Débit (Rate Limiting)
- **6.1 — Opérations coûteuses (APIs payantes)** : Rate limiting sur les endpoints OpenAI, Anthropic, Stripe, SMS.
- **6.2 — Endpoints d'authentification** : Anti-bruteforce sur login, register, OTP et reset password.
- **6.3 — Implémentation côté serveur** : Stockage centralisé (Redis/Upstash) résistant au redéploiement.

### Section 7 : Configuration CORS
- **7.1 — CORS des routes API** : Restriction d'origine aux domaines autorisés du cabinet/app (pas de `Access-Control-Allow-Origin: *` sur endpoints privés).
- **7.2 — Mode credentials** : `Access-Control-Allow-Credentials: true` associé uniquement à des origines explicites.

### Section 8 : Sécurité des Téléversements de Fichiers
- **8.1 — Validation serveur** : Contrôle du type MIME réel et taille maximale côté serveur.
- **8.2 — Permissions de stockage** : Séparation stricte des fichiers publics et des documents privés.
- **8.3 — Prévention d'exécution** : Interdiction d'exécution de scripts dans les répertoires de téléchargement.

---

## 📝 Format des Conclusions ❌ ÉCHOUÉ

Pour chaque constat d'échec ❌, appliquer strictement la structure suivante :

```text
┌─────────────────────────────────────────────────────────┐
│ CONCLUSION #[numero]                                    │
├──────────┬──────────────────────────────────────────────┤
│ Severite │ CRITIQUE / HAUTE / MOYENNE / BASSE           │
│ Categorie│ ex., Exposition de Secret, RLS Manquant, etc.│
│ Emplacement│ chemin/fichier.ts:numero_ligne             │
│ CWE      │ CWE-XXX (Nom)                               │
├──────────┴──────────────────────────────────────────────┤
│ Ce qui ne va pas :                                      │
│ [Description en langage clair de la vulnerabilite]      │
│                                                         │
│ Pourquoi c'est important :                              │
│ [Ce qu'un attaquant pourrait reellement faire avec ca]  │
│                                                         │
│ Le code vulnerable :                                    │
│ [extrait de code exact]                                 │
│                                                         │
│ La correction :                                         │
│ [extrait de code corrige, pret a copier/coller]         │
│                                                         │
│ Effort : ~[X] minutes                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Format du Rapport Final

1. **Évaluation de la Posture de Sécurité** (🔴 CRITIQUE / 🟠 À AMÉLIORER / 🟡 ACCEPTABLE / 🟢 SOLIDE) + Résumé exécutif.
2. **Conclusions Critiques et Hautes** (Synthèse prioritaire).
3. **Victoires Rapides (< 10 min)**.
4. **Plan de Remédiation Priorisé** (Ordre : Sévérité puis Effort avec estimations en minutes).
5. **Ce qui est Déjà Bien Fait** (Pour préserver les bonnes pratiques en place).
6. **Résumé Compact de la Checklist** (Grille synthétique `1.1 ✅ 1.2 ❌ ...`).
