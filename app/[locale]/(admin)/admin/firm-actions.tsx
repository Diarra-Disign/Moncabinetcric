"use client"

import * as React from "react"
import { Plus, Ban, Play, Check, AlertTriangle, Copy, Link2 } from "lucide-react"
import { creerCabinet, changerPlan, basculerAcces, type ResultatAction } from "@/lib/data/admin-actions"
import type { EffetOctroi } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

/**
 * Ce qu'un exploitant accorde lui-même.
 *
 * « solo » et « cabinet » ont été retirés de la liste : ce sont des plans
 * payants, et le seul chemin qui y mène est le paiement, depuis Réglages →
 * Abonnement du cabinet. Les offrir ici faisait diverger la console et
 * Stripe — un cabinet marqué « cabinet » d'un côté, facturé « solo » de
 * l'autre —, et créait des cabinets dont l'accès se refermait à la première
 * connexion, faute d'abonnement derrière le plan.
 *
 * Pour donner l'accès complet sans facturer, « courtoisie » existe et le dit.
 *
 * Le refus ne repose pas sur cette liste : admin-actions.ts revalide côté
 * serveur. Ceci ne fait que retirer une option qui ne menait nulle part.
 */
const PLANS = ["trial", "courtoisie"] as const

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

/**
 * Lien d'invitation, quand le courriel n'a pas pu partir.
 *
 * Il n'est affiché qu'une fois : la base n'en garde que l'empreinte, et
 * cet écran est le seul endroit où il aura jamais existé en clair. Le
 * bouton de copie évite la sélection à la souris, où l'on perd un
 * caractère sans s'en apercevoir.
 */
export function LienARecopier({ lien, labels }: { lien: string; labels: Record<string, string> }) {
  const [copie, setCopie] = React.useState(false)

  return (
    <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-foreground">
        <Link2 aria-hidden className="h-3.5 w-3.5" />
        {labels.linkOnce}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-2 py-1.5 font-mono text-[11px] text-foreground">
          {lien}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(lien)
            setCopie(true)
          }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {copie ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
          {copie ? labels.copied : labels.copy}
        </button>
      </div>
    </div>
  )
}

function Retour({
  resultat,
  labels,
}: {
  resultat: ResultatAction | null
  labels: Record<string, string>
}) {
  if (!resultat) return null
  return (
    <>
      <p
        role="status"
        className={cn(
          "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold",
          resultat.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
        )}
      >
        {resultat.ok ? (
          <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        )}
        {resultat.message}
      </p>
      {resultat.lien && <LienARecopier lien={resultat.lien} labels={labels} />}
    </>
  )
}

/** Coordonnées reprises d'une demande de démonstration. */
export interface PreRemplissage {
  demandeId: string
  nom: string
  proprietaire: string
  courriel: string
  langue: string
}

/**
 * Ouverture d'un cabinet : c'est l'acte qui donne accès à la plateforme.
 *
 * Le formulaire crée le cabinet ET invite son propriétaire. Les deux ne
 * sont pas séparables : un cabinet sans membre est une impasse, et c'est
 * l'état dans lequel les premiers essais ont laissé « Groupe Immedia ».
 */
export function CreerCabinet({
  labels,
  prefill,
  onDone,
  onResultat,
}: {
  labels: Record<string, string>
  prefill?: PreRemplissage
  onDone?: () => void
  /**
   * Remonte le résultat à un parent qui survivra au rafraîchissement.
   *
   * Nécessaire quand ce formulaire est rendu à l'intérieur d'une demande :
   * l'ouverture de l'accès la fait sortir de la liste, le composant est
   * démonté, et le lien — dont c'est le seul exemplaire — disparaissait
   * avec lui.
   */
  onResultat?: (r: ResultatAction) => void
}) {
  const [ouvert, setOuvert] = React.useState(Boolean(prefill))
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()
  const [plan, setPlan] = React.useState<string>("trial")

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Plus aria-hidden className="h-4 w-4" />
        {labels.newFirm}
      </button>
    )
  }

  return (
    <form
      action={(fd) => demarrer(async () => {
        const r = await creerCabinet(fd)
        // Quand un parent prend le relais, il conserve le résultat après le
        // démontage de ce formulaire ; sinon on l'affiche ici.
        if (onResultat) onResultat(r)
        else setResultat(r)
        // Le formulaire ne se referme que si le lien est parti par courriel,
        // ou si quelqu'un d'autre se charge de l'afficher.
        if (r.ok && (!r.lien || onResultat)) {
          setOuvert(false)
          onDone?.()
        }
      })}
      className="w-full rounded-2xl border border-border bg-card p-5"
    >
      <h3 className="mb-4 text-sm font-black text-foreground">{labels.newFirm}</h3>

      {prefill && <input type="hidden" name="demandeId" value={prefill.demandeId} />}
      {/* Le courriel repart dans la langue où la demande a été remplie. */}
      <input type="hidden" name="langue" value={prefill?.langue ?? "fr"} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-foreground">
          {labels.firmName}
          <input
            name="nom"
            required
            defaultValue={prefill?.nom}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.license}
          <input
            name="permis"
            required
            placeholder="R1234567"
            className={cn(CHAMP, "mt-1 h-10 font-mono font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.consultant}
          <input
            name="proprietaire"
            required
            defaultValue={prefill?.proprietaire}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.email}
          {/* Obligatoire : c'est cette adresse qui reçoit le lien d'accès.
              Sans elle, on créerait un cabinet où personne ne peut entrer. */}
          <input
            name="courriel"
            type="email"
            required
            defaultValue={prefill?.courriel}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          />
          <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
            {labels.emailHint}
          </span>
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.plan}
          <select
            name="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {/* L'échéance n'a de sens que pour un essai : les autres plans
            n'expirent pas d'eux-mêmes. */}
        {plan === "trial" && (
          <label className="text-xs font-bold text-foreground">
            {labels.trialDays}
            <input
              name="jours"
              type="number"
              min={1}
              defaultValue={30}
              className={cn(CHAMP, "mt-1 h-10 font-normal")}
            />
          </label>
        )}
      </div>

      <Retour resultat={resultat} labels={labels} />

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => { setOuvert(false); setResultat(null) }}
          className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {labels.cancel}
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {enCours ? labels.saving : labels.create}
        </button>
      </div>
    </form>
  )
}

