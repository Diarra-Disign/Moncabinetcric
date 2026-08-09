"use server"

import { randomBytes, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentPlatformAdmin, getSessionSupabase } from "@/lib/supabase/session"
import { envoyerCourriel, adresseDeReponse } from "@/lib/email/send"
import { courrielInvitation, type Langue } from "@/lib/email/templates"
import { siteUrl } from "@/lib/site-url"

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
   * Lien d'invitation, renvoyé seulement quand le courriel n'a pas pu
   * partir — fournisseur non configuré, ou refus de sa part. Il n'est
   * affiché qu'une fois : seule son empreinte est conservée en base.
   */
  lien?: string
}

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

    // Même règle qu'à changerPlan, et ici elle évite pire qu'une incohérence
    // d'affichage : un cabinet créé d'emblée en « solo » n'a aucun abonnement,
    // donc firm_access_open() le refuse. On ouvrirait un accès qui se referme
    // à la première connexion, sans que rien n'explique pourquoi.
    if (!PLANS_OCTROYABLES.includes(plan as (typeof PLANS_OCTROYABLES)[number])) {
      return {
        ok: false,
        message:
          "Ouvrez le cabinet en « trial » ou en « courtoisie ». Un plan payant se souscrit " +
          "par le cabinet lui-même, depuis Réglages → Abonnement.",
      }
    }

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
      return { ok: false, message: error.message }
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
        message: `Cabinet créé, mais l'invitation a échoué : ${erreurInvitation.message}`,
      }
    }

    const lien = `${baseUrl()}/${langue}/bienvenue?jeton=${jeton}`
    const message = courrielInvitation({
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

    revalidatePath("/[locale]/admin", "page")

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
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
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

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: "Demande écartée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Plans qu'un exploitant peut accorder lui-même.
 *
 * « solo » et « cabinet » n'en font délibérément pas partie : ce sont des
 * plans payants, et le seul chemin légitime pour y entrer est le paiement.
 * Les accorder d'un clic laissait la console et Stripe se contredire — un
 * cabinet marqué « cabinet » ici, facturé « solo » là-bas.
 *
 * Depuis firm_effective_plan(), cette contradiction ne donne plus de droits
 * indus : les droits suivent l'abonnement. Mais elle produisait encore un
 * tableau de bord qui ment sur son propre chiffre d'affaires, et un
 * exploitant convaincu d'avoir fait passer un client au forfait supérieur
 * alors que rien n'était facturé.
 */
const PLANS_OCTROYABLES = ["trial", "courtoisie"] as const

export async function changerPlan(formData: FormData): Promise<ResultatAction> {
  try {
    await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const plan = String(formData.get("plan") ?? "")
    const jours = Number.parseInt(String(formData.get("jours") ?? "30"), 10)

    if (!id || !plan) return { ok: false, message: "Cabinet ou plan manquant." }

    if (!PLANS_OCTROYABLES.includes(plan as (typeof PLANS_OCTROYABLES)[number])) {
      return {
        ok: false,
        message:
          "Un plan payant ne s'accorde pas depuis cette console : il se souscrit par le cabinet, " +
          "depuis Réglages → Abonnement, et c'est Stripe qui fait foi. " +
          "Pour offrir l'accès complet sans facturer, choisissez « courtoisie ».",
      }
    }

    const echeance =
      plan === "trial"
        ? new Date(Date.now() + (Number.isFinite(jours) && jours > 0 ? jours : 30) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

    const { error } = await supabase
      .from("firms")
      .update({ plan, trial_ends_at: echeance, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: `Plan passé à « ${plan} ».` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function basculerAcces(formData: FormData): Promise<ResultatAction> {
  try {
    await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const suspendre = String(formData.get("suspendre") ?? "") === "1"
    if (!id) return { ok: false, message: "Cabinet manquant." }

    const { error } = await supabase
      .from("firms")
      .update({
        status: suspendre ? "suspended" : "active",
        suspended_at: suspendre ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) return { ok: false, message: error.message }

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
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
