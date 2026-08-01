# Instructions d'exécution — projet `moncabinetcric`

> Document destiné à un agent de code automatisé.
> Exécute les tâches **dans l'ordre**, **une seule à la fois**, et **vérifie chaque tâche avant de passer à la suivante**.

---

## 0. Contexte du projet (à lire avant toute action)

**Produit** : SaaS de gestion de cabinet pour consultants réglementés en immigration canadienne (RCIC / CICC).

**Stack** :
- Next.js 16.2.12 (App Router, Turbopack) + React 19.2.4 + TypeScript
- Tailwind CSS v4 (configuration dans `app/globals.css`, pas de `tailwind.config.ts`)
- `next-intl` v4 pour le bilinguisme FR/EN
- `lucide-react` pour les icônes
- Gestionnaire de paquets : **pnpm** (mais `npm run <script>` fonctionne)

**Commandes** (Node local au projet — toujours exporter le PATH d'abord) :
```bash
export PATH="/Users/adamadiarra/Desktop/Antigravity/moncabinetcric/.local-node/bin:$PATH"
cd /Users/adamadiarra/Desktop/Antigravity/moncabinetcric

npm run build     # doit toujours réussir
npx eslint .      # ne doit jamais augmenter le nombre d'erreurs
npm run dev       # serveur sur http://localhost:3000
```

**Structure** :
```
app/[locale]/(marketing)/landing/   → site vitrine public
app/[locale]/(app)/                 → application du cabinet (dashboard, clients, matters,
                                       documents, pipeline, billing, calendar, settings)
app/[locale]/(portal)/              → portail client final
components/ui/                      → primitives (button, card, badge, input, signature-pad)
components/app-shell/               → sidebar, topbar, locale-switcher, theme-picker
lib/data/                           → couche d'accès aux données (types, queries, actions, mocks)
messages/fr.json, messages/en.json  → traductions
i18n/routing.ts                     → exporte Link, useRouter, usePathname localisés
```

**Conventions obligatoires du projet** (fichier `CLAUDE.md`) :
1. **Bilinguisme strict** : aucune chaîne visible en dur. Tout passe par `next-intl` et existe dans `fr.json` **et** `en.json`.
2. **Routage** : toutes les pages sous `app/[locale]/`.
3. **Server Components par défaut** : `"use client"` uniquement si état ou événements.
4. **Couche données unique** : `lib/data/` est la seule source de vérité.
5. **Style** : pas de valeurs magiques (`w-[42px]`), utiliser le design system et `components/ui/`.

---

## Règles d'exécution (impératives)

1. **Une tâche à la fois.** Après chaque tâche, lance `npm run build`. Si le build échoue, corrige avant de continuer.
2. **Ne jamais changer le comportement visuel** sauf si la tâche le demande explicitement.
3. **Ne pas toucher** à `node_modules/`, `.next/`, `.local-node/`, `pnpm-lock.yaml`.
4. **Ne pas reformater** des fichiers entiers. Faire des modifications ciblées.
5. **Ne pas inventer de contenu métier** (numéros de permis, formulaires IRCC, montants). Si une donnée manque, réutiliser celle déjà présente dans `lib/data/`.
6. **Ne pas installer de nouvelle dépendance** sans que la tâche le demande.
7. Si une instruction est ambiguë ou si le fichier ne correspond pas à la description : **arrête-toi et signale**, ne devine pas.
8. Le français du projet utilise `&apos;` pour les apostrophes dans le JSX. Respecte cette convention.

---

# TÂCHE T01 — Navigation mobile (BUG BLOQUANT)

**Problème** : en dessous de 1024 px de large, il n'existe aucune navigation. Le sidebar est masqué (`hidden lg:fixed` dans `components/app-shell/sidebar.tsx` ligne 27) et `components/app-shell/topbar.tsx` ne contient aucun bouton menu. L'utilisateur mobile ne peut plus changer de page.

**Objectif** : ajouter un menu latéral mobile (drawer) ouvert par un bouton hamburger visible uniquement sous `lg`.

### Étapes

**1. Extraire la liste de navigation dans un fichier partagé.**

Créer `components/app-shell/nav-items.ts` :

```ts
import { LayoutDashboard, Users, FolderOpen, Calendar, FileText, Settings, Building2, Files } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  labelKey: string
  href: string
  icon: LucideIcon
}

export const MAIN_NAV: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "calendar", href: "/calendar", icon: Calendar },
  { labelKey: "clients", href: "/clients", icon: Users },
  { labelKey: "matters", href: "/matters", icon: FolderOpen },
  { labelKey: "documents", href: "/documents", icon: Files },
  { labelKey: "pipeline", href: "/pipeline", icon: Building2 },
]

export const OTHER_NAV: NavItem[] = [
  { labelKey: "billing", href: "/billing", icon: FileText },
  { labelKey: "settings", href: "/settings", icon: Settings },
]
```

**2. Réécrire `components/app-shell/sidebar.tsx`** pour consommer `MAIN_NAV` / `OTHER_NAV` et traduire via `t(item.labelKey)`.
Les clés `dashboard`, `calendar`, `clients`, `matters`, `documents`, `pipeline`, `billing`, `settings` existent déjà dans `Navigation` de `messages/fr.json` et `messages/en.json`.
⚠️ Les deux entrées actuellement en dur — `"Agenda & Rencontres"` et `"Paramètres Cabinet"` — deviennent `t("calendar")` et `t("settings")`. Ne pas ajouter de nouvelle clé.
Le rendu desktop doit rester **strictement identique**.

**3. Créer `components/app-shell/mobile-nav.tsx`** :

```tsx
"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { MAIN_NAV, OTHER_NAV } from "./nav-items"

export function MobileNav() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Ferme le tiroir à chaque changement de page
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Ferme avec la touche Échap
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen])

  const renderGroup = (items: typeof MAIN_NAV, heading: string) => (
    <li>
      <div className="text-xs font-semibold leading-6 text-muted-foreground uppercase tracking-wider mb-2">
        {heading}
      </div>
      <ul role="list" className="-mx-2 space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                  "group flex gap-x-3 rounded-xl p-2 text-sm font-semibold leading-6 transition-colors"
                )}
              >
                <Icon
                  className={cn(
                    isActive ? "text-primary" : "text-muted-foreground",
                    "h-5 w-5 shrink-0"
                  )}
                  aria-hidden="true"
                />
                {t(item.labelKey)}
              </Link>
            </li>
          )
        })}
      </ul>
    </li>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={isOpen}
        className="lg:hidden -ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4 shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  C
                </div>
                moncabinetcric
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("closeMenu")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                {renderGroup(MAIN_NAV, t("main"))}
                {renderGroup(OTHER_NAV, t("other"))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
```

**4. Ajouter 3 clés** dans le bloc `Navigation` de `messages/fr.json` **et** `messages/en.json` :

| clé | fr.json | en.json |
|---|---|---|
| `menu` | `"Menu de navigation"` | `"Navigation menu"` |
| `openMenu` | `"Ouvrir le menu"` | `"Open menu"` |
| `closeMenu` | `"Fermer le menu"` | `"Close menu"` |

**5. Insérer `<MobileNav />` dans `components/app-shell/topbar.tsx`** : importer le composant, et le placer comme **tout premier enfant** du `<div className="flex flex-1 gap-x-4 ...">` (ligne 53), avant le bloc de recherche.

**6. Corriger la barre de recherche écrasée sur mobile** : dans `topbar.tsx` ligne 56, remplacer `className="relative flex flex-1 max-w-md items-center"` par `className="relative flex flex-1 min-w-0 max-w-md items-center"`.

### Vérification
```bash
npm run build                       # doit réussir
```
Puis avec le serveur dev lancé, ouvrir `http://localhost:3000/fr/dashboard` en largeur 390 px :
- un bouton hamburger est visible en haut à gauche ;
- il ouvre un tiroir contenant les 8 liens ;
- cliquer un lien navigue **et** ferme le tiroir ;
- Échap et le clic sur le fond ferment le tiroir ;
- en largeur ≥ 1024 px, le hamburger est invisible et le sidebar est inchangé.

---

# TÂCHE T02 — `middleware.ts` → `proxy.ts`

**Problème** : le build affiche `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`

### Étapes
1. Renommer `middleware.ts` en `proxy.ts` (même dossier, la racine du projet).
2. Ne rien changer au contenu.

### Vérification
```bash
npm run build       # l'avertissement "middleware is deprecated" a disparu
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/fr/dashboard   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/en/dashboard   # 200
```
⚠️ Si après renommage la redirection de locale ne fonctionne plus (`/` ne redirige plus vers `/fr`), **annule le renommage** et signale.

---

# TÂCHE T03 — Supprimer les jeux de données dupliqués

**Problème** : chaque composant client contient son propre jeu de données en dur, en doublon de `lib/data/`. Il existe donc deux sources de vérité contradictoires. C'est une violation de la règle n°4 du projet.

Emplacements exacts :

| Fichier | Constante | Ligne |
|---|---|---|
| `app/[locale]/(app)/clients/clients-client.tsx` | `INITIAL_CLIENTS` | 52 |
| `app/[locale]/(app)/billing/billing-client.tsx` | `INITIAL_INVOICES` | 44 |
| `app/[locale]/(app)/pipeline/pipeline-client.tsx` | `INITIAL_LEADS` | 69 |
| `app/[locale]/(app)/matters/matters-client.tsx` | `INITIAL_MATTERS` | 42 |
| `app/[locale]/(app)/documents/documents-client.tsx` | `INITIAL_DOCUMENTS` | 74 |
| `app/[locale]/(app)/calendar/calendar-client.tsx` | `MOCK_EVENTS` | 63 |
| `components/app-shell/topbar.tsx` | `GLOBAL_SEARCH_DB` | 20 |
| `app/[locale]/(app)/dashboard/dashboard-client.tsx` | `SEARCH_DATABASE` | 41 |

### T03-a — Les 5 composants déjà alimentés par props

Pour `clients`, `billing`, `pipeline`, `matters`, `documents` : le composant serveur `page.tsx` passe déjà les données via une prop (`initialClients`, `initialInvoices`, …), mais le composant client écrit `useState(initialX || INITIAL_X)` — le doublon sert de repli silencieux.

Pour chacun des 5 fichiers :
1. Rendre la prop **obligatoire** dans l'interface : supprimer le `?` (ex. `initialClients?: ClientRecord[]` → `initialClients: ClientRecord[]`).
2. Remplacer `useState(initialX || INITIAL_X)` par `useState(initialX)`.
3. **Supprimer entièrement** la constante `INITIAL_X`.
4. Corriger toute autre référence résiduelle. ⚠️ Cas connu : `billing-client.tsx` ligne 107 contient `useState<InvoiceRecord>(INITIAL_INVOICES[0])` → remplacer par `useState<InvoiceRecord | null>(null)` et gérer le cas `null` aux endroits où `selectedInvoice` est lu (rendu conditionnel, pas de `!`).
5. ⚠️ `billing-client.tsx` **redéfinit** l'interface `InvoiceRecord` (ligne 33) alors qu'elle existe déjà dans `lib/data/types.ts` ligne 34. Supprimer la définition locale et importer depuis `@/lib/data/types`. Si le champ `taxExempt` manque dans le type central, **l'ajouter à `lib/data/types.ts`** en optionnel (`taxExempt?: boolean`) plutôt que de garder deux types.

### T03-b — Calendrier

`app/[locale]/(app)/calendar/calendar-client.tsx` n'a aucune couche données et `app/[locale]/(app)/calendar/page.tsx` ne fait que `return <CalendarClient />`.

1. Créer `lib/data/types.ts` → ajouter l'interface `CalendarEvent` (copier telle quelle celle déclarée ligne 44 de `calendar-client.tsx`).
2. Créer `lib/data/mock/events.ts` exportant `export const MOCK_EVENTS: CalendarEvent[] = [...]` avec le contenu **inchangé** du tableau actuel.
3. Ajouter dans `lib/data/queries.ts` : `export async function getEvents(): Promise<CalendarEvent[]> { return eventsStore }` en suivant exactement le modèle des autres stores du fichier.
4. Ré-exporter depuis `lib/data/index.ts` comme les autres.
5. `page.tsx` : `const initialEvents = await getEvents()` puis `<CalendarClient initialEvents={initialEvents} />`.
6. `calendar-client.tsx` : accepter la prop, supprimer `MOCK_EVENTS` local et l'interface locale (importer depuis `@/lib/data/types`).

### T03-c — Recherche globale

`GLOBAL_SEARCH_DB` (topbar) et `SEARCH_DATABASE` (dashboard) sont **deux copies du même tableau de 6 entrées**.

1. Créer `lib/data/search.ts` avec l'interface `SearchItem` et `export const SEARCH_INDEX: SearchItem[] = [...]` (contenu inchangé).
2. Les deux composants importent `SEARCH_INDEX` et suppriment leur constante locale.

### Interdits
- Ne pas modifier les **valeurs** des données (noms, numéros de dossier, montants). Uniquement leur emplacement.
- Ne pas brancher de base de données. `lib/data/` reste en mémoire.

### Vérification
```bash
npm run build
grep -rn "INITIAL_CLIENTS\|INITIAL_INVOICES\|INITIAL_LEADS\|INITIAL_MATTERS\|INITIAL_DOCUMENTS\|MOCK_EVENTS\|GLOBAL_SEARCH_DB\|SEARCH_DATABASE" app components
# → ne doit renvoyer AUCUN résultat dans app/ et components/
```
Les 10 pages doivent afficher exactement le même contenu qu'avant.

---

# TÂCHE T04 — Extraire les 495 chaînes françaises en dur (i18n)

**Problème** : `messages/en.json` est complet (262 clés, aucune manquante) mais ~90 % de l'interface ne l'utilise pas. Sur `/en`, l'application affiche du français :

| page `/en` | nœuds de texte français |
|---|---|
| calendar | 61 |
| landing | 27 |
| matters | 26 |
| dashboard | 21 |
| pipeline | 19 |
| billing | 19 |
| portal | 14 |
| clients | 10 |
| documents | 10 |
| settings | 10 |

**Méthode obligatoire** : dans un composant `"use client"`, utiliser directement le hook — **ne pas** créer de nouvelles props `t`.

```tsx
import { useTranslations } from "next-intl"
// ...
const t = useTranslations("Calendar")
// puis : {t("headerTitle")}
```
Cela fonctionne car `app/[locale]/layout.tsx` fournit déjà toutes les traductions via `NextIntlClientProvider`.

### Procédure, fichier par fichier

Traite les fichiers **dans cet ordre**, un par commit / une vérification chacun :

1. `app/[locale]/(app)/calendar/calendar-client.tsx` (74 chaînes) → namespace `Calendar` (à créer)
2. `app/[locale]/(app)/billing/billing-client.tsx` (62) → namespace `Billing` (existe, à compléter)
3. `app/[locale]/(portal)/smart-intake-wizard.tsx` (55) → namespace `Intake` (à créer)
4. `app/[locale]/(marketing)/landing/landing-client.tsx` (46) → namespace `Landing` (existe, à compléter)
5. `app/[locale]/(app)/documents/documents-client.tsx` (34) → `Documents`
6. `app/[locale]/(app)/clients/clients-client.tsx` (33) → `Clients`
7. `app/[locale]/(app)/settings/settings-client.tsx` (32) → `Settings` (à créer)
8. `app/[locale]/(app)/matters/matters-client.tsx` (31) → `Matters`
9. `app/[locale]/(app)/pipeline/pipeline-client.tsx` (27) → `Pipeline`
10. `app/[locale]/(app)/matters/[id]/direct-actions-tabs.tsx` (20) → `MatterDetail`
11. `app/[locale]/(app)/dashboard/dashboard-client.tsx` (19) → `Dashboard`
12. `app/[locale]/(app)/matters/[id]/page.tsx` (12) → `MatterDetail`
13. `app/[locale]/(app)/matters/[id]/meeting-notes-card.tsx` (10) → `MatterDetail`
14. `components/ui/signature-pad.tsx` (6) → `Common` (à créer)
15. `app/[locale]/(portal)/virtual-meeting-card.tsx` (5) → `Portal`
16. `components/app-shell/theme-picker.tsx` (4) → `Navigation`
17. `app/[locale]/design-system/page.tsx` (4) → laisser tel quel, page interne de développement

Pour chaque fichier :
1. Repérer chaque chaîne visible par l'utilisateur (texte JSX, `placeholder`, `title`, `aria-label`, `alt`, libellés de tableaux et d'onglets).
2. Créer une clé descriptive en `camelCase` dans le bon namespace de **`messages/fr.json`** avec le texte français d'origine **à l'identique**.
3. Ajouter la **même clé** dans **`messages/en.json`** avec une traduction anglaise professionnelle. Vocabulaire à respecter :

