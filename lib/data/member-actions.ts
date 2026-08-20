"use server"

import { randomBytes, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"
import { exigerPermission } from "@/lib/auth/permissions"
import { synchroniserSiegesStripe } from "@/lib/billing/seat-sync"
import { messageErreur } from "@/lib/data/erreurs"
import { STATUTS_MEMBRE, type StatutMembre } from "./membre-criteres"

/**
 * Gestion des membres d'un cabinet, depuis l'écran Paramètres.
 *
 * Toutes ces actions sont réservées au propriétaire du cabinet. La
 * vérification est refaite ici à chaque appel : une action de serveur
 * s'appelle directement, sans passer par la page qui masque les boutons.
 *
 * La RLS applique la même règle en base — les politiques d'écriture sur
 * profiles exigent is_firm_owner(). Ce contrôle applicatif sert à rendre
 * l'erreur lisible, pas à assurer la sécurité.
 */

export interface ResultatMembre {
  ok: boolean
  message: string
  /** Lien d'invitation, affiché une seule fois : seule l'empreinte est stockée. */
  lien?: string
}

const ROLES = ["owner", "rcic", "risia", "staff", "bookkeeper", "readonly"] as const

async function exigerProprietaire() {
  // Le nom reste, la règle change : ce n'est plus le rôle « owner » qui
  // ouvre, mais une permission nommée. Un cabinet peut donc la déléguer
  // sans distribuer le reste des droits du propriétaire.
  return exigerPermission("firm.members")
}

export async function inviterMembre(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const courriel = String(formData.get("courriel") ?? "").trim().toLowerCase()
    const role = String(formData.get("role") ?? "staff")
    const jours = Number.parseInt(String(formData.get("jours") ?? "7"), 10)

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) {
      return { ok: false, message: "Adresse courriel non valide." }
    }
    if (!ROLES.includes(role as (typeof ROLES)[number])) {
      return { ok: false, message: `Rôle « ${role} » inconnu.` }
    }

    // Un membre déjà rattaché ne doit pas recevoir d'invitation : elle
    // créerait un second profil pour la même personne.
    const { data: existant } = await supabase
      .from("profiles")
      .select("id")
      .eq("firm_id", membre.firmId)
      .eq("email", courriel)
      .maybeSingle()
    if (existant) {
      return { ok: false, message: "Cette personne est déjà membre du cabinet." }
    }

    // Le jeton n'est jamais stocké : seule son empreinte l'est. Une fuite
    // de la table ne permettrait donc pas de rejouer une invitation.
    const jeton = randomBytes(32).toString("base64url")
    const empreinte = createHash("sha256").update(jeton).digest("hex")
    const validite = Number.isFinite(jours) && jours > 0 ? jours : 7

    const { error } = await supabase.from("invitations").insert({
      firm_id: membre.firmId,
      email: courriel,
      cicc_role: role,
      token_hash: empreinte,
      expires_at: new Date(Date.now() + validite * 86400000).toISOString(),
    })

    if (error) return { ok: false, message: messageErreur(error) }

    // Une invitation vivante occupe une place, donc en facture une : la
    // réconciliation part maintenant et non à l'acceptation, sans quoi le
    // plafond et la facture parleraient de deux effectifs différents.
    const sync = await synchroniserSiegesStripe(membre.firmId)

    revalidatePath("/[locale]/settings", "page")
    return {
      ok: true,
      message:
        `Invitation créée pour ${courriel}. Le lien n'est affiché qu'une fois.` +
        (sync.modifie ? ` ${sync.message}` : ""),
      lien: `/fr/bienvenue?jeton=${jeton}`,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function changerRole(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const profilId = String(formData.get("profilId") ?? "")
    const role = String(formData.get("role") ?? "")
    if (!profilId || !ROLES.includes(role as (typeof ROLES)[number])) {
      return { ok: false, message: "Membre ou rôle manquant." }
    }

    // Se rétrograder soi-même laisserait le cabinet sans propriétaire :
    // plus personne ne pourrait inviter ni modifier l'identité.
    const { data: cible } = await supabase
      .from("profiles")
      .select("user_id, cicc_role")
      .eq("id", profilId)
      .maybeSingle()

    if (cible?.user_id === membre.userId && role !== "owner") {
      return {
        ok: false,
        message: "Vous ne pouvez pas vous retirer le rôle de propriétaire. Promouvez d'abord quelqu'un d'autre.",
      }
    }

    const { error } = await supabase.from("profiles").update({ cicc_role: role }).eq("id", profilId)
    if (error) return { ok: false, message: messageErreur(error) }

    // Le prix d'une place dépend du rôle qui l'occupe : passer une adjointe
    // consultante change ce que le cabinet paie.
    const sync = await synchroniserSiegesStripe(membre.firmId)

    revalidatePath("/[locale]/settings", "page")
    return { ok: true, message: "Rôle mis à jour." + (sync.modifie ? ` ${sync.message}` : "") }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}


const LIBELLE_STATUT: Record<StatutMembre, string> = {
  active: "réactivé : l'accès est rouvert immédiatement",
  suspended: "suspendu : l'accès est fermé, la place est libérée, rien n'est perdu",
  revoked: "révoqué : l'accès est fermé définitivement, l'historique est conservé",
}

/**
 * Change le statut d'un membre — sans jamais supprimer sa ligne.
 *
 * Remplace l'ancien `retirerMembre`, qui faisait un DELETE sur `profiles`.
 * Ce n'était pas une ligne d'annuaire : c'est le rattachement qui relie un
 * compte à son cabinet, et à travers lui toute la traçabilité de ce que la
 * personne a fait. La supprimer n'était pas fermer un accès, c'était effacer
 * la réponse à « qui a déposé cette pièce » — dans une application où cette
 * réponse a une valeur déontologique.
 *
 * L'effet est immédiat et ne dépend d'aucun redéploiement : le verrou est
 * current_firm_id(), évaluée à chaque requête. Un membre suspendu dont la
 * session est encore ouverte se voit refuser dès sa requête suivante.
 */
export async function changerStatutMembre(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const profilId = String(formData.get("profilId") ?? "")
    const statut = String(formData.get("statut") ?? "") as StatutMembre

    if (!profilId) return { ok: false, message: "Membre manquant." }
    if (!STATUTS_MEMBRE.includes(statut)) return { ok: false, message: "Statut inconnu." }

    const { data: cible } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, cicc_role")
      .eq("id", profilId)
      .maybeSingle()

    if (!cible) return { ok: false, message: "Membre introuvable dans ce cabinet." }

    // Un propriétaire qui se ferme la porte laisse un cabinet sans personne
    // pour la rouvrir — la même impasse que les cabinets sans propriétaire
    // rencontrée aux premiers essais. La politique RLS le refuse déjà ;
    // ceci ne fait que produire un message compréhensible.
    if (cible.user_id === membre.userId) {
      return { ok: false, message: "Vous ne pouvez pas modifier votre propre accès." }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        status: statut,
        status_at: new Date().toISOString(),
        status_by: membre.userId,
        status_note: String(formData.get("motif") ?? "").trim() || null,
      })
      .eq("id", profilId)

    if (error) return { ok: false, message: messageErreur(error) }

    const sync = await synchroniserSiegesStripe(membre.firmId)

    revalidatePath("/[locale]/settings", "page")
    const qui = cible.full_name || cible.email || "Le membre"
    return {
      ok: true,
      message: `${qui} — ${LIBELLE_STATUT[statut]}.` + (sync.modifie ? ` ${sync.message}` : ""),
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function revoquerInvitation(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("invitationId") ?? "")
    if (!id) return { ok: false, message: "Invitation manquante." }

    const { error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("accepted_at", null)

    if (error) return { ok: false, message: messageErreur(error) }

    const sync = await synchroniserSiegesStripe(membre.firmId)

    revalidatePath("/[locale]/settings", "page")
    return {
      ok: true,
      message: "Invitation révoquée. Le lien ne fonctionne plus." + (sync.modifie ? ` ${sync.message}` : ""),
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
