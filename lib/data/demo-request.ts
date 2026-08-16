"use server"

import { z } from "zod"
import { getServerSupabase } from "@/lib/supabase/server"
import { autorise, TROP_DE_TENTATIVES } from "@/lib/securite/limiter"
import { envoyerCourriel, adresseDeReponse } from "@/lib/email/send"
import { courrielAccuseDemande, courrielDemandeRecue } from "@/lib/email/templates"
import { siteUrl } from "@/lib/site-url"

/**
 * Demande de démonstration déposée depuis la page publique.
 *
 * Trois choses expliquent la forme de ce module.
 *
 * Le visiteur n'a pas de session : aucune politique RLS ne peut donc le
 * rattacher à quoi que ce soit. L'écriture passe par la clé service_role,
 * et `demo_requests` n'a volontairement aucune politique d'insertion —
 * cette action est la seule porte, ce qui rend les contrôles ci-dessous
 * incontournables plutôt que facultatifs.
 *
 * La demande ne va plus dans `leads`. Un prospect de la plateforme n'est
 * pas un prospect d'immigration : il s'adresse à l'éditeur, et le compte
 * exploitant — membre d'aucun cabinet — ne voyait rien de ce qui lui était
 * destiné.
 *
 * Le formulaire est ouvert à tous : tout ce qui en vient est traité comme
 * hostile jusqu'à validation, et borné en longueur avant d'atteindre la
 * base.
 */

const Demande = z.object({
  nom: z.string().trim().min(2, "Nom trop court.").max(120),
  courriel: z.string().trim().toLowerCase().email("Courriel invalide.").max(180),
  cabinet: z.string().trim().max(160).optional().default(""),
  telephone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  // La réponse doit repartir dans la langue de la page où la demande a été
  // remplie, pas dans celle de l'exploitant.
  langue: z.enum(["fr", "en"]).optional().default("fr"),
  // Champ leurre : invisible à l'écran, donc vide chez un humain. Ce n'est
  // pas une protection sérieuse contre un robot déterminé, seulement le
  // filtre le moins coûteux contre le remplissage automatique courant.
  site: z.string().max(0).optional().default(""),
})

export interface ResultatDemande {
  ok: boolean
  erreur?: string
}

type DemandeValidee = z.infer<typeof Demande>

/**
 * À qui l'avis interne est adressé.
 *
 * La lecture passe par la clé de service, et il n'y a pas d'alternative : le
 * visiteur n'a pas de session, donc la politique de `platform_admins` — qui
 * n'ouvre la table qu'à un administrateur — ne lui accorderait rien. Lire la
 * table plutôt que de poser une variable d'environnement garde l'avis juste
 * quand la liste des administrateurs change, sans redéploiement.
 *
 * Le repli sur l'adresse de réponse ne masque pas une erreur de configuration,
 * il évite qu'elle coûte un prospect : une table vide est un incident à
 * corriger, mais perdre la demande en attendant serait pire.
 */
async function destinatairesExploitation(): Promise<string[]> {
  try {
    const { data, error } = await getServerSupabase().from("platform_admins").select("email")
    if (error) throw new Error(error.message)

    const adresses = (data ?? [])
      .map((a) => String(a.email ?? "").trim())
      .filter(Boolean)
    if (adresses.length > 0) return adresses

    console.error("destinatairesExploitation : aucun administrateur, repli sur l'adresse de réponse.")
  } catch (e) {
    console.error("destinatairesExploitation :", e instanceof Error ? e.message : e)
  }

  const repli = adresseDeReponse()
  return repli ? [repli] : []
}

