"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase, getCurrentPlatformAdmin } from "@/lib/supabase/session"
import { getServerSupabase } from "@/lib/supabase/server"
import { envoyerCourriel, adresseDeReponse } from "@/lib/email/send"
import { courrielDemandeAide } from "@/lib/email/templates"
import { siteUrl } from "@/lib/site-url"

/**
 * Demandes d'aide déposées depuis un écran d'accès fermé.
 *
 * ─── CE QUE CE MODULE REMPLACE ─────────────────────────────────────────────
 *
 * Un lien `mailto:`. Il ne faisait rien chez qui lit son courrier dans un
 * onglet — la majorité —, et pointait qui plus est vers une adresse dont le
 * domaine n'avait aucun serveur de courrier entrant. Un écran cul-de-sac ne
 * doit dépendre ni du client de messagerie du visiteur, ni d'un enregistrement
 * DNS : les deux sont hors du produit, et les deux échouent en silence.
 *
 * ─── POURQUOI L'ÉCRITURE PASSE PAR LA SESSION ──────────────────────────────
 *
 * Et non par la clé de service, contrairement au formulaire de démonstration.
 * La différence tient à qui écrit : un prospect n'a pas de session, un membre
 * bloqué en a une. Faire passer l'écriture par la RLS garantit qu'une demande
 * ne peut être déposée QUE pour son propre cabinet — l'identifiant est ici
 * fourni par le serveur, mais la politique le revérifie, et c'est elle qui
 * tient si ce code venait à changer.
 *
 * La politique `support_requests_create` est la seule du schéma bâtie pour
 * fonctionner ALORS QUE L'ACCÈS EST FERMÉ ; sa migration explique comment.
 */

const Demande = z.object({
  message: z
    .string()
    .trim()
    .min(10, "Décrivez la situation en quelques mots.")
    .max(2000, "Message trop long."),
  langue: z.enum(["fr", "en"]).optional().default("fr"),
})

export interface ResultatAide {
  ok: boolean
  /** Clé de message rendue par l'appelant, jamais une phrase : l'écran est bilingue. */
  cle?: "sent" | "already" | "invalid" | "error"
  /** Détail seulement quand la validation a quelque chose d'utile à dire. */
  detail?: string
}

export async function demanderAide(formData: FormData): Promise<ResultatAide> {
  const membre = await getCurrentMember()
  // Sans profil, rien à rattacher. Le cas ne devrait pas se produire — cet
  // écran n'est rendu qu'à un membre — mais une action de serveur est un
  // point d'entrée à part entière, appelable sans jamais passer par la page.
  if (!membre) return { ok: false, cle: "error" }

  const analyse = Demande.safeParse({
    message: formData.get("message"),
    langue: formData.get("langue") ?? "fr",
  })
  if (!analyse.success) {
    return { ok: false, cle: "invalid", detail: analyse.error.issues[0]?.message }
  }

  const supabase = await getSessionSupabase()

  // L'état du cabinet est RECOPIÉ dans la demande, pas joint. Trois jours plus
  // tard, la jointure montrerait l'état courant — peut-être déjà modifié par
  // l'exploitant lui-même — et non ce que la personne avait sous les yeux.
  const [{ data: cabinet }, { data: abonnement }] = await Promise.all([
    supabase.from("firms").select("plan, status").eq("id", membre.firmId).maybeSingle(),
    supabase.from("firm_subscriptions").select("status").maybeSingle(),
  ])

  const ligne = {
    firm_id: membre.firmId,
    requested_by: membre.userId,
    requester_name: membre.fullName || membre.email,
    requester_email: membre.email,
    firm_plan: (cabinet?.plan as string) ?? "",
    firm_status: (cabinet?.status as string) ?? "",
    subscription_status: (abonnement?.status as string) ?? "",
    message: analyse.data.message,
    locale: analyse.data.langue,
  }

  const { error } = await supabase.from("support_requests").insert(ligne)

  if (error) {
    // 23505 : l'index unique refuse une seconde demande en attente. Ce n'est
    // pas un échec, c'est le comportement voulu — et il faut le dire
    // autrement, sinon la personne bloquée croit que rien n'est parti et
    // recommence.
    if (error.code === "23505") return { ok: true, cle: "already" }
    return { ok: false, cle: "error" }
  }

  await previenirExploitation({ ...ligne, cabinet: membre.firmName })
  revalidatePath("/[locale]/admin", "page")
  return { ok: true, cle: "sent" }
}

/**
 * L'avis aux administrateurs.
 *
 * Même règle que pour les demandes de démonstration : un échec d'envoi ne
 * fait pas échouer la demande. La LIGNE fait foi, la console la montre. Le
 * courriel n'est qu'un rappel — c'est précisément ce qui distingue ce
 * dispositif du `mailto:` qu'il remplace, où le message était tout.
 */
async function previenirExploitation(d: {
  cabinet: string
  requester_name: string
  requester_email: string
  firm_plan: string
  firm_status: string
  subscription_status: string
  message: string
  locale: string
}): Promise<void> {
  try {
    const avis = courrielDemandeAide({
      cabinet: d.cabinet,
      nom: d.requester_name,
      courriel: d.requester_email,
      plan: d.firm_plan,
      statutCabinet: d.firm_status,
      statutAbonnement: d.subscription_status,
      message: d.message,
      langue: d.locale === "en" ? "en" : "fr",
      lienConsole: `${siteUrl()}/fr/admin`,
    })

    // La lecture de platform_admins passe par la clé de service : le
    // demandeur n'est pas administrateur, la politique de la table ne lui
    // accorderait rien.
    const { data } = await getServerSupabase().from("platform_admins").select("email")
    const adresses = (data ?? []).map((a) => String(a.email ?? "").trim()).filter(Boolean)
    if (adresses.length === 0) {
      const repli = adresseDeReponse()
      if (repli) adresses.push(repli)
    }

    const envois = adresses.map((destinataire) =>
      envoyerCourriel({
        destinataire,
        sujet: avis.sujet,
        html: avis.html,
        texte: avis.texte,
        // Répondre depuis sa boîte suffit à joindre la personne bloquée.
        repondreA: d.requester_email,
      })
    )

    for (const r of await Promise.allSettled(envois)) {
      if (r.status === "rejected") console.error("previenirExploitation (aide) :", r.reason)
      else if (!r.value.envoye) {
        console.error("previenirExploitation (aide) :", r.value.erreur ?? "envoi non configuré")
      }
    }
  } catch (e) {
    console.error("previenirExploitation (aide) :", e instanceof Error ? e.message : e)
  }
}

/** Marque une demande comme traitée. Réservé à l'exploitant. */
export async function marquerAideTraitee(formData: FormData): Promise<ResultatAide> {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) return { ok: false, cle: "error" }

  const id = String(formData.get("id") ?? "")
  if (!id) return { ok: false, cle: "error" }

  const supabase = await getSessionSupabase()
  const { error } = await supabase
    .from("support_requests")
    .update({ status: "handled", handled_by: admin.userId, handled_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { ok: false, cle: "error" }

  revalidatePath("/[locale]/admin", "page")
  return { ok: true, cle: "sent" }
}