/** Plan et accès d'un cabinet donné, modifiables sans terminal. */
export function ActionsCabinet({
  firmId,
  plan,
  statut,
  effet,
  labels,
}: {
  firmId: string
  plan: string
  /**
   * `firms.status`, et NON `accessOpen`.
   *
   * Ce bouton pilotait la suspension depuis `accessOpen`, ce qui marchait tant
   * que celui-ci ne disait que « statut actif et essai non échu ». Depuis qu'il
   * dit la vérité — abonnement compris — un cabinet jamais suspendu dont le
   * paiement a cessé afficherait « Réactiver », et le clic écrirait
   * `status = 'active'` sur un cabinet déjà actif : rien ne changerait, et
   * l'exploitant conclurait que la console est cassée.
   *
   * Suspendre est une DÉCISION, l'accès en est une conséquence parmi d'autres.
   * Le bouton suit donc la décision.
   */
  statut: string
  /**
   * Ce que produira réellement un octroi, calculé côté serveur par
   * `effetOctroi()`. Sa raison d'être est dans `lib/billing/plans.ts` :
   * deux situations sur trois rendent l'octroi sans effet visible, et il
   * vaut mieux le dire avant le clic qu'après l'appel du consultant.
   */
  effet: EffetOctroi
  labels: Record<string, string>
}) {
  const suspendu = statut === "suspended"
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()

  /**
   * Le plan en cours figure-t-il parmi ceux qu'on accorde d'un clic ?
   *
   * ─── CE QUI A CHANGÉ, ET POURQUOI ──────────────────────────────────────
   *
   * Le menu déroulant était SUPPRIMÉ pour un cabinet au forfait payant, au
   * motif — juste — qu'une liste dont aucune option ne correspond au plan en
   * cours ferait sélectionner « essai » d'office par le navigateur, et qu'on
   * lirait « essai » sur la ligne d'un cabinet qui paie.
   *
   * Le raisonnement était bon, la conclusion allait trop loin. Un cabinet qui
   * résilie reste à `plan = 'solo'` avec un abonnement `canceled` : son accès
   * se ferme, à juste titre, et la console n'offrait alors PLUS AUCUN BOUTON
   * pour le rouvrir. Il fallait un terminal, le dépôt, et savoir que
   * `./cric abonnement --plan=courtoisie` existe. C'est arrivé.
   *
   * La liste est donc toujours affichée, avec en tête une option INERTE qui
   * porte le plan réel. Rien n'est présélectionné à tort — c'est le plan en
   * cours qu'on lit —, `required` empêche de valider sans choisir, et la
   * porte de sortie existe.
   */
  const planOctroyable = (PLANS as readonly string[]).includes(plan)

  return (
    <div className="space-y-2">
      <form
        action={(fd) => demarrer(async () => setResultat(await changerPlan(fd)))}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="firmId" value={firmId} />
        <input type="hidden" name="jours" value={30} />
        <select
          name="plan"
          required
          defaultValue={planOctroyable ? plan : ""}
          className="min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {!planOctroyable && (
            <option value="" disabled>
              {plan} — {labels.planPaid}
            </option>
          )}
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={enCours}
          className="min-h-8 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {labels.apply}
        </button>
      </form>

      {/* Ce que fera le geste, pas ce qu'il écrit. Les deux premiers cas
          écrivent bien `firms.plan` et ne rouvrent rien : sans cette ligne,
          la console répondrait « Plan passé à courtoisie » et l'exploitant
          en conclurait que c'est réglé. */}
      <p
        className={cn(
          "text-[11px] leading-relaxed",
          effet === "rouvre" ? "text-muted-foreground" : "text-warning"
        )}
      >
        {effet === "suspendu"
          ? labels.grantSuspended
          : effet === "abonnement-prime"
            ? labels.grantPaid
            : labels.grantReopens}
      </p>

      <form action={(fd) => demarrer(async () => setResultat(await basculerAcces(fd)))}>
        <input type="hidden" name="firmId" value={firmId} />
        <input type="hidden" name="suspendre" value={suspendu ? "0" : "1"} />
        <button
          type="submit"
          disabled={enCours}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-50",
            suspendu
              ? "border border-success/30 text-success hover:bg-success/10"
              : "border border-error/30 text-error hover:bg-error/10"
          )}
        >
          {suspendu ? (
            <>
              <Play aria-hidden className="h-3 w-3" />
              {labels.activate}
            </>
          ) : (
            <>
              <Ban aria-hidden className="h-3 w-3" />
              {labels.suspend}
            </>
          )}
        </button>
        {/* Le bouton « Stripe Lien » a été retiré : il recopiait dans le
            presse-papier l'adresse
            « https://buy.stripe.com/test_moncabinetcric_saas », qui n'est pas
            un identifiant Stripe et ne mène nulle part. Un bouton qui annonce
            « lien copié » et ne copie rien d'utilisable est pire qu'un bouton
            absent : l'exploitant le transmet à un client. Le vrai chemin de
            paiement est le tunnel du cabinet, Réglages → Abonnement, dont
            l'adresse est déjà copiable depuis le bloc financier. */}
      </form>

      <Retour resultat={resultat} labels={labels} />
    </div>
  )
}