| FR | EN |
|---|---|
| Dossier | Matter / File |
| Échéance butoir | Hard deadline |
| Fidéicommis | Trust account |
| Rapprochement | Reconciliation |
| Pièce (justificative) | Supporting document |
| Mandat | Retainer / Mandate |
| Entente de service | Service agreement |
| Prospect | Lead |
| Praticabilité | Feasibility |
| Téléverser | Upload |
| Conforme | Compliant |
| Consultant réglementé (RCIC) | Regulated consultant (RCIC) |
| Cabinet | Firm |

⚠️ Ne **jamais traduire** : `CICC`, `IRCC`, `MIFI`, `RCIC`, `EIMT`/`LMIA`, `CAQ`, `PEQ`, les codes `IMM 0008 / 5406 / 5476 / 5669 / 5257`, les identifiants `#DOS-xxxxx`, `#FAC-xxxxxx`, `AES-256`.

4. Remplacer la chaîne dans le JSX par `{t("cle")}`.
5. Les valeurs interpolées utilisent la syntaxe next-intl : `t("greeting", { name })` avec `"greeting": "Bienvenue, {name}"`.

### Interdits
- Ne pas modifier le texte français affiché (mêmes mots, même ponctuation, mêmes accents).
- Ne pas changer la mise en page ni les classes CSS.
- Ne pas laisser une clé présente dans un seul des deux fichiers de messages.

