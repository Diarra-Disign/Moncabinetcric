"use client"

import * as React from "react"
import { useLocale } from "next-intl"
import { useRouter } from "@/i18n/routing"
import {
  Landmark, Plus, Eye, Lock, AlertTriangle, X, Trash2, CheckCircle2, Scale,
} from "lucide-react"
import type { RegistreFideicommis, RapprochementVue, EcartRapprochement } from "@/lib/data/trust"
import {
  enregistrerMouvementFideicommis, enregistrerRapprochement,
  cloreRapprochement, supprimerRapprochement,
} from "@/lib/data/trust-actions"
import { PageHeader } from "@/components/app-shell/page-header"
import { cn } from "@/lib/utils"

/**
 * Le registre du fidéicommis et son rapprochement.
 *
 * DEUX PARTIS PRIS qui gouvernent tout l'écran.
 *
 * 1. LE SOLDE PAR CLIENT EST AUSSI VISIBLE QUE LE TOTAL. Un total juste peut
 *    masquer un client débiteur compensé par un autre — la faute la plus grave
 *    en matière de fidéicommis. La base l'interdit par déclencheur ; l'écran
 *    doit quand même la rendre lisible, parce qu'une règle qu'on ne voit pas
 *    appliquée finit par ne plus être crue.
 *
 * 2. LE RAPPROCHEMENT NE S'ARRÊTE PAS TANT QUE L'ÉCART N'EST PAS EXPLIQUÉ.
 *    Le refus vient du serveur et dit combien il reste à justifier. Un état
 *    conservé avec un écart inexpliqué n'atteste rien.
 */

const TYPES: { valeur: string; libelle: string; aide: string; sens: -1 | 1 }[] = [
  { valeur: "deposit", libelle: "Dépôt du client", aide: "Fonds reçus et déposés en fidéicommis.", sens: 1 },
  { valeur: "withdrawal", libelle: "Débours payé", aide: "Frais gouvernementaux ou tiers payés pour le compte du client.", sens: -1 },
  { valeur: "transfer_to_business", libelle: "Virement d'honoraires", aide: "Honoraires gagnés, virés au compte de l'entreprise.", sens: -1 },
  { valeur: "refund_to_client", libelle: "Remboursement", aide: "Solde restitué au client.", sens: -1 },
]

