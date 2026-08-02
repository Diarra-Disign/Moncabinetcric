# Plan de correction — écarts entre les affirmations de l'interface et le code réel

**Date** : 2026-08-02 · **Responsable** : Me Adama Diarra (RCIC #R-514982)

Ce plan liste les écarts constatés entre ce que la plateforme **affirme** à ses utilisateurs et ce
que le code **fait** réellement. Il est ordonné par priorité. Voir [EFVP-ebauche.md](./EFVP-ebauche.md)
pour l'analyse complète.

---

## Priorité 1 — À lever avant tout dossier client réel

### P1.1 — Retirer ou corriger les affirmations de sécurité non fondées

Ces mentions sont affichées à l'utilisateur alors qu'aucun code ne les soutient. Affirmer
publiquement une mesure inexistante est un risque distinct sous la Loi 25.

| Fichier | Ligne | Mention |
|---|---|---|
| `app/[locale]/(app)/documents/documents-client.tsx` | 239 | « stockage chiffré AES-256 » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 284 | « Traçabilité SHA-256 (Loi 25) » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 286 | « Région ca-central-1 (Canada) » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 290 | « chiffrés au repos (AES-256) » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 632 | « Chiffré AES-256 » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 660 | « AES-256 au repos (ca-central-1) » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 668 | « Souveraineté des données Canada (Loi 25) » |
| `app/[locale]/(app)/documents/documents-client.tsx` | 772 | « empreinte SHA-256 dans le journal d'audit » |
| `app/[locale]/(app)/settings/audit/audit-client.tsx` | 220 | « traçabilité cryptographique SHA-256 » |
| `app/[locale]/(app)/dashboard/dashboard-client.tsx` | 700 | « AES-256 » |
| `app/[locale]/(marketing)/landing/landing-client.tsx` | 514 | « AES-256 » — **page publique** |

Deux voies : implémenter réellement (P1.2 et P1.3), ou retirer les mentions. Ne pas laisser en l'état.

### P1.2 — Implémenter un vrai hachage SHA-256

État actuel — aucun `crypto` dans le projet :

| Fichier | Ligne | Code actuel |
|---|---|---|
| `lib/data/actions.ts` | 175, 198, 220 | `` rowHash: `sha256-${Date.now()}` `` |
| `lib/data/actions.ts` | 137 | `` secretHash: `sha256-${Date.now()}` `` |
| `app/[locale]/(app)/settings/audit/audit-client.tsx` | 123 | timestamp hexadécimal + chaîne fixe |
| `app/[locale]/(app)/documents/documents-client.tsx` | 81 | `Math.random()` complété à 64 caractères |

Correctif : calculer côté serveur `sha256(prevHash + champs canoniques de la ligne)` avec
`node:crypto`. Le calcul ne doit jamais être fait côté client — sinon la chaîne reste falsifiable
par quiconque ouvre la console.

`secretHash` (clés d'API du connecteur) doit en outre utiliser un algorithme de hachage de mot de
passe, pas un SHA nu.

### P1.3 — Confirmer la région d'hébergement

Projet Supabase `zpbkxzrnvzxcwlhjllrp`. Lire la région dans les paramètres du projet, la consigner
ici, puis corriger l'interface. Si la région est hors Québec, l'EFVP de l'article 17 devient
obligatoire avant tout traitement réel.

### P1.4 — Brancher l'authentification

Aucune authentification n'existe. La RLS est activée sur les 20 tables (migration `0001`) mais reste
inopérante : l'accès se fait avec la clé `service_role`, qui la contourne par conception. Le
cloisonnement repose aujourd'hui uniquement sur le filtre `firm_id` appliqué dans `lib/data/`.

Tant que ce point n'est pas levé, la plateforme ne peut pas être exposée publiquement.

### P1.5 — Encadrer le connecteur d'intelligence artificielle

Avant toute activation : EFVP dédiée, entente écrite avec l'exploitant de l'assistant, information
des personnes concernées, registre des activations. Le connecteur reste désactivé par défaut et les
actes réservés restent exclus — cette partie est correctement conçue, ne pas la relâcher.

---

## Priorité 2 — Avant mise en production

- **P2.1** — Rédiger la politique de gouvernance interne des RP (document distinct de la politique publique, exigé par la Loi 25).
- **P2.2** — Mettre en place le registre des incidents de confidentialité et la procédure de notification à la CAI.
- **P2.3** — Paramétrer et appliquer les durées de conservation, avec purge effective des prospects non convertis.
- **P2.4** — Faire réviser la politique de confidentialité, les conditions d'utilisation et l'EFVP par un avocat en protection des renseignements personnels.
- **P2.5** — Ajouter les liens vers `/confidentialite` et `/conditions` dans le pied de page et au moment de la création de compte.

## Priorité 3 — Amélioration continue

- **P3.1** — Journaliser les accès en lecture aux dossiers sensibles, pas seulement les écritures.
- **P3.2** — Ajouter un mécanisme de vérification de l'intégrité de la chaîne d'audit, une fois le vrai hachage en place.
- **P3.3** — Prévoir l'export des données d'une personne dans un format structuré (droit à la portabilité, Loi 25).

---

## Ce qui est déjà correct

À ne pas défaire lors des corrections :

- `firm_id` présent sur toutes les tables cloisonnées, filtre systématique dans `lib/data/supabase/reads.ts`
- RLS activée dès la création des tables, et non ajoutée après coup
- `audit_logs` sans politique `update` ni `delete` — journal en ajout seul
- Connecteur IA désactivé par défaut, actes réservés exclus des actions automatisables
- `lib/supabase/server.ts` marqué `server-only` : la clé `service_role` ne peut pas fuir dans un bundle client
- Aucune garantie de résultat promise sur les demandes d'immigration
