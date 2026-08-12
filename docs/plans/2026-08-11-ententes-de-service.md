# Plan d'Implémentation — Ententes de service et contrats

> **Note aux Agents :** Suivre strictement chaque étape séquentiellement. Exécuter un
> cycle complet (Test → Code → Vérification → Commit) pour chaque tâche.

---

## 0. AUDIT — ce que le §32 demandait de vérifier avant de développer

### Le module ne persiste rien

```ts
// lib/data/queries.ts:169
export async function getAgreements(): Promise<AgreementRecord[]> {
  if (isSupabaseSource()) return []      // ← toujours vide sur la vraie base
  return _mockStores.agreements
}
```

Et le catalogue confirme : **aucune table `agreements`, `contracts` ou `ententes`
n'existe** dans `einwjjkmmnnrrissctxd`. Vérifié dans `information_schema.tables`,
pas dans les fichiers de migration — l'archive en déclare une qui n'a jamais été
appliquée.

**1 949 lignes d'interface reposent donc sur rien** :
`agreements-client.tsx` (648), `smart-agreement-builder.tsx` (1 112),
`conformite-contrat.tsx` (168). Pour un cabinet réel, l'écran « En attente de
service » est vide et le restera quoi qu'on y fasse.

Ce n'est donc pas une refonte : c'est une construction. Le brief demande de ne
pas défaire l'existant — il n'y a rien à défaire côté données, et beaucoup à
garder côté interface.

### Ce qui existe, et qui est bon

| Élément | État | À réutiliser pour |
|---|---|---|
| `signature_requests` | table réelle : `document_id`, `client_id`, `document_sha256`, `requested_by`, `expires_at`, `status`, `cancelled_at` | §25 — rien à créer |
| `signatures` | `signer_kind`, `signer_name/email/role`, `rcic_number`, `document_sha256`, `signed_at`, `ip_address`, `user_agent`, `signature_image` | §25, plusieurs signataires |
| `documents` | `sha256`, `storage_path`, `doc_type`, `matter_id`, `client_id` | §21 — un contrat EST un document |
| `ClauseDefinition` | `code`, `category`, `level` (`structural` \| `free`), `isEditable`, `isOptional`, bilingue | §13–15 — les articles |
| `firms` | logo, taux de taxes, conditions de paiement, préfixe de numérotation | §9, §10, §27 |
| `civility`, `family_members` | posés aujourd'hui | §7, §8 |
| `ConfirmationEnvoi` | composant unique, déjà branché sur 7 chemins | §24 — déjà satisfait |
| `lib/invoices/pdf.ts` + `document.ts` | moteur PDF éprouvé, logo du cabinet, translittération WinAnsi | §20 — pas de second moteur |

**Conséquence architecturale.** Les tables de signature sont accrochées à
`documents`, pas à une entité « contrat ». L'architecture du brief
(CLIENT → DOSSIER → DOCUMENT → DEMANDE DE SIGNATURE → SIGNATAIRES) est donc déjà
à moitié construite, et elle impose sa conclusion : **un contrat généré doit
être un `document`**, pas une entité parallèle. Créer un `contracts` avec sa
propre chaîne de signature dupliquerait ce qui existe — exactement ce que le
§17 interdit.

### Ce qui manque vraiment

- La persistance : modèles, versions, ententes émises.
- Les articles modifiables par cabinet (§13–15) : `ClauseDefinition` est une
  constante en mémoire, identique pour tous.
- Le versionnage (§18).
- Le pré-remplissage depuis prospect/client (§3–5).
- Les parties multiples (§8).
- La validation avant génération (§29).

---

## 1. Périmètre & Architecture Fichiers

- [ ] `[NOUVEAU]` `supabase/migrations/…_ententes.sql` — `agreement_templates`,
      `agreement_template_articles`, `agreements`, `agreement_parties`
