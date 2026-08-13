import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Building2, Users, AlertTriangle, Terminal, Lock, Ban, CreditCard, Clock } from "lucide-react"
import {
  getAdminFirms, getDemoRequests, getStatistiquesPlateforme, getTousLesAbonnements,
  type AdminMemberRow,
} from "@/lib/data/admin"
import { getCatalogue } from "@/lib/billing/catalogue"
import { getDemandesEnAttente } from "@/lib/data/seat-reads"
import { SeatRequests } from "./seat-requests"
import { CreerCabinet, ActionsCabinet } from "./firm-actions"
import { DemoRequests } from "./demo-requests"
import { FinancialHub } from "./financial-hub"
import { cn } from "@/lib/utils"
import { siteUrl } from "@/lib/site-url"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin")
  return {
    title: t("title"),
    description: t("subtitle"),
    robots: { index: false, follow: false },
  }
}

/** Libellé traduit d'un rôle, sans jamais afficher l'identifiant brut. */
function roleLabel(t: (k: string) => string, role: string): string {
  const map: Record<string, string> = {
    owner: "roleOwner",
    rcic: "roleRcic",
    risia: "roleRisia",
    staff: "roleStaff",
    bookkeeper: "roleBookkeeper",
    readonly: "roleReadonly",
  }
  return map[role] ? t(map[role]) : role
}

