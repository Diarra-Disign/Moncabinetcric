import "server-only"

/**
 * Envoi de courriel transactionnel.
 *
 * Un seul fournisseur pour l'instant, Resend, appelé par son API HTTP
 * plutôt que par son paquet npm : trois champs et un POST ne justifient
 * pas une dépendance de plus, ni sa chaîne de mises à jour.
 *
 * Le point important est le comportement quand rien n'est configuré. La
 * fonction ne lève pas et n'écrit pas dans le vide : elle renvoie
 * `configure: false`. L'appelant sait alors que le message n'est pas
 * parti et peut afficher le lien à copier. Ouvrir un accès reste donc
 * possible avant que le domaine soit délégué — ce qui évite d'avoir à
 * choisir entre « attendre les DNS » et « livrer un envoi non testé ».
 */

export interface ResultatEnvoi {
  /** Vrai si le message a été accepté par le fournisseur. */
  envoye: boolean
  /** Faux si RESEND_API_KEY ou EMAIL_FROM manquent : rien n'a été tenté. */
  configure: boolean
  erreur?: string
}

export function envoiConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/**
 * Adresse à laquelle une réponse doit parvenir.
 *
 * L'expéditeur d'un courriel transactionnel — acces@… — n'est pas une
 * boîte de réception : Resend signe en son nom, rien ne l'écoute. Sans
 * cette adresse, répondre revient à écrire dans le vide, ce qui est pire
 * que de ne pas proposer de répondre du tout.
 */
export function adresseDeReponse(): string | null {
  return process.env.EMAIL_REPLY_TO?.trim() || null
}

export async function envoyerCourriel(opts: {
  destinataire: string
  sujet: string
  html: string
  texte: string
}): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY
  const expediteur = process.env.EMAIL_FROM

  if (!cle || !expediteur) return { envoye: false, configure: false }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: [opts.destinataire],
        ...(adresseDeReponse() ? { reply_to: adresseDeReponse() } : {}),
        subject: opts.sujet,
        html: opts.html,
        // Toujours accompagner le HTML de sa version texte : sans elle,
        // les filtres anti-pourriel notent le message plus sévèrement, et
        // certains clients n'affichent rien du tout.
        text: opts.texte,
      }),
    })

    if (!res.ok) {
      const corps = await res.text()
      return { envoye: false, configure: true, erreur: `Resend ${res.status} : ${corps.slice(0, 300)}` }
    }
    return { envoye: true, configure: true }
  } catch (e) {
    return {
      envoye: false,
      configure: true,
      erreur: e instanceof Error ? e.message : "Envoi impossible.",
    }
  }
}
