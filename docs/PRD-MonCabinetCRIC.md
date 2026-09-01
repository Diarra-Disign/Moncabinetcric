# PRD de continuité — MonCabinetCRIC

> **Version :** 2026-09-01  
> **Audience :** Claude Code et tout agent qui intervient sur ce dépôt.  
> **Objectif :** comprendre le produit livré, préserver les garanties métier et de sécurité, puis apporter des changements ciblés sans régression.  
> **Source de vérité :** le code, les migrations `supabase/migrations/` et les tests priment sur ce document lorsqu’ils divergent. Mettre ce PRD à jour dans le même commit qu’un changement fonctionnel important.

## 1. Produit et promesse

MonCabinetCRIC est un SaaS bilingue (français/anglais) de gestion de cabinet pour les consultants réglementés en immigration canadienne (RCIC/CICC). Il centralise le cycle d’un mandat : prospect, client, dossier, documents, entente, signature, facturation, fidéicommis, échéances, communication et portail client.

Le produit sert trois populations qui ne doivent jamais être confondues :

| Population | Besoin principal | Frontières d’accès |
|---|---|---|
| Membre d’un cabinet | Administrer les mandats du **seul** cabinet auquel il appartient | Données isolées par `firm_id` et politiques RLS |
| Client final | Consulter son dossier, répondre aux questionnaires et déposer des documents | Uniquement ses propres données via le portail |
| Administrateur de plateforme | Administrer cabinets, offres et demandes de soutien | Ne doit jamais consulter les dossiers métier des cabinets |

Le produit traite des renseignements personnels sensibles (statut migratoire, documents d’identité, informations familiales et financières). Les fonctions « pratiques » ne doivent jamais contourner cette contrainte.

## 2. État fonctionnel actuel

### Modules livrés

| Domaine | Capacités actuelles |
|---|---|
| Accès et cabinets | Authentification Supabase, invitations, membres, rôles, droits, sièges, plans et état d’accès du cabinet |
| CRM | Prospects, conversion prospect → client, identité civile, coordonnées, famille et recherche |
| Dossiers | Création et suivi de dossiers, programmes, exigences, échéances, notes de rendez-vous et critères de complétude |
| Documents | Classement, téléversement, téléchargement contrôlé, revue par le client et documents liés aux dossiers |
| Questionnaires | Modèles, envoi au client par jeton, réponses, suivi dans le portail |
| Ententes | Modèles système/cabinet, consultation initiale et services professionnels, clauses variables, brouillons, émission PDF, classement documentaire, signature et conversion prospect → client |
| Signatures | Demandes, destinataires, champs, signature par jeton, archivage et verrouillage des documents signés |
| Facturation | Factures, lignes, taxes, paiements, PDF, facturation d’étapes d’entente |
| Fidéicommis | Grand livre, rapprochements, registre mensuel et relevés PDF |
| Calendrier et rendez-vous | Événements, disponibilités, synchronisation/relevé Calendly, salle de rencontre du cabinet et prise de rendez-vous publique |
| Tâches et alertes | Tâches, assignation, permissions, notifications et tableau de bord |
| Portail client | Aperçu du dossier, échéances, documents, questionnaires, facturation et rendez-vous du client connecté |
| Plateforme | Catalogue, abonnements Stripe, sièges, demandes de démonstration/soutien et console d’administration |
| Connecteur IA | API/connecteur documenté, désactivé par défaut et limité aux opérations autorisées ; il ne peut jamais effectuer un acte réservé |

### Routes importantes

Les routes utilisent un préfixe de langue : `/fr` est la valeur par défaut et `/en` est pris en charge.

| Espace | Routes clés |
|---|---|
| Marketing/public | `/fr`, `/fr/landing`, `/fr/connexion`, `/fr/demo`, `/fr/rdv/[slug]`, `/fr/conditions`, `/fr/confidentialite` |
| Application cabinet | `/fr/dashboard`, `/fr/clients`, `/fr/pipeline`, `/fr/matters`, `/fr/documents`, `/fr/agreements`, `/fr/signatures`, `/fr/billing`, `/fr/fideicommis`, `/fr/calendar`, `/fr/deadlines`, `/fr/questionnaires`, `/fr/settings` |
| Portail client | `/fr/portal` et ses sous-routes |
| Administration plateforme | `/fr/admin` et ses sous-routes |
| Liens à jeton | `/s/[jeton]` pour signature ; `/fr/q/[token]` pour questionnaire |

Toute route nouvelle est privée par défaut. Pour rendre une route explicitement publique, l’ajouter avec justification à `SEGMENTS_PUBLICS` dans `proxy.ts` et vérifier qu’elle ne révèle aucune donnée métier.

## 3. Architecture actuelle

