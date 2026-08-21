import "server-only"

import { headers } from "next/headers"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Limitation de débit des chemins ouverts sans session.
 *
 * ─── CE QUE CE MODULE PROTÈGE, ET CE QU'IL NE PROTÈGE PAS ──────────────────
 *
 * Il couvre les points d'entrée qu'on atteint SANS COMPTE : le formulaire de
 * démonstration, et les chemins à jeton de la signature. Ce sont les seuls
 * qu'un inconnu peut marteler.
 *
 * IL NE COUVRE PAS LA CONNEXION, et il faut le dire clairement plutôt que de
 * laisser croire le contraire. `sign-in-form.tsx` est un composant CLIENT qui
 * appelle `supabase.auth.signInWithPassword()` directement : la requête part du
 * navigateur vers Supabase sans passer par ce serveur. Une garde écrite ici ne
 * verrait jamais ces tentatives, et une garde écrite dans le composant se
 * contournerait en appelant l'API Supabase à la main.
 *
 * Le seul endroit qui puisse arrêter une attaque par dictionnaire sur la
 * connexion est donc Supabase Auth lui-même, dont la limitation se règle dans
 * la console du projet. C'est une configuration, pas du code.
 */

/** Quotas, par fenêtre. Volontairement lâches : on arrête l'abus, pas l'usage. */
export const QUOTAS = {
  /** Formulaire de démonstration : un visiteur légitime le remplit une fois. */
  demo: { max: 5, secondes: 3600 },
  /** Consultation d'un document à signer — on relit, on hésite, on revient. */
  jetonLecture: { max: 120, secondes: 3600 },
  /** Apposition ou refus de signature : quelques essais suffisent. */
  jetonEcriture: { max: 20, secondes: 3600 },
  /** Consultation de la page publique de réservation — on regarde, on hésite. */
  rdvLecture: { max: 60, secondes: 3600 },
  /** Réservation effective : trois par heure et par adresse suffisent
      largement à un client honnête, et arrêtent qui remplirait l'agenda. */
  rdvEcriture: { max: 3, secondes: 3600 },
} as const

/**
 * L'adresse de l'appelant, telle que l'hébergeur la rapporte.
 *
 * `x-forwarded-for` peut porter une chaîne de mandataires ; le premier élément
 * est le client. En-tête falsifiable en théorie — mais derrière Vercel, c'est
 * la plateforme qui la réécrit. Le repli sur « inconnue » regroupe alors tous
 * les appels sans adresse sous une même clé, ce qui les limite ENSEMBLE :
 * pour un chemin public, mieux vaut une limite grossière qu'aucune.
 */
async function adresse(): Promise<string> {
  try {
    const h = await headers()
    const chaine = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? ""
    return chaine.split(",")[0]?.trim() || "inconnue"
  } catch {
    return "inconnue"
  }
}

/**
 * Autorise, ou non, un passage.
 *
 * ─── POURQUOI ÇA LAISSE PASSER EN CAS DE PANNE ─────────────────────────────
 *
 * Si la base ne répond pas, la fonction renvoie `true`. C'est un choix, et il
 * mérite d'être conscient : refuser fermerait le formulaire de démonstration et
 * les liens de signature déjà envoyés à des clients au moindre incident de
 * base. La limitation de débit est un CONFORT DE PROTECTION, jamais le verrou
 * qui garde les données — celui-là, c'est la RLS, et elle ne dépend pas d'ici.
 */
export async function autorise(
  action: keyof typeof QUOTAS,
  discriminant?: string
): Promise<boolean> {
  const { max, secondes } = QUOTAS[action]
  const cle = `${action}:${discriminant ?? (await adresse())}`

  try {
    const sb = getServerSupabase()
    const { data, error } = await sb.rpc("limiter", {
      p_cle: cle,
      p_max: max,
      p_secondes: secondes,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}

/** Le message rendu à qui dépasse — sans jamais dire quel est le quota. */
export const TROP_DE_TENTATIVES =
  "Trop de tentatives. Réessayez dans une heure."
