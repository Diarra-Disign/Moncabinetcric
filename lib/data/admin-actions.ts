"use server"

import { randomBytes, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentPlatformAdmin, getSessionSupabase } from "@/lib/supabase/session"
import { getServerSupabase } from "@/lib/supabase/server"
import { envoyerCourriel, adresseDeReponse } from "@/lib/email/send"
import { courrielInvitation, courrielOffreAbonnement, type Langue } from "@/lib/email/templates"
import { getPlan } from "@/lib/billing/catalogue"
import {
  PLANS_ACCORDES,
  abonnementVivant,
  formatMontant,
  libelle,
  modeOuverture,
  type Cadence,
  type Plan,
} from "@/lib/billing/plans"
import { siteUrl } from "@/lib/site-url"
import { journaliserExploitation } from "./platform-audit"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Actions de la console d'exploitation.
 *
 * Chaque action revérifie la qualité d'administrateur côté serveur. Ce
 * n'est pas redondant avec la protection de la route : une action de
 * serveur est un point d'entrée à part entière, appelable directement
 * sans jamais passer par la page. Se fier au fait que le bouton n'est
 * affiché qu'aux administrateurs reviendrait à protéger une porte en
 * cachant la poignée.
 *
 * Les écritures passent par le client de session, donc par la RLS : même
 * si ce contrôle applicatif était contourné, la base refuserait.
 */

export interface ResultatAction {
  ok: boolean
  message: string
  /**
   * Lien d'invitation, renvoyé quand le courriel n'a pas pu partir —
   * fournisseur non configuré, ou refus de sa part — et toujours pour un lien
   * d'abonnement, que l'exploitant peut vouloir transmettre lui-même. Il n'est
   * affiché qu'une fois : seule son empreinte est conservée en base.
   */
  lien?: string
  /** Le courriel est parti : le lien affiché n'est qu'une copie de secours. */
  envoye?: boolean
}

function lireCadence(formData: FormData): Cadence {
  return String(formData.get("cadence") ?? "monthly") === "annual" ? "annual" : "monthly"
}

/** Le montant de l'offre, dans la langue du courriel, au prix du catalogue. */
function prixDeLOffre(forfait: Plan, cadence: Cadence, langue: Langue): string {
  return formatMontant((cadence === "annual" ? forfait.annual : forfait.monthly) ?? 0, langue)
}

/** « Cabinet Pro à 79 $ par mois », pour les messages de la console. */
function resumeOffre(forfait: Plan, cadence: Cadence): string {
  return `${libelle(forfait, "fr")} à ${prixDeLOffre(forfait, cadence, "fr")} ${cadence === "annual" ? "par année" : "par mois"}`
}

/**
 * Écrit l'offre : une ligne d'abonnement « incomplete », sans identifiant
 * d'abonnement Stripe. Elle n'ouvre aucun droit — firm_access_open() et
 * firm_effective_plan() l'ignorent — et présélectionne forfait et périodicité
 * sur l'écran de paiement du client. Le webhook l'écrasera avec ce que Stripe
 * affirme.
 *
 * Clé de service : `firm_subscriptions` n'accorde aucune écriture à un compte
 * authentifié, pas même à l'exploitant. Appelée seulement après
 * exigerAdministrateur().
 *
 * Sur une ligne existante, l'écriture est CONDITIONNELLE : elle ne touche
 * qu'une offre (« incomplete ») ou un abonnement terminé, quel que soit
 * l'identifiant Stripe porté. Si le webhook a écrit un abonnement vivant
 * entre la lecture et cette écriture, rien n'est modifié —
 * sans quoi un cabinet qui vient de payer repasserait en « incomplete » et
 * perdrait son accès. L'identifiant client Stripe est conservé : le cabinet
 * qui revient retrouve ses factures.
 */
