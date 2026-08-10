"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, Banknote, CalendarClock, Check, CheckCircle2, ChevronRight,
  Clock, Eye, FileSignature, FileText, Landmark, Receipt, ShieldCheck, Trash2,
  Send, Upload, Users, X, Edit3, MessageSquare, History, Plus, Sparkles
} from "lucide-react"
import type { DossierComplet } from "@/lib/data/matter-file"
import {
  ajouterEcheance, changerEtatEcheance, declarerDossier, demanderValidation,
  enregistrerPaiement, marquerRecue, marquerVerifiee,
  renvoyerACorriger, virerHonoraires, rattacherClient, inviterClientAuPortail,
  deposerFormulaire, deposerPourExigence, apercuDocument, retirerDocument,
  type Resultat,
} from "@/lib/data/matter-actions"
import { cn } from "@/lib/utils"
import {
  requestQuestionnaireCorrections,
  updateQuestionnaireByConsultant,
  validateQuestionnaire,
} from "@/lib/data/actions"
import type { ClientQuestionnaire, QuestionnaireCorrection, QuestionnaireHistoryEntry } from "@/lib/data/types"
import { envoyerQuestionnaire } from "@/lib/data/questionnaire-actions"
import { ConfirmationEnvoi } from "@/components/ui/confirmation-envoi"
import { creerFacture, emettreFacture, supprimerFacture, annulerFacture, envoyerFactureAuClient, envoyerRecuAuClient, modifierFacture, lignesDeFacture } from "@/lib/data/invoice-actions"
import { SubmissionLetterBuilder } from "@/components/matters/submission-letter-builder"

/**
 * Le dossier client, en onglets.
 *
 * Un seul composant plutôt qu'un écran par onglet : les indicateurs du bandeau
 * — pièces manquantes, solde, échéances dépassées — se lisent dans les mêmes
 * données que les listes. Séparés, ils seraient chargés à des instants
 * différents et finiraient par se contredire à l'écran.
 *
 * Aucune règle n'est réécrite ici. Les boutons envoient, la base décide, et le
 * message affiché est celui qu'elle a levé — il est écrit pour être lu.
 */

type Onglet =
  | "apercu" | "documents" | "formulaires" | "facturation"
  | "paiements" | "echeances" | "portail" | "argumentaire"

const ONGLETS: { cle: Onglet; libelle: string; icone: React.ElementType }[] = [
  { cle: "apercu", libelle: "Vue d'ensemble", icone: ShieldCheck },
  { cle: "documents", libelle: "Documents", icone: FileText },
  { cle: "formulaires", libelle: "Formulaires", icone: FileSignature },
  { cle: "facturation", libelle: "Facturation", icone: Receipt },
  { cle: "paiements", libelle: "Paiements", icone: Banknote },
  { cle: "echeances", libelle: "Échéances", icone: CalendarClock },
  { cle: "portail", libelle: "Portail client", icone: Users },
  { cle: "argumentaire", libelle: "Argumentaire IRCC", icone: Sparkles },
]

const STATUT_PIECE: Record<string, { texte: string; ton: string }> = {
  missing:    { texte: "Non reçu",   ton: "bg-muted text-muted-foreground" },
  requested:  { texte: "Demandé",    ton: "bg-primary/10 text-primary-strong" },
  received:   { texte: "À vérifier", ton: "bg-warning/15 text-warning" },
  verified:   { texte: "Validé",     ton: "bg-success/15 text-success" },
  to_correct: { texte: "À corriger", ton: "bg-error/15 text-error" },
  expired:    { texte: "Expiré",     ton: "bg-error/15 text-error" },
}

const STATUT_ECHEANCE: Record<string, { texte: string; ton: string }> = {
  todo:        { texte: "À faire",   ton: "bg-muted text-muted-foreground" },
  in_progress: { texte: "En cours",  ton: "bg-primary/10 text-primary-strong" },
  done:        { texte: "Terminé",   ton: "bg-success/15 text-success" },
  overdue:     { texte: "En retard", ton: "bg-error/15 text-error" },
  cancelled:   { texte: "Annulé",    ton: "bg-muted text-muted-foreground" },
}

const STATUT_FACTURE: Record<string, { texte: string; ton: string }> = {
  draft:     { texte: "Brouillon",           ton: "bg-muted text-muted-foreground" },
  issued:    { texte: "Émise",               ton: "bg-primary/10 text-primary-strong" },
  partial:   { texte: "Partiellement payée", ton: "bg-warning/15 text-warning" },
  paid:      { texte: "Payée",               ton: "bg-success/15 text-success" },
  overdue:   { texte: "En retard",           ton: "bg-error/15 text-error" },
  cancelled: { texte: "Annulée",             ton: "bg-muted text-muted-foreground line-through" },
}

const STATUT_FORMULAIRE: Record<string, string> = {
  to_prepare: "À préparer", in_preparation: "En préparation",
  ready_for_review: "Prêt pour révision", sent_to_client: "Envoyé au client",
  awaiting_signature: "En attente de signature", signed: "Signé",
  to_correct: "À corriger", archived: "Archivé",
}