### Vérification (après chaque fichier)
```bash
npm run build

# Les deux fichiers de messages doivent avoir exactement les mêmes clés :
node -e "
const fr=require('./messages/fr.json'), en=require('./messages/en.json');
const f=o=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v).map(x=>k+'.'+x):[k]);
const a=f(fr), b=f(en);
console.log('fr:',a.length,'en:',b.length);
console.log('manquantes en EN:', a.filter(k=>!b.includes(k)));
console.log('manquantes en FR:', b.filter(k=>!a.includes(k)));
"
```

**Vérification finale de la tâche** (serveur dev lancé) :
```bash
for p in landing dashboard clients matters pipeline billing calendar documents settings portal; do
  n=$(curl -s http://localhost:3000/en/$p | grep -oE '>[^<]*[éèêàçûôîÉÈÀ][^<]*<' | wc -l | tr -d ' ')
  echo "$p: $n"
done
```
**Objectif : `0` pour chaque page** (hors sigles et noms propres). Ce compteur doit décroître à chaque fichier traité.

---

# TÂCHE T05 — En-tête de page unifié

**Problème** : chaque page de `(app)` a un en-tête au design différent (hero navy sur Dossiers, carte blanche sur Pipeline, bandeau dégradé sur Facturation/Documents/Paramètres, hero noir de 660 px sur Agenda). L'utilisateur perd ses repères à chaque navigation, et les hero décoratifs consomment la moitié de l'écran utile.