async function ecrireOffre(
  firmId: string,
  forfait: Plan,
  cadence: Cadence,
  ligneExistante: boolean
): Promise<{ ecrite: boolean; erreur: string }> {
  const offre = {
    plan: forfait.key,
    cadence,
    seats: forfait.seatsIncluded,
    status: "incomplete",
    updated_at: new Date().toISOString(),
  }
  const service = getServerSupabase()

  if (!ligneExistante) {
    const { error } = await service.from("firm_subscriptions").insert({ firm_id: firmId, ...offre })
    return { ecrite: !error, erreur: error ? messageErreur(error) : "" }
  }

  const { data, error } = await service
    .from("firm_subscriptions")
    .update({
      ...offre,
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      grace_until: null,
    })
    .eq("firm_id", firmId)
    .in("status", ["incomplete", "canceled", "incomplete_expired"])
    .select("id")

  if (error) return { ecrite: false, erreur: messageErreur(error) }
  if (!data?.length) {
    return {
      ecrite: false,
      erreur: "L'abonnement de ce cabinet vient de changer chez Stripe. Rechargez la page avant de réessayer.",
    }
  }
  return { ecrite: true, erreur: "" }
}

/**
 * Le forfait payant demandé, s'il peut partir dans un lien d'abonnement.
 *
 * Lu au catalogue en base, jamais pris tel que le formulaire l'envoie : un
 * forfait non souscriptible ou sans prix arrêté ne doit pas atteindre Stripe.
 */
async function forfaitProposable(cle: string): Promise<Plan | null> {
  const forfait = await getPlan(cle)
  return forfait && modeOuverture(forfait) === "lien" ? forfait : null
}

const REFUS_FORFAIT =
  "Ce forfait ne peut pas être proposé : il n'est pas souscriptible en ligne ou son prix " +
  "n'est pas arrêté. Vérifiez-le dans Console → Catalogue."

async function exigerAdministrateur() {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) throw new Error("Réservé aux administrateurs de la plateforme.")
  return admin
}

/** R suivi de six à huit chiffres ; la longueur varie selon l'époque de délivrance. */
const PERMIS = /^[Rr]-?\d{6,8}$/

/** Validité du lien d'invitation, en jours. */
const VALIDITE_INVITATION = 7

/**
 * Ouvre l'accès d'un cabinet : création, invitation du propriétaire, envoi.
 *
 * Les trois gestes n'en font qu'un délibérément. Séparés, ils laissaient
 * derrière eux des cabinets sans aucun membre — créés, actifs, facturables
 * en apparence, et où personne ne pouvait entrer. C'est arrivé dès le
 * premier essai. Un cabinet sans propriétaire n'est pas un cabinet à
 * moitié ouvert, c'est un cabinet inutilisable : rien ne justifiait d'en
 * rendre l'état atteignable.
 *
 * Le courriel est donc obligatoire — sans lui, personne à inviter.
 */
