# Spécification technique — Phase 0 : Personnes & Services

> Document destiné à un agent de code automatisé.
> Même format et mêmes règles que `TACHES-GEMINI.md`. **Lis d'abord la section 0 de ce fichier-là** (contexte, commandes, conventions) : elle n'est pas répétée ici.
>
> ⚠️ Les numéros de ligne cités dans ce document ont été relevés le 1er août 2026. Le code évolue : **repère toujours par le nom du symbole** (`getMatterById`, `_getStores`, `<DirectActionsTabs>`) et traite le numéro de ligne comme une indication approximative. Si un symbole est introuvable, arrête-toi et signale.

---

## Objectif de la phase

Remplacer le modèle « un dossier = une personne = un montant » par le modèle **« un dossier = N personnes, chaque personne porte ses propres services, les honoraires sont la somme des services »**.

### Pourquoi maintenant

1. **Exigence réglementaire.** Le *Retainer Agreement Regulation* du CICC impose la ventilation des honoraires par service rendu. Un honoraire global sans détail est un risque disciplinaire pour le consultant.
2. **Réalité des dossiers.** Un parrainage a un répondant *et* un parrainé. Une EIMT a un employeur *et* des travailleurs. Un permis d'études a souvent un étudiant *et* un parent payeur. Le modèle actuel (`Matter.clientName: string`) ne peut représenter aucun de ces cas.
3. **Coût du retard.** C'est une décision de schéma. Ajoutée plus tard, elle impose de réécrire la facturation, le contrat de services, le calcul des frais gouvernementaux et le pré-remplissage des formulaires IRCC. Ajoutée maintenant, elle ne touche que `lib/data/` et une carte d'interface.

### Ce que cette phase ne fait PAS

- Pas de contrat de services, pas de PDF, pas de signature → phases ultérieures.
- Pas de catalogue de frais gouvernementaux → phase 1. Mais le champ `dateOfBirth` de `Party` est créé **dès maintenant**, car les règles de frais dépendent de l'âge.
- Pas de branchement Supabase. Le SQL est **rédigé et versionné, mais non appliqué** (voir P0-8).

---

## Contrainte de compatibilité (impérative)

**Aucune régression visuelle n'est autorisée.** Les 10 pages doivent afficher exactement le même contenu qu'avant, à l'exception de la nouvelle carte ajoutée en P0-7.

En conséquence :
- Le champ `Matter.clientName` **est conservé tel quel**. Il devient un champ d'affichage dénormalisé (le nom du demandeur principal). Ne le supprime pas, ne le renomme pas, ne modifie pas sa valeur.
- `ClientRecord` **n'est pas modifié**. `Party` est une entité distincte : `ClientRecord` = fiche commerciale du client du cabinet ; `Party` = personne rattachée à un dossier précis.
- `InvoiceRecord` **n'est pas modifié** dans cette phase.

---

## Ordre d'exécution

`P0-1` → `P0-2` → `P0-3` → `P0-4` → `P0-5` → `P0-6` → `P0-7` → `P0-8` → `P0-9`

Lance `npm run build` après chaque sous-tâche.

---

# P0-1 — Types

**Fichier** : `lib/data/types.ts` (ajouter à la fin, ne rien supprimer)