function MemberList({
  members,
  t,
}: {
  members: AdminMemberRow[]
  t: (k: string) => string
}) {
  if (members.length === 0) {
    return <span className="text-xs italic text-muted-foreground">{t("noMembers")}</span>
  }
  return (
    <ul className="space-y-1">
      {members.map((m) => (
        <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs font-bold text-foreground">{m.fullName || m.email}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {roleLabel(t, m.ciccRole)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const t = await getTranslations("Admin")
  const params = await searchParams
  const recherche = (params.q ?? "").trim()
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const [pageCabinets, demandes, catalogue, demandesSieges, stats, abonnements] =
    await Promise.all([
      getAdminFirms({ recherche, page }),
      getDemoRequests(),
      getCatalogue(),
      getDemandesEnAttente(),
      // Les totaux portent sur la PLATEFORME, pas sur la page affichée.
      getStatistiquesPlateforme(),
      // Le bloc financier additionne des abonnements : lui servir une page
      // ferait un chiffre d'affaires qui change quand on tourne les pages.
      getTousLesAbonnements(),
    ])

  const firms = pageCabinets.lignes
  const pages = Math.max(1, Math.ceil(pageCabinets.total / pageCabinets.parPage))

  // LE PLAFOND DE PLACES DES CABINETS QUI EN DEMANDENT.
  //
  // Il était passé à `null`, donc affiché « ∞ » — au moment précis où
  // l'exploitant décide d'accorder des places, l'écran lui disait qu'il n'y
  // avait aucune limite. La question à laquelle il doit répondre est « combien
  // en ont-ils déjà, sur combien », et l'écran effaçait le dénominateur.
  //
  // Seulement pour les cabinets qui ont une demande en attente : elles se
  // comptent sur les doigts d'une main, et interroger les quatre-vingts autres
  // pour rien serait le N+1 qu'on veut éviter ailleurs.
  // Les places OCCUPÉES viennent aussi de la base : `firm_seats_taken()`
  // compte les invitations encore vivantes en plus des membres actifs, comme
  // le fait le déclencheur qui refuse la place de trop. Les compter autrement
  // ici donnerait un numérateur qui ne correspond pas au refus.
  const { getSessionSupabase } = await import("@/lib/supabase/session")
  const sb = await getSessionSupabase()
  const cabinetsQuiDemandent = [...new Set(demandesSieges.map((d) => d.firmId))]
  const places = new Map(
    await Promise.all(
      cabinetsQuiDemandent.map(async (id) => {
        const [{ data: max }, { data: prises }] = await Promise.all([
          sb.rpc("firm_seat_limit", { f_id: id }),
          sb.rpc("firm_seats_taken", { f_id: id }),
        ])
        return [id, {
          max: max === null || max === undefined ? null : Number(max),
          prises: Number(prises ?? 0),
        }] as const
      })
    )
  )

  // Les noms de cabinets pour les demandes de places : ils viennent de la
  // lecture d'ENSEMBLE, pas de la page affichée. Sans cela, une demande
  // émanant d'un cabinet de la deuxième page s'intitulerait « Cabinet
  // inconnu » — précisément quand l'exploitant doit décider s'il l'accorde.
  const nomDe = new Map(abonnements.map((a) => [a.id, { name: a.name, plan: a.plan }]))

  // Les libellés traversent la frontière serveur/client : un composant
  // client ne peut pas appeler getTranslations lui-même.
  const etiquettes = Object.fromEntries(
    ["newFirm","firmName","license","consultant","email","emailHint","plan","trialDays",
     "cancel","create","saving","apply","suspend","activate",
     "linkOnce","copy","copied"].map(k => [k, t(k)])
  )
  const etiquettesDemandes = Object.fromEntries(
    ["requestsHeading","requestsEmpty","openAccess","dismiss","done"].map(k => [k, t(k)])
  )

  // CES CHIFFRES PORTENT SUR LA PLATEFORME ENTIÈRE, pas sur la page affichée.
  // Ils étaient tirés de la liste ; depuis qu'elle est paginée, ils auraient
  // annoncé « 25 organisations » quel qu'en soit le nombre réel, et « 0 fermé »
  // dès que les cabinets fermés seraient tombés en deuxième page.
  //
  // Rien ici ne compte de signatures ni de documents : un exploitant n'a pas
  // accès à ces tables, et les lui ouvrir pour alimenter une tuile
  // contredirait le cloisonnement que cette console affiche par ailleurs.
  const tiles = [
    { icon: Building2, label: t("statFirms"), value: stats.firmCount, warn: false },
    { icon: Users, label: t("statMembers"), value: stats.memberCount, warn: false },
    { icon: CreditCard, label: "Abonnements actifs", value: stats.abonnesActifs, warn: false },
    { icon: Clock, label: "En essai", value: stats.essais, warn: false },
    {
      icon: AlertTriangle,
      label: t("statNoOwner"),
      value: stats.firmsWithoutOwner,
      warn: stats.firmsWithoutOwner > 0,
    },
    {
      icon: Ban,
      label: t("statClosed"),
      value: stats.firmsClosed,
      warn: stats.firmsClosed > 0,
    },
  ]

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Le périmètre est énoncé à l'écran, pas seulement dans le code : un
          administrateur doit savoir ce qu'il ne peut pas voir, et pourquoi. */}
      <section className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-xs font-black text-foreground">{t("boundaryTitle")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("boundaryBody")}</p>
        </div>
      </section>

      {/* LES CHIFFRES DE LA PLATEFORME.
          Cette grille était CALCULÉE et jamais rendue : `tiles` existait dans
          le fichier sans qu'aucun JSX ne l'affiche. La console d'exploitation
          s'ouvrait donc sur le hub financier, sans qu'on sache combien de
          cabinets ni de membres elle administrait. */}
      <section>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tuile) => (
            <li
              key={tuile.label}
              className={cn(
                "rounded-2xl border p-4",
                tuile.warn ? "border-warning/40 bg-warning/10" : "border-border bg-card"
              )}
            >
              <tuile.icon
                aria-hidden
                className={cn(
                  "h-4 w-4",
                  tuile.warn ? "text-warning-strong" : "text-muted-foreground"
                )}
              />
              <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
                {tuile.value}
              </p>
              <p className="text-[11px] font-bold leading-tight text-muted-foreground">
                {tuile.label}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Hub Financier & Métriques de Revenus Stripe */}
      <section>
        <h2 className="text-base font-black tracking-tight text-foreground mb-4">
          💳 Hub Financier SaaS & Performance Stripe
        </h2>
        <FinancialHub firms={abonnements} catalogue={catalogue} origine={siteUrl()} />
      </section>

      {/* Les demandes viennent avant la liste des cabinets : c'est ce qui
          attend une décision, et le reste est de la consultation. */}
      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-base font-black tracking-tight text-foreground">
          {t("requestsHeading")}
          {demandes.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-black tabular-nums text-primary-foreground">
              {demandes.length}
            </span>
          )}
        </h2>
        <DemoRequests
          requests={demandes}
          labels={{ ...etiquettesDemandes, empty: etiquettesDemandes.requestsEmpty }}
          firmLabels={etiquettes}
        />
      </section>

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-base font-black tracking-tight text-foreground">
          Demandes de places
          {demandesSieges.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-black tabular-nums text-primary-foreground">
              {demandesSieges.length}
            </span>
          )}
        </h2>
        <SeatRequests
          demandes={demandesSieges.map((d) => {
            const cab = nomDe.get(d.firmId)
            const p = places.get(d.firmId)
            return {
              id: d.id,
              firmName: cab?.name ?? "Cabinet inconnu",
              plan: cab?.plan ?? "",
              demandeur: d.demandeur,
              seats: d.seats,
              roleHint: d.roleHint,
              justification: d.justification,
              statut: d.statut,
              creeLe: d.creeLe,
              placesOccupees: p?.prises ?? 0,
              placesMax: p?.max ?? null,
            }
          })}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-tight text-foreground">
            {t("firmsHeading")}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground">
              {pageCabinets.total}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/fr/admin/utilisateurs"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Users aria-hidden className="h-3.5 w-3.5" /> Utilisateurs
            </a>
            <CreerCabinet labels={etiquettes} />
          </div>
        </div>

        {/* RECHERCHE ET PAGINATION EN GET, sans JavaScript.
            Un formulaire qui écrit dans l'adresse rend chaque page partageable
            et retrouvable dans l'historique — ce qu'un filtre en mémoire ne
            permet pas. Le filtrage se fait en base : trier après avoir tout
            chargé ne pagine rien, le coût est déjà payé quand on jette les
            lignes. */}
        <form method="get" className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={recherche}
            placeholder="Nom, courriel ou numéro de permis…"
            aria-label="Rechercher un cabinet"
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <button
            type="submit"
            className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
          >
            Rechercher
          </button>
          {recherche && (
            <a
              href="/fr/admin"
              className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              Effacer
            </a>
          )}
        </form>

        {firms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            {t("noFirms")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-bold">{t("colFirm")}</th>
                  <th className="px-4 py-3 font-bold">{t("colLicense")}</th>
                  <th className="px-4 py-3 font-bold">{t("colPlan")}</th>
                  <th className="px-4 py-3 font-bold">{t("colContact")}</th>
                  <th className="px-4 py-3 font-bold">{t("colMembers")}</th>
                  <th className="px-4 py-3 font-bold whitespace-nowrap">{t("colCreated")}</th>
                  <th className="px-4 py-3 font-bold">{t("actionsCol")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {firms.map((f) => {
                  const orphan = !f.members.some((m) => m.ciccRole === "owner")
                  return (
                    <tr key={f.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-bold text-foreground">{f.name}</div>
                        {f.city && (
                          <div className="text-xs text-muted-foreground">{f.city}</div>
                        )}
                        {orphan && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-warning">
                            <AlertTriangle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                            {t("noOwnerWarning")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-foreground">
                        {f.rcicLicenseNumber}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs font-bold text-foreground">{f.plan}</div>
                        <div
                          className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            f.accessOpen
                              ? "bg-success/10 text-success"
                              : "bg-error/10 text-error"
                          }`}
                        >
                          {f.accessOpen ? t("accessOpen") : t("accessClosed")}
                        </div>
                        {f.trialEndsAt && (
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {t("trialUntil")} {f.trialEndsAt}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        <div>{f.ownerName}</div>
                        {f.email && <div className="font-mono">{f.email}</div>}
                        {f.phone && <div className="font-mono">{f.phone}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <MemberList members={f.members} t={t} />
                      </td>
                      <td className="px-4 py-4 font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {f.createdAt}
                      </td>
                      <td className="px-4 py-4">
                        <ActionsCabinet
                          firmId={f.id}
                          plan={f.plan}
                          statut={f.status}
                          labels={etiquettes}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav
            aria-label="Pages de cabinets"
            className="mt-3 flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} sur {pages} · {pageCabinets.total} cabinet
              {pageCabinets.total > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/fr/admin?${new URLSearchParams({ ...(recherche ? { q: recherche } : {}), page: String(page - 1) })}`}
                  className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  Précédente
                </a>
              )}
              {page < pages && (
                <a
                  href={`/fr/admin?${new URLSearchParams({ ...(recherche ? { q: recherche } : {}), page: String(page + 1) })}`}
                  className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                >
                  Suivante
                </a>
              )}
            </div>
          </nav>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-border p-4">
        <Terminal aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-xs font-black text-foreground">{t("scriptsHeading")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("scriptsBody")}</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">
{`node scripts/setup-accounts.mjs --apply
node scripts/grant-platform-admin.mjs --grant=<courriel>
node scripts/manage-subscription.mjs --firm=<permis> --plan=courtoisie
node scripts/manage-subscription.mjs --firm=<permis> --suspend
node scripts/verify-roles.mjs`}
          </pre>
        </div>
      </section>
    </div>
  )
}
