"use server"

import { randomInt } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"
import { exigerPermission } from "@/lib/auth/permissions"

/**
 * Ouverture d'un accès au portail pour un client du cabinet.
 *
 * Ce module existe parce que l'écran qui l'appelle n'appelait rien. Il tirait
 * un mot de passe au hasard dans le navigateur, l'affichait, et annonçait
 * « accès copié ». Aucun compte n'était créé, aucun mot de passe posé : le
 * consultant transmettait à son client un identifiant qui ne fonctionnait
 * pas, et ne pouvait s'en apercevoir qu'en l'entendant se plaindre.
 *
 * Deux règles gouvernent ce qui suit.
 *
 * · Le mot de passe est engendré ICI, côté serveur, avec un générateur
 *   cryptographique. Un secret produit par Math.random() dans un navigateur
 *   est devinable ; celui-ci ouvre l'accès au dossier d'immigration d'une
 *   personne réelle.
 *
 * · Le client visé est lu par le client de session, donc sous RLS. Un
 *   identifiant de client appartenant à un autre cabinet ne renvoie
 *   simplement aucune ligne — il n'y a pas de filtre applicatif à oublier.
 */

export interface ResultatAccesPortail {
  ok: boolean
  message: string
  /**
   * Mot de passe temporaire, rendu une seule fois.
   *
   * Il n'est conservé nulle part en clair : Supabase n'en garde qu'une
   * empreinte. Perdu, il se remplace en rouvrant l'accès.
   */
  motDePasse?: string
  courriel?: string
}

/** Seul le propriétaire gère les accès : la politique RLS l'exige déjà. */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Alphabet sans caractères ambigus.
 *
 * Ni O ni 0, ni I ni l ni 1. Ce mot de passe se lit au téléphone et se
 * recopie à la main : une ambiguïté typographique coûte un appel de plus,
 * et fait croire à une panne.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
const LONGUEUR = 14

function motDePasseTemporaire(): string {
  let sortie = ""
  for (let i = 0; i < LONGUEUR; i++) sortie += ALPHABET[randomInt(ALPHABET.length)]
  // Coupé en groupes de quatre : plus court à dicter, plus sûr à recopier.
  return sortie.replace(/(.{4})(?=.)/g, "$1-")
}

/**
 * Crée ou réinitialise l'accès au portail d'un client.
 *
 * Rejouable sans dommage : si le compte existe déjà, son mot de passe est
 * remplacé et le rattachement laissé tel quel. C'est le comportement attendu
 * d'un bouton « régénérer », et c'est aussi ce qui permet de dépanner un
 * client qui a perdu son accès.
 */
export async function ouvrirAccesPortail(formData: FormData): Promise<ResultatAccesPortail> {
  try {
    // Déléguable : une adjointe peut ouvrir les accès portail sans porter
    // pour autant les droits du propriétaire sur l'abonnement ou les membres.
    const membre = await exigerPermission("portal.manage")

    const clientId = String(formData.get("clientId") ?? "").trim()
    if (!clientId) return { ok: false, message: "Client manquant." }

    // Lecture sous RLS : un client d'un autre cabinet ne renvoie rien.
    const session = await getSessionSupabase()
    const { data: client } = await session
      .from("clients")
      .select("id, name, email")
      .eq("id", clientId)
      .maybeSingle()

    if (!client) {
      return { ok: false, message: "Client introuvable dans ce cabinet." }
    }

    const courriel = String(client.email ?? "").trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) {
      return {
        ok: false,
        message:
          "Ce client n'a pas d'adresse courriel valide. C'est elle qui sert d'identifiant : renseignez-la d'abord sur sa fiche.",
      }
    }

    const admin = serviceClient()
    const motDePasse = motDePasseTemporaire()

    // Le compte peut déjà exister : client d'un second cabinet, ou accès
    // rouvert. On ne recrée rien, on repose le mot de passe.
    const { data: liste } = await admin.auth.admin.listUsers()
    const existant = (liste?.users ?? []).find(
      (u) => u.email?.toLowerCase() === courriel
    )

    let userId: string

    if (existant) {
      const { error } = await admin.auth.admin.updateUserById(existant.id, {
        password: motDePasse,
        // Porté par app_metadata et non user_metadata : un compte authentifié
        // peut modifier son user_metadata, et se débarrasserait donc lui-même
        // de l'obligation de changer de mot de passe.
        app_metadata: { ...existant.app_metadata, must_change_password: true },
      })
      if (error) return { ok: false, message: `Compte existant : ${error.message}` }
      userId = existant.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel,
        password: motDePasse,
        // Le cabinet répond de l'adresse : exiger du client qu'il confirme un
        // courriel avant de pouvoir se connecter ajouterait une étape que
        // personne ne lui a annoncée.
        email_confirm: true,
        app_metadata: { must_change_password: true },
      })
      if (error || !data.user) {
        return { ok: false, message: `Création du compte : ${error?.message ?? "échec"}` }
      }
      userId = data.user.id
    }

    // Rattachement par le client de session : la politique
    // client_users_firm_manage exige le cabinet courant ET la qualité de
    // propriétaire. Le contrôle applicatif ci-dessus ne fait que produire un
    // message lisible — même contourné, la base refuserait.
    const { error: erreurLien } = await session.from("client_users").upsert(
      {
        user_id: userId,
        client_id: client.id,
        firm_id: membre.firmId,
        email: courriel,
      },
      { onConflict: "user_id" }
    )

    if (erreurLien) {
      return {
        ok: false,
        message: `Le compte existe mais n'a pas pu être rattaché au dossier : ${erreurLien.message}`,
      }
    }

    revalidatePath("/[locale]/clients", "page")

    return {
      ok: true,
      message: `Accès ouvert pour ${client.name}. Le mot de passe ci-dessous ne sera plus affiché.`,
      motDePasse,
      courriel,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Lève l'obligation de changer de mot de passe, une fois qu'elle est remplie.
 *
 * Appelée après que le client a effectivement posé son nouveau mot de passe.
 * Le drapeau vit dans app_metadata, hors de portée du compte lui-même : seule
 * la clé de service peut l'effacer, et elle ne le fait qu'ici, pour
 * l'utilisateur de la session en cours — jamais pour un identifiant reçu en
 * paramètre.
 */
export async function leverChangementObligatoire(): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await getSessionSupabase()
    const {
      data: { user },
    } = await session.auth.getUser()

    if (!user) return { ok: false, message: "Session absente." }

    const admin = serviceClient()
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, must_change_password: false },
    })

    if (error) return { ok: false, message: error.message }
    return { ok: true, message: "Mot de passe enregistré." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