const argent = (v: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v)

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export function DossierOnglets({
  dossier, matterId, clientId, statutDossier, clientsDuCabinet, clientQuestionnaires: initialQuestionnaires = [], modeles = [], consultant, clientName, courrielClient = "", programName,
}: {
  dossier: DossierComplet
  matterId: string
  /** L'uuid du client — celui qu'attendent les clés étrangères. */
  clientId: string | null
  statutDossier: string
  /** Les clients du cabinet, pour rattacher un dossier qui n'en a pas. */
  clientsDuCabinet: { id: string; nom: string; dossier: string }[]
  clientQuestionnaires?: ClientQuestionnaire[]
  /** La bibliothèque du cabinet, pour l'envoi contextuel. */
  modeles?: { id: string; titleFr: string }[]
  consultant: { id: string; name: string }
  /** Nom du client, pour la lettre IA d'argumentaire. */
  clientName: string
  /** Courriel du client, pour montrer À QUI part un envoi avant de l'exécuter. */
  courrielClient?: string
  /** Nom du programme, pour la lettre IA d'argumentaire. */
  programName: string
}) {
  const [onglet, setOnglet] = React.useState<Onglet>("apercu")
  const [resultat, setResultat] = React.useState<Resultat | null>(null)
  const [enCours, demarrer] = React.useTransition()
  const routeur = useRouter()
  const rafraichir = () => routeur.refresh()

  /** Le lien du dernier envoi, à copier quand le courriel n'est pas parti. */
  const [lienEnvoi, setLienEnvoi] = React.useState<string | null>(null)
  /** Vrai quand la fenêtre de création de facture est ouverte. */
  const [nouvelleFacture, setNouvelleFacture] = React.useState(false)
  /** Le brouillon en cours de modification, ou null. */
  const [factureAModifier, setFactureAModifier] = React.useState<{ id: string; numero: string; dueOn: string; description: string } | null>(null)
  /**
   * L'envoi en attente de confirmation.
   *
   * Rien ne part tant que cet état n'a pas été confirmé : le bouton « Envoyer »
   * le POSE, la fenêtre l'exécute. C'est ce qui garantit qu'un clic seul ne
   * déclenche jamais un courriel vers un client.
   */
  const [envoiAConfirmer, setEnvoiAConfirmer] = React.useState<{
    action: string; objet: string; objetDetail?: string
    destinataire: { nom: string; courriel?: string }
    mode?: string
    message?: string
    irreversible?: string
    libelleConfirmer?: string
    executer: () => Promise<Resultat>
  } | null>(null)

  // Liste des questionnaires locaux
  const [prevInitialQuestionnaires, setPrevInitialQuestionnaires] = React.useState(initialQuestionnaires)
  const [questionnaires, setQuestionnaires] = React.useState(initialQuestionnaires)

  if (initialQuestionnaires !== prevInitialQuestionnaires) {
    setPrevInitialQuestionnaires(initialQuestionnaires)
    setQuestionnaires(initialQuestionnaires)
  }

  // Modales overlays
  const [selectedReviewQ, setSelectedReviewQ] = React.useState<ClientQuestionnaire | null>(null)
  const [selectedEditQ, setSelectedEditQ] = React.useState<ClientQuestionnaire | null>(null)
  const [selectedCorrectionQ, setSelectedCorrectionQ] = React.useState<ClientQuestionnaire | null>(null)

  // États pour modifications dans la modale d'édition
  const [editAnswers, setEditAnswers] = React.useState<Record<string, unknown>>({})

  // États pour corrections dans la modale de corrections
  const [newCorrectionComment, setNewCorrectionComment] = React.useState("")
  const [selectedCorrectionSection, setSelectedCorrectionSection] = React.useState("")

  const lancer = (action: (fd: FormData) => Promise<Resultat>) => (fd: FormData) =>
    demarrer(async () => setResultat(await action(fd)))

  /**
   * Un formulaire qui envoie quelque chose au client passe par la confirmation.
   *
   * On remplace `action={…}` par ceci : la soumission native est arrêtée, les
   * champs saisis sont figés dans une FormData, et c'est cette FormData — celle
   * qui a été LUE dans la fenêtre — que « Confirmer » expédiera. Décrire
   * l'envoi à partir du formulaire, plutôt qu'à partir de l'état du composant,
   * évite le décalage où la fenêtre annonce un document et le serveur en reçoit
   * un autre.
   */
  const confirmerPuisEnvoyer =
    (
      action: (fd: FormData) => Promise<Resultat>,
      decrire: (fd: FormData) => Omit<NonNullable<typeof envoiAConfirmer>, "executer">
    ) =>
    (evenement: React.FormEvent<HTMLFormElement>) => {
      evenement.preventDefault()
      const fd = new FormData(evenement.currentTarget)
      setEnvoiAConfirmer({ ...decrire(fd), executer: () => action(fd) })
    }

  /**
   * Pour les actions qui rendent une adresse : l'onglet s'ouvre.
   *
   * L'ouverture a lieu APRÈS l'appel, donc hors du geste de l'utilisateur —
   * certains navigateurs la bloquent alors comme une fenêtre surgissante. Le
   * message le dit plutôt que de laisser croire à une panne.
   */
  const ouvrir =
    (action: (fd: FormData) => Promise<Resultat & { url?: string }>) => (fd: FormData) =>
      demarrer(async () => {
        const r = await action(fd)
        if (r.ok && r.url) {
          const onglet = window.open(r.url, "_blank", "noopener")
          setResultat(
            onglet
              ? { ok: true, message: r.message }
              : {
                  ok: false,
                  message:
                    "L'aperçu a été bloqué par le navigateur. Autorisez les fenêtres pour ce site.",
                }
          )
          return
        }
        setResultat(r)
      })

  const d = dossier
  // Un dossier peut n'être rattaché à aucun client. Les pièces, les
  // formulaires et les échéances tiennent au DOSSIER et restent utilisables ;
  // tout ce qui touche à l'argent et au portail suppose un client.
  const sansClient = clientId === null

  // Les deux onglets se partagent la même liste. Le classement vient de la
  // base — colonne `kind` — et non d'un motif appliqué au code ici : une règle
  // recopiée dans l'écran ne se corrige pas sans déploiement, et elle est
  // fausse pour un formulaire provincial, dont le code ne commence pas par
  // « IMM ».
  const pieces = d.exigences.filter((e) => e.kind !== "form")
  const formulairesRequis = d.exigences.filter((e) => e.kind === "form")

  /**
   * Une ligne d'exigence, avec ses quatre gestes.
   *
   * Extraite parce que DEUX onglets l'affichent — les pièces justificatives
   * et les formulaires requis. Recopier ce bloc aurait garanti qu'un
   * correctif n'atteigne qu'une des deux listes, et personne ne l'aurait vu
   * avant de chercher pourquoi un bouton manque d'un côté.
   */
  const ligneExigence = (e: DossierComplet["exigences"][number]) => {
          const s = STATUT_PIECE[e.status] ?? { texte: e.status, ton: "bg-muted" }
          return (
            <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                    {e.label}
                    {e.mandatory && (
                      <span className="rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-error">
                        obligatoire
                      </span>
                    )}
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", s.ton)}>
                      {s.texte}
                    </span>
                  </h4>
                  {/* Reçu et vérifié sont affichés SÉPARÉMENT : c'est toute
                      la distinction, et la confondre à l'écran l'annulerait. */}
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      Reçu : {e.receivedAt
                        ? `${new Date(e.receivedAt).toLocaleDateString("fr-CA")}${e.receivedFrom === "client" ? " — déposé par le client" : ""}`
                        : "non"}
                    </span>
                    <span>
                      Vérifié : {e.verifiedAt ? new Date(e.verifiedAt).toLocaleDateString("fr-CA") : "non"}
                    </span>
                    {e.expiresOn && <span>Expire le {e.expiresOn}</span>}
                  </p>
                  {e.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-[11px] italic text-error">
                      « {e.rejectionReason} »
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {!e.receivedAt && (
                    <form action={lancer(marquerRecue)}>
                      <input type="hidden" name="id" value={e.id} />
                      <BoutonPetit disabled={enCours} ton="neutre">Marquer reçue</BoutonPetit>
                    </form>
                  )}
                  {e.receivedAt && e.status !== "verified" && (
                    <form action={lancer(marquerVerifiee)}>
                      <input type="hidden" name="id" value={e.id} />
                      <BoutonPetit disabled={enCours} ton="success">Vérifier</BoutonPetit>
                    </form>
                  )}
                  {e.documentId && (
                    <>
                      <form action={ouvrir(apercuDocument)}>
                        <input type="hidden" name="documentId" value={e.documentId} />
                        <BoutonPetit disabled={enCours} ton="neutre">
                          <Eye aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Aperçu
                        </BoutonPetit>
                      </form>
                      <form action={lancer(retirerDocument)}>
                        <input type="hidden" name="documentId" value={e.documentId} />
                        <BoutonPetit disabled={enCours} ton="error">
                          <Trash2 aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Retirer
                        </BoutonPetit>
                      </form>
                    </>
                  )}
                  {e.receivedAt && (
                    <form action={lancer(renvoyerACorriger)} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={e.id} />
                      <input name="motif" placeholder="Motif du renvoi" className={cn(CHAMP, "w-40")} />
                      <BoutonPetit disabled={enCours} ton="error">Renvoyer</BoutonPetit>
                    </form>
                  )}
                </div>
              </div>

              {/* Le téléversement est SOUS la ligne plutôt qu'à côté : un
                  sélecteur de fichier serré entre quatre boutons devient le
                  plus discret de tous, alors que c'est le geste principal. */}
              <form
                action={lancer(deposerPourExigence)}
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
              >
                <input type="hidden" name="exigenceId" value={e.id} />
                <input type="hidden" name="matterId" value={matterId} />
                <input type="hidden" name="clientId" value={clientId ?? ""} />
                <input
                  type="file"
                  name="fichier"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  className={cn(CHAMP, "max-w-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-bold")}
                />
                <BoutonPetit disabled={enCours}>
                  <Upload aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                  {e.documentId ? "Remplacer" : "Téléverser"}
                </BoutonPetit>
                {e.documentNom && (
                  <span className="text-[11px] text-muted-foreground">
                    {e.documentNom} · déposé le{" "}
                    {new Date(e.documentDepotLe!).toLocaleString("fr-CA", {
                      dateStyle: "short", timeStyle: "short",
                    })}
                    {e.documentDeposePar && ` par ${e.documentDeposePar}`}
                  </span>
                )}
              </form>
            </div>
          )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Le bandeau des onglets défile horizontalement plutôt que de se
          replier : sept onglets serrés sur un téléphone deviennent
          illisibles, et un menu déroulant cacherait ce qu'on cherche. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="flex w-max gap-1 rounded-2xl border border-border bg-card p-1">
          {ONGLETS.filter((o) => !sansClient || o.cle !== "paiements").map(({ cle, libelle, icone: Icone }) => (
            <button
              key={cle}
              role="tab"
              aria-selected={onglet === cle}
              onClick={() => setOnglet(cle)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors",
                onglet === cle
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icone aria-hidden className="h-4 w-4 shrink-0" />
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {sansClient && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-xs font-bold leading-relaxed text-warning">
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Ce dossier n&apos;est rattaché à aucun client. Les pièces, les formulaires et les échéances
            fonctionnent ; les paiements et le fidéicommis attendent le rattachement.{" "}
            <button type="button" onClick={() => setOnglet("portail")} className="underline underline-offset-2">
              Rattacher un client
            </button>
          </span>
        </p>
      )}

      {resultat && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 whitespace-pre-line rounded-xl px-4 py-3 text-xs font-bold leading-relaxed",
            resultat.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {resultat.ok
            ? <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
            : <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />}
          {resultat.message}
        </p>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "apercu" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Carte titre="Dossier" icone={ShieldCheck}>
            <Ligne libelle="Pièces exigées" valeur={`${d.progression.total}`} />
            <Ligne libelle="Reçues" valeur={`${d.progression.recues}`} />
            <Ligne libelle="À vérifier" valeur={`${d.progression.aVerifier}`} accent={d.progression.aVerifier > 0} />
            <Ligne libelle="Manquantes" valeur={`${d.progression.manquantes}`} accent={d.progression.manquantes > 0} />
            <Ligne libelle="Validées" valeur={`${d.progression.verifiees} / ${d.progression.total}`} />
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${d.progression.pourcentage}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {d.progression.pourcentage}% des pièces vérifiées
            </p>
          </Carte>

          <Carte titre="Finances" icone={Banknote}>
            <Ligne libelle="Total facturé" valeur={argent(d.finances.facture)} />
            <Ligne libelle="Total payé" valeur={argent(d.finances.paye)} />
            <Ligne libelle="Solde restant" valeur={argent(d.finances.solde)} accent={d.finances.solde > 0} />
            {/* Les deux comptes ne sont JAMAIS additionnés. Un total unique
                laisserait croire que le cabinet dispose de l'ensemble. */}
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <Ligne libelle="Reçu en fidéicommis" valeur={argent(d.finances.enFideicommis)} />
              <Ligne libelle="Reçu au compte d'entreprise" valeur={argent(d.finances.auCompteEntreprise)} />
              <Ligne
                libelle="Solde en fidéicommis du client"
                valeur={argent(d.finances.soldeFideicommisClient)}
                accent={d.finances.soldeFideicommisClient > 0}
              />
            </div>
          </Carte>

          <Carte titre="Client" icone={Users}>
            <Ligne libelle="Compte client" valeur={d.portail.compteCree ? "Créé" : "Pas encore"} />
            <Ligne libelle="Documents déposés par le client" valeur={`${d.portail.documentsDeposes}`} />
            <Ligne
              libelle="En attente de sa validation"
              valeur={`${d.portail.validationsEnAttente}`}
              accent={d.portail.validationsEnAttente > 0}
            />
            <Ligne libelle="Échéances" valeur={`${d.echeances.filter((e) => e.status !== "done" && e.status !== "cancelled").length} ouverte(s)`} />
            <Ligne
              libelle="Dépassées"
              valeur={`${d.echeances.filter((e) => e.status === "overdue").length}`}
              accent={d.echeances.some((e) => e.status === "overdue")}
            />
          </Carte>

          {/* Le blocage, dit ici plutôt que découvert au moment de cliquer. */}
          <div className="lg:col-span-3">
            {d.bloquantes.length > 0 ? (
              <div className="rounded-2xl border border-error/30 bg-error/5 p-5">
                <h3 className="flex items-center gap-2 text-sm font-black text-error">
                  <AlertTriangle aria-hidden className="h-4 w-4" />
                  Le dossier ne peut pas être déclaré complet
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.bloquantes.length} pièce(s) obligatoire(s) encore manquante(s) ou non vérifiée(s).
                </p>
                <ul className="mt-3 space-y-1.5">
                  {d.bloquantes.map((b) => (
                    <li key={b.code}>
                      <button
                        type="button"
                        onClick={() => setOnglet("documents")}
                        className="inline-flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary"
                      >
                        <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                        {b.label}
                        <span className="font-normal text-muted-foreground">
                          — {STATUT_PIECE[b.status]?.texte ?? b.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <form action={lancer(declarerDossier)} className="rounded-2xl border border-success/30 bg-success/5 p-5">
                <input type="hidden" name="id" value={matterId} />
                <h3 className="flex items-center gap-2 text-sm font-black text-success">
                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                  Toutes les pièces obligatoires sont vérifiées
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" name="statut" value="complete" disabled={enCours || statutDossier === "complete"}
                    className="inline-flex min-h-10 items-center rounded-xl bg-success px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    Déclarer complet
                  </button>
                  <button type="submit" name="statut" value="ready_to_submit" disabled={enCours}
                    className="inline-flex min-h-10 items-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50">
                    Prêt à être soumis
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "documents" && (
        <div className="space-y-3">
          {pieces.length === 0 && <Vide texte="Aucune pièce justificative exigée pour ce programme." />}
          {pieces.map(ligneExigence)}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "formulaires" && (
        <div className="space-y-3">
          {/* Les formulaires EXIGÉS par le programme viennent en tête : ce sont
              eux qui bloquent la validation du dossier, et c'est d'eux qu'on
              vient s'occuper. Ils portent exactement les mêmes gestes que les
              pièces justificatives — même fonction, une seule à corriger. */}
          {formulairesRequis.length > 0 && (
            <>
              <h3 className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Exigés par le programme
              </h3>
              {formulairesRequis.map(ligneExigence)}
              <h3 className="pt-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                Autres formulaires
              </h3>
            </>
          )}

          {/* Le dépôt libre passe avant le pré-remplissage : c'est le geste
              courant. Le pré-remplissage ne vaut que pour les formulaires
              préparés un par un, et il n'y en a encore aucun. */}
          <form action={lancer(deposerFormulaire)} className="rounded-2xl border border-border bg-card p-5">
            <input type="hidden" name="matterId" value={matterId} />
            <input type="hidden" name="clientId" value={clientId ?? ""} />
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
              <Upload aria-hidden className="h-4 w-4 text-muted-foreground" />
              Déposer un formulaire
            </h3>
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">
              N&apos;importe quel formulaire utile au dossier — IRCC, provincial, consulaire. Il se
              range au dossier, se consulte et se télécharge. PDF, image ou document, 20 Mo au plus.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-[11px] font-bold text-muted-foreground sm:col-span-2">
                Fichier
                <input type="file" name="fichier" required accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  className={cn(CHAMP, "mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-bold")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Nom au dossier
                <input name="nom" placeholder="repris du fichier" className={cn(CHAMP, "mt-1")} />
              </label>
            </div>
            <BoutonPetit disabled={enCours} className="mt-3">Déposer</BoutonPetit>
          </form>

          {/* La section IMM 5476 a été retirée : le module de génération de
              formulaires officiels IRCC n'est pas encore intégré côté backend.
              Le dépôt libre ci-dessus reste le geste courant pour téléverser un
              formulaire rempli manuellement. */}

          {d.formulairesDeposes.length > 0 && (
            <div className="space-y-2">
              {d.formulairesDeposes.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-foreground">{f.nom}</h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Déposé le{" "}
                      {new Date(f.deposeLe).toLocaleString("fr-CA", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {f.deposePar ? ` par ${f.deposePar}` : ""}
                      {f.taille ? ` · ${Math.round(f.taille / 1024)} Ko` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={ouvrir(apercuDocument)}>
                      <input type="hidden" name="documentId" value={f.id} />
                      <BoutonPetit disabled={enCours} ton="neutre">
                        <Eye aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Aperçu
                      </BoutonPetit>
                    </form>
                    <form action={lancer(retirerDocument)}>
                      <input type="hidden" name="documentId" value={f.id} />
                      <BoutonPetit disabled={enCours} ton="error">
                        <Trash2 aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Retirer
                      </BoutonPetit>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {d.formulaires.length === 0 &&
            d.formulairesDeposes.length === 0 &&
            formulairesRequis.length === 0 && (
              <Vide texte="Aucun formulaire au dossier." />
            )}

          {/* ============================================================
              PANNEAU : QUESTIONNAIRES CLIENTS INTÉGRÉS
              ============================================================ */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <FileSignature aria-hidden className="h-4 w-4 text-primary" />
                  Questionnaires Clients Remplis en Ligne
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Attribuez un formulaire dynamique que le client pourra remplir directement depuis son portail sécurisé.
                </p>
              </div>

              {/* Envoi contextuel (§8) : le destinataire n'est pas demandé,
                  puisqu'on est déjà dans son dossier. Le consultant ne choisit
                  que le questionnaire. */}
              {clientId ? (
                <div className="flex items-center gap-2">
                  <select
                    id="select-assign-form"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    defaultValue=""
                    disabled={modeles.length === 0}
                    // Le geste le plus léger de l'application déclenchait le
                    // plus lourd : dérouler la liste et relâcher la souris sur
                    // la mauvaise ligne — ou la survoler au clavier — expédiait
                    // un courriel au client. La sélection ne fait plus que
                    // PRÉPARER l'envoi ; la fenêtre l'exécute.
                    onChange={(e) => {
                      const templateId = e.target.value
                      if (!templateId) return
                      const modele = modeles.find((m) => m.id === templateId)
                      e.target.value = ""
                      const fd = new FormData()
                      fd.set("templateId", templateId)
                      fd.set("destinataireType", "client")
                      fd.set("destinataireId", clientId ?? "")
                      fd.set("matterId", matterId)
                      fd.set("locale", "fr")
                      setEnvoiAConfirmer({
                        action: "Le client recevra un lien sécurisé pour remplir ce questionnaire.",
                        objet: modele?.titleFr ?? "Questionnaire",
                        objetDetail: `Rattaché au dossier ${matterId}`,
                        destinataire: { nom: clientName, courriel: courrielClient },
                        executer: async () => {
                          const r = await envoyerQuestionnaire(fd)
                          if (r.ok) setLienEnvoi(r.lien ?? null)
                          return r
                        },
                      })
                    }}
                  >
                    <option value="" disabled>+ Envoyer un questionnaire</option>
                    {modeles.map((m) => (
                      <option key={m.id} value={m.id}>{m.titleFr}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-xs text-error font-bold bg-error/10 px-2 py-1 rounded">Rattachez un client pour envoyer un questionnaire</span>
              )}
            </div>

            {questionnaires.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                Aucun questionnaire en ligne n&apos;est attribué à ce dossier.
              </p>
            ) : (
              <div className="space-y-3">
                {questionnaires.map((q) => (
                  <div key={q.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{q.title}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Dernière modification : {new Date(q.updatedAt).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="bg-primary h-full" style={{ width: `${q.progress}%` }} />
                          </div>
                          <span>{q.progress}%</span>
                        </div>

                        <span className={cn(
                          "rounded px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                          q.status === "completed" || q.status === "cancelled"
                            ? "bg-success/15 text-success"
                            : q.status === "submitted" || q.status === "corrected"
                              ? "bg-primary/15 text-primary-strong"
                              : q.status === "to_correct"
                                ? "bg-error/15 text-error"
                                : "bg-muted text-muted-foreground"
                        )}>
                          {q.status === "draft" && "Brouillon"}
                          {q.status === "in_progress" && "En cours"}
                          {q.status === "submitted" && "Soumis"}
                          {q.status === "to_correct" && "À corriger"}
                          {q.status === "corrected" && "Corrigé"}
                          {q.status === "completed" && "Clos"}
                          {q.status === "cancelled" && "Annulé"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
                      <button
                        type="button"
                        onClick={() => setSelectedReviewQ(q)}
                        className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-bold text-xs transition-colors cursor-pointer text-foreground flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" /> Voir les réponses
                      </button>

                      {q.status !== "cancelled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEditQ(q)
                              setEditAnswers({ ...q.answers })
                            }}
                            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-bold text-xs transition-colors cursor-pointer text-foreground flex items-center gap-1.5"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" /> Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedCorrectionQ(q)}
                            className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted font-bold text-xs transition-colors cursor-pointer text-error flex items-center gap-1.5"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-error/70" /> Demander corrections
                          </button>

                          {q.status === "submitted" && (
                            <button
                              type="button"
                              onClick={async () => {
                                demarrer(async () => {
                                  try {
                                    const updated = await validateQuestionnaire(q.id)
                                    setQuestionnaires((prev) => prev.map((item) => item.id === q.id ? updated : item))
                                    setResultat({ ok: true, message: "Questionnaire validé avec succès." })
                                  } catch (err: unknown) {
                                    const msg = err instanceof Error ? err.message : String(err)
                                    setResultat({ ok: false, message: msg || "Erreur de validation." })
                                  }
                                })
                              }}
                              className="px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
                            >
                              <Check className="h-3.5 w-3.5" /> Valider
                            </button>
                          )}
                        </>
                      )}

                      {/* « Verrouiller » a disparu, et ce n'est pas un oubli.
                          L'ancien modèle distinguait « validé » de
                          « verrouillé » : deux états dont le second n'ajoutait
                          rien que le premier ne garantissait pas. Clore un
                          questionnaire le ferme désormais pour tout le monde —
                          le cabinet comme le destinataire — et la base le fait
                          respecter. Un bouton de plus n'aurait fermé que ce
                          qui l'était déjà. */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {d.formulaires.map((f) => (
            <div key={f.id} className={cn("rounded-2xl border border-border bg-card p-4", f.archived && "opacity-60")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    {f.label} <span className="font-normal text-muted-foreground">· version {f.version}</span>
                  </h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {STATUT_FORMULAIRE[f.status] ?? f.status}
                    {f.signedAt && ` · signé le ${new Date(f.signedAt).toLocaleDateString("fr-CA")}`}
                    {f.formVersion && ` · formulaire ${f.formVersion}`}
                  </p>
                </div>
                {!f.documentId && !f.archived && (
                  <span className="text-[11px] italic text-muted-foreground">
                    PDF officiel non encore importé
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "facturation" && (
        <div className="space-y-3">
          {/* Le total facturé, le réglé et le solde (§10). Ils ne sont pas
              recalculés ici : ils viennent de la fiche, qui les tient de la
              base — un troisième calcul finirait par en différer. */}
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4">
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Total facturé</dt>
                <dd className="font-black text-foreground font-mono text-sm">{argent(d.finances.facture)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Réglé</dt>
                <dd className="font-black text-success-strong font-mono text-sm">{argent(d.finances.paye)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Solde à recevoir</dt>
                <dd className={cn("font-black font-mono text-sm", d.finances.solde > 0 ? "text-warning-strong" : "text-foreground")}>
                  {argent(d.finances.solde)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Factures</dt>
                <dd className="font-black text-foreground font-mono text-sm">{d.factures.length}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setNouvelleFacture(true)}
              disabled={!clientId}
              title={clientId ? undefined : "Rattachez un client à ce dossier avant de facturer"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Créer une facture
            </button>
          </div>

          {d.factures.length === 0 && <Vide texte="Aucune facture pour ce dossier." />}
          {d.factures.map((f) => {
            const s = STATUT_FACTURE[f.statut] ?? { texte: f.statut, ton: "bg-muted" }
            return (
              <div key={f.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                      {f.numero}
                      <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", s.ton)}>
                        {s.texte}
                      </span>
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Émise le {f.date} {f.dueOn && `· échéance ${f.dueOn}`}
                    </p>

                    {/* Le PDF s'ouvre dans un onglet plutôt que de tomber dans
                        les téléchargements : on veut d'abord LE VOIR. La
                        visionneuse du navigateur offre l'enregistrement. */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a
                        href={`/api/invoices/${f.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                      >
                        <Eye className="h-3.5 w-3.5" /> Voir le PDF
                      </a>
                      {f.statut === "draft" && (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => demarrer(async () => {
                            const fd = new FormData()
                            fd.set("id", f.id)
                            fd.set("locale", "fr")
                            const r = await emettreFacture(fd)
                            setResultat(r)
                            if (r.ok) rafraichir()
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-[11px] hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          <Receipt className="h-3.5 w-3.5" /> Émettre
                        </button>
                      )}

                      {/* Supprimer n'est offert que sur un BROUILLON, et
                          annuler que sur une facture émise. La base refuserait
                          de toute façon ; montrer un bouton voué au refus
                          n'aurait appris la règle qu'après le clic. */}
                      {f.statut !== "cancelled" && (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => setEnvoiAConfirmer({
                            action: "Vous êtes sur le point d'envoyer cette facture au client.",
                            objet: `Facture ${f.numero}`,
                            objetDetail: `${argent(f.montant)}${f.dueOn ? ` · à régler avant le ${f.dueOn}` : ""}`,
                            destinataire: { nom: clientName, courriel: courrielClient },
                            irreversible: f.statut === "draft"
                              ? "La facture sera émise en même temps : son numéro et son montant seront alors figés."
                              : undefined,
                            executer: async () => {
                              const fd = new FormData()
                              fd.set("id", f.id)
                              // Envoyer une facture, c'est l'émettre. Laisser
                              // partir un document marqué « brouillon » puis lui
                              // donner un autre numéro serait le meilleur moyen
                              // de la faire payer deux fois — ou pas du tout.
                              if (f.statut === "draft") fd.set("emettre", "1")
                              fd.set("locale", "fr")
                              return envoyerFactureAuClient(fd)
                            },
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                        >
                          <Send className="h-3.5 w-3.5" /> Envoyer au client
                        </button>
                      )}

                      {f.statut === "draft" && (
                        <button
                          type="button"
                          onClick={() => setFactureAModifier({ id: f.id, numero: f.numero, dueOn: f.dueOn ?? "", description: f.description ?? "" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Modifier
                        </button>
                      )}

                      {f.statut === "draft" ? (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => demarrer(async () => {
                            const fd = new FormData()
                            fd.set("id", f.id)
                            fd.set("locale", "fr")
                            const r = await supprimerFacture(fd)
                            setResultat(r)
                            if (r.ok) rafraichir()
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-error/10 hover:text-error transition-colors cursor-pointer text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Supprimer
                        </button>
                      ) : f.statut !== "cancelled" && (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => demarrer(async () => {
                            const fd = new FormData()
                            fd.set("id", f.id)
                            fd.set("locale", "fr")
                            const r = await annulerFacture(fd)
                            setResultat(r)
                            if (r.ok) rafraichir()
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-error/10 hover:text-error transition-colors cursor-pointer text-muted-foreground"
                        >
                          <X className="h-3.5 w-3.5" /> Annuler
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-black text-foreground">{argent(f.montant)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      réglé {argent(f.regle)} · solde {argent(f.solde)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "paiements" && (
        <div className="space-y-4">
          <form action={lancer(enregistrerPaiement)} className="rounded-2xl border border-border bg-card p-5">
            <input type="hidden" name="clientId" value={clientId ?? ""} />
            <input type="hidden" name="matterId" value={matterId} />
            <h3 className="text-sm font-black text-foreground">Enregistrer un paiement</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-[11px] font-bold text-muted-foreground">
                Montant
                <input name="montant" inputMode="decimal" placeholder="0,00" required className={cn(CHAMP, "mt-1 font-mono")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Date
                <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={cn(CHAMP, "mt-1")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Méthode
                <select name="methode" className={cn(CHAMP, "mt-1")}>
                  <option value="interac">Virement Interac</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="card">Carte</option>
                  <option value="cheque">Chèque</option>
                  <option value="cash">Comptant</option>
                  <option value="other">Autre</option>
                </select>
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Référence
                <input name="reference" placeholder="n° de transaction" className={cn(CHAMP, "mt-1")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground sm:col-span-2">
                Facture
                <select name="invoiceId" className={cn(CHAMP, "mt-1")}>
                  <option value="">Aucune</option>
                  {d.factures.map((f) => (
                    <option key={f.id} value={f.id}>{f.numero} — solde {argent(f.solde)}</option>
                  ))}
                </select>
              </label>

              {/* Sans valeur pré-cochée, délibérément : un défaut rendrait le
                  choix facultatif dans les faits, et ce serait « entreprise »
                  qu'on choisirait — donc l'erreur la plus grave. */}
              <fieldset className="sm:col-span-2">
                <legend className="text-[11px] font-bold text-muted-foreground">
                  Compte de destination — obligatoire
                </legend>
                <div className="mt-1 flex gap-2">
                  {[
                    { v: "trust", l: "Fidéicommis", i: Landmark },
                    { v: "business", l: "Compte de l'entreprise", i: Banknote },
                  ].map(({ v, l, i: I }) => (
                    <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                      <input type="radio" name="destination" value={v} required className="accent-[var(--color-primary)]" />
                      <I aria-hidden className="h-3.5 w-3.5" />
                      {l}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <BoutonPetit disabled={enCours} className="mt-3">Enregistrer</BoutonPetit>
          </form>

          {d.finances.soldeFideicommisClient > 0 && (
            <form action={lancer(virerHonoraires)} className="rounded-2xl border border-border bg-muted/30 p-5">
              <input type="hidden" name="clientId" value={clientId ?? ""} />
              <input type="hidden" name="matterId" value={matterId} />
              <h3 className="text-sm font-black text-foreground">Virer des honoraires gagnés</h3>
              <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                Du fidéicommis vers le compte de l&apos;entreprise. Solde disponible :{" "}
                <strong className="text-foreground">{argent(d.finances.soldeFideicommisClient)}</strong>.
                Un virement supérieur au solde est refusé par la base.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-[11px] font-bold text-muted-foreground">
                  Montant
                  <input name="montant" inputMode="decimal" required className={cn(CHAMP, "mt-1 w-32 font-mono")} />
                </label>
                <label className="flex-1 text-[11px] font-bold text-muted-foreground">
                  Motif
                  <input name="memo" defaultValue="Honoraires gagnés" className={cn(CHAMP, "mt-1")} />
                </label>
                <BoutonPetit disabled={enCours}>Virer</BoutonPetit>
              </div>
            </form>
          )}

          {d.paiements.length === 0 && <Vide texte="Aucun paiement enregistré." />}
          {d.paiements.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                  {argent(p.montant)}
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                    p.destination === "trust" ? "bg-primary/10 text-primary-strong" : "bg-muted text-muted-foreground"
                  )}>
                    {p.destination === "trust"
                      ? <><Landmark aria-hidden className="h-3 w-3" /> Fidéicommis</>
                      : <><Banknote aria-hidden className="h-3 w-3" /> Compte de l&apos;entreprise</>}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {p.date} · {p.methode}{p.reference && ` · ${p.reference}`}
                  {p.factureNumero && ` · facture ${p.factureNumero}`}
                </p>
              </div>

              {/* Le reçu se produit AU PAIEMENT, pas à la facturation : la
                  facture dit « vous devez », le reçu dit « vous avez payé ».
                  Il vit donc ici, sur l'encaissement qu'il atteste — et il
                  porte les mêmes gestes qu'une facture, parce qu'un client qui
                  a payé attend sa preuve autant qu'il attendait sa demande. */}
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <a
                  href={`/api/payments/${p.id}/receipt`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" /> Voir le PDF
                </a>

                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setEnvoiAConfirmer({
                    action: "Le client recevra son reçu par courriel, en pièce jointe.",
                    objet: `Reçu du paiement de ${argent(p.montant)}`,
                    objetDetail: `${p.date} · ${p.methode}${p.factureNumero ? ` · facture ${p.factureNumero}` : ""}`,
                    destinataire: { nom: clientName, courriel: courrielClient },
                    // Aucun avertissement d'irréversibilité, et c'est exact :
                    // envoyer un reçu n'écrit rien et ne fige rien. Le même
                    // reçu peut repartir autant de fois qu'un client l'égare.
                    libelleConfirmer: "Envoyer le reçu",
                    executer: async () => {
                      const fd = new FormData()
                      fd.set("id", p.id)
                      fd.set("locale", "fr")
                      return envoyerRecuAuClient(fd)
                    },
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer au client
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "echeances" && (
        <div className="space-y-3">
          <form action={lancer(ajouterEcheance)} className="rounded-2xl border border-border bg-card p-5">
            <input type="hidden" name="matterId" value={matterId} />
            <h3 className="text-sm font-black text-foreground">Ajouter une échéance</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <label className="text-[11px] font-bold text-muted-foreground sm:col-span-2">
                Titre
                <input name="titre" required className={cn(CHAMP, "mt-1")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Date
                <input name="date" type="date" required className={cn(CHAMP, "mt-1")} />
              </label>
              <label className="text-[11px] font-bold text-muted-foreground">
                Priorité
                <select name="priorite" className={cn(CHAMP, "mt-1")}>
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </label>
            </div>
            <BoutonPetit disabled={enCours} className="mt-3">Ajouter</BoutonPetit>
          </form>

          {d.echeances.length === 0 && <Vide texte="Aucune échéance à ce dossier." />}
          {d.echeances.map((e) => {
            const s = STATUT_ECHEANCE[e.status] ?? { texte: e.status, ton: "bg-muted" }
            return (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <h4 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                    {e.title}
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", s.ton)}>
                      {s.texte}
                    </span>
                    {e.isRegulatory && (
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning">
                        réglementaire
                      </span>
                    )}
                  </h4>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock aria-hidden className="h-3 w-3" /> {e.dueOn}
                    </span>
                    {e.assigneeName && <span>Responsable : {e.assigneeName}</span>}
                  </p>
                </div>
                <form action={lancer(changerEtatEcheance)} className="flex shrink-0 gap-1.5">
                  <input type="hidden" name="id" value={e.id} />
                  {e.status !== "done" ? (
                    <>
                      <BoutonPetit disabled={enCours} name="statut" value="in_progress">En cours</BoutonPetit>
                      <BoutonPetit disabled={enCours} name="statut" value="done" ton="success">Terminer</BoutonPetit>
                    </>
                  ) : (
                    <BoutonPetit disabled={enCours} name="statut" value="todo">Rouvrir</BoutonPetit>
                  )}
                </form>
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "portail" && (
        <div className="space-y-4">
          {sansClient ? (
            <form action={lancer(rattacherClient)} className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <input type="hidden" name="matterId" value={matterId} />
              <h3 className="text-sm font-black text-foreground">Rattacher ce dossier à un client</h3>
              <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                Sans client, ni les paiements ni le portail ne peuvent exister : ils appartiennent à
                une personne, pas à un dossier.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-56 flex-1 text-[11px] font-bold text-muted-foreground">
                  Client du cabinet
                  <select name="clientId" required className={cn(CHAMP, "mt-1")}>
                    <option value="">Choisir…</option>
                    {clientsDuCabinet.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom} — {c.dossier}</option>
                    ))}
                  </select>
                </label>
                <BoutonPetit disabled={enCours}>Rattacher</BoutonPetit>
              </div>
              {clientsDuCabinet.length === 0 && (
                <p className="mt-2 text-[11px] italic text-muted-foreground">
                  Aucun client au cabinet. Créez-en un depuis l&apos;écran Clients.
                </p>
              )}
            </form>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
              <Users aria-hidden className="h-4 w-4 text-muted-foreground" />
              Accès du client
            </h3>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Ligne libelle="Compte créé" valeur={d.portail.compteCree ? "Oui" : "Non"} />
              <Ligne libelle="Documents déposés" valeur={`${d.portail.documentsDeposes}`} />
              <Ligne libelle="Validations en attente" valeur={`${d.portail.validationsEnAttente}`} accent={d.portail.validationsEnAttente > 0} />
            </dl>
            {!sansClient && (
              <form
                onSubmit={confirmerPuisEnvoyer(inviterClientAuPortail, () => ({
                  action: d.portail.compteCree
                    ? "Un nouveau mot de passe temporaire va remplacer celui en vigueur."
                    : "Un compte va être créé pour que ce client accède à son portail.",
                  objet: `Accès au portail — ${clientName}`,
                  objetDetail: `Dossier ${matterId}`,
                  destinataire: { nom: clientName, courriel: courrielClient },
                  mode: "Aucun courriel automatique — le mot de passe vous sera affiché à transmettre",
                  // Le bouton dit « Régénérer » sans dire ce que la
                  // régénération coûte au client : son mot de passe actuel
                  // meurt, y compris celui qu'il avait choisi lui-même.
                  irreversible: d.portail.compteCree
                    ? "Ce client a déjà un accès. Son mot de passe actuel cessera immédiatement de fonctionner, et il devra en définir un nouveau."
                    : undefined,
                  libelleConfirmer: d.portail.compteCree ? "Régénérer l'accès" : "Ouvrir l'accès",
                }))}
                className="mt-4 border-t border-border pt-4"
              >
                <input type="hidden" name="clientId" value={clientId ?? ""} />
                <p className="max-w-prose text-xs text-muted-foreground">
                  {d.portail.compteCree
                    ? "Régénérer un mot de passe temporaire, si le client a perdu son accès."
                    : "Ouvrir l'accès crée le compte du client et produit un mot de passe temporaire, à lui transmettre. Il devra le changer à sa première connexion."}
                </p>
                <BoutonPetit disabled={enCours} className="mt-3">
                  {d.portail.compteCree ? "Régénérer l'accès" : "Inviter le client au portail"}
                </BoutonPetit>
              </form>
            )}
          </div>

          {!sansClient && (
          <form
            onSubmit={confirmerPuisEnvoyer(demanderValidation, (fd) => {
              const choisis = fd.getAll("documentId").map(String).filter(Boolean)
              // On renomme les identifiants en libellés : « 3 documents » ne
              // permet pas de vérifier qu'on n'a pas coché le passeport à la
              // place du contrat.
              const noms = choisis
                .map((id) => d.exigences.find((e) => e.documentId === id)?.label ?? "Document")
              const nature = String(fd.get("nature") ?? "validation")
              return {
                action: {
                  validation: "Le client sera invité à confirmer que ces pièces sont exactes.",
                  signature: "Le client sera invité à signer ces pièces.",
                  validation_and_signature: "Le client sera invité à confirmer puis à signer ces pièces.",
                }[nature] ?? "Le client sera sollicité sur ces pièces.",
                objet: noms.length === 0 ? "Aucun document sélectionné" : noms.join(" · "),
                objetDetail: `${choisis.length} document(s) · dossier ${matterId}`,
                destinataire: { nom: clientName, courriel: courrielClient },
                mode: "Portail client",
                message: String(fd.get("message") ?? "") || undefined,
                libelleConfirmer: "Envoyer au client",
              }
            })}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <input type="hidden" name="clientId" value={clientId ?? ""} />
            <input type="hidden" name="matterId" value={matterId} />
            <h3 className="text-sm font-black text-foreground">Demander la validation du client</h3>
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">
              Le client pourra confirmer que les informations sont exactes, ou signaler une erreur en
              expliquant laquelle. Sa confirmation ne vaut pas vérification par le cabinet.
            </p>

            <div className="mt-3 space-y-2">
              {d.exigences.filter((e) => e.documentId).length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  Aucun document au dossier à soumettre pour validation.
                </p>
              ) : (
                d.exigences.filter((e) => e.documentId).map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                    <input type="checkbox" name="documentId" value={e.documentId!} className="accent-[var(--color-primary)]" />
                    {e.label}
                  </label>
                ))
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-[11px] font-bold text-muted-foreground">
                Nature
                <select name="nature" className={cn(CHAMP, "mt-1")}>
                  <option value="validation">Validation seule</option>
                  <option value="signature">Signature seule</option>
                  <option value="validation_and_signature">Validation et signature</option>
                </select>
              </label>
              <label className="text-[11px] font-bold text-muted-foreground sm:col-span-2">
                Message au client
                <input name="message" placeholder="Merci de confirmer que les informations sont exactes." className={cn(CHAMP, "mt-1")} />
              </label>
            </div>
            <BoutonPetit disabled={enCours} className="mt-3">Envoyer au client</BoutonPetit>
          </form>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ */}
      {onglet === "argumentaire" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <SubmissionLetterBuilder
            key={matterId}
            matterId={matterId}
            clientName={clientName}
            programName={programName}
          />
        </div>
      )}

      {/* ============================================================
          MODALES DE QUESTIONNAIRES CLIENTS
          ============================================================ */}
      
      {/* 1. Modale de visualisation (Aperçu) */}
      {selectedReviewQ && (() => {
        const tpl = { sections: selectedReviewQ.sections }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">{selectedReviewQ.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Visualisation des réponses soumises par le candidat.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReviewQ(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {tpl?.sections.map((section) => (
                  <div key={section.id} className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary border-b pb-1">
                      {section.titleFr}
                    </h4>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.fields.map((field) => {
                        const answer = selectedReviewQ.answers[field.key]
                        if (field.type === "repeater") {
                          const items = (answer as Record<string, unknown>[]) || []
                          return (
                            <div key={field.key} className="sm:col-span-2 space-y-2">
                              <span className="text-[11px] font-bold text-muted-foreground block">{field.labelFr}</span>
                              {items.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-xl border border-dashed">Aucun élément fourni.</p>
                              ) : (
                                <div className="space-y-2">
                                  {items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="p-3 border border-border rounded-xl bg-muted/20 space-y-1.5">
                                      {field.fields?.map((sub) => (
                                        <div key={sub.key} className="flex justify-between text-xs">
                                          <span className="text-muted-foreground">{sub.labelFr} :</span>
                                          <span className="font-bold text-foreground">{String(item[sub.key] || "—")}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div key={field.key} className="space-y-1">
                            <span className="text-[11px] font-bold text-muted-foreground block">{field.labelFr}</span>
                            <span className="text-sm font-bold text-foreground">
                              {answer === true ? "Oui" : answer === false ? "Non" : String(answer || "—")}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Historique des modifications */}
                {selectedReviewQ.history.length > 0 && (
                  <div className="pt-6 border-t border-border space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      Historique des modifications par le cabinet
                    </h4>
                    <div className="space-y-2.5">
                      {selectedReviewQ.history.map((h, hIdx) => (
                        <div key={hIdx} className="text-xs p-3 rounded-xl border border-border bg-muted/20 flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Modifié par : <strong>{h.userName}</strong> ({h.userType === "consultant" ? "Cabinet" : "Portail"})</span>
                            <span>{new Date(h.changedAt).toLocaleString("fr-CA")}</span>
                          </div>
                          <p className="text-foreground mt-0.5">
                            Champ « <strong>{h.fieldName}</strong> » changé de <span className="line-through text-muted-foreground font-mono">{JSON.stringify(h.oldValue)}</span> à <span className="font-bold text-foreground font-mono">{JSON.stringify(h.newValue)}</span>.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border flex justify-end gap-2 bg-muted/10">
                <button
                  type="button"
                  onClick={() => setSelectedReviewQ(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 2. Modale d'édition par le consultant */}
      {selectedEditQ && (() => {
        const tpl = { sections: selectedEditQ.sections }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">Modifier : {selectedEditQ.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Modifiez directement les réponses. Toute modification sera journalisée.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEditQ(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {tpl?.sections.map((section) => (
                  <div key={section.id} className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary border-b pb-1">
                      {section.titleFr}
                    </h4>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {section.fields.map((field) => {
                        const val = editAnswers[field.key]
                        if (field.type === "repeater") {
                          const items = (val as Record<string, unknown>[]) || []
                          return (
                            <div key={field.key} className="sm:col-span-2 space-y-2">
                              <span className="text-[11px] font-bold text-muted-foreground block">{field.labelFr}</span>
                              
                              <div className="space-y-3">
                                {items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newList = [...items]
                                        newList.splice(itemIdx, 1)
                                        setEditAnswers(prev => ({ ...prev, [field.key]: newList }))
                                      }}
                                      className="absolute top-3 right-3 text-error hover:text-error/80 text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Retirer
                                    </button>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {field.fields?.map((sub) => (
                                        <label key={sub.key} className="block text-[11px] font-bold text-muted-foreground">
                                          {sub.labelFr} {sub.required && <span className="text-error">*</span>}
                                          <input
                                            type={sub.type === "date" ? "date" : sub.type === "number" ? "number" : "text"}
                                            // Une valeur de répéteur est typée `unknown` : la
                                            // convertir explicitement, et avec ?? plutôt que ||,
                                            // sans quoi un 0 saisi dans un champ numérique
                                            // s'effacerait à l'affichage.
                                            value={String(item[sub.key] ?? "")}
                                            onChange={(e) => {
                                              const newList = [...items]
                                              newList[itemIdx] = { ...newList[itemIdx], [sub.key]: e.target.value }
                                              setEditAnswers(prev => ({ ...prev, [field.key]: newList }))
                                            }}
                                            className={cn(CHAMP, "mt-1")}
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const newList = [...items, {}]
                                    setEditAnswers(prev => ({ ...prev, [field.key]: newList }))
                                  }}
                                  className="px-3 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer text-foreground"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Ajouter un élément
                                </button>
                              </div>
                            </div>
                          )
                        }

                        if (field.type === "select") {
                          return (
                            <label key={field.key} className="block text-[11px] font-bold text-muted-foreground">
                              {field.labelFr} {field.required && <span className="text-error">*</span>}
                              <select
                                value={String(val || "")}
                                onChange={(e) => setEditAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                                className={cn(CHAMP, "mt-1")}
                              >
                                <option value="">Choisir...</option>
                                {field.options?.map(o => (
                                  <option key={o.value} value={o.value}>{o.labelFr}</option>
                                ))}
                              </select>
                            </label>
                          )
                        }

                        if (field.type === "radio") {
                          return (
                            <div key={field.key} className="space-y-1">
                              <span className="text-[11px] font-bold text-muted-foreground block">
                                {field.labelFr} {field.required && <span className="text-error">*</span>}
                              </span>
                              <div className="flex gap-4 mt-1">
                                {field.options?.map(o => (
                                  <label key={o.value} className="flex items-center gap-2 text-xs text-foreground font-bold cursor-pointer">
                                    <input
                                      type="radio"
                                      name={field.key}
                                      value={o.value}
                                      checked={val === o.value}
                                      onChange={() => setEditAnswers(prev => ({ ...prev, [field.key]: o.value }))}
                                      className="accent-primary"
                                    />
                                    {o.labelFr}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <label key={field.key} className="block text-[11px] font-bold text-muted-foreground">
                            {field.labelFr} {field.required && <span className="text-error">*</span>}
                            <input
                              type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                              value={String(val || "")}
                              onChange={(e) => setEditAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                              className={cn(CHAMP, "mt-1")}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 border-t border-border flex justify-end gap-2 bg-muted/10">
                <button
                  type="button"
                  onClick={() => setSelectedEditQ(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    demarrer(async () => {
                      try {
                        const oldAnswers = selectedEditQ.answers
                        const historyLog: QuestionnaireHistoryEntry[] = []
                        
                        if (tpl) {
                          for (const section of tpl.sections) {
                            for (const field of section.fields) {
                              const oldVal = oldAnswers[field.key]
                              const newVal = editAnswers[field.key]
                              if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                                historyLog.push({
                                  userId: consultant.id,
                                  userName: consultant.name,
                                  userType: "consultant",
                                  changedAt: new Date().toISOString(),
                                  sectionId: section.id,
                                  fieldKey: field.key,
                                  fieldName: field.labelFr,
                                  oldValue: oldVal ?? null,
                                  newValue: newVal ?? null
                                })
                              }
                            }
                          }
                        }

                        const updated = await updateQuestionnaireByConsultant(selectedEditQ.id, editAnswers, historyLog)
                        setQuestionnaires((prev) => prev.map((item) => item.id === selectedEditQ.id ? updated : item))
                        setSelectedEditQ(null)
                        setResultat({ ok: true, message: "Questionnaire modifié avec succès par le consultant." })
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err)
                        setResultat({ ok: false, message: msg || "Erreur de modification." })
                      }
                    })
                  }}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 3. Modale de demande de corrections */}
      {nouvelleFacture && (
        <ModaleNouvelleFacture
          matterId={matterId}
          onFermer={() => setNouvelleFacture(false)}
          onCreee={(r) => { setNouvelleFacture(false); setResultat(r); rafraichir() }}
        />
      )}

      {envoiAConfirmer && (
        <ConfirmationEnvoi
          action={envoiAConfirmer.action}
          objet={envoiAConfirmer.objet}
          objetDetail={envoiAConfirmer.objetDetail}
          destinataires={[envoiAConfirmer.destinataire]}
          mode={envoiAConfirmer.mode}
          message={envoiAConfirmer.message}
          irreversible={envoiAConfirmer.irreversible}
          libelleConfirmer={envoiAConfirmer.libelleConfirmer}
          onAnnuler={() => setEnvoiAConfirmer(null)}
          onConfirmer={async () => {
            const r = await envoiAConfirmer.executer()
            setEnvoiAConfirmer(null)
            setResultat(r)
            if (r.ok) rafraichir()
          }}
        />
      )}

      {factureAModifier && (
        <ModaleNouvelleFacture
          matterId={matterId}
          facture={factureAModifier}
          onFermer={() => setFactureAModifier(null)}
          onCreee={(r) => { setFactureAModifier(null); setResultat(r); rafraichir() }}
        />
      )}

      {selectedCorrectionQ && (() => {
        const tpl = { sections: selectedCorrectionQ.sections }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">Demander des corrections</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Spécifiez la section et le motif de la correction demandée au candidat.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCorrectionQ(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <label className="block text-[11px] font-bold text-muted-foreground">
                  Section concernée
                  <select
                    value={selectedCorrectionSection}
                    onChange={(e) => setSelectedCorrectionSection(e.target.value)}
                    className={cn(CHAMP, "mt-1")}
                  >
                    <option value="">Sélectionner une section...</option>
                    {tpl?.sections.map(s => (
                      <option key={s.id} value={s.id}>{s.titleFr}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] font-bold text-muted-foreground">
                  Commentaire / Instructions pour le client
                  <textarea
                    value={newCorrectionComment}
                    onChange={(e) => setNewCorrectionComment(e.target.value)}
                    placeholder="Ex: Le relevé bancaire fourni est expiré ou le nom de famille est mal orthographié."
                    rows={4}
                    className={cn(CHAMP, "mt-1 h-auto py-2")}
                  />
                </label>

                {/* Historique des corrections en suspens */}
                {selectedCorrectionQ.corrections.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground block">Demandes en attente :</span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {selectedCorrectionQ.corrections.map((c, cIdx) => (
                        <div key={cIdx} className="text-xs p-2.5 rounded-lg border border-border bg-error/5 text-error flex justify-between items-start">
                          <div>
                            <span className="font-bold">[{c.sectionId}]</span> {c.comment}
                          </div>
                          <span className="text-[9px] uppercase font-black bg-error/15 px-1.5 py-0.5 rounded shrink-0">
                            {c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border flex justify-end gap-2 bg-muted/10">
                <button
                  type="button"
                  onClick={() => setSelectedCorrectionQ(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedCorrectionSection || !newCorrectionComment.trim()) return
                    demarrer(async () => {
                      try {
                        const newCorr: QuestionnaireCorrection = {
                          sectionId: selectedCorrectionSection,
                          comment: newCorrectionComment.trim(),
                          status: "pending",
                          requestedAt: new Date().toISOString()
                        }
                        const updated = await requestQuestionnaireCorrections(selectedCorrectionQ.id, [newCorr, ...selectedCorrectionQ.corrections])
                        setQuestionnaires((prev) => prev.map((item) => item.id === selectedCorrectionQ.id ? updated : item))
                        setSelectedCorrectionQ(null)
                        setNewCorrectionComment("")
                        setSelectedCorrectionSection("")
                        setResultat({ ok: true, message: "Demande de correction envoyée au client." })
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err)
                        setResultat({ ok: false, message: msg || "Erreur lors de la demande." })
                      }
                    })
                  }}
                  className="px-4 py-2 rounded-xl bg-error hover:bg-error/95 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Envoyer la demande
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

function Carte({ titre, icone: I, children }: { titre: string; icone: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
        <I aria-hidden className="h-4 w-4 text-muted-foreground" />
        {titre}
      </h3>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  )
}

function Ligne({ libelle, valeur, accent }: { libelle: string; valeur: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] text-muted-foreground">{libelle}</dt>
      <dd className={cn("font-mono text-xs font-bold", accent ? "text-warning" : "text-foreground")}>
        {valeur}
      </dd>

    </div>
  )
}

function Vide({ texte }: { texte: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
      {texte}
    </p>
  )
}

function BoutonPetit({
  children, disabled, ton, className, name, value,
}: {
  children: React.ReactNode
  disabled?: boolean
  ton?: "success" | "error" | "neutre"
  className?: string
  name?: string
  value?: string
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50",
        ton === "success" ? "bg-success text-white hover:bg-success/90"
          : ton === "error" ? "border border-error/30 text-error hover:bg-error/10"
          // Neutre : pour que « Téléverser » reste le geste mis en avant et
          // que les autres ne se disputent pas l'attention.
          : ton === "neutre" ? "border border-border text-foreground hover:bg-muted"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
    >
      {children}
    </button>
  )
}


/**
 * Création d'une facture depuis un dossier.
 *
 * Le client et le dossier ne sont pas redemandés : on est déjà dedans. Le
 * numéro n'est pas saisissable non plus — il est calculé à l'enregistrement,
 * et le laisser modifier rouvrirait la porte aux doublons que l'index unique
 * vient de fermer.
 *
 * Les totaux affichés ici sont une ESTIMATION à l'écran. Ceux qui feront foi
 * sont recalculés en base par invoice_totals(), avec les taux du cabinet. Les
 * deux doivent s'accorder ; en cas d'écart, c'est la base qui a raison, et
 * c'est son montant que la liste affichera ensuite.
 */
function ModaleNouvelleFacture({
  matterId, facture, onFermer, onCreee,
}: {
  matterId: string
  /** Présent = on modifie un brouillon existant plutôt que d'en créer un. */
  facture?: { id: string; numero: string; dueOn: string; description: string }
  onFermer: () => void
  onCreee: (r: Resultat) => void
}) {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const dans30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const [date, setDate] = React.useState(aujourdhui)
  const [echeance, setEcheance] = React.useState(facture?.dueOn || dans30)
  const [notes, setNotes] = React.useState(facture?.description ?? "")
  const [lignes, setLignes] = React.useState([
    { description: "", quantite: 1, prixUnitaire: 0, taxable: true },
  ])
  const [chargement, setChargement] = React.useState(Boolean(facture))

  // Les lignes ne voyagent pas avec la fiche du dossier : on les demande à
  // l'ouverture. Les joindre à chaque chargement de dossier alourdirait un
  // écran fréquent pour un formulaire qu'on ouvre rarement.
  React.useEffect(() => {
    if (!facture) return
    let vivant = true
    lignesDeFacture(facture.id).then((l) => {
      if (!vivant) return
      if (l.length > 0) setLignes(l)
      setChargement(false)
    })
    return () => { vivant = false }
  }, [facture])
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const majLigne = (i: number, champ: string, valeur: unknown) =>
    setLignes((prev) => prev.map((l, j) => (j === i ? { ...l, [champ]: valeur } : l)))

  const sousTotal = lignes.reduce((t, l) => t + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
  const imposable = lignes
    .filter((l) => l.taxable)
    .reduce((t, l) => t + (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0), 0)
  const tps = Math.round(imposable * 0.05 * 100) / 100
  const tvq = Math.round(imposable * 0.09975 * 100) / 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-foreground">
              {facture ? `Modifier ${facture.numero}` : "Créer une facture"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {facture
                ? "Un brouillon se modifie librement. Une fois émise, la facture est figée."
                : "Le numéro est attribué à l'enregistrement. La facture naît en brouillon."}
            </p>
          </div>
          <button type="button" onClick={onFermer} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid gap-4 sm:grid-cols-2">
            {!facture && (
              <label className="block">
                <span className="text-[11px] font-bold text-muted-foreground">Date de facturation</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(CHAMP, "mt-1")} />
              </label>
            )}
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Date d&apos;échéance</span>
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={cn(CHAMP, "mt-1")} />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground">Services facturés</span>
            {lignes.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_auto] items-start">
                <input
                  value={l.description}
                  onChange={(e) => majLigne(i, "description", e.target.value)}
                  placeholder="Consultation initiale en immigration"
                  className={CHAMP}
                />
                <input
                  type="number" min="0" step="0.5" value={l.quantite}
                  onChange={(e) => majLigne(i, "quantite", Number(e.target.value))}
                  className={CHAMP}
                />
                <input
                  type="number" min="0" step="0.01" value={l.prixUnitaire}
                  onChange={(e) => majLigne(i, "prixUnitaire", Number(e.target.value))}
                  className={CHAMP}
                />
                <span className="flex items-center gap-1.5 pt-2">
                  {/* Un débours d'IRCC n'est pas taxable là où les honoraires
                      le sont, et les deux figurent sur la même facture. */}
                  <label className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox" checked={l.taxable}
                      onChange={(e) => majLigne(i, "taxable", e.target.checked)}
                    />
                    taxable
                  </label>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLignes((prev) => prev.filter((_, j) => j !== i))}
                      className="text-error hover:text-error/80 cursor-pointer"
                      aria-label="Retirer la ligne"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLignes((prev) => [...prev, { description: "", quantite: 1, prixUnitaire: 0, taxable: true }])}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </button>
          </div>

          <dl className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Sous-total</dt><dd className="font-mono font-bold text-foreground">{argent(sousTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">TPS (5 %)</dt><dd className="font-mono font-bold text-foreground">{argent(tps)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">TVQ (9,975 %)</dt><dd className="font-mono font-bold text-foreground">{argent(tvq)}</dd></div>
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <dt className="font-black text-foreground">Total</dt>
              <dd className="font-mono font-black text-foreground">{argent(sousTotal + tps + tvq)}</dd>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              Estimation aux taux par défaut. Les taux de votre cabinet s&apos;appliquent à
              l&apos;enregistrement, et c&apos;est ce montant-là qui fera foi.
            </p>
          </dl>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>

          {erreur && <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error-strong">{erreur}</p>}
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onFermer} className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours || chargement || sousTotal <= 0}
            onClick={() => {
              setErreur(null)
              demarrer(async () => {
                const fd = new FormData()
                fd.set("matterId", matterId)
                fd.set("date", date)
                fd.set("dueOn", echeance)
                fd.set("notes", notes)
                fd.set("lignes", JSON.stringify(lignes))
                fd.set("locale", "fr")
                const r = facture
                  ? await modifierFacture((fd.set("id", facture.id), fd))
                  : await creerFacture(fd)
                if (r.ok) onCreee(r)
                else setErreur(r.message)
              })
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            <Receipt className="h-4 w-4" />
            {chargement ? "Chargement…" : enCours ? "Enregistrement…" : facture ? "Enregistrer" : "Créer la facture"}
          </button>
        </footer>
      </div>
    </div>
  )
}