/**
 * Les deux courriels d'une demande : l'accusé au prospect, l'avis à l'éditeur.
 *
 * ─── POURQUOI UN ÉCHEC D'ENVOI NE FAIT PAS ÉCHOUER LA DEMANDE ──────────────
 *
 * La ligne est déjà écrite quand cette fonction est appelée, et c'est elle qui
 * fait foi : la console d'exploitation la montre, qu'un courriel soit parti ou
 * non. Répondre « erreur » au prospect dont la demande EST enregistrée
 * l'inviterait à recommencer, et produirait des doublons plutôt qu'un envoi.
 * L'échec est donc consigné dans les journaux du serveur, où il se voit, et
 * nulle part ailleurs.
 *
 * ─── POURQUOI L'ENVOI EST ATTENDU PLUTÔT QUE DIFFÉRÉ ───────────────────────
 *
 * `after()` rendrait la réponse un peu plus vive, au prix d'un envoi dont plus
 * rien ne rapporte l'échec dans le fil de la requête. Deux appels HTTP sur un
 * formulaire rempli une fois ne valent pas cette perte de visibilité, et les
 * cinq autres points d'envoi du projet attendent également.
 */
async function previenirExploitation(d: DemandeValidee): Promise<void> {
  const envois: Promise<{ envoye: boolean; configure: boolean; erreur?: string }>[] = []

  // 1. L'accusé au prospect, dans la langue de la page qu'il a remplie.
  const accuse = courrielAccuseDemande({ langue: d.langue, nom: d.nom })
  envois.push(
    envoyerCourriel({
      destinataire: d.courriel,
      sujet: accuse.sujet,
      html: accuse.html,
      texte: accuse.texte,
    })
  )

  // 2. L'avis à chaque administrateur, avec réponse dirigée vers le prospect.
  const avis = courrielDemandeRecue({
    nom: d.nom,
    courriel: d.courriel,
    cabinet: d.cabinet,
    telephone: d.telephone,
    message: d.message,
    langue: d.langue,
    lienConsole: `${siteUrl()}/fr/admin`,
  })
  for (const adresse of await destinatairesExploitation()) {
    envois.push(
      envoyerCourriel({
        destinataire: adresse,
        sujet: avis.sujet,
        html: avis.html,
        texte: avis.texte,
        repondreA: d.courriel,
      })
    )
  }

  // allSettled et non all : un avis refusé ne doit pas empêcher les autres
  // d'être rapportés, ni masquer le sort de l'accusé au prospect.
  for (const r of await Promise.allSettled(envois)) {
    if (r.status === "rejected") {
      console.error("previenirExploitation :", r.reason)
    } else if (!r.value.configure) {
      console.error("previenirExploitation : RESEND_API_KEY ou EMAIL_FROM manquante, rien n'est parti.")
    } else if (!r.value.envoye) {
      console.error("previenirExploitation :", r.value.erreur)
    }
  }
}

export async function enregistrerDemandeDemo(
  brut: Record<string, unknown>
): Promise<ResultatDemande> {
  // LA LIMITE PASSE AVANT LA VALIDATION, et l'ordre compte : valider d'abord
  // ferait travailler le serveur pour chaque requête d'un robot. Le leurre
  // ci-dessous n'arrête qu'un robot naïf ; celui qui le remplit correctement
  // pouvait jusqu'ici inonder la console d'exploitation de fausses demandes.
  if (!(await autorise("demo"))) {
    return { ok: false, erreur: TROP_DE_TENTATIVES }
  }

  const analyse = Demande.safeParse(brut)
  if (!analyse.success) {
    return { ok: false, erreur: analyse.error.issues[0]?.message ?? "Formulaire invalide." }
  }
  const d = analyse.data

  // Le leurre est rempli : on répond comme si tout allait bien, sans rien
  // écrire. Annoncer le rejet apprendrait au robot à le contourner.
  if (d.site) return { ok: true }

  const { error } = await getServerSupabase().from("demo_requests").insert({
    name: d.nom,
    email: d.courriel,
    company: d.cabinet || null,
    phone: d.telephone || null,
    message: d.message || null,
    locale: d.langue,
  })

  if (error) return { ok: false, erreur: error.message }

  // L'ÉCRITURE D'ABORD, LES COURRIELS ENSUITE, et jamais l'inverse : un envoi
  // réussi suivi d'une écriture ratée laisserait un prospect à qui l'on a
  // promis une réponse sans aucune trace de sa demande.
  await previenirExploitation(d)

  return { ok: true }
}