```ts
// ─────────────────────────────────────────────────────────────
// PERSONNES AU DOSSIER
// ─────────────────────────────────────────────────────────────

export type PartyRole =
  | "principal"   // demandeur principal
  | "spouse"      // conjoint / conjoint de fait
  | "dependent"   // personne à charge
  | "sponsor"     // répondant (parrainage)
  | "employer"    // employeur (EIMT / permis de travail fermé)
  | "payer"       // tiers payeur (parent, employeur, organisme)
  | "rcic"        // consultant réglementé responsable
  | "cocounsel"   // co-conseil / avocat associé

export interface Party {
  id: string
  matterId: string
  role: PartyRole
  firstName: string
  lastName: string
  /** ISO AAAA-MM-JJ. Requis pour les règles de frais liées à l'âge (phase 1). */
  dateOfBirth?: string
  /** Pays de citoyenneté, aligné sur ClientRecord.citizenship. */
  citizenship?: string
  email?: string
  phone?: string
  /** Pour role="employer" : raison sociale. */
  organizationName?: string
  /** Lien de parenté avec le demandeur principal, en clair. */
  relationshipToPrincipal?: string
  /** Cette personne doit-elle apposer une signature sur l'entente ? */
  isSignatory: boolean
  /** Cette personne acquitte-t-elle tout ou partie des honoraires ? */
  isPayer: boolean
}

// ─────────────────────────────────────────────────────────────
// MODÈLES DE SERVICE (catalogue du cabinet)
// ─────────────────────────────────────────────────────────────

/**
 * Un modèle s'applique PAR SERVICE, jamais par entente.
 * C'est ce qui permet de facturer des services différents
 * à des personnes différentes du même dossier.
 */
export interface ServiceTemplate {
  id: string
  code: string
  labelFr: string
  labelEn: string
  descriptionFr: string
  descriptionEn: string
  /** id d'un ImmigrationProgram de programs.ts, ou "generic". */
  programId: string
  /** Rôles auxquels ce service s'adresse habituellement. */
  applicableRoles: PartyRole[]
  /** Fourchette d'honoraires habituelle, en $ CAD hors taxes. */
  feeRangeMin: number
  feeRangeMax: number
  feeSuggested: number
}

// ─────────────────────────────────────────────────────────────
// LIGNES DE SERVICE (services réellement rendus)
// ─────────────────────────────────────────────────────────────

export interface ServiceLine {
  id: string
  matterId: string
  /** La ligne appartient à UNE personne précise du dossier. */
  partyId: string
  /** Modèle d'origine — traçabilité obligatoire. */
  templateId: string
  labelFr: string
  labelEn: string
  /** Honoraires professionnels en $ CAD, HORS taxes et HORS débours. */
  professionalFee: number
  /** Copie de la fourchette du modèle au moment de l'ajout (historisation). */
  feeRangeMin?: number
  feeRangeMax?: number
  /** Ordre d'affichage dans l'entente. */
  order: number
}
```

### Interdits
- Ne pas ajouter de champ `totalFee` ou `professionalFees` sur `Matter`. Le total est **calculé**, jamais stocké (voir P0-5).
- Ne pas modifier les interfaces existantes.

### Vérification
```bash
npm run build
```

---

# P0-2 — Catalogue des modèles de service

**Fichier à créer** : `lib/data/serviceTemplates.ts`

Il doit couvrir les 7 programmes déjà définis dans `lib/data/programs.ts` (`prog-ee`, `prog-peq`, `prog-tr-visa`, `prog-super-visa`, `prog-lmia`, `prog-study`, `prog-sponsorship`), plus des services génériques.

**Minimum : 18 modèles.** Structure attendue :

```ts
import { ServiceTemplate } from "./types"

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "svc-consult",
    code: "CONSULT-INIT",
    labelFr: "Consultation initiale et évaluation d'admissibilité",
    labelEn: "Initial consultation and eligibility assessment",
    descriptionFr: "Entretien d'évaluation, analyse du profil et recommandation de programme.",
    descriptionEn: "Assessment interview, profile analysis and program recommendation.",
    programId: "generic",
    applicableRoles: ["principal", "sponsor", "employer"],
    feeRangeMin: 150,
    feeRangeMax: 400,
    feeSuggested: 250,
  },
  // ... 17 autres
]

export function getServiceTemplates(): ServiceTemplate[] {
  return SERVICE_TEMPLATES
}

export function getServiceTemplateById(id: string): ServiceTemplate | undefined {
  return SERVICE_TEMPLATES.find((t) => t.id === id)
}

/** Modèles pertinents pour un programme et un rôle donnés. */
export function getServiceTemplatesFor(
  programId: string,
  role: PartyRole
): ServiceTemplate[] {
  return SERVICE_TEMPLATES.filter(
    (t) =>
      (t.programId === programId || t.programId === "generic") &&
      t.applicableRoles.includes(role)
  )
}
```

### Modèles à créer (liste imposée)

