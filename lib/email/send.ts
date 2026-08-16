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
  /**
   * Vrai si l'adresse est réservée et que rien n'a été expédié.
   *
   * `envoye` reste VRAI dans ce cas, et c'est délibéré : pour l'appelant, le
   * message a suivi son cours normal. Voir `adresseNonRoutable()`.
   */
  ignore?: boolean
  erreur?: string
}

/**
 * Domaines réservés par l'IETF, qui n'appartiennent et n'appartiendront à
 * personne — RFC 2606 et RFC 6761.
 *
 * Les quatre premiers sont des domaines de tête entiers ; les trois suivants
 * sont réservés au second niveau.
 */
const TETE_RESERVEE = [".invalid", ".test", ".example", ".localhost"]
const SECOND_NIVEAU_RESERVE = ["example.com", "example.net", "example.org"]

/**
 * L'adresse désigne-t-elle un domaine qui ne peut recevoir aucun courrier ?
 *
 * ─── POURQUOI CETTE GARDE EXISTE ───────────────────────────────────────────
 *
 * Les scripts d'épreuve créent des clients fictifs à des adresses en
 * `@example.invalid`, puis déclenchent les VRAIS envois — c'est tout leur
 * intérêt : ils éprouvent la chaîne complète plutôt qu'une imitation.
 *
 * Le choix de `.invalid` était bon : ce domaine est réservé, donc aucun
 * inconnu ne reçoit jamais une épreuve. Ce qui n'avait pas été vu, c'est que
 * LE MESSAGE PART QUAND MÊME, et qu'il rebondit.
 *
 * Relevé du 16 août 2026, sur le compte de production :
 *
 *     68 envois connus depuis le 6 août
 *       bounced    37   54 %   ← tous vers @example.invalid
 *       delivered  31   46 %
 *
 * Amazon SES, qui achemine pour Resend, tient 5 % pour un seuil d'alerte et
 * 10 % pour un motif de suspension. Un domaine à 54 % est traité comme un
 * expéditeur douteux, et les messages LÉGITIMES finissent en indésirables —
 * ce qui a été constaté chez Microsoft. Autrement dit : chaque séance de mise
 * au point abîmait la remise des courriels destinés aux vrais clients.
 *
 * ─── POURQUOI `envoye` RESTE VRAI ──────────────────────────────────────────
 *
 * Rendre `envoye: false` aurait paru plus honnête, et aurait été un piège :
 * plusieurs appelants affichent alors un lien de secours à recopier, et les
 * scripts d'épreuve auraient rapporté des échecs là où le parcours qu'ils
 * vérifient s'est parfaitement déroulé. Pour l'appelant, rien ne change ; ce
 * qui change est que le fournisseur n'est jamais contacté. `ignore` porte la
 * nuance pour qui veut la lire.
 *
 * Une adresse sans arobase, ou vide, est traitée de la même façon : rien de
 * bon ne peut sortir d'un appel au fournisseur avec un destinataire malformé.
 */
export function adresseNonRoutable(courriel: string): boolean {
  const brut = (courriel ?? "").trim().toLowerCase()
  const arobase = brut.lastIndexOf("@")
  if (arobase < 1) return true

  const domaine = brut.slice(arobase + 1).replace(/\.$/, "")
  if (!domaine) return true

  return (
    TETE_RESERVEE.some((t) => domaine === t.slice(1) || domaine.endsWith(t)) ||
    SECOND_NIVEAU_RESERVE.some((d) => domaine === d || domaine.endsWith(`.${d}`))
  )
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

  // LA GARDE PASSE AVANT TOUT LE RESTE. Un domaine réservé ne reçoit rien : le
  // seul effet d'un envoi serait un rebond, et les rebonds abîment la remise
  // des courriels destinés aux vrais clients. La trace est écrite pour que le
  // saut reste visible dans la sortie des scripts d'épreuve — un envoi
  // silencieusement escamoté se prendrait un jour pour un envoi réussi.
  if (adresseNonRoutable(opts.destinataire)) {
    console.warn(
      `envoyerCourriel : « ${opts.destinataire} » relève d'un domaine réservé, rien n'est expédié —`,
      opts.sujet
    )
    return { envoye: true, configure: true, ignore: true }
  }

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