- [ ] `[NOUVEAU]` `lib/data/ententes.ts` — lecture (server-only)
- [ ] `[NOUVEAU]` `lib/data/ententes-criteres.ts` — types, statuts, variables
      (module pur : le composant client en a besoin)
- [ ] `[NOUVEAU]` `lib/data/ententes-actions.ts` — créer, éditer, émettre, envoyer
- [ ] `[NOUVEAU]` `lib/ententes/variables.ts` — substitution `{{…}}` + validation §29
- [ ] `[NOUVEAU]` `lib/ententes/pdf.ts` — composition, **réutilise** les
      primitives de `lib/invoices/pdf.ts`
- [ ] `[MODIFIER]` `app/[locale]/(app)/agreements/*` — brancher sur les vraies données
- [ ] `[MODIFIER]` `lib/data/supabase/writes.ts` — la conversion prospect→client
      emmène les ententes (§22), même geste que questionnaires et famille

---

## 2. Découpage des Tâches Séquentielles

### Tâche 1 — Le socle de données (est. 30 min)

Quatre tables, et la raison de chacune :

- `agreement_templates` — `firm_id` NULL = modèle système, non modifiable ;
  copie du cabinet modifiable. C'est le §16, et c'est le motif **déjà éprouvé**
  par `questionnaire_templates` : reprendre sa politique RLS mot pour mot.
- `agreement_template_articles` — un article = une ligne (`position`, `code`,
  `title_fr/en`, `body_fr/en`, `level`, `optional`, `enabled`). Une colonne
  `jsonb` aurait rendu impossible de réordonner ou de masquer un article sans
  réécrire le tout.
- `agreements` — l'entente émise. Porte `document_id` (le PDF, dans
  `documents`), `client_id` **OU** `lead_id` (contrainte d'exclusion mutuelle,
  comme `client_questionnaires`), `matter_id`, `template_id`,
  `template_version`, **`articles_snapshot jsonb`**, `status`, montants.
- `agreement_parties` — §8. Chaque partie a sa civilité, son rôle, ses
  coordonnées.

**L'instantané est le point critique.** Le §18 exige qu'un contrat déjà émis ne
change pas quand le modèle change. La même garantie protège déjà
`client_questionnaires.sections`, et elle a été éprouvée aujourd'hui : on
réécrit le modèle de fond en comble et l'envoi garde ses questions.

- [ ] Écrire l'épreuve dans `./cric ententes` : un modèle réécrit ne modifie pas
      une entente émise
- [ ] Constater l'échec (la table n'existe pas)
- [ ] Rédiger la migration, l'appliquer par `./cric migration`
- [ ] Vérifier dans `pg_policies` que RLS isole les cabinets
- [ ] Commit `feat(ententes): socle de données`

### Tâche 2 — Les variables et la validation (est. 20 min)

Module **pur**, donc éprouvable sans base — la leçon de `verifierSections()` et
de `bornesDeLaPeriode()` : une garde qu'on ne peut pas appeler depuis un test
finit par n'être éprouvée qu'en production.

- [ ] Tests unitaires : substitution de `{{civilite}}`, `{{nom_client}}`,
      `{{honoraires}}`… ; **une variable inconnue laissée telle quelle est un
      défaut** — elle doit être signalée, sinon `{{adresse_client}}` s'imprime
      dans le contrat envoyé au client
- [ ] Tests de `verifierAvantGeneration()` (§29) : adresse manquante, courriel
      manquant, honoraires non configurés → refus nommant CE qui manque
- [ ] Implémenter, valider, commit

### Tâche 3 — Le pré-remplissage (est. 20 min)

- [ ] `chargerContractant(type, id)` lit prospect ou client + `family_members`
- [ ] Distinguer **donnée du dossier** et **correction propre au contrat**
      (§6) : la correction vit dans `agreement_parties`, jamais réécrite dans la
      fiche sans confirmation explicite
- [ ] Épreuve : corriger une adresse dans le contrat ne modifie pas le client

### Tâche 4 — Les modèles système (est. 30 min)