| id | programId | rôles visés | objet |
|---|---|---|---|
| `svc-consult` | generic | principal, sponsor, employer | Consultation initiale |
| `svc-doc-review` | generic | principal | Revue et validation des pièces |
| `svc-forms-prep` | generic | principal, spouse, dependent | Préparation et dépôt des formulaires |
| `svc-followup` | generic | principal | Suivi du dossier jusqu'à décision |
| `svc-ee-profile` | prog-ee | principal | Création et optimisation du profil Entrée Express |
| `svc-ee-eapr` | prog-ee | principal | Demande de RP après ITA (eAPR) |
| `svc-ee-dependent` | prog-ee | spouse, dependent | Ajout d'une personne à charge au dossier |
| `svc-peq-csq` | prog-peq | principal | Demande de CSQ — volet PEQ |
| `svc-peq-pr` | prog-peq | principal | Demande de RP fédérale après CSQ |
| `svc-lmia-application` | prog-lmia | employer | Préparation et dépôt de l'EIMT |
| `svc-lmia-recruitment` | prog-lmia | employer | Accompagnement aux exigences de recrutement |
| `svc-wp-application` | prog-lmia | principal | Demande de permis de travail |
| `svc-study-caq` | prog-study | principal | Demande de CAQ pour études |
| `svc-study-permit` | prog-study | principal | Demande de permis d'études |
| `svc-sponsor-app` | prog-sponsorship | sponsor | Demande de parrainage (répondant) |
| `svc-sponsor-pr` | prog-sponsorship | principal | Demande de RP du parrainé |
| `svc-trv` | prog-tr-visa | principal, spouse, dependent | Demande de visa de résident temporaire |
| `svc-supervisa` | prog-super-visa | principal | Demande de Super Visa |

**Fourchettes d'honoraires** : ce sont les honoraires **du cabinet**, pas des frais gouvernementaux. Utilise des valeurs plausibles et cohérentes entre elles (consultation la moins chère, dossier de RP complet le plus cher). Elles seront ajustées par l'utilisateur.

⚠️ **Ne code aucun frais gouvernemental ici.** Le catalogue IRCC/ASFC/MIFI relève de la phase 1 et exige des montants sourcés officiellement.

### Vérification
```bash
npm run build
node -e "const {SERVICE_TEMPLATES}=require('./lib/data/serviceTemplates.ts')" 2>/dev/null || echo "ok (TS non exécutable directement)"
```

---

# P0-3 — Données de démonstration

**Fichiers à créer** : `lib/data/mock/parties.ts` et `lib/data/mock/serviceLines.ts`

Il faut peupler les **7 dossiers existants** de `lib/data/mock/matters.ts`.

### Contrainte de cohérence n°1 — le nom affiché

Pour chaque dossier, la personne de rôle `principal` (ou `employer` pour un dossier B2B) doit correspondre au `clientName` déjà présent dans `MOCK_MATTERS`. Aucun nom affiché ne doit changer dans l'interface.

### Contrainte de cohérence n°2 — les montants

**La somme des `professionalFee` des lignes d'un dossier doit être exactement égale au montant de la facture existante de ce dossier** dans `lib/data/mock/invoices.ts`. C'est la démonstration vivante du principe « le total concorde toujours avec le détail ».