### Étapes

**1. Créer `components/app-shell/page-header.tsx`** :

```tsx
import * as React from "react"

interface PageHeaderStat {
  label: string
  value: string
  tone?: "default" | "success" | "warning"
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  stats?: PageHeaderStat[]
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, badge, stats, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {badge && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            {badge}
          </span>
        )}
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        {stats && stats.length > 0 && (
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </dt>
                <dd
                  className={
                    s.tone === "success"
                      ? "text-lg font-black text-success"
                      : s.tone === "warning"
                        ? "text-lg font-black text-warning"
                        : "text-lg font-black text-foreground"
                  }
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}
```

**2. Remplacer le bloc d'en-tête décoratif** en tête de chacune de ces pages par `<PageHeader ... />`, en réutilisant les textes et statistiques déjà affichés :

| Fichier | Bloc à remplacer |
|---|---|
| `app/[locale]/(app)/matters/matters-client.tsx` | hero navy « Portefeuille des Dossiers » + stats Actifs/Conformes/Alertes |
| `app/[locale]/(app)/calendar/calendar-client.tsx` | hero noir « Agenda & Rencontres Virtuelles » + 4 stats |
| `app/[locale]/(app)/pipeline/pipeline-client.tsx` | carte blanche « Pipeline de Prospection Commerciale » |
| `app/[locale]/(app)/billing/billing-client.tsx` | bandeau dégradé + titre « Facturation & Fidéicommis » |
| `app/[locale]/(app)/documents/documents-client.tsx` | bandeau dégradé + titre « Documents » |
| `app/[locale]/(app)/settings/settings-client.tsx` | bandeau dégradé « Profil Cabinet CRIC » |

**Conserver** : le bouton d'action principal (passé en `actions`), les libellés, les valeurs de statistiques. **Supprimer uniquement** le conteneur décoratif (dégradés, fonds sombres, halos `blur`).

**3. Ne pas toucher** à la landing ni au portail client : les traitements sombres et dégradés y sont volontaires.

### Vérification
```bash
npm run build
```
Visuellement : les 6 pages commencent toutes par le même bloc, hauteur ≈ 120 px, sur fond clair. Le contenu réel (tableaux, colonnes) apparaît nettement plus haut qu'avant. Aucune information affichée n'a disparu.

---

# TÂCHE T06 — Rétablir le design system (couleurs)

**Problème mesuré** :
```
Couleurs Tailwind brutes (slate-*, blue-*)     : 1036 occurrences
Tokens sémantiques (bg-card, text-foreground…) :  144
Valeurs magiques ([36px], [#2563eb])           :  166
<button> bruts                                 :  147
<Button> du design system                      :   23
```
**Conséquence concrète** : le sélecteur de thème (`components/app-shell/theme-picker.tsx`) propose 4 couleurs de cabinet (saphir, émeraude, ambre, violet) qui ne modifient que la variable `--primary`. Comme la quasi-totalité de l'interface est écrite `blue-600` en dur, **choisir « Émeraude » ne change presque rien à l'écran**. La personnalisation vendue au client est cassée par la façon dont le CSS est écrit.

**Périmètre** : uniquement `app/[locale]/(app)/**` et `components/**`.
**Exclus** : `app/[locale]/(marketing)/**` et `app/[locale]/(portal)/**` (identités visuelles distinctes assumées).

### Table de correspondance