- **Framework :** Next.js 16.3, App Router, React 19, TypeScript.
- **UI :** Tailwind CSS v4, composants React, `lucide-react`.
- **Internationalisation :** `next-intl` v4, messages dans `messages/`, routing dans `lib/i18n/`.
- **Données et authentification :** Supabase (Postgres, Auth, Storage, RLS) via `@supabase/ssr` et `@supabase/supabase-js`.
- **Documents PDF :** `pdf-lib`; primitives partagées dans `lib/pdf/`, ententes dans `lib/ententes/pdf.ts`, factures dans `lib/invoices/pdf.ts`.
- **Paiements :** Stripe, webhook dans `app/api/stripe/webhook/route.ts`.
- **Courriel :** Resend.
- **Validation :** Zod aux frontières pertinentes ; tests Node/TSX et Playwright configuré.

### Organisation à conserver

```text
app/                    Routes et composants de page
components/             Composants partagés d’interface
lib/data/               Lectures/actions métier côté serveur
lib/<domaine>/          Logique pure, génération PDF, règles métier et tests
lib/supabase/           Clients, session et identité du membre/cabinet
supabase/migrations/    Schéma, fonctions SQL, RLS et évolutions irréversibles
scripts/ + ./cric       Outils d’administration et vérifications métier
docs/                   Spécifications, conformité, plans et ce PRD
```

Préférer une règle métier pure et testable dans `lib/<domaine>/`, puis l’appeler depuis une action serveur dans `lib/data/`. Les routes API doivent rester étroites : validation → autorisation → service, sans logique métier répliquée dans l’interface.

## 4. Invariants non négociables

### Sécurité et cloisonnement

1. **Jamais de lecture ou écriture inter-cabinet.** Toute donnée métier est rattachée à `firm_id`; utiliser le client de session (`getSessionSupabase`) et l’identité actuelle (`getCurrentMember`) pour les actions d’un cabinet.
2. **La RLS est le verrou final.** Un filtre applicatif est utile, mais ne remplace jamais une politique Supabase. Ne jamais ajouter une requête utilisant la clé `service_role` pour une action d’utilisateur courant.
3. **La clé `SUPABASE_SERVICE_ROLE_KEY` reste serveur exclusivement.** `lib/supabase/server.ts` est `server-only`; ne jamais l’importer côté client ni exposer une variable secrète dans une variable `NEXT_PUBLIC_*`.
4. **Séparer cabinet, client portail et administrateur plateforme.** Une fonction administrative ne donne pas accès aux dossiers clients. Un membre de cabinet ne se transforme pas implicitement en client portail.
5. **Routes privées par défaut.** Toute ouverture publique doit être minimale, sans énumération d’identifiants ni fuite de données.
6. **Toute erreur affichée doit être lisible et sûre.** Ne pas exposer d’erreur Postgres, de jeton, de clé ou de détail interne à l’utilisateur.

### Intégrité métier et réglementaire

1. **Actes réservés :** finaliser, envoyer, signer ou annuler une entente ne peut pas être automatisé par le connecteur IA et exige les permissions prévues.
2. **Documents signés et factures émises : immutables.** Ne jamais « corriger » leur contenu en place. Créer une nouvelle version, note de crédit ou artefact approprié.
3. **Ententes : l’instantané est contractuel.** Le PDF est produit depuis `articles_snapshot`, jamais depuis le modèle courant. Un changement de modèle ne modifie pas une entente émise.
4. **Ententes : variables résolues à la sauvegarde.** Après modification d’un brouillon, les variables `{{...}}` doivent rester substituées dans l’instantané PDF. Le contexte de consultation (durée, date, mode, notes) et du mandat (services/échéancier) doit être conservé.
5. **PDF : aucune troncature silencieuse.** Le texte contractuel doit s’envelopper et passer à la page suivante. Toute évolution du moteur PDF préserve les primitives partagées, l’identité visuelle et le contenu complet.
6. **En-tête : la raison sociale prime sur le logo.** Le nom légal du cabinet ne se tronque jamais — c’est lui qui dit *qui s’engage*, forme juridique comprise. `nomCabinetEnLignes()` l’enveloppe sur deux lignes, puis réduit la taille, puis accepte une troisième ligne : il cède tout sauf l’intégralité. Quand le nom réclame une ligne de plus, cette hauteur est retranchée du budget du **logo**, jamais de celui du corps.
7. **En-tête : le logo ne pousse jamais le contenu vers le bas.** `enTeteOfficiel` sert cinq documents — facture, reçu, registre mensuel, rapprochement, note de rencontre — dont plusieurs n’ouvrent qu’une seule page, sans pagination : un en-tête plus haut y rognerait la place des lignes et ferait déborder en silence ce qui entrait auparavant. Le logo est donc borné à la hauteur que la colonne de droite consomme déjà (dix-huit points par repère). Toute modification de cet en-tête doit se mesurer avant/après, en appariant les fragments de texte par leur contenu et non par leur rang.
8. **Logos : seuls le PNG et le JPEG existent pour `pdf-lib`.** Tout autre format déposé par un cabinet doit être converti à la réception, jamais laissé pour compte à la génération — un SVG s’affiche parfaitement dans l’aperçu des paramètres et disparaît de tous les documents. Aucun échec d’embarquement ne doit rester muet.
9. **Conversion prospect → client : conserver les relations.** Les ententes, questionnaires, coordonnées et identité/famille doivent survivre; respecter les contraintes SQL qui empêchent un transfert partiel.
10. **Fidéicommis : aucune approximation financière.** Montants, rapprochements, gel des périodes et registre mensuel doivent être calculés côté serveur et vérifiés par les règles existantes.
11. **Audit : ajout seul.** Ne pas créer de mécanisme de modification/suppression d’entrées d’audit.