Correspondances à respecter (lire `mock/invoices.ts` pour les valeurs exactes et s'y conformer) :

| Dossier | Client | Montant à atteindre |
|---|---|---|
| `#DOS-35698` | Les Industries Nordiques Inc. | montant de `#FAC-202601` |
| `#DOS-35697` | Dr. S. Rahman | montant de `#FAC-202602` |
| `#DOS-35696` | Santé Québec Express | montant de `#FAC-202603` |
| `#DOS-35695` | K. Tremblay | montant de `#FAC-202604` |

Pour les 3 dossiers sans facture (`#DOS-35694`, `#DOS-35693`, `#DOS-35692`), choisis des montants cohérents avec les fourchettes des modèles.

### ⚠️ Incohérences connues dans les données existantes

Le dossier **`#DOS-35695`** est décrit de trois façons contradictoires :

| Source | Client | Programme |
|---|---|---|
| `lib/data/mock/matters.ts` | `K. Tremblay` | `Parrainage Spousal` |
| `lib/data/mock/invoices.ts` (`#FAC-202604`) | `K. Tremblay` | *« PEQ Travailleur — Dépôt CSQ & Résidence Permanente »* |
| `topbar.tsx` / `dashboard-client.tsx` (index de recherche) | `M. A. Diarra` | `PEQ Québec` |

De plus, ce dossier porte `clientId: "c-4"`… non : `clientId: "c-1"`, qui correspond dans `mock/clients.ts` à **`M. A. Diarra`**, et non à `K. Tremblay`.

**Règle à appliquer** : `lib/data/mock/matters.ts` fait foi. Construis donc un **parrainage spousal** pour `#DOS-35695`, avec `K. Tremblay` comme répondant.
**Ne corrige pas** les autres sources dans cette phase — signale simplement l'écart dans le rapport final. La correction relève de la tâche T03 de `TACHES-GEMINI.md` (source de vérité unique).

### Composition des personnes (imposée)

Elle doit démontrer les cas multi-parties réels :

**`#DOS-35695` — K. Tremblay · Parrainage Spousal**
- `sponsor` : K. Tremblay (résident canadien, signataire, payeur)
- `principal` : le conjoint parrainé, résidant à l'étranger (signataire, non payeur)
→ services : `svc-sponsor-app` sur le répondant, `svc-sponsor-pr` + `svc-doc-review` sur le parrainé.

**`#DOS-35697` — Dr. S. Rahman · Résidence Permanente (EE)**
- `principal` : Dr. S. Rahman (signataire, payeur)
- `spouse` : son conjoint (signataire)
- `dependent` : un enfant de moins de 22 ans, avec `dateOfBirth` renseignée
→ services : `svc-ee-profile` + `svc-ee-eapr` sur le principal, `svc-ee-dependent` sur le conjoint et sur l'enfant.

**`#DOS-35698` — Les Industries Nordiques · EIMT**
- `employer` : Les Industries Nordiques Inc., avec `organizationName` (signataire, payeur)
- `principal` : le travailleur étranger recruté (signataire, **non** payeur)
→ services : `svc-lmia-application` + `svc-lmia-recruitment` sur l'employeur, `svc-wp-application` sur le travailleur.

**`#DOS-35694` — M. A. Dos Santos · Permis d'études**
- `principal` : M. A. Dos Santos (signataire)
- `payer` : un parent qui finance les études (signataire, payeur, **non** demandeur)
→ services : `svc-study-caq` + `svc-study-permit` sur le principal.
*Ce dossier démontre le cas du tiers payeur : le payeur signe l'entente mais ne reçoit aucun service.*

Les 3 autres dossiers (`#DOS-35696`, `#DOS-35693`, `#DOS-35692`) : au minimum une personne `principal` ou `employer` et 1 à 3 services.

### Règles de nommage
- `Party.id` : `party-<numéro de dossier sans #>-<n>`, ex. `party-DOS-35697-1`
- `ServiceLine.id` : `sl-<numéro de dossier sans #>-<n>`
- Toujours ajouter une personne de rôle `rcic` correspondant au champ `Matter.rcic` (`Me. A. Diarra` ou `Me. S. Lavoie`), avec `isSignatory: true`, `isPayer: false`, et **aucune ligne de service** (le consultant ne se facture pas lui-même).

⚠️ **Données ostensiblement fictives.** Pas de vrai numéro de passeport, pas d'adresse réelle. Les dates de naissance sont plausibles mais inventées.

### Vérification
```bash
npm run build
```
Test de cohérence (à écrire en P0-9, à vérifier mentalement ici) : pour chacun des 4 dossiers facturés, `Σ professionalFee === montant de la facture`.

---

# P0-4 — Requêtes

**Fichier** : `lib/data/queries.ts`

Suivre **exactement** le modèle des stores existants du fichier (déclaration du store, fonctions `async`, exposition dans `_getStores()`).

```ts
import { Party, ServiceLine } from "./types"
import { MOCK_PARTIES } from "./mock/parties"
import { MOCK_SERVICE_LINES } from "./mock/serviceLines"

let partiesStore: Party[] = [...MOCK_PARTIES]
let serviceLinesStore: ServiceLine[] = [...MOCK_SERVICE_LINES]

// PARTIES
export async function getPartiesByMatterId(matterId: string): Promise<Party[]> { /* … */ }
export async function getPartyById(id: string): Promise<Party | undefined> { /* … */ }
export async function getPrincipalParty(matterId: string): Promise<Party | undefined> { /* … */ }

// SERVICE LINES
export async function getServiceLinesByMatterId(matterId: string): Promise<ServiceLine[]> { /* … */ }
export async function getServiceLinesByPartyId(partyId: string): Promise<ServiceLine[]> { /* … */ }
```

### Point d'attention : normalisation du `#`

Les identifiants de dossier existent sous les formes `#DOS-35697`, `DOS-35697` et encodée URL. `getMatterById` (ligne 22) et `getInvoicesByMatterId` (ligne 45) gèrent déjà ce cas. **Réutilise strictement la même logique** pour `getPartiesByMatterId` et `getServiceLinesByMatterId`, sinon la page de détail d'un dossier n'affichera aucune personne.

Extraire cette normalisation dans une fonction locale partagée du fichier :
```ts
function normalizeMatterId(id: string): string {
  return decodeURIComponent(id).replace("#", "")
}
```
et l'utiliser dans les nouvelles fonctions. **Ne refactore pas** les fonctions existantes dans cette phase.

`getPrincipalParty` : retourne la personne de rôle `principal`, ou à défaut celle de rôle `employer`.

Ajouter les deux nouveaux stores et leurs setters dans `_getStores()` (ligne 86), en suivant la forme des autres.

### `lib/data/index.ts`
Ajouter :
```ts
export * from "./serviceTemplates"
```

### Vérification
```bash
npm run build
grep -n "partiesStore\|serviceLinesStore" lib/data/queries.ts   # présents, y compris dans _getStores
```

---

# P0-5 — Actions et **règle de calcul**

**Fichier** : `lib/data/actions.ts` (fichier `"use server"`)

```ts
export async function createParty(data: Omit<Party, "id"> & { id?: string }): Promise<Party>
export async function updateParty(id: string, patch: Partial<Omit<Party, "id" | "matterId">>): Promise<Party | undefined>
export async function deleteParty(id: string): Promise<boolean>
export async function createServiceLine(data: Omit<ServiceLine, "id"> & { id?: string }): Promise<ServiceLine>
export async function updateServiceLine(id: string, patch: Partial<Omit<ServiceLine, "id" | "matterId" | "partyId">>): Promise<ServiceLine | undefined>
export async function deleteServiceLine(id: string): Promise<boolean>
```

Suivre le style des actions existantes (`createMatter` ligne 7, `updateMatterStatus` ligne 18) : lecture via `_getStores()`, remplacement immuable du tableau, retour de l'entité.

### Règle métier n°1 — suppression en cascade
`deleteParty` doit **aussi supprimer toutes les `ServiceLine` dont `partyId` correspond**. Une ligne de service orpheline est un état invalide.

### Règle métier n°2 — la personne `rcic` n'est pas supprimable
`deleteParty` retourne `false` sans rien modifier si la personne a le rôle `rcic`.

### Règle métier n°3 — LA RÈGLE D'OR

**Fichier à créer** : `lib/data/fees.ts`

```ts
import { ServiceLine, Party } from "./types"

/**
 * Honoraires professionnels d'un dossier.
 *
 * RÈGLE STRUCTURELLE : les honoraires sont TOUJOURS calculés comme la somme
 * des lignes de service. Ils ne doivent JAMAIS être un champ de saisie,
 * ni être stockés sur Matter ou sur une entente.
 *
 * Cette règle garantit que le total présenté au client concorde toujours
 * avec le détail qui figure en dessous — exigence de ventilation des
 * honoraires du Retainer Agreement Regulation (CICC).
 */
export function computeProfessionalFees(lines: ServiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.professionalFee, 0)
}

/** Ventilation par personne, pour l'affichage de l'entente. */
export function computeFeesByParty(
  lines: ServiceLine[],
  parties: Party[]
): { party: Party; lines: ServiceLine[]; subtotal: number }[] {
  return parties
    .map((party) => {
      const partyLines = lines
        .filter((l) => l.partyId === party.id)
        .sort((a, b) => a.order - b.order)
      return {
        party,
        lines: partyLines,
        subtotal: computeProfessionalFees(partyLines),
      }
    })
    .filter((group) => group.lines.length > 0)
}
```

### Interdits
- **Ne crée aucun champ de saisie du total des honoraires**, nulle part, dans aucune interface.
- Ne stocke pas le total en base ni dans un état React persistant : il se recalcule à chaque rendu.

### Vérification
```bash
npm run build
grep -rn "totalFee\|totalHonoraires\|professionalFees:" lib/data app   # aucun champ stocké
```

---

# P0-6 — Traductions

Ajouter un namespace `Parties` dans **`messages/fr.json` ET `messages/en.json`** (mêmes clés des deux côtés, cf. règle T04 de `TACHES-GEMINI.md`).

```json
"Parties": {
  "sectionTitle": "Personnes & Services du dossier",
  "sectionSubtitle": "Chaque personne porte ses propres services. Les honoraires professionnels sont la somme des services facturés.",
  "addParty": "Ajouter une personne",
  "addService": "Ajouter un service",
  "removeParty": "Retirer la personne",
  "removeService": "Retirer le service",
  "subtotalForParty": "Sous-total pour cette personne",
  "totalProfessionalFees": "Total des honoraires professionnels",
  "totalNote": "Calculé automatiquement · hors taxes et hors débours gouvernementaux",
  "noServices": "Aucun service facturé à cette personne",
  "signatory": "Signataire",
  "payer": "Payeur",
  "feeRangeHint": "Fourchette habituelle pour ce modèle : {min} $ – {max} $",
  "fromTemplate": "Modèle : {template}",
  "roles": {
    "principal": "Demandeur principal",
    "spouse": "Conjoint",
    "dependent": "Personne à charge",
    "sponsor": "Répondant",
    "employer": "Employeur",
    "payer": "Tiers payeur",
    "rcic": "Consultant réglementé (RCIC)",
    "cocounsel": "Co-conseil"
  }
}
```

Version anglaise — vocabulaire imposé (cohérent avec le glossaire de `TACHES-GEMINI.md`) :

```json
"Parties": {
  "sectionTitle": "People & Services on this matter",
  "sectionSubtitle": "Each person carries their own services. Professional fees are the sum of all billed services.",
  "addParty": "Add a person",
  "addService": "Add a service",
  "removeParty": "Remove person",
  "removeService": "Remove service",
  "subtotalForParty": "Subtotal for this person",
  "totalProfessionalFees": "Total professional fees",
  "totalNote": "Automatically calculated · before taxes and government disbursements",
  "noServices": "No services billed to this person",
  "signatory": "Signatory",
  "payer": "Payer",
  "feeRangeHint": "Usual range for this template: ${min} – ${max}",
  "fromTemplate": "Template: {template}",
  "roles": {
    "principal": "Principal applicant",
    "spouse": "Spouse",
    "dependent": "Dependant",
    "sponsor": "Sponsor",
    "employer": "Employer",
    "payer": "Third-party payer",
    "rcic": "Regulated consultant (RCIC)",
    "cocounsel": "Co-counsel"
  }
}
```

### Vérification
Le contrôle de parité des clés de `TACHES-GEMINI.md` (tâche T04) doit passer.

---

# P0-7 — Interface : carte « Personnes & Services »

**Fichiers** :
- créer `app/[locale]/(app)/matters/[id]/parties-services-card.tsx` (composant client)
- modifier `app/[locale]/(app)/matters/[id]/page.tsx`

### Emplacement
Dans `page.tsx`, colonne de gauche, **entre le composant `<DirectActionsTabs>` (ligne ~211) et la section « Checklist des pièces requises » (ligne ~217)**.

Charger les données dans le composant serveur :
```ts
const parties = await getPartiesByMatterId(matter.id)
const serviceLines = await getServiceLinesByMatterId(matter.id)
```
puis passer `parties`, `serviceLines` et `getServiceTemplates()` en props.

### Contenu attendu

Un `<Card>` (primitive existante `components/ui/card.tsx`) contenant :

1. **En-tête** : titre `t("sectionTitle")`, sous-titre `t("sectionSubtitle")`, et à droite le **total des honoraires** issu de `computeProfessionalFees()`, en gras, avec la mention `t("totalNote")` en dessous.

2. **Un bloc par personne**, obtenu via `computeFeesByParty()`, plus les personnes sans service (affichées avec `t("noServices")`) :
   - ligne d'identité : initiales dans une pastille, `firstName lastName` (ou `organizationName` si rôle `employer`), badge du rôle traduit via `t("roles." + party.role)` ;
   - badges `t("signatory")` et `t("payer")` si les booléens correspondants sont vrais ;
   - liste des lignes de service : libellé selon la locale (`labelFr` / `labelEn`), mention `t("fromTemplate", { template })` en petit, montant à droite ;
   - sous-total de la personne : `t("subtotalForParty")`.

3. **Pied** : total général, identique à celui de l'en-tête. **Il doit être visiblement égal à la somme des sous-totaux affichés** — c'est la démonstration du principe.

4. **Boutons** `t("addService")` par personne et `t("addParty")` en bas. En phase 0, ils ouvrent un formulaire local qui appelle les Server Actions de P0-5. Le sélecteur d'honoraires propose `feeSuggested` du modèle par défaut et affiche `t("feeRangeHint", { min, max })`.

### Règles de style (cf. tâche T06 de `TACHES-GEMINI.md`)
- Tokens sémantiques uniquement : `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`. **Aucun `blue-600`, `slate-900`, etc.**
- Boutons via `<Button>` de `components/ui/button.tsx`.
- Aucune valeur arbitraire type `w-[42px]`.
- Aucune chaîne en dur : tout passe par `useTranslations("Parties")`.
- Montants formatés en `fr-CA` / `en-CA` avec `Intl.NumberFormat(locale, { style: "currency", currency: "CAD" })`.

### Accessibilité
- Les boutons d'icône seule portent un `aria-label` traduit.
- La ventilation est une liste de définitions (`<dl>`/`<dt>`/`<dd>`) ou un tableau avec `<th scope="col">`, pas une pile de `<div>`.

### Vérification
```bash
npm run build
```
Sur `http://localhost:3000/fr/matters/DOS-35697` :
- 4 personnes affichées (principal, conjoint, enfant, RCIC) ;
- le RCIC apparaît sans service ;
- le total en en-tête = somme des sous-totaux = montant de la facture `#FAC-202602`.

Sur `http://localhost:3000/fr/matters/DOS-35694` : le tiers payeur apparaît avec le badge « Payeur » et aucun service.

Sur `http://localhost:3000/en/matters/DOS-35697` : **tout est en anglais**, y compris les rôles et les libellés de service.

---

# P0-8 — Migration Supabase (rédigée, **non appliquée**)

**Fichier à créer** : `supabase/migrations/0001_parties_services.sql`

> ⚠️ **Ne pas exécuter cette migration. Ne pas installer le client Supabase. Ne pas créer de projet.**
> Le fichier est versionné pour que le schéma soit décidé maintenant et appliqué lors de la phase d'authentification.

```sql
-- Phase 0 : personnes et services rattachés à un dossier
-- NON APPLIQUÉE — voir SPEC-PHASE0-PERSONNES-SERVICES.md

create type party_role as enum (
  'principal','spouse','dependent','sponsor','employer','payer','rcic','cocounsel'
);

create table parties (
  id                        uuid primary key default gen_random_uuid(),
  cabinet_id                uuid not null references cabinets(id) on delete cascade,
  matter_id                 uuid not null references matters(id) on delete cascade,
  role                      party_role not null,
  first_name                text not null,
  last_name                 text not null,
  date_of_birth             date,
  citizenship               text,
  email                     text,
  phone                     text,
  organization_name         text,
  relationship_to_principal text,
  is_signatory              boolean not null default false,
  is_payer                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table service_lines (
  id               uuid primary key default gen_random_uuid(),
  cabinet_id       uuid not null references cabinets(id) on delete cascade,
  matter_id        uuid not null references matters(id) on delete cascade,
  party_id         uuid not null references parties(id) on delete cascade,
  template_id      text not null,
  label_fr         text not null,
  label_en         text not null,
  professional_fee numeric(10,2) not null check (professional_fee >= 0),
  fee_range_min    numeric(10,2),
  fee_range_max    numeric(10,2),
  "order"          integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index parties_matter_idx       on parties(matter_id);
create index service_lines_matter_idx on service_lines(matter_id);
create index service_lines_party_idx  on service_lines(party_id);

-- Un seul demandeur principal par dossier
create unique index parties_one_principal_per_matter
  on parties(matter_id) where role = 'principal';

-- Isolation multi-cabinet
alter table parties       enable row level security;
alter table service_lines enable row level security;

create policy parties_tenant_isolation on parties
  using (cabinet_id = (auth.jwt() ->> 'cabinet_id')::uuid);

create policy service_lines_tenant_isolation on service_lines
  using (cabinet_id = (auth.jwt() ->> 'cabinet_id')::uuid);
```

### Notes de conception à conserver dans le fichier (en commentaire SQL)
- `cabinet_id` est présent **sur chaque table**, y compris `service_lines` qui pourrait le déduire de `matter_id` : c'est une dénormalisation volontaire, indispensable pour que les politiques RLS soient évaluables sans jointure.
- **Aucune colonne ne stocke le total des honoraires.** Il est calculé par `sum(professional_fee)`. Si une vue est créée plus tard, elle sera en lecture seule.
- `on delete cascade` de `parties` vers `service_lines` reproduit la règle métier n°1 de P0-5.

### Vérification
```bash
test -f supabase/migrations/0001_parties_services.sql && echo "présent"
grep -rn "@supabase" package.json          # aucun résultat : rien n'a été installé
npm run build
```

---

# P0-9 — Tests

Prérequis : les scripts de test de la tâche T12 de `TACHES-GEMINI.md` doivent exister dans `package.json`.

**Fichier à créer** : `lib/data/fees.test.ts`

| Test | Assertion |
|---|---|
| Somme simple | `computeProfessionalFees` sur 3 lignes retourne bien leur somme |
| Liste vide | retourne `0`, pas `NaN` |
| Ventilation | `computeFeesByParty` regroupe correctement et **exclut** les personnes sans ligne |
| Ordre | les lignes d'une personne sont triées par `order` croissant |

**Fichier à créer** : `lib/data/parties.test.ts`

| Test | Assertion |
|---|---|
| Normalisation | `getPartiesByMatterId("DOS-35697")`, `("#DOS-35697")` et `(encodeURIComponent("#DOS-35697"))` retournent le **même** résultat |
| Principal | `getPrincipalParty` retourne le rôle `principal`, et bascule sur `employer` pour `#DOS-35698` |
| Cascade | `deleteParty` supprime les `ServiceLine` associées |
| RCIC protégé | `deleteParty` sur une personne de rôle `rcic` retourne `false` et ne modifie rien |

**Fichier à créer** : `lib/data/coherence.test.ts` — **le test le plus important**

```
Pour chaque dossier possédant une facture dans MOCK_INVOICES :
  computeProfessionalFees(lignes du dossier) === montant de la facture
```
Ce test garantit qu'aucune donnée de démonstration ne peut dériver et faire mentir le principe « le total concorde toujours avec le détail ».

### Vérification
```bash
npm test          # tous les tests passent
```

---

# Critères d'acceptation de la Phase 0

- [ ] `npm run build` réussit
- [ ] `npx eslint .` n'introduit **aucune** nouvelle erreur
- [ ] `npm test` passe, y compris `coherence.test.ts`
- [ ] Les 10 pages existantes affichent le même contenu qu'avant (seule la nouvelle carte s'ajoute)
- [ ] `Matter.clientName` n'a été ni supprimé, ni renommé, ni modifié
- [ ] Aucun champ de saisie du total des honoraires n'existe nulle part
- [ ] `/en/matters/DOS-35697` est intégralement en anglais
- [ ] `supabase/migrations/0001_parties_services.sql` existe et **n'a pas été appliqué**
- [ ] Aucune dépendance nouvelle dans `package.json`

# Rapport final attendu

1. Statut de chaque sous-tâche P0-1 à P0-9 (**fait / partiel / non fait** + raison).
2. Sortie de `npm run build`, `npx eslint . | tail -3`, `npm test`.
3. Pour les 4 dossiers facturés : le total calculé et le montant de la facture, côte à côte.
4. Liste des fichiers créés et modifiés.
5. Toute incohérence rencontrée dans les données existantes que tu n'as **pas** corrigée de ta propre initiative.