| Avant | Après | Note |
|---|---|---|
| `bg-blue-600`, `bg-blue-700` | `bg-primary` | couleur de marque |
| `text-blue-600`, `text-blue-700` | `text-primary` | |
| `border-blue-500`, `border-blue-600` | `border-primary` | |
| `bg-blue-50`, `bg-blue-100` | `bg-primary/10` | |
| `text-slate-900`, `text-slate-800` | `text-foreground` | |
| `text-slate-500`, `text-slate-400` | `text-muted-foreground` | |
| `bg-white` (surface de carte) | `bg-card` | |
| `bg-slate-50`, `bg-slate-100` | `bg-muted` | |
| `border-slate-200`, `border-slate-100` | `border-border` | |
| `text-emerald-600` (statut) | `text-success` | |
| `text-amber-500/600` (statut) | `text-warning` | |
| `text-rose-600`, `text-red-600` (statut) | `text-error` | |

⚠️ **Ne pas convertir** les couleurs qui portent un **sens de statut dans un badge multicolore** (ex. la pastille verte « Conforme » à côté d'une pastille ambre « Alerte ») si le token correspondant n'existe pas — les tokens `success`, `warning`, `error` existent bien dans `app/globals.css`, utilise-les.
⚠️ Les dégradés multi-teintes décoratifs (`from-slate-900 via-indigo-950 to-blue-950`) peuvent rester en l'état pour cette tâche.

### Boutons
Remplacer les `<button>` bruts par `<Button>` de `components/ui/button.tsx` **uniquement** quand le bouton correspond à une variante existante (`default`, `outline`, `ghost`, `secondary`, `destructive`, `link`) et à une taille existante (`default`, `sm`, `lg`, `icon`). Les boutons très spécifiques (onglets de filtres avec état actif coloré) restent en `<button>` mais doivent recevoir `type="button"` s'il manque.

### Vérification
```bash
npm run build

# Le ratio doit s'inverser :
echo "brutes: $(grep -roE 'text-slate-[0-9]{3}|bg-slate-[0-9]{3}|bg-blue-[0-9]{3}|border-slate-[0-9]{3}' app/\[locale\]/\(app\) components | wc -l)"
echo "tokens: $(grep -roE 'bg-card|text-foreground|text-muted-foreground|bg-primary|border-border|text-primary' app/\[locale\]/\(app\) components | wc -l)"
```
**Test fonctionnel décisif** : ouvrir `/fr/dashboard`, cliquer « Thème » → « Émeraude ». La sidebar, les boutons principaux, les liens actifs et les icônes primaires doivent **tous** virer au vert. Si l'écran reste bleu, la tâche n'est pas terminée.

---

# TÂCHE T07 — Corrections de cohérence (rapides)

Chaque point est indépendant.

**a) Emojis dans les onglets de l'agenda**
`app/[locale]/(app)/calendar/calendar-client.tsx` : les onglets affichent `🏢 Jours ouvrés (Lun-Ven)`, `📅 Semaine (7J)`, `📆 Mois (31J)`, `⏱ Jour`.
→ Supprimer les emojis et utiliser les icônes `lucide-react` déjà importées dans le fichier (`CalendarDays`, `LayoutGrid`, `List`, `Clock`), au format `<Icon className="w-4 h-4" />` avant le libellé.
*Raison : registre inadapté à un outil réglementaire, et rendu inconsistant selon les OS.*

**b) Prix contradictoires sur la landing**
`messages/fr.json` → `Landing.pricing.basic.price` = `"99$"`, `priceAnnual` = `"79$"`, `business.price` = `"199$"`, `priceAnnual` = `"159$"`.
`app/[locale]/(marketing)/landing/landing-client.tsx` lignes 636 et 662 affichent en dur `isAnnual ? "69$" : "89$"` et `isAnnual ? "149$" : "189$"` — les valeurs traduites sont **ignorées**.
→ Faire afficher les valeurs issues des messages : `{isAnnual ? t.pricing.basic.priceAnnual : t.pricing.basic.price}`. Ajouter les clés manquantes (`price` mensuel / `priceAnnual`) dans les deux fichiers de messages si besoin, et exposer `price`/`priceAnnual` dans l'objet passé par `app/[locale]/(marketing)/landing/page.tsx`.
→ Extraire aussi le suffixe `/mois` et le libellé `Économisez 20%` (ligne 623) vers les messages.
⚠️ **Ne pas décider quel prix est le bon.** Utiliser les valeurs de `messages/fr.json` comme référence et signaler l'écart dans ton rapport final.

**c) Numéro de permis RCIC incohérent**
Trois valeurs différentes pour la même personne :
- `app/[locale]/(app)/dashboard/dashboard-client.tsx` ligne 100 → `#R708149`
- `app/[locale]/(portal)/smart-intake-wizard.tsx` ligne 541 → `R512345`
- `app/[locale]/(app)/settings/settings-client.tsx` → `R-514982`

→ Créer `lib/data/firm.ts` :
```ts
export const DEMO_FIRM = {
  name: "Cabinet Immigration Boréale Inc.",
  consultantName: "Adama Diarra",
  rcicNumber: "R-514982",
  email: "contact@immigrations-boreale.ca",
  phone: "+1 (514) 555-0100",
  address: "1000 Rue Sherbrooke Ouest, Bureau 1400, Montréal, QC H3A 3G4",
} as const
```
→ Les trois fichiers importent `DEMO_FIRM` et affichent `DEMO_FIRM.rcicNumber`. Valeur retenue : `R-514982` (celle des paramètres du cabinet).

**d) Lettre de logo incohérente**
`M` sur la landing, `C` dans l'app (`sidebar.tsx`), `P` dans le portail (`(portal)/layout.tsx`).
→ Uniformiser sur **`M`** (initiale de « moncabinetcric ») dans les trois emplacements. Le portail conserve son libellé « Portail Client » à côté du logo.

