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

/**
 * L'adresse d'expédition, sans son éventuel nom d'affichage.
 *
 * EMAIL_FROM peut valoir « moncabinetcric <acces@moncabinetcric.com> » ou
 * simplement « acces@moncabinetcric.com ». Pour y substituer le nom d'un
 * cabinet, il faut d'abord isoler l'adresse : recoller un nom devant une
 * chaîne qui en contient déjà un produirait un en-tête que les serveurs
 * refusent, et le refus n'apparaîtrait qu'au premier envoi réel.
 */
function adresseNue(brut: string): string {
  const entreChevrons = brut.match(/<([^>]+)>/)
  return (entreChevrons ? entreChevrons[1] : brut).replace(/["']/g, "").trim()
}

/**
 * L'en-tête « De », au nom du cabinet quand il en a donné un.
 *
 * Le DOMAINE d'expédition ne change pas, et ce n'est pas un oubli : un
 * fournisseur n'expédie que depuis un domaine dont la propriété est prouvée
 * par DNS. Laisser un cabinet expédier depuis le sien ferait refuser l'envoi,
 * ou pire, le ferait classer en pourriel sans que personne ne l'apprenne. Le
 * nom affiché, lui, est libre — et c'est lui que le destinataire lit dans sa
 * boîte.
 */
export function enTeteDe(nomCabinet?: string | null): string {
  const brut = process.env.EMAIL_FROM ?? ""
  const adresse = adresseNue(brut)
  const nom = nomCabinet?.trim()
  if (!nom) return brut
  // Les guillemets sont doublés d'un échappement : une raison sociale
  // contenant un guillemet casserait l'en-tête sans cela.
  return `"${nom.replace(/"/g, "'")}" <${adresse}>`
}

export async function envoyerCourriel(opts: {
  destinataire: string
  sujet: string
  html: string
  texte: string
  /** Nom affiché à la place de celui de la plateforme. */
  nomExpediteur?: string | null
  /** Adresse qui recevra les réponses ; à défaut, celle de la plateforme. */
  repondreA?: string | null
  /** Pièces jointes. Le contenu est encodé en base64 par cette fonction. */
  pieces?: { nom: string; contenu: Uint8Array }[]
}): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY
  const expediteurBrut = process.env.EMAIL_FROM

  if (!cle || !expediteurBrut) return { envoye: false, configure: false }
  const expediteur = enTeteDe(opts.nomExpediteur)
  const repondreA = opts.repondreA?.trim() || adresseDeReponse()

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
        ...(repondreA ? { reply_to: repondreA } : {}),
        ...(opts.pieces?.length
          ? {
              attachments: opts.pieces.map((p) => ({
                filename: p.nom,
                content: Buffer.from(p.contenu).toString("base64"),
              })),
            }
          : {}),
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