### Vérité produit et conformité

- Ne jamais présenter un modèle comme un formulaire officiel CICC ni une conformité juridique comme acquise sans validation compétente.
- Ne pas affirmer une mesure de sécurité, un chiffrement, une région d’hébergement ou une certification qui n’est pas confirmée par l’infrastructure et le code.
- Le connecteur IA reste désactivé par défaut. Son activation traite potentiellement des renseignements personnels : préserver les limites d’usage, les droits et les traces existantes.
- Les documents `docs/conformite/` et `docs/EFVP-ebauche.md` sont des éléments de travail, pas des avis juridiques. Les mettre à jour lorsqu’un flux de données ou une affirmation de sécurité change.

## 5. Données : contrats à respecter

Les migrations SQL sont une lignée append-only. Ne jamais réécrire une migration déjà appliquée : ajouter une migration datée, idempotente quand c’est pertinent, incluant contraintes, index, fonctions et RLS nécessaires.

Entités principales :

- Cabinet/accès : `firms`, `profiles`, `firm_members`, `platform_admins`, abonnements, sièges, permissions et invitations.
- CRM/dossier : `leads`, `clients`, `family_members`, `matters`, exigences et échéances.
- Documents/portail : `documents`, `document_reviews`, `client_users`, questionnaires et réponses.
- Ententes/signatures : `agreement_templates`, articles, `agreements`, parties, `signature_requests`, destinataires, champs et signatures.
- Finance : `invoices`, lignes, `payments`, `trust_ledger`, rapprochements et frais gouvernementaux.
- Opérations : événements calendrier, réservations, tâches, notifications, demandes de soutien et journal d’audit.

Avant une évolution de schéma : vérifier les contraintes existantes, les fonctions SQL et les politiques RLS qui portent sur les tables affectées. Prévoir la migration des données existantes et un test de régression ciblé.

## 6. Workflow obligatoire pour un agent

1. Lire `AGENTS.md` avant d’écrire du code. Pour tout changement Next.js, consulter la documentation correspondant à la version installée dans `node_modules/next/dist/docs/`.
2. Vérifier `git status --short` et préserver strictement les changements non committés d’autrui.
3. Avant toute implémentation, présenter un plan clair, le périmètre, les fichiers visés, les risques et les tests; attendre la validation explicite de l’utilisateur.
4. Faire un changement minimal, localisé et compatible avec l’architecture existante. Ne pas effectuer de refonte opportuniste.
5. Écrire/adapter les tests les plus proches de la règle modifiée. Utiliser les modules purs pour tester les règles métier.
6. Exécuter la vérification proportionnée : au minimum `pnpm test` ou la suite ciblée, puis `npx tsc --noEmit`; utiliser `pnpm build` quand le changement touche routes, build, configuration ou rendu serveur. Pour les ententes : `./cric ententes` si l’environnement est configuré.
7. Fournir le résultat, les tests exécutés, les risques résiduels et l’URL locale concernée. Exemples : `http://localhost:3000/fr/agreements`, `http://localhost:3000/fr/dashboard`.
8. Ne jamais pousser, déployer, appliquer une migration distante, modifier une donnée réelle ou exécuter une opération destructrice sans demander explicitement : **« Est-ce que je peux le faire ? »**

## 7. Vérifications disponibles

```bash
pnpm test                 # tests unitaires/intégration métier
npx tsc --noEmit          # types TypeScript
pnpm lint                 # lint
pnpm build                # build de production
pnpm test:e2e             # Playwright, si configuré
./cric ententes           # contrôles spécifiques aux ententes
./cric roles              # matrice de droits/RLS
./cric verifier           # diagnostic d’authentification et environnement
```