**e) Liens `<a>` vers des pages internes**
Erreurs ESLint `@next/next/no-html-link-for-pages` (les deux pointent vers `/calendar/`) :
- `app/[locale]/(app)/matters/[id]/direct-actions-tabs.tsx` ligne 247
- `app/[locale]/(app)/matters/matters-client.tsx` ligne 435
- (et tout autre `<a href="/...">` pointant vers une route interne)
→ Remplacer par `<Link>` importé de `@/i18n/routing` (**pas** `next/link` — la version localisée est requise).

### Vérification
```bash
npm run build
grep -rn "🏢\|📅\|📆\|⏱" app                       # aucun résultat
grep -rn "R708149\|R512345" app                    # aucun résultat
npx eslint . 2>&1 | grep "no-html-link-for-pages"  # aucun résultat
```

---

# TÂCHE T08 — Corriger les 17 erreurs ESLint

**État actuel** : `npx eslint .` → **17 erreurs, 172 avertissements**. Objectif de cette tâche : **0 erreur**. Les avertissements peuvent rester.

### Inventaire par fichier

| Fichier | Ligne:col | Règle |
|---|---|---|
| `app/[locale]/(app)/dashboard/dashboard-client.tsx` | 50:45 | `no-explicit-any` |
| `app/[locale]/(app)/dashboard/dashboard-client.tsx` | 152:52 | `no-explicit-any` |
| `app/[locale]/(app)/dashboard/dashboard-client.tsx` | 432:57 | `no-explicit-any` |
| `app/[locale]/(app)/matters/matters-client.tsx` | 275:64 | `no-explicit-any` |
| `app/[locale]/(app)/matters/matters-client.tsx` | 435:17 | `no-html-link-for-pages` (traité en T07-e) |
| `app/[locale]/(app)/matters/[id]/direct-actions-tabs.tsx` | 247:15 | `no-html-link-for-pages` (traité en T07-e) |
| `app/[locale]/(app)/matters/[id]/meeting-notes-card.tsx` | 154:67 | `no-explicit-any` |
| `app/[locale]/(app)/documents/documents-client.tsx` | 620:69 | `no-explicit-any` |
| `app/[locale]/(app)/settings/settings-client.tsx` | 345:75 | `no-explicit-any` |
| `app/[locale]/(portal)/smart-intake-wizard.tsx` | 234:55 | `no-explicit-any` |
| `app/[locale]/layout.tsx` | 37:43 | `no-explicit-any` |
| `components/app-shell/topbar.tsx` | 105:50 | `no-explicit-any` |
| `components/app-shell/theme-picker.tsx` | 17:7 | `react-hooks/set-state-in-effect` |
| `i18n/request.ts` | 7:54 | `no-explicit-any` |
| `lib/data/queries.ts` | 15:5 | `prefer-const` (`foldersStore`) |

> ESLint compte 17 erreurs car certaines sont rapportées deux fois par la configuration à plat ; il y a 15 emplacements distincts à corriger.

### Corrections attendues

**1. `router.push(x as any)`** (motif le plus fréquent, ex. `topbar.tsx:105`, `dashboard-client.tsx:152`) :
le `as any` annule le typage des routes de `next-intl`. Typer correctement la propriété `href` de `SearchItem` plutôt que de caster :
```ts
import type { ComponentProps } from "react"
import { Link } from "@/i18n/routing"
type AppHref = ComponentProps<typeof Link>["href"]
// puis dans l'interface : href: AppHref
```
et appeler `router.push(item.href)` sans cast.

**2. `DashboardClient({ t }: { t: any })`** (`dashboard-client.tsx:50`) : déclarer une interface explicite pour `t`, comme le font déjà les autres pages.

**3. `Badge variant={x as any}`** (`smart-intake-wizard.tsx:234`) : typer avec la variante du composant :
```ts
import type { ComponentProps } from "react"
type BadgeVariant = ComponentProps<typeof Badge>["variant"]
```

**4. `app/[locale]/layout.tsx:37`** : `routing.locales.includes(locale as any)` → typer `locale` comme `(typeof routing.locales)[number]` après une vérification, ou utiliser `routing.locales.some((l) => l === locale)`.

**5. `lib/data/queries.ts:15`** : `let foldersStore` → `const foldersStore` (jamais réassigné).

**6. `components/app-shell/theme-picker.tsx:17`** : `setState` appelé directement dans un `useEffect`, ce qui déclenche un rendu en cascade. Lire `localStorage` via l'initialiseur paresseux de `useState` **côté client uniquement**, ou séparer l'effet de lecture du thème de l'effet de gestion du clic extérieur (ce sont actuellement deux responsabilités dans un même `useEffect`, ce qui est aussi la cause du problème).

### Interdits
- Ne pas ajouter de `// eslint-disable` pour faire disparaître une erreur.
- Ne pas modifier `eslint.config.mjs` pour désactiver une règle.

### Vérification
```bash
npx eslint . 2>&1 | tail -3     # doit indiquer 0 error
npm run build
```

---

# TÂCHE T09 — SEO et métadonnées

**Problème** : aucun `generateMetadata`, aucun `openGraph`, aucun `alternates.hreflang`, pas de `sitemap.ts` ni `robots.ts`. Les 27 pages générées partagent le même `<title>` (`"moncabinetcric"`).
*Raison : sans `hreflang`, Google traite les versions FR et EN comme du contenu dupliqué — pénalisant pour un produit bilingue dont l'acquisition passe par la recherche organique.*

### Étapes