export async function creerCabinet(formData: FormData): Promise<ResultatAction> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const nom = String(formData.get("nom") ?? "").trim()
    const permis = String(formData.get("permis") ?? "").trim()
    const proprietaire = String(formData.get("proprietaire") ?? "").trim()
    const courriel = String(formData.get("courriel") ?? "").trim().toLowerCase()
    const plan = String(formData.get("plan") ?? "trial")
    const cadence = lireCadence(formData)
    const jours = Number.parseInt(String(formData.get("jours") ?? "30"), 10)
    const langue: Langue = String(formData.get("langue") ?? "fr") === "en" ? "en" : "fr"
    const demandeId = String(formData.get("demandeId") ?? "").trim()

    if (!nom) return { ok: false, message: "La raison sociale est obligatoire." }
    if (!PERMIS.test(permis)) {
      return { ok: false, message: `Permis « ${permis} » non conforme. Attendu : R suivi de 6 à 8 chiffres.` }
    }
    if (!proprietaire) return { ok: false, message: "Le nom du consultant est obligatoire." }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) {
      return { ok: false, message: "Une adresse courriel valide est requise : c'est elle qui recevra l'accès." }
    }

    // Deux chemins, et seulement deux. Essai et courtoisie s'ACCORDENT : l'accès
    // s'ouvre tout de suite, sans facturation. Un forfait payant se PROPOSE :
    // le cabinet est créé fermé, et c'est le paiement confirmé par Stripe —
    // via le webhook — qui l'ouvre. Rien ici n'écrit « payé ».
    const accorde = (PLANS_ACCORDES as readonly string[]).includes(plan)
    const forfait = accorde ? null : await forfaitProposable(plan)
    if (!accorde && !forfait) return { ok: false, message: REFUS_FORFAIT }

    // Un essai sans échéance n'est pas un essai : il devient un accès
    // gratuit permanent que personne ne pense à révoquer.
    const echeance =
      plan === "trial"
        ? new Date(Date.now() + (Number.isFinite(jours) && jours > 0 ? jours : 30) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

    const { data: cabinet, error } = await supabase
      .from("firms")
      .insert({
        name: nom,
        rcic_license_number: permis,
        owner_name: proprietaire,
        email: courriel,
        plan,
        status: "active",
        trial_ends_at: echeance,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        return { ok: false, message: "Un cabinet porte déjà ce numéro de permis." }
      }
      return { ok: false, message: messageErreur(error) }
    }

    // L'échec de l'offre n'arrête pas l'ouverture : le cabinet existe déjà, et
    // sans invitation personne ne pourrait y entrer. Le client choisirait
    // alors son forfait lui-même ; l'exploitant en est averti.
    let avertissementOffre = ""
    if (forfait) {
      const offre = await ecrireOffre(String(cabinet.id), forfait, cadence, false)
      if (!offre.ecrite) {
        avertissementOffre = ` Attention : l'offre n'a pas pu être enregistrée (${offre.erreur}) ; le client choisira son forfait lui-même.`
      }
    }

    // Le jeton n'est jamais stocké : seule son empreinte l'est. Une fuite
    // de la table ne permettrait donc pas de rejouer une invitation.
    const jeton = randomBytes(32).toString("base64url")
    const { error: erreurInvitation } = await supabase.from("invitations").insert({
      firm_id: cabinet.id,
      email: courriel,
      cicc_role: "owner",
      token_hash: createHash("sha256").update(jeton).digest("hex"),
      invited_by: admin.userId,
      expires_at: new Date(Date.now() + VALIDITE_INVITATION * 86400000).toISOString(),
    })

    if (erreurInvitation) {
      // Le cabinet est créé mais nul ne peut y entrer : le dire plutôt que
      // d'annoncer un succès dont il faudrait découvrir la moitié manquante.
      return {
        ok: false,
        message: `Cabinet créé, mais l'invitation a échoué : ${messageErreur(erreurInvitation)}`,
      }
    }

    const lien = `${baseUrl()}/${langue}/bienvenue?jeton=${jeton}`
    const message = forfait
      ? courrielOffreAbonnement({
          langue,
          cabinet: nom,
          forfait: libelle(forfait, langue),
          prix: prixDeLOffre(forfait, cadence, langue),
          cadence,
          lien,
          nouveauCompte: true,
          jours: VALIDITE_INVITATION,
          reponsePossible: Boolean(adresseDeReponse()),
        })
      : courrielInvitation({
          langue,
          cabinet: nom,
          lien,
          jours: VALIDITE_INVITATION,
          reponsePossible: Boolean(adresseDeReponse()),
        })
    const envoi = await envoyerCourriel({
      destinataire: courriel,
      sujet: message.sujet,
      html: message.html,
      texte: message.texte,
    })

    // La demande d'origine, s'il y en a une, cesse d'être en attente.
    if (demandeId) {
      await supabase
        .from("demo_requests")
        .update({
          status: "opened",
          firm_id: cabinet.id,
          handled_at: new Date().toISOString(),
          handled_by: admin.userId,
        })
        .eq("id", demandeId)
    }

    // OUVRIR UN ACCÈS SE CONSIGNE AUTANT QUE LE FERMER. Le courriel
    // d'invitation est noté, pas son jeton : le journal se lit à plusieurs, et
    // un lien d'invitation en clair y resterait valide sept jours.
    await journaliserExploitation({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "firm.create",
      firmId: String(cabinet.id),
      firmName: nom,
      summary: forfait
        ? `Cabinet « ${nom} » créé, lien d'abonnement ${plan} (${cadence}) envoyé`
        : `Cabinet « ${nom} » ouvert au forfait ${plan}`,
      details: {
        plan,
        cadence: forfait ? cadence : null,
        lienAbonnement: Boolean(forfait),
        permis,
        proprietaire: courriel,
        invitationEnvoyee: envoi.envoye,
        demandeId: demandeId || null,
      },
    })

    revalidatePath("/[locale]/admin", "page")

    // Un lien d'abonnement est toujours rendu, même parti par courriel :
    // l'exploitant peut vouloir le transmettre lui-même, à l'issue d'une
    // démonstration par exemple.
    if (forfait) {
      const offre = resumeOffre(forfait, cadence)
      return {
        ok: true,
        message:
          (envoi.envoye
            ? `Cabinet « ${nom} » créé. Lien d'abonnement (${offre}) envoyé à ${courriel}.`
            : `Cabinet « ${nom} » créé, mais le courriel n'est pas parti${envoi.erreur ? ` (${envoi.erreur})` : ""}. Transmettez le lien ci-dessous (${offre}).`) +
          " L'accès s'ouvrira dès que Stripe aura confirmé le paiement." +
          avertissementOffre,
        lien,
        envoye: envoi.envoye,
      }
    }

    if (envoi.envoye) {
      return { ok: true, message: `Cabinet « ${nom} » ouvert. Lien d'accès envoyé à ${courriel}.` }
    }
    return {
      ok: true,
      message: envoi.configure
        ? `Cabinet « ${nom} » ouvert, mais l'envoi a échoué (${envoi.erreur}). Transmettez le lien ci-dessous.`
        : `Cabinet « ${nom} » ouvert. Aucun expéditeur n'est configuré : transmettez le lien ci-dessous.`,
      lien,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Origine des liens envoyés par courriel.
 *
 * Un lien relatif n'a aucun sens dans une boîte de réception : il lui faut
 * un domaine. En développement, l'adresse locale suffit.
 *
 * Délègue à siteUrl() plutôt que de relire APP_URL. La même expression était
 * recopiée à trois endroits, et toutes trois oubliaient d'enlever les espaces :
 * une adresse posée avec un retour à la ligne coupait les liens d'invitation
 * en deux, sans qu'aucune erreur ne se produise nulle part.
 */
function baseUrl(): string {
  return siteUrl()
}

/** Écarte une demande sans y donner suite. */
export async function ecarterDemande(formData: FormData): Promise<ResultatAction> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("demandeId") ?? "").trim()
    if (!id) return { ok: false, message: "Demande manquante." }

    // Écartée, pas supprimée : savoir qu'une demande a été refusée vaut
    // mieux que de la voir disparaître sans trace.
    const { error } = await supabase
      .from("demo_requests")
      .update({
        status: "dismissed",
        handled_at: new Date().toISOString(),
        handled_by: admin.userId,
      })
      .eq("id", id)

    if (error) return { ok: false, message: messageErreur(error) }

    await journaliserExploitation({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "demo.dismiss",
      summary: "Demande de démonstration écartée",
      details: { demandeId: id },
    })

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: "Demande écartée." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/** Ce qu'il faut savoir d'un cabinet avant de lui proposer un forfait. */
interface EtatPourOffre {
  cabinet: { name: string; email: string; plan: string; status: string } | null
  abonnement: { id: string; stripe_subscription_id: string | null; status: string } | null
  proprietaire: { email: string; status: string } | null
  placesOccupees: number
}

/**
 * Pourquoi ce lien ne peut pas partir — ou null s'il le peut.
 *
 * Tout est vérifié AVANT la moindre écriture : un refus tardif laissait une
 * offre enregistrée et un forfait modifié sans qu'aucun lien soit parti.
 */
function refusOffre(etat: EtatPourOffre, forfait: Plan): string | null {
  const { cabinet, abonnement, proprietaire, placesOccupees } = etat
  if (!cabinet) return "Cabinet introuvable."
  if (cabinet.status !== "active") {
    return "Ce cabinet est suspendu : un paiement ne le rouvrirait pas. Levez d'abord la suspension."
  }
  // Le webhook ne remplace jamais une courtoisie (décision de l'exploitant) :
  // un cabinet en courtoisie qui paierait garderait son accès gratuit même
  // après un impayé ou une résiliation.
  if (cabinet.plan === "courtoisie") {
    return "Ce cabinet est en courtoisie, que le paiement ne remplacerait pas. Passez-le d'abord en « trial » : il garde son accès le temps de payer, et le paiement remplacera l'essai."
  }
  // Vivant, avec ou sans identifiant Stripe : une ligne « active » écrite à
  // la main (scripts de vérification, reprise) ouvre l'accès tout autant.
  if (abonnement && abonnementVivant(abonnement.status)) {
    return "Ce cabinet a un abonnement en cours. Il change de forfait lui-même, depuis Réglages → Abonnement, avec proratisation : une offre écrite ici fermerait son accès."
  }
  if (proprietaire && proprietaire.status !== "active") {
    return "Le propriétaire de ce cabinet est suspendu ou révoqué : rétablissez-le avant de lui envoyer un lien."
  }
  if (!proprietaire && !cabinet.email) return "Ce cabinet n'a aucune adresse courriel à inviter."
  // Même règle que le tunnel de paiement, qui refuserait sinon au client un
  // forfait trop petit — au moment précis où il s'apprête à payer.
  if (forfait.maxSeats !== null && placesOccupees > forfait.maxSeats) {
    return `Le forfait « ${forfait.labelFr} » n'admet que ${forfait.maxSeats} place(s) et ce cabinet en occupe ${placesOccupees}. Proposez un forfait supérieur.`
  }
  return null
}

/**
 * Invitation neuve du propriétaire, l'ancienne révoquée.
 *
 * Révoquer d'abord est imposé par la base : une seule invitation peut vivre
 * par adresse et par cabinet. Si la création échoue ensuite, le message le
 * dit — l'ancien lien est mort, et l'exploitant doit le savoir.
 */
async function reinviterProprietaire(opts: {
  firmId: string
  courriel: string
  adminId: string
  langue: Langue
}): Promise<{ lien: string } | { erreur: string }> {
  const supabase = await getSessionSupabase()
  const { error: erreurRevocation } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("firm_id", opts.firmId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    // « _ » et « % » sont des jokers pour ilike : non échappés, jean_x@…
    // révoquerait aussi l'invitation de jean-x@… dans le même cabinet.
    .ilike("email", opts.courriel.replace(/[\\%_]/g, (c) => `\\${c}`))
  if (erreurRevocation) return { erreur: messageErreur(erreurRevocation) }

  const jeton = randomBytes(32).toString("base64url")
  const { error } = await supabase.from("invitations").insert({
    firm_id: opts.firmId,
    email: opts.courriel,
    cicc_role: "owner",
    token_hash: createHash("sha256").update(jeton).digest("hex"),
    invited_by: opts.adminId,
    expires_at: new Date(Date.now() + VALIDITE_INVITATION * 86400000).toISOString(),
  })
  if (error) {
    return {
      erreur: `l'ancienne invitation est révoquée et la nouvelle n'a pas pu être créée (${messageErreur(error)}). Réessayez.`,
    }
  }
  return { lien: `${baseUrl()}/${opts.langue}/bienvenue?jeton=${jeton}` }
}

/**
 * Envoie (ou renvoie) un lien d'abonnement à un cabinet existant.
 *
 * L'offre ne touche à rien de ce qui ouvre l'accès : un cabinet en essai le
 * garde jusqu'à ce qu'il paie, et c'est le webhook qui remplacera l'essai.
 * Refusée pour un abonnement Stripe vivant (il appartient au webhook) et pour
 * la courtoisie (le paiement ne la remplacerait pas) ; acceptée pour un
 * abonnement terminé, que le cabinet peut ainsi reprendre.
 *
 * Le lien dépend de l'avancement du client : sans compte, une invitation
 * neuve ; avec un compte, la page d'abonnement, derrière la connexion.
 */
export async function envoyerLienAbonnement(formData: FormData): Promise<ResultatAction> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const firmId = String(formData.get("firmId") ?? "").trim()
    const cadence = lireCadence(formData)
    const langue: Langue = String(formData.get("langue") ?? "fr") === "en" ? "en" : "fr"
    if (!firmId) return { ok: false, message: "Cabinet manquant." }

    const forfait = await forfaitProposable(String(formData.get("plan") ?? ""))
    if (!forfait) return { ok: false, message: REFUS_FORFAIT }

    const [{ data: cabinet }, { data: abonnement }, { data: proprietaire }, { data: places }] =
      await Promise.all([
        supabase.from("firms").select("name, email, plan, status").eq("id", firmId).maybeSingle(),
        supabase
          .from("firm_subscriptions")
          .select("id, stripe_subscription_id, status")
          .eq("firm_id", firmId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("email, status")
          .eq("firm_id", firmId)
          .eq("cicc_role", "owner")
          .order("status", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase.rpc("firm_seats_taken", { f_id: firmId }),
      ])

    const refus = refusOffre(
      { cabinet, abonnement, proprietaire, placesOccupees: Number(places ?? 0) },
      forfait
    )
    if (refus || !cabinet) return { ok: false, message: refus ?? "Cabinet introuvable." }

    const offre = await ecrireOffre(firmId, forfait, cadence, Boolean(abonnement?.id))
    if (!offre.ecrite) return { ok: false, message: offre.erreur }

    // Un cabinet déjà sur un forfait payant, sans abonnement vivant, suit
    // l'offre : sans cela la console afficherait un forfait et en proposerait
    // un autre. L'essai reste : il ouvre l'accès d'ici au paiement.
    if (cabinet.plan !== "trial") {
      const { error } = await supabase
        .from("firms")
        .update({ plan: forfait.key, updated_at: new Date().toISOString() })
        .eq("id", firmId)
        // Seulement si rien n'a changé depuis la lecture : un webhook passé
        // entre-temps a écrit le forfait réellement payé, qui doit rester.
        .eq("plan", cabinet.plan)
      if (error) return { ok: false, message: `Offre enregistrée, mais le forfait du cabinet n'a pas suivi : ${messageErreur(error)}` }
    }

    const nom = String(cabinet.name ?? "")
    const destinataire = String(proprietaire?.email ?? cabinet.email).toLowerCase()
    let lien = `${baseUrl()}/${langue}/settings/subscription`
    if (!proprietaire) {
      const invitation = await reinviterProprietaire({
        firmId,
        courriel: destinataire,
        adminId: admin.userId,
        langue,
      })
      if ("erreur" in invitation) {
        return { ok: false, message: `Offre enregistrée, mais ${invitation.erreur}` }
      }
      lien = invitation.lien
    }

    const courriel = courrielOffreAbonnement({
      langue,
      cabinet: nom,
      forfait: libelle(forfait, langue),
      prix: prixDeLOffre(forfait, cadence, langue),
      cadence,
      lien,
      nouveauCompte: !proprietaire,
      jours: VALIDITE_INVITATION,
      reponsePossible: Boolean(adresseDeReponse()),
    })
    const envoi = await envoyerCourriel({
      destinataire,
      sujet: courriel.sujet,
      html: courriel.html,
      texte: courriel.texte,
    })

    await journaliserExploitation({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "firm.subscription_link",
      firmId,
      firmName: nom,
      summary: `Lien d'abonnement ${forfait.key} (${cadence}) pour « ${nom} »`,
      details: {
        plan: forfait.key,
        cadence,
        planAvant: cabinet.plan ?? null,
        abonnementTermine: abonnement?.status ?? null,
        // L'offre efface l'identifiant d'un abonnement terminé : le journal le garde.
        abonnementPrecedent: abonnement?.stripe_subscription_id ?? null,
        nouvelleInvitation: !proprietaire,
        envoye: envoi.envoye,
      },
    })

    revalidatePath("/[locale]/admin", "page")

    const libelleOffre = resumeOffre(forfait, cadence)
    return {
      ok: true,
      message: envoi.envoye
        ? `Lien d'abonnement (${libelleOffre}) envoyé à ${destinataire}.`
        : `Offre enregistrée (${libelleOffre}), mais le courriel n'est pas parti${envoi.erreur ? ` (${envoi.erreur})` : ""}. Transmettez le lien ci-dessous.`,
      lien,
      envoye: envoi.envoye,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function changerPlan(formData: FormData): Promise<ResultatAction> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const plan = String(formData.get("plan") ?? "")
    const jours = Number.parseInt(String(formData.get("jours") ?? "30"), 10)

    if (!id || !plan) return { ok: false, message: "Cabinet ou plan manquant." }

    // Un plan payant ne s'ACCORDE pas : il se propose par lien d'abonnement,
    // et c'est Stripe qui fait foi. L'accorder ici donnait une console qui
    // annonçait un forfait que rien ne facturait.
    if (!(PLANS_ACCORDES as readonly string[]).includes(plan)) {
      return {
        ok: false,
        message:
          "Un plan payant ne s'accorde pas depuis cette console : envoyez un lien d'abonnement, " +
          "c'est Stripe qui fait foi. Pour offrir l'accès complet sans facturer, choisissez « courtoisie ».",
      }
    }

    const echeance =
      plan === "trial"
        ? new Date(Date.now() + (Number.isFinite(jours) && jours > 0 ? jours : 30) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

    const { data: avant } = await supabase
      .from("firms").select("name, plan, trial_ends_at").eq("id", id).maybeSingle()

    const { error } = await supabase
      .from("firms")
      .update({ plan, trial_ends_at: echeance, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return { ok: false, message: messageErreur(error) }

    await journaliserExploitation({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "firm.plan",
      firmId: id,
      firmName: String(avant?.name ?? ""),
      summary: `Forfait de « ${avant?.name ?? id} » : ${avant?.plan ?? "—"} → ${plan}`,
      details: { avant: avant?.plan ?? null, apres: plan, echeance },
    })

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: `Plan passé à « ${plan} ».` }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function basculerAcces(formData: FormData): Promise<ResultatAction> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const suspendre = String(formData.get("suspendre") ?? "") === "1"
    if (!id) return { ok: false, message: "Cabinet manquant." }

    // Le nom est relevé AVANT : après la bascule, le journal n'aurait qu'un
    // identifiant, et une ligne d'audit qu'il faut résoudre pour comprendre
    // n'est pas lue.
    const { data: avant } = await supabase
      .from("firms").select("name, status").eq("id", id).maybeSingle()

    const { error } = await supabase
      .from("firms")
      .update({
        status: suspendre ? "suspended" : "active",
        suspended_at: suspendre ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) return { ok: false, message: messageErreur(error) }

    // FERMER UN CABINET EST LE GESTE LE PLUS LOURD DE CETTE CONSOLE, et il ne
    // laissait aucune trace : `journaliser()` vivait dans catalogue-actions.ts
    // et n'était appelée que par les gestes du catalogue. Modifier un prix
    // s'écrivait au journal, couper l'accès à un cabinet non.
    await journaliserExploitation({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: suspendre ? "firm.suspend" : "firm.resume",
      firmId: id,
      firmName: String(avant?.name ?? ""),
      summary: suspendre
        ? `Accès fermé pour « ${avant?.name ?? id} »`
        : `Accès rouvert pour « ${avant?.name ?? id} »`,
      details: { avant: avant?.status ?? null, apres: suspendre ? "suspended" : "active" },
    })

    revalidatePath("/[locale]/admin", "page")
    return {
      ok: true,
      // La suspension prend effet à la requête suivante : le verrou est
      // porté par current_firm_id(), évaluée à chaque appel.
      message: suspendre
        ? "Accès fermé. L'effet est immédiat, sans redéploiement."
        : "Accès rouvert.",
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