const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.valeur, t.libelle]))

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export function FideicommisClient({
  registre, clients,
}: {
  registre: RegistreFideicommis
  clients: { id: string; nom: string; numero: string }[]
}) {
  const locale = useLocale()
  const routeur = useRouter()
  const [enCours, demarrer] = React.useTransition()
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  const [mouvement, setMouvement] = React.useState(false)
  const [rapprochement, setRapprochement] = React.useState<RapprochementVue | "nouveau" | null>(null)

  const argent = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" }).format(v),
    [locale]
  )

  const agir = (action: () => Promise<{ ok: boolean; message: string }>) =>
    demarrer(async () => {
      const r = await action()
      setResultat(r)
      if (r.ok) routeur.refresh()
    })

  const debiteurs = registre.parClient.filter((c) => c.solde < 0)

  return (
    <div className="flex flex-col gap-6 pb-16">
      {resultat && (
        <div
          role="status"
          className={cn(
            "rounded-2xl border p-4 text-xs font-bold",
            resultat.ok
              ? "border-success/30 bg-success/10 text-success-strong"
              : "border-error/30 bg-error/10 text-error-strong"
          )}
        >
          {resultat.message}
        </div>
      )}

      <PageHeader
        title="Compte en fidéicommis"
        subtitle="Registre des mouvements, solde par client et états de rapprochement conformes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMouvement(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Enregistrer un mouvement
            </button>
            <button
              type="button"
              onClick={() => setRapprochement("nouveau")}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              <Scale className="h-4 w-4" /> Rapprocher une période
            </button>
          </div>
        }
      />

      {/* L'alerte du §F25 : elle ne s'affiche que s'il y a quelque chose à
          rapprocher. Reprocher un retard à un cabinet sans mouvement en
          fidéicommis apprendrait à ignorer l'avertissement. */}
      {registre.suivi.enRetard && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-black text-warning-strong">
              {registre.suivi.dernierePeriode
                ? `Aucun rapprochement depuis ${registre.suivi.joursDepuis} jours.`
                : "Aucun rapprochement n'a jamais été arrêté."}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Le Collège attend un état mensuel. Arrêter la période prend quelques minutes si le registre est à jour.
            </p>
          </div>
        </div>
      )}

      {debiteurs.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-error/40 bg-error/10 p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-error-strong" />
          <p className="text-sm font-black text-error-strong">
            {debiteurs.length} client(s) au solde débiteur — les fonds d&apos;un autre client seraient employés.
          </p>
        </div>
      )}

      {/* ---- Le solde ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Solde en fidéicommis</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums text-foreground">
            <Landmark aria-hidden className="h-5 w-5 text-primary" />
            {argent(registre.soldeTotal)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cet argent appartient aux clients jusqu&apos;à ce que les honoraires soient gagnés.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Clients concernés</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{registre.parClient.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Dernier rapprochement</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
            {registre.suivi.dernierePeriode ?? "—"}
          </p>
        </div>
      </div>

      {/* ---- Ventilation par client ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">Solde par client</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          La ventilation qu&apos;une inspection demande en premier : un total juste peut masquer un solde débiteur.
        </p>
        {registre.parClient.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucun mouvement en fidéicommis pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {registre.parClient.map((c) => (
              <li key={c.clientId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">{c.clientNom}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.ecritures} écriture(s){c.dernierMouvement ? ` · dernier le ${c.dernierMouvement}` : ""}
                  </p>
                </div>
                <span className={cn(
                  "shrink-0 text-sm font-black tabular-nums",
                  c.solde < 0 ? "text-error-strong" : "text-foreground"
                )}>
                  {argent(c.solde)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Les rapprochements ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">États de rapprochement</h2>
        {registre.rapprochements.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucune période arrêtée. Le premier état se dresse à partir du solde de votre relevé bancaire.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {registre.rapprochements.map((r) => {
              const explique = r.ecarts.reduce((t, e) => t + e.montant, 0)
              const residuel = Math.round((r.soldeBancaire + explique - r.soldeRegistre) * 100) / 100
              return (
                <article key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
                        Période arrêtée au {r.periodeFin}
                        <span className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                          r.statut === "closed"
                            ? "bg-success/15 text-success-strong"
                            : "bg-warning/15 text-warning-strong"
                        )}>
                          {r.statut === "closed" ? "Arrêté" : "Brouillon"}
                        </span>
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Relevé {argent(r.soldeBancaire)} · registre {argent(r.soldeRegistre)} ·{" "}
                        <span className={residuel === 0 ? "text-success-strong font-bold" : "text-error-strong font-bold"}>
                          écart résiduel {argent(residuel)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <a
                      href={`/api/trust/${r.id}/statement?lang=${locale}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> Voir l&apos;état
                    </a>
                    {r.statut === "draft" && (
                      <>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => setRapprochement(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer disabled:opacity-40"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => agir(() => {
                            const fd = new FormData()
                            fd.set("id", r.id); fd.set("locale", locale)
                            return cloreRapprochement(fd)
                          })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-40"
                        >
                          <Lock className="h-3.5 w-3.5" /> Arrêter la période
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => agir(() => {
                            const fd = new FormData()
                            fd.set("id", r.id); fd.set("locale", locale)
                            return supprimerRapprochement(fd)
                          })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-error/10 hover:text-error-strong cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Supprimer
                        </button>
                      </>
                    )}
                    {r.statut === "closed" && (
                      <span className="inline-flex items-center gap-1.5 px-2 text-[11px] font-bold text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success-strong" />
                        Arrêté le {r.closLe?.slice(0, 10)} — figé
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Le registre ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">Registre des mouvements</h2>
        {registre.mouvements.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucune écriture. Un paiement encaissé en fidéicommis en produit une automatiquement.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">Date</th>
                  <th className="py-2 pr-3 font-bold">Client</th>
                  <th className="py-2 pr-3 font-bold">Mouvement</th>
                  <th className="py-2 pr-3 font-bold">Objet</th>
                  <th className="py-2 pl-3 text-right font-bold">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {registre.mouvements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-3 font-mono text-muted-foreground">{m.date}</td>
                    <td className="py-2.5 pr-3 font-bold text-foreground">{m.clientNom}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{LIBELLE_TYPE[m.type] ?? m.type}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {m.memo || m.factureNumero || m.dossierReference || "—"}
                    </td>
                    <td className={cn(
                      "py-2.5 pl-3 text-right font-bold tabular-nums",
                      m.montantSigne < 0 ? "text-error-strong" : "text-success-strong"
                    )}>
                      {m.montantSigne < 0 ? "−" : "+"}{argent(m.montant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mouvement && (
        <ModaleMouvement
          clients={clients}
          enCours={enCours}
          onFermer={() => setMouvement(false)}
          onEnregistrer={(fd) => agir(async () => {
            const r = await enregistrerMouvementFideicommis(fd)
            if (r.ok) setMouvement(false)
            return r
          })}
        />
      )}

      {rapprochement && (
        <ModaleRapprochement
          existant={rapprochement === "nouveau" ? null : rapprochement}
          soldeRegistre={registre.soldeTotal}
          enCours={enCours}
          onFermer={() => setRapprochement(null)}
          onEnregistrer={(fd) => agir(async () => {
            const r = await enregistrerRapprochement(fd)
            if (r.ok) setRapprochement(null)
            return r
          })}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ModaleMouvement({
  clients, enCours, onFermer, onEnregistrer,
}: {
  clients: { id: string; nom: string; numero: string }[]
  enCours: boolean
  onFermer: () => void
  onEnregistrer: (fd: FormData) => void
}) {
  const locale = useLocale()
  const [type, setType] = React.useState("deposit")
  const choisi = TYPES.find((t) => t.valeur === type)

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("locale", locale); onEnregistrer(fd) }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-base font-black text-foreground">Enregistrer un mouvement</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Chaque mouvement est rattaché à un client : c&apos;est ce qui rend le solde par client exact.
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 overflow-y-auto p-5">
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Nature du mouvement</span>
            <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={cn(CHAMP, "mt-1")}>
              {TYPES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
            </select>
            {choisi && <span className="mt-1 block text-[11px] text-muted-foreground">{choisi.aide}</span>}
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Client</span>
            <select name="clientId" required className={cn(CHAMP, "mt-1")} defaultValue="">
              <option value="" disabled>Choisir le client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.numero ? ` — ${c.numero}` : ""}</option>)}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Montant</span>
              <input name="montant" inputMode="decimal" required placeholder="0,00" className={cn(CHAMP, "mt-1 font-mono")} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Date</span>
              <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className={cn(CHAMP, "mt-1")} />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Objet</span>
            <input name="memo" placeholder="Frais IRCC, biométrie, traduction…" className={cn(CHAMP, "mt-1")} />
          </label>

          {choisi?.sens === -1 && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-[11px] text-warning-strong">
              Une sortie ne peut pas rendre le solde du client débiteur. La base la refusera et vous dira de combien.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onFermer} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer">
            Annuler
          </button>
          <button type="submit" disabled={enCours} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
            {enCours ? "Enregistrement…" : "Enregistrer au registre"}
          </button>
        </footer>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ModaleRapprochement({
  existant, soldeRegistre, enCours, onFermer, onEnregistrer,
}: {
  existant: RapprochementVue | null
  soldeRegistre: number
  enCours: boolean
  onFermer: () => void
  onEnregistrer: (fd: FormData) => void
}) {
  const locale = useLocale()
  const finDuMoisDernier = React.useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)
  }, [])

  const [periode, setPeriode] = React.useState(existant?.periodeFin ?? finDuMoisDernier)
  const [banque, setBanque] = React.useState(String(existant?.soldeBancaire ?? ""))
  const [ecarts, setEcarts] = React.useState<EcartRapprochement[]>(existant?.ecarts ?? [])
  const [notes, setNotes] = React.useState(existant?.notes ?? "")

  const registre = existant?.soldeRegistre ?? soldeRegistre
  const banqueNum = Number(String(banque).replace(",", ".")) || 0
  const explique = ecarts.reduce((t, e) => t + (Number(e.montant) || 0), 0)
  const residuel = Math.round((banqueNum + explique - registre) * 100) / 100

  const argent = (v: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" }).format(v)

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-base font-black text-foreground">Rapprocher une période</h2>
            <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
              Comparez le solde de votre relevé bancaire au solde du registre, puis expliquez chaque écart.
              L&apos;état ne peut être arrêté que lorsqu&apos;il ne reste rien d&apos;inexpliqué.
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Fin de la période</span>
              <input type="date" value={periode} onChange={(e) => setPeriode(e.target.value)} className={cn(CHAMP, "mt-1")} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Solde du relevé bancaire</span>
              <input inputMode="decimal" value={banque} onChange={(e) => setBanque(e.target.value)} placeholder="0,00" className={cn(CHAMP, "mt-1 font-mono")} />
            </label>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Solde du registre</span>
              <span className="font-bold tabular-nums text-foreground">{argent(registre)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Relevé + éléments expliqués</span>
              <span className="font-bold tabular-nums text-foreground">{argent(banqueNum + explique)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="font-black text-foreground">Écart résiduel</span>
              <span className={cn("font-black tabular-nums", residuel === 0 ? "text-success-strong" : "text-error-strong")}>
                {argent(residuel)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">Éléments de rapprochement</span>
              <button
                type="button"
                onClick={() => setEcarts((e) => [...e, { libelle: "", montant: 0 }])}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Ajouter
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Un chèque encore en circulation retranche du relevé ; un dépôt en transit s&apos;y ajoute.
            </p>
            <div className="mt-2 space-y-2">
              {ecarts.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                  Aucun élément. Si l&apos;écart résiduel est déjà nul, il n&apos;y a rien à expliquer.
                </p>
              )}
              {ecarts.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={e.libelle}
                    onChange={(ev) => setEcarts((l) => l.map((x, j) => j === i ? { ...x, libelle: ev.target.value } : x))}
                    placeholder="Chèque n° 1234 en circulation"
                    className={cn(CHAMP, "flex-1")}
                  />
                  <input
                    value={String(e.montant)}
                    onChange={(ev) => setEcarts((l) => l.map((x, j) => j === i ? { ...x, montant: Number(ev.target.value.replace(",", ".")) || 0 } : x))}
                    inputMode="decimal"
                    className={cn(CHAMP, "w-32 font-mono")}
                  />
                  <button
                    type="button"
                    onClick={() => setEcarts((l) => l.filter((_, j) => j !== i))}
                    aria-label="Retirer"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error-strong cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onFermer} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer">
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              const fd = new FormData()
              if (existant) fd.set("id", existant.id)
              fd.set("periodeFin", periode)
              fd.set("soldeBancaire", banque)
              fd.set("ecarts", JSON.stringify(ecarts))
              fd.set("notes", notes)
              fd.set("locale", locale)
              onEnregistrer(fd)
            }}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            {enCours ? "Enregistrement…" : "Enregistrer le rapprochement"}
          </button>
        </footer>
      </div>
    </div>
  )
}