**1. Ajouter les métadonnées bilingues** dans `app/[locale]/layout.tsx`. Remplacer l'export statique `metadata` par :

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Meta" })

  return {
    metadataBase: new URL("https://moncabinetcric.ca"),
    title: { default: t("title"), template: `%s · moncabinetcric` },
    description: t("description"),
    alternates: {
      canonical: `/${locale}`,
      languages: { fr: "/fr", en: "/en" },
    },
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_CA" : "en_CA",
      siteName: "moncabinetcric",
      title: t("title"),
      description: t("description"),
    },
  }
}
```
(importer `getTranslations` depuis `next-intl/server`.)

**2. Créer le namespace `Meta`** dans les deux fichiers de messages :

```json
"Meta": {
  "title": "moncabinetcric — Logiciel de gestion pour cabinets d'immigration CICC",
  "description": "Plateforme de gestion de cabinet pour consultants réglementés en immigration canadienne : suivi des dossiers IRCC, échéances, portail client sécurisé et conformité CICC."
}
```
```json
"Meta": {
  "title": "moncabinetcric — Practice management software for CICC immigration firms",
  "description": "Practice management platform for Regulated Canadian Immigration Consultants: IRCC matter tracking, deadlines, secure client portal and CICC compliance."
}
```

**3. Créer `app/sitemap.ts`** (à la racine de `app/`, **pas** sous `[locale]`) listant, pour chaque locale (`fr`, `en`), les routes publiques : `/`, `/landing`, `/portal`. **Ne pas indexer** les routes de `(app)`.

**4. Créer `app/robots.ts`** : autoriser `/`, interdire `/fr/dashboard`, `/en/dashboard`, `/fr/clients`, `/en/clients`, `/fr/matters`, `/en/matters`, `/fr/billing`, `/en/billing`, `/fr/documents`, `/en/documents`, `/fr/pipeline`, `/en/pipeline`, `/fr/settings`, `/en/settings`, `/fr/calendar`, `/en/calendar`, `/fr/design-system`, `/en/design-system`. Référencer le sitemap.

**5. Nettoyer les métadonnées du projet** :
- `package.json` : `"name": "temp-app"` → `"moncabinetcric"`
- `README.md` : remplacer le contenu par défaut de `create-next-app` par une présentation réelle (objet du projet, prérequis, `npm run dev`, structure des dossiers, conventions renvoyant à `CLAUDE.md`).

### Vérification
```bash
npm run build
curl -s http://localhost:3000/sitemap.xml | head -20
curl -s http://localhost:3000/robots.txt
curl -s http://localhost:3000/en/landing | grep -o '<title>[^<]*</title>'   # titre EN
curl -s http://localhost:3000/fr/landing | grep -o 'hreflang="[^"]*"'       # fr et en présents
```

---

# TÂCHE T10 — Accessibilité

**Problème** : 21 attributs `aria`/`role` dans l'ensemble du projet. Les cartes de KPI sont des `<div onClick>` non atteignables au clavier. De nombreux textes en `text-[10px]` / `text-[11px]` gris clair passent sous le seuil de contraste WCAG AA.
*Raison : les utilisateurs finaux du portail sont des demandeurs d'immigration, souvent en langue seconde et sur petit écran ; l'accessibilité devient par ailleurs un critère d'appel d'offres institutionnel.*

### Étapes

**1. Éléments cliquables non sémantiques.**
Recenser :
```bash
grep -rn "div[^>]*onClick" app components
```
Pour chacun :
- si l'action est une **navigation** → remplacer le `<div>` par `<Link href="...">` de `@/i18n/routing` ;
- si l'action est un **traitement** → remplacer par `<button type="button">` ;
- ne jamais se contenter d'ajouter `tabIndex`.

Cas prioritaires : les 4 cartes de KPI de `dashboard-client.tsx` (lignes ~188, 213, 238, 263) et les lignes de tableau/liste cliquables (`dashboard-client.tsx` ~430, `matters-client.tsx`, `billing-client.tsx`).
⚠️ Conserver l'apparence exacte : ajouter `text-left w-full` sur les boutons pour neutraliser les styles par défaut.

**2. Tailles de texte.** Remplacer toute occurrence de `text-[10px]` par `text-[11px]`, et vérifier que le texte de couleur `text-slate-400` sur fond blanc est remonté à `text-muted-foreground` (`#64748B`) minimum. Ne pas descendre sous 11 px.

**3. Libellés manquants.** Tout bouton dont le contenu est uniquement une icône doit avoir un `aria-label` traduit. Rechercher :
```bash
grep -rn "size=\"icon\"\|<button" app components | grep -v "aria-label"
```

**4. Onglets.** Les groupes d'onglets (`matters`, `billing`, `documents`, `settings`, `calendar`, `pipeline`) doivent porter `role="tablist"` sur le conteneur et `role="tab"` + `aria-selected` sur chaque bouton — le motif est déjà correctement implémenté dans `landing-client.tsx` lignes 327-355, s'en inspirer.

**5. Tableaux.** `clients-client.tsx`, `documents-client.tsx` et `billing-client.tsx` utilisent de vrais `<table>` : vérifier que chaque `<th>` porte `scope="col"`.

### Vérification
```bash
npm run build
grep -rn "div[^>]*onClick" app components     # objectif : 0
grep -rn "text-\[10px\]" app components       # objectif : 0
```
Test clavier sur `/fr/dashboard` : la touche Tab doit atteindre successivement les 4 cartes de KPI, et Entrée doit déclencher la navigation. L'anneau de focus est déjà défini globalement (`app/globals.css` ligne 105).

---

# TÂCHE T11 — Réduire le JavaScript client