Ne jamais inclure `.env.local`, clés Supabase, Stripe, Resend, jetons de signature ou données de clients dans un commit, un test, une capture d’écran ou une réponse.

## 8. État récent à connaître

Les derniers changements ont notamment renforcé :

- la persistance et l’aperçu du portail client sur données réelles;
- la réservation publique et la non-divulgation de la salle de rencontre;
- le calendrier et les relevés Calendly;
- les tâches, leurs permissions, les dates locales et les messages d’erreur sûrs;
- la conversion prospect → client avec transfert complet de civilité et coordonnées;
- les PDF d’ententes : descriptions d’échéancier sur plusieurs lignes, sans troncature;
- les brouillons d’ententes : la resubstitution des variables à chaque sauvegarde, incluant le contexte de consultation et de mandat;
- l’en-tête des documents : le logo de chaque cabinet et sa raison sociale (voir ci-dessous).

### L’en-tête des documents — ce qui a été corrigé

Trois défauts distincts empêchaient un cabinet d’avoir son identité sur ses propres documents. Ils sont réglés; ce paragraphe existe pour éviter qu’on les rouvre par erreur.

1. **Formats.** `pdf-lib` n’embarque que du PNG et du JPEG, alors que l’écran des paramètres accepte `image/*` et annonce PNG, JPG, SVG, WEBP. Un cabinet déposant un SVG voyait son logo dans l’aperçu, lisait « enregistré », puis n’en avait aucun sur ses documents : `embedPng` levait et le `catch` avalait l’erreur. L’image est désormais **convertie en PNG au dépôt**, dans un canvas, côté long borné à 1024 px.
2. **Proportions.** Les en-têtes fixaient la hauteur puis plafonnaient la largeur sans la recalculer : au-delà du rapport 3,86 le logo était comprimé — un bandeau 678×143 sortait en 170×44. `boiteLogo()` respecte désormais les deux bornes ensemble.
3. **Raison sociale.** `couper(c.nom, gras, 15, 220)` amputait le nom légal : « Diarra Global Visa & Immigration Services Inc. » réclame 329 points pour 220 alloués et s’imprimait « Diarra Global Visa & Immigr… », perdant sa forme juridique.

**L’ancien avertissement de ce paragraphe est caduc** : il disait qu’un logo minuscule tenait probablement aux marges blanches de l’image source et invitait à ne pas toucher au moteur. Le moteur avait bel et bien deux défauts de mise en page, aujourd’hui corrigés et couverts par des épreuves (`lib/ententes/__tests__/logo-pdf.test.ts`, `nom-cabinet-pdf.test.ts`). La distinction reste néanmoins utile dans l’autre sens : **le moteur étant sain, un logo qui paraît encore petit vient maintenant de l’image elle-même** — marges blanches, faible résolution — et se corrige en la recadrant, pas en modifiant `lib/pdf/`.

Restent connus et non traités : les logos **déjà** enregistrés dans un format non embarquable ne sont pas convertis rétroactivement (le cabinet doit redéposer son image); le champ d’URL collée n’est pas couvert, une image cross-origin ne pouvant être convertie côté navigateur; `enTete()` dans `lib/pdf/primitives.ts` est du code mort porteur du même défaut de proportions; et l’écran des paramètres est en français codé en dur, sans `useTranslations`, contrairement à la règle de bilinguisme.

## 9. Critères d’acceptation transversaux

Un changement est acceptable seulement s’il :

- respecte le cloisonnement de cabinet et les permissions;
- ne rend pas une route privée accessible par inadvertance;
- ne modifie pas rétroactivement un document signé, une facture émise ou une entente émise;
- ne perd pas des données lors d’une conversion ou d’une mise à jour;
- reste bilingue ou utilise les mécanismes i18n existants;
- garde un rendu PDF lisible et sans texte coupé;
- ne dégrade ni l’accessibilité, ni les états de chargement/erreur;
- est couvert par une preuve exécutable adaptée au risque;
- est accompagné d’une mise à jour de ce PRD si l’architecture, le périmètre ou les invariants changent.

## 10. Prompt de relais recommandé pour Claude Code

> Lis d’abord `AGENTS.md`, puis `docs/PRD-MonCabinetCRIC.md`. Considère les migrations, les tests et le code comme sources de vérité si un écart apparaît. Préserve tout changement non committé. Avant d’implémenter, présente un plan détaillé et attends ma validation. Ne pousse, ne déploie, n’applique aucune migration distante et ne modifie aucune donnée réelle sans me demander : « Est-ce que je peux le faire ? ». Pour chaque intervention, respecte les invariants de cloisonnement par cabinet, d’immutabilité documentaire et de sécurité décrits dans le PRD, puis exécute les tests adaptés et donne l’URL locale de vérification.
