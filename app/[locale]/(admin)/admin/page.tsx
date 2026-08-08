import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Building2, Users, AlertTriangle, Terminal, Lock, Ban } from "lucide-react"
import { getAdminFirms, getDemoRequests, summarise, type AdminMemberRow } from "@/lib/data/admin"
import { getCatalogue } from "@/lib/billing/catalogue"
import { getDemandesEnAttente } from "@/lib/data/seat-reads"
import { SeatRequests } from "./seat-requests"
import { CreerCabinet, ActionsCabinet } from "./firm-actions"
import { DemoRequests } from "./demo-requests"
import { FinancialHub } from "./financial-hub"

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

export default async function AdminPage() {
  const t = await getTranslations("Admin")
  const [firms, demandes, catalogue, demandesSieges] = await Promise.all([
    getAdminFirms(),
    getDemoRequests(),
    getCatalogue(),
    getDemandesEnAttente(),
  ])
  const stats = summarise(firms)

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

  const tiles = [
    { icon: Building2, label: t("statFirms"), value: stats.firmCount, warn: false },
    { icon: Users, label: t("statMembers"), value: stats.memberCount, warn: false },
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

      {/* Hub Financier & Métriques de Revenus Stripe */}
      <section>
        <h2 className="text-base font-black tracking-tight text-foreground mb-4">
          💳 Hub Financier SaaS & Performance Stripe
        </h2>
        <FinancialHub firms={firms} catalogue={catalogue} />
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
            const cab = firms.find((f) => f.id === d.firmId)
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
              placesOccupees: cab?.members.filter((m) => m.statut === "active").length ?? 0,
              placesMax: null,
            }
          })}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-tight text-foreground">
            {t("firmsHeading")}
          </h2>
          <CreerCabinet labels={etiquettes} />
        </div>

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
                          accessOpen={f.accessOpen}
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