Quatre modèles, engendrés par script comme
`scripts/generer-modeles-questionnaires.mjs` : consultation initiale,
consultation initiale pro bono, services professionnels, services
professionnels pro bono.

**Pro bono n'est pas « 0 $ »** (§26) : les articles d'honoraires sont
*remplacés*, pas vidés — nature du mandat, absence de contrepartie, portée.

- [ ] Rédiger les articles depuis `MOCK_CLAUSES`, qui en contient déjà sept de
      qualité (`mandate_scope`, `no_guarantee_result`, `cicc_complaints`,
      `trust_account_art13`, `privacy_retention_6years`…)
- [ ] Commit

### Tâche 5 — L'écran (est. 45 min)

- [ ] Sélection du contractant avec recherche (§3–4) — réutiliser la forme du
      sélecteur de destinataire des questionnaires
- [ ] Articles : cocher, masquer, réordonner, éditer (§13–15)
- [ ] Aperçu à droite (§19)
- [ ] `ConfirmationEnvoi` pour l'envoi (§24) — **composant existant, rien à écrire**

### Tâche 6 — PDF et classement (est. 30 min)

- [ ] `pdfEntente()` réutilise les primitives de `lib/invoices/pdf.ts`
- [ ] Le PDF est **inséré dans `documents`** avec son `sha256`, puis
      `agreements.document_id` le désigne
- [ ] La demande de signature réutilise `signature_requests` — aucune table neuve

### Tâche 7 — La conversion (est. 15 min)

- [ ] `convertLeadToClient()` : les ententes suivent, un seul UPDATE
      (`client_id` posé, `lead_id` vidé), même motif que questionnaires et
      famille — et même raison : `lead_id` est `on delete cascade`

---

## 3. Ce que je recommande de NE PAS faire en V1

Le §2 propose cinq modèles supplémentaires. Trois relèvent du même mécanisme et
n'ont pas besoin d'un modèle propre :

- **Avenant** et **services additionnels** : une entente qui référence la
  précédente. Une colonne `remplace_id` suffit — trois modèles de plus
  produiraient trois textes à maintenir pour une seule idée.
- **Paiement échelonné** : ce n'est pas un modèle, c'est un échéancier (§12).
  Il appartient à tous les modèles.
- **Fin de mandat** : celui-là mérite un modèle propre. Ce n'est pas une entente
  de service, et le CRIC encadre la fin de représentation.

---

## 4. Vérification

1. `./cric ententes` (nouveau) — instantané, RLS, conversion, validation
2. `./cric contraste --page=/fr/agreements` sous les cinq thèmes
3. `pnpm test`, `npx tsc --noEmit`, `pnpm build`
4. Déploiement Vercel confirmé `READY` par `list_deployments`

---

## 5. ⚠️ Validation réglementaire — à lire avant usage

**Aucun texte produit ici n'est un formulaire officiel du Collège.** Le §1 le
demande explicitement, et le code actuel s'en écarte déjà : `page.tsx` annonce
« ententes de service réglementées CICC » et une clause s'intitule
« Conformité CICC ». Ces formulations laissent croire à une conformité
attestée qui n'existe pas.

Ce que je livrerai est **une base de rédaction**, à faire valider avant de
servir de modèle du cabinet. Trois points appellent une relecture juridique :

- **Compte en fidéicommis (art. 13)** — la clause existe déjà (`trust_account_art13`).
  Son libellé engage le cabinet sur le maniement des sommes.
- **Conservation six ans** (`privacy_retention_6years`) — à confronter à la
  **Loi 25** et à la **LPRPDE** : la durée doit correspondre à une finalité
  déclarée, et le client doit savoir ce qui est conservé et pourquoi.
- **Absence de garantie de résultat** (`no_guarantee_result`) — clause centrale
  pour un consultant réglementé.

Je signalerai ces trois points dans le rapport final plutôt que de les
présenter comme acquis.