**Problème** : 1,2 Mo de JS dont un fragment de 227 Ko. Les 10 pages sont entièrement `"use client"` (jusqu'à 1394 lignes pour `calendar-client.tsx`), alors que la règle n°3 du projet impose « Server Components par défaut ». En-têtes, cartes statistiques statiques, tableaux en lecture seule et pieds de page n'ont aucun besoin d'être hydratés.

### Étapes
À traiter **après** T03 et T05, et **uniquement** pour ces deux fichiers dans un premier temps :
1. `app/[locale]/(app)/calendar/calendar-client.tsx` (1394 lignes)
2. `app/[locale]/(app)/billing/billing-client.tsx` (931 lignes)

Pour chacun :
- Identifier les sections **sans** `useState`, `onClick`, ni `useEffect`.
- Les extraire en composants **sans** `"use client"`, dans le même dossier (ex. `billing-summary.tsx`, `calendar-legend.tsx`).
- Les rendre depuis le `page.tsx` serveur, en les passant en `children` du composant client si l'imbrication l'exige.
- L'interactivité (filtres, glisser-déposer, modales) reste dans le composant client, réduit d'autant.

### Interdits
- Ne pas casser une fonctionnalité interactive existante pour gagner des kilo-octets.
- Ne pas transformer un composant en serveur s'il utilise `useTranslations` **et** un hook d'état : utiliser `getTranslations` côté serveur.

### Vérification
```bash
npm run build
du -sh .next/static/chunks       # doit diminuer par rapport à 1,2 Mo
```
Le calendrier et la facturation doivent rester **entièrement fonctionnels** : filtres, onglets, glisser-déposer, modales.

---

# TÂCHE T12 — Premiers tests automatisés

**Problème** : `vitest` et `@playwright/test` sont installés, **aucun test n'existe**. Aucun script de test dans `package.json`.
*Raison : le produit affiche « 99,8 % de conformité » et manipule des calculs de taxes, d'échéances et de fidéicommis ; une erreur y devient une faute professionnelle pour le consultant.*

### Étapes

**1. Ajouter les scripts** dans `package.json` :
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

**2. Créer `lib/data/queries.test.ts`** couvrant :
- `getMatterById` accepte `"DOS-35695"`, `"#DOS-35695"` et une valeur encodée URL, et renvoie le même dossier ;
- `getMatterById` renvoie `undefined` pour un identifiant inconnu ;
- `getInvoicesByMatterId` applique la même normalisation du `#` ;
- `getMattersByClientId` filtre correctement.

**3. Créer `lib/data/actions.test.ts`** couvrant :
- `createMatter` ajoute en tête de liste et génère un identifiant au format `#DOS-xxxxx` ;
- `updateMatterStatus` renvoie `undefined` sur un identifiant inconnu et ne modifie pas le magasin ;
- `moveLeadStage` déplace bien l'étape.

**4. Créer `messages/messages.test.ts`** : test de parité qui échoue si `fr.json` et `en.json` n'ont pas exactement le même ensemble de clés (à plat, récursif).
*C'est le test le plus utile du lot : il empêche la régression corrigée en T04.*

**5. Créer `e2e/navigation.spec.ts`** (Playwright) :
- en viewport 390 × 844, sur `/fr/dashboard` : le bouton menu est visible, l'ouvrir, cliquer « Clients », vérifier l'arrivée sur `/fr/clients` ;
- en viewport 1440 × 900 : le bouton menu est absent, le sidebar est visible.

⚠️ Playwright n'a pas de navigateur installé dans cet environnement. Si `npx playwright install` échoue, configurer `playwright.config.ts` avec `use: { channel: "chrome" }` et signaler la contrainte.

### Vérification
```bash
npm test          # tous les tests passent
```

---

# HORS PÉRIMÈTRE — à ne pas exécuter automatiquement

Ces chantiers ont été identifiés dans l'audit mais **ne doivent pas** être confiés à une exécution automatisée : ils engagent des décisions d'architecture, des identifiants secrets ou des affirmations à portée réglementaire.

| Chantier | Raison de l'exclusion |
|---|---|
| **Authentification Supabase + RLS multi-tenant** | Nécessite des identifiants, un choix de schéma et une politique d'isolation par cabinet. Actuellement `/dashboard`, `/clients`, `/billing` sont **publics et non protégés**. C'est le blocage n°1 du produit, mais il doit être conçu, pas généré. |
| **Génération réelle des formulaires IRCC** | Cœur de la valeur produit (les concurrents en couvrent 234 à 400). Exige les PDF officiels et une cartographie champ par champ. |
| **Journal d'audit infalsifiable** | Affirmé partout dans l'interface, implémenté nulle part. Le *Client File Management Regulation* du CICC en fixe le contenu obligatoire : à concevoir avec un juriste. |
| **Comptabilité en fidéicommis transactionnelle** | Actuellement de simples chiffres affichés. Domaine à risque réglementaire élevé. |
| **Signature électronique** | `components/ui/signature-pad.tsx` est un canevas décoratif : pas d'horodatage, pas de scellement du PDF. |
| **Retrait des allégations non étayées** | L'interface affiche « horodatage cryptographique infalsifiable », « SHA256: 8f9b…a19c », « Conformité 99,8 % », « AES-256 » sans implémentation. **Décision du propriétaire du produit** : soit implémenter, soit retirer. Ne pas laisser un agent trancher. |
| **Données de démonstration réalistes** | Numéros de passeport, dates de naissance et adresses vraisemblables dans un domaine soumis à la PIPEDA : à remplacer par des données ostensiblement fictives, sur décision produit. |

---

# Rapport final attendu

À la fin de l'exécution, produis un compte rendu contenant :
1. Pour chaque tâche T01 à T12 : **fait / partiel / non fait**, avec la raison en cas de blocage.
2. La sortie de `npm run build` (doit réussir).
3. La sortie de `npx eslint . | tail -3` (nombre d'erreurs et d'avertissements).
4. Le compteur de français résiduel sur `/en` pour les 10 pages (commande de T04).
5. La liste des fichiers créés, modifiés et supprimés.
6. Toute incohérence rencontrée que tu n'as **pas** corrigée de ta propre initiative (notamment l'écart de prix de T07-b).
