import "server-only"

/**
 * Gabarits des courriels transactionnels.
 *
 * Volontairement sobres et en HTML ancien — tableaux, styles en ligne,
 * aucune police distante. Les clients de messagerie ne sont pas des
 * navigateurs : la moitié ignore les feuilles de style, et un courriel
 * d'accès qui s'affiche mal ressemble à une tentative d'hameçonnage,
 * précisément le jour où il faut inspirer confiance.
 *
 * Le texte n'est pas tiré de next-intl : ces messages sont composés hors
 * de tout contexte de requête, par une action de serveur. La langue est
 * celle de la demande, transportée depuis le formulaire public.
 */

export type Langue = "fr" | "en"

const BLEU = "#1e40af"

export interface CourrielCompose {
  sujet: string
  html: string
  texte: string
}

function coquille(titre: string, corps: string, pied: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:800;color:${BLEU};letter-spacing:-0.5px;">moncabinetcric</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${titre}</h1>
${corps}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">${pied}</p>
</td></tr></table>
</td></tr></table>
</body></html>`
}

/**
 * Neutralise ce qui vient du dehors avant de l'insérer dans du HTML.
 *
 * Le formulaire de démonstration est ouvert à tous : son nom, son message et
 * ses coordonnées sont écrits par un inconnu. Sans cette fonction, une balise
 * fermante dans un de ces champs disloque la mise en page du courriel, et un
 * `<a href>` glissé dans le message transforme l'avis interne en un message
 * d'apparence légitime portant un lien choisi par l'expéditeur — le tout
 * expédié depuis notre propre domaine, signé par lui.
 *
 * L'apostrophe est échappée en plus des quatre habituelles : ces valeurs
 * finissent parfois entre guillemets simples d'un attribut.
 */
function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function bouton(url: string, libelle: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:${BLEU};border-radius:9999px;">
<a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${libelle}</a>
</td></tr></table>`
}

/**
 * Invitation à ouvrir son accès et à choisir son mot de passe.
 *
 * `reponsePossible` commande une phrase, pas une mise en forme : inviter à
 * répondre quand aucune adresse de réponse n'est configurée enverrait le
 * consultant écrire à une boîte que personne ne relève. Mieux vaut ne
 * rien promettre que promettre dans le vide.
 */
export function courrielInvitation(opts: {
  langue: Langue
  cabinet: string
  lien: string
  jours: number
  reponsePossible: boolean
}): CourrielCompose {
  const { langue, cabinet, lien, jours, reponsePossible } = opts

  if (langue === "en") {
    return {
      sujet: `Your access to moncabinetcric — ${cabinet}`,
      html: coquille(
        "Your firm's access is open",
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">An access has been opened for <strong>${cabinet}</strong>. Choose your password to sign in — nobody else knows it, not even us.</p>
         ${bouton(lien, "Choose my password")}
         <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This link works once and expires in ${jours} days.${reponsePossible ? " If it has expired, reply to this message and we will send a new one." : ""}</p>`,
        "You are receiving this message because an access was opened for your firm. If you were not expecting it, ignore it — the link is useless without you."
      ),
      texte: `An access has been opened for ${cabinet}.

Choose your password: ${lien}

This link works once and expires in ${jours} days.`,
    }
  }

  return {
    sujet: `Votre accès à moncabinetcric — ${cabinet}`,
    html: coquille(
      "L'accès de votre cabinet est ouvert",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Un accès a été ouvert pour <strong>${cabinet}</strong>. Choisissez votre mot de passe pour entrer — personne d'autre ne le connaîtra, nous pas davantage.</p>
       ${bouton(lien, "Choisir mon mot de passe")}
       <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Ce lien ne sert qu'une fois et expire dans ${jours} jours.${reponsePossible ? " S'il est périmé, répondez à ce message et nous vous en enverrons un autre." : ""}</p>`,
      "Vous recevez ce message parce qu'un accès a été ouvert pour votre cabinet. Si vous ne l'attendiez pas, ignorez-le : le lien ne sert à rien sans vous."
    ),
    texte: `Un accès a été ouvert pour ${cabinet}.

Choisissez votre mot de passe : ${lien}

Ce lien ne sert qu'une fois et expire dans ${jours} jours.`,
  }
}

/**
 * Accusé de réception d'une demande de démonstration.
 *
 * Le nom est échappé dans le HTML mais laissé nu dans la version texte, où il
 * n'y a rien à disloquer. Le SUJET aussi le laisse nu, et volontairement : y
 * échapper afficherait « &amp; » dans la boîte de réception de quelqu'un dont
 * la raison sociale contient une esperluette.
 */
export function courrielAccuseDemande(opts: { langue: Langue; nom: string }): CourrielCompose {
  const nom = echapper(opts.nom)
  if (opts.langue === "en") {
    return {
      sujet: "We received your request — moncabinetcric",
      html: coquille(
        "Request received",
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hello ${nom}, we have received your demo request. Our team will contact you shortly to schedule a time that fits your availability.</p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Access to MonCabinetCRIC is configured individually for each firm.</p>`,
        "No action is required on your side."
      ),
      texte: `Hello ${opts.nom}, we have received your demo request. Our team will contact you shortly to schedule a time.`,
    }
  }

  return {
    sujet: "Nous avons reçu votre demande — moncabinetcric",
    html: coquille(
      "Demande reçue",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bonjour ${nom}, nous avons bien reçu votre demande de démonstration. Notre équipe vous contactera très prochainement pour convenir d'un créneau adapté à vos disponibilités.</p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">L'accès à MonCabinetCRIC est configuré individuellement pour chaque cabinet.</p>`,
      "Aucune action n'est requise de votre part."
    ),
    texte: `Bonjour ${opts.nom}, nous avons bien reçu votre demande de démonstration. Notre équipe vous contactera très prochainement pour convenir d'un créneau.`,
  }
}

/**
 * Avis à l'exploitant : quelqu'un vient de demander une démonstration.
 *
 * ─── POURQUOI CE MESSAGE EXISTE ────────────────────────────────────────────
 *
 * La demande était jusqu'ici écrite en base, et c'est tout. Rien ne prévenait
 * personne. Un prospect voyait une confirmation à l'écran puis n'entendait
 * plus rien, et l'exploitant n'apprenait son existence qu'en pensant à ouvrir
 * `/admin`. Pour un logiciel vendu à des professionnels réglementés, ce
 * silence est la façon la plus rapide de perdre le premier client.
 *
 * ─── POURQUOI IL EST EN FRANÇAIS SEULEMENT ─────────────────────────────────
 *
 * `platform_admins` ne stocke aucune préférence de langue. En inventer une
 * reviendrait à choisir à la place de quelqu'un ; reprendre celle du prospect
 * serait pire encore — un confrère anglophone ferait basculer l'avis interne
 * dans une langue que son destinataire n'a pas choisie. Le français est la
 * langue d'exploitation de l'éditeur. Le jour où la table porte une colonne
 * de langue, c'est ici et dans `previenirExploitation` qu'il faut revenir.
 *
 * ─── CE QUE LE MESSAGE PORTE, ET POURQUOI ──────────────────────────────────
 *
 * Tout ce que la personne a écrit, pour qu'on puisse juger de la demande sans
 * ouvrir la console — un avis qui oblige à aller voir ailleurs ne fait que
 * déplacer le délai. L'adresse de réponse est celle du prospect : répondre
 * depuis sa boîte suffit alors à engager la conversation.
 */
export function courrielDemandeRecue(opts: {
  nom: string
  courriel: string
  cabinet?: string | null
  telephone?: string | null
  message?: string | null
  /** Langue de la PAGE où la demande a été remplie — un renseignement, pas un réglage. */
  langue: Langue
  lienConsole: string
}): CourrielCompose {
  const { nom, courriel, cabinet, telephone, message, langue, lienConsole } = opts

  const lignes: [string, string][] = [
    ["Nom", nom],
    ["Courriel", courriel],
    ...(cabinet?.trim() ? ([["Cabinet", cabinet.trim()]] as [string, string][]) : []),
    ...(telephone?.trim() ? ([["Téléphone", telephone.trim()]] as [string, string][]) : []),
    ["Langue de la demande", langue === "en" ? "anglais" : "français"],
  ]

  const tableau = lignes
    .map(
      ([cle, valeur]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top;">${cle}</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${echapper(valeur)}</td></tr>`
    )
    .join("")

  // Le message est rendu dans un bloc à part, pré-formaté : un paragraphe
  // saisi avec des retours à la ligne les perdrait tous en HTML, et c'est
  // souvent là que se trouve le renseignement qui décide de la réponse.
  const bloc = message?.trim()
    ? `<p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;">Message</p>
       <div style="padding:16px;background:#f8fafc;border-radius:12px;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${echapper(message.trim())}</div>`
    : `<p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Aucun message.</p>`

  const titre = cabinet?.trim() ? `${nom} — ${cabinet.trim()}` : nom

  return {
    // Le sujet porte le nom : une boîte de réception se lit en diagonale, et
    // « Nouvelle demande » répété dix fois ne se distingue pas de lui-même.
    sujet: `Demande de démonstration — ${titre}`,
    html: coquille(
      "Une demande de démonstration vient d'arriver",
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${tableau}</table>
       ${bloc}
       ${bouton(lienConsole, "Ouvrir la console")}`,
      "Vous recevez cet avis parce que vous administrez la plateforme. Répondre à ce message écrit directement au prospect."
    ),
    texte: `Une demande de démonstration vient d'arriver.

${lignes.map(([cle, valeur]) => `${cle} : ${valeur}`).join("\n")}

Message :
${message?.trim() || "(aucun)"}

Console : ${lienConsole}`,
  }
}

/**
 * Avis à l'exploitant : un cabinet bloqué demande de l'aide.
 *
 * Frère du précédent, et pour la même raison — sauf que celui-ci vient de
 * quelqu'un qui est DÉJÀ CLIENT et se trouve dehors. Le délai de réponse ne
 * coûte pas un prospect, il coûte une journée de travail à un consultant qui
 * a des échéances IRCC.
 *
 * D'où l'état du cabinet porté dans le corps : plan, statut, abonnement, tels
 * qu'ils étaient au moment de la demande. Sans eux, l'exploitant ouvre la
 * console, cherche le cabinet, et reconstitue ce que la personne avait déjà
 * sous les yeux. Avec eux, il sait souvent quoi faire avant d'avoir ouvert
 * quoi que ce soit.
 *
 * En français seulement, comme l'avis de démonstration, et pour la même
 * raison : `platform_admins` ne stocke aucune préférence de langue, et
 * reprendre celle du demandeur ferait basculer l'avis interne dans une langue
 * que son destinataire n'a pas choisie.
 */
export function courrielDemandeAide(opts: {
  cabinet: string
  nom: string
  courriel: string
  plan: string
  statutCabinet: string
  statutAbonnement: string
  message: string
  langue: Langue
  lienConsole: string
}): CourrielCompose {
  const {
    cabinet, nom, courriel, plan, statutCabinet, statutAbonnement, message, langue, lienConsole,
  } = opts

  const lignes: [string, string][] = [
    ["Cabinet", cabinet],
    ["Demandeur", `${nom} — ${courriel}`],
    ["Forfait", plan || "—"],
    ["Statut du cabinet", statutCabinet || "—"],
    ["Abonnement", statutAbonnement || "aucun"],
    ["Langue", langue === "en" ? "anglais" : "français"],
  ]

  const tableau = lignes
    .map(
      ([cle, valeur]) =>
        `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top;">${cle}</td><td style="padding:6px 0;font-size:14px;color:#0f172a;">${echapper(valeur)}</td></tr>`
    )
    .join("")

  return {
    // « bloqué » dans le sujet, à dessein : c'est le mot qui fait ouvrir le
    // message avant les autres, et il est exact.
    sujet: `Cabinet bloqué — ${cabinet}`,
    html: coquille(
      "Un cabinet ne peut plus entrer",
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">Cette demande a été écrite depuis l'écran d'accès fermé. La personne est dehors au moment où vous lisez ceci.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${tableau}</table>
       <p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#64748b;">Message</p>
       <div style="padding:16px;background:#f8fafc;border-radius:12px;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${echapper(message.trim())}</div>
       ${bouton(lienConsole, "Ouvrir la console")}`,
      "Vous recevez cet avis parce que vous administrez la plateforme. Répondre à ce message écrit directement au demandeur."
    ),
    texte: `Un cabinet ne peut plus entrer. Demande écrite depuis l'écran d'accès fermé.

${lignes.map(([cle, valeur]) => `${cle} : ${valeur}`).join("\n")}

Message :
${message.trim()}

Console : ${lienConsole}`,
  }
}

/**
 * Les trois courriels de la signature.
 *
 * ─── POURQUOI LE LIEN N'EST PAS UN BOUTON SEUL ─────────────────────────────
 *
 * L'adresse est aussi écrite en toutes lettres. Beaucoup de clients d'un
 * cabinet d'immigration lisent leur courrier depuis un téléphone bas de gamme
 * ou une messagerie qui bloque les liens des expéditeurs inconnus. Un bouton
 * qui ne s'ouvre pas laisse la personne sans recours ; une adresse se recopie.
 *
 * ─── CE QUE CES MESSAGES NE FONT PAS ───────────────────────────────────────
 *
 * Ils ne joignent PAS le document. Une pièce jointe circule ensuite sans
 * contrôle, survit à la révocation du lien, et ne dit pas si elle est la
 * dernière version. Le lien, lui, meurt quand il doit mourir.
 */

export function courrielSignatureDemandee(opts: {
  langue: Langue
  cabinet: string
  nom: string
  document: string
  lien: string
  jours: number
}): CourrielCompose {
  const { langue, cabinet, nom, document, lien, jours } = opts

  if (langue === "en") {
    return {
      sujet: `Signature requested — ${document}`,
      html: coquille(
        "A document awaits your signature",
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hello ${nom},</p>
         <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;"><strong>${cabinet}</strong> invites you to read and sign <strong>${document}</strong>.</p>
         ${bouton(lien, "Read and sign")}
         <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all;">${lien}</span></p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">This link is personal and expires in ${jours} days. Do not forward it: it carries your signature.</p>`,
        "You are receiving this message because a document was sent to you for signature."
      ),
      texte: `Hello ${nom},

${cabinet} invites you to read and sign: ${document}

${lien}

This link is personal and expires in ${jours} days. Do not forward it.`,
    }
  }

  return {
    sujet: `Signature demandée — ${document}`,
    html: coquille(
      "Un document attend votre signature",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bonjour ${nom},</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;"><strong>${cabinet}</strong> vous invite à prendre connaissance de <strong>${document}</strong> et à le signer.</p>
       ${bouton(lien, "Lire et signer")}
       <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#64748b;">Si le bouton ne fonctionne pas, recopiez cette adresse dans votre navigateur :<br><span style="word-break:break-all;">${lien}</span></p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Ce lien vous est personnel et expire dans ${jours} jours. Ne le transférez pas : il porte votre signature.</p>`,
      "Vous recevez ce message parce qu'un document vous a été transmis pour signature."
    ),
    texte: `Bonjour ${nom},

${cabinet} vous invite à lire et signer : ${document}

${lien}

Ce lien vous est personnel et expire dans ${jours} jours. Ne le transférez pas.`,
  }
}

export function courrielSignatureFaite(opts: {
  langue: Langue
  cabinet: string
  nom: string
  document: string
}): CourrielCompose {
  const { langue, cabinet, nom, document } = opts

  if (langue === "en") {
    return {
      sujet: `Signed — ${document}`,
      html: coquille(
        "Your document is signed",
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hello ${nom},</p>
         <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;"><strong>${document}</strong> has been signed by every party. ${cabinet} keeps a copy, along with a certificate listing the signatories, the timestamps and the document fingerprint.</p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Ask ${cabinet} for a copy at any time.</p>`,
        "You are receiving this message because you signed this document."
      ),
      texte: `Hello ${nom},

${document} has been signed by every party. ${cabinet} keeps a copy and its certificate.`,
    }
  }

  return {
    sujet: `Signé — ${document}`,
    html: coquille(
      "Votre document est signé",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bonjour ${nom},</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;"><strong>${document}</strong> a été signé par toutes les parties. ${cabinet} en conserve une copie, accompagnée d'un certificat qui nomme les signataires, les horodatages et l'empreinte du document.</p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Vous pouvez en demander une copie à ${cabinet} à tout moment.</p>`,
      "Vous recevez ce message parce que vous avez signé ce document."
    ),
    texte: `Bonjour ${nom},

${document} a été signé par toutes les parties. ${cabinet} en conserve une copie et son certificat.`,
  }
}

/**
 * Le rendez-vous fixé par le cabinet, annoncé à son client.
 *
 * ─── POURQUOI LA DATE EST ÉCRITE EN TOUTES LETTRES ─────────────────────────
 *
 * « 2026-09-15 14:30 » se lit mal, et surtout se lit de deux façons selon le
 * pays du lecteur. Un candidat à l'immigration vient rarement d'un pays qui
 * écrit les dates comme le Canada. « Le mardi 15 septembre 2026 à 14 h 30 » ne
 * se confond avec rien — et le jour de la semaine sert de contrôle : qui lit
 * « mardi » alors qu'il attendait un lundi écrit pour demander.
 *
 * ─── LE FUSEAU EST NOMMÉ, TOUJOURS ─────────────────────────────────────────
 *
 * Le cabinet reçoit des clients qui sont encore à l'étranger. « 14 h 30 » sans
 * fuseau fait manquer le rendez-vous à qui est à Dakar ou à Manille. La mention
 * de l'heure de l'Est n'est pas une précaution de juriste : c'est la différence
 * entre une rencontre tenue et une rencontre manquée.
 *
 * ─── LE LIEN N'EST PAS TOUJOURS LÀ, ET CE N'EST PAS UNE ERREUR ─────────────
 *
 * Un rendez-vous en personne n'a pas de lien de visioconférence. Le courriel
 * part quand même : le client doit connaître la date. Le lien de réservation du
 * cabinet, lui, figure en repli pour reprogrammer — c'est la seule chose utile
 * à offrir quand on ne peut pas offrir de porte d'entrée à la rencontre.
 */
export function courrielRendezVous(opts: {
  langue: Langue
  nomClient: string
  nomCabinet: string
  motif: string
  /** Déjà composée pour l'humain : « mardi 15 septembre 2026 ». */
  dateLisible: string
  /** « 14 h 30 » en français, « 2:30 p.m. » en anglais. */
  heureLisible: string
  fuseauLisible: string
  dureeMinutes: number
  modalite?: string
  lienRencontre?: string
  lienReservation?: string
  reponsePossible: boolean
}): CourrielCompose {
  const en = opts.langue === "en"
  const nom = echapper(opts.nomClient.trim() || (en ? "Hello" : "Bonjour"))
  const cabinet = echapper(opts.nomCabinet.trim())
  const motif = echapper(opts.motif.trim())
  const modalite = echapper((opts.modalite ?? "").trim())
  const lien = (opts.lienRencontre ?? "").trim()
  const reservation = (opts.lienReservation ?? "").trim()

  const sujet = en
    ? `Your appointment — ${opts.dateLisible} at ${opts.heureLisible}`
    : `Votre rendez-vous — ${opts.dateLisible} à ${opts.heureLisible}`

  const ligne = (etiquette: string, valeur: string) =>
    `<tr><td style="padding:6px 16px 6px 0;font-size:14px;color:#64748b;white-space:nowrap;">${etiquette}</td>` +
    `<td style="padding:6px 0;font-size:14px;font-weight:700;color:#0f172a;">${valeur}</td></tr>`

  const details =
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">` +
    ligne(en ? "Date" : "Date", `${opts.dateLisible}`) +
    ligne(en ? "Time" : "Heure", `${opts.heureLisible} (${opts.fuseauLisible})`) +
    ligne(en ? "Duration" : "Durée", en ? `${opts.dureeMinutes} minutes` : `${opts.dureeMinutes} minutes`) +
    ligne(en ? "Purpose" : "Motif", motif) +
    (modalite ? ligne(en ? "Format" : "Modalité", modalite) : "") +
    `</table>`

  const corps =
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">` +
    (en
      ? `Hello ${nom},<br><br>Your appointment with <strong>${cabinet}</strong> is confirmed.`
      : `Bonjour ${nom},<br><br>Votre rendez-vous avec <strong>${cabinet}</strong> est confirmé.`) +
    `</p>` +
    details +
    (lien
      ? bouton(lien, en ? "Join the meeting" : "Rejoindre la rencontre") +
        `<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">` +
        (en
          ? `If the button does not work, copy this address: ${echapper(lien)}`
          : `Si le bouton ne fonctionne pas, copiez cette adresse : ${echapper(lien)}`) +
        `</p>`
      : `<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#334155;">` +
        (en
          ? `Details on where to meet will follow separately.`
          : `Les précisions sur le lieu de la rencontre vous parviendront séparément.`) +
        `</p>`) +
    (reservation
      ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">` +
        (en
          ? `Need another time? <a href="${reservation}" style="color:${BLEU};">Choose a new slot</a>.`
          : `Un autre moment vous conviendrait mieux ? <a href="${reservation}" style="color:${BLEU};">Choisissez un nouveau créneau</a>.`) +
        `</p>`
      : "")

  const pied = opts.reponsePossible
    ? en
      ? `Sent by ${cabinet}. Reply to this message if you have a question.`
      : `Envoyé par ${cabinet}. Répondez à ce message si vous avez une question.`
    : en
      ? `Sent by ${cabinet}.`
      : `Envoyé par ${cabinet}.`

  const texte = [
    en ? `Hello ${opts.nomClient},` : `Bonjour ${opts.nomClient},`,
    "",
    en
      ? `Your appointment with ${opts.nomCabinet} is confirmed.`
      : `Votre rendez-vous avec ${opts.nomCabinet} est confirmé.`,
    "",
    `${en ? "Date" : "Date"} : ${opts.dateLisible}`,
    `${en ? "Time" : "Heure"} : ${opts.heureLisible} (${opts.fuseauLisible})`,
    `${en ? "Duration" : "Durée"} : ${opts.dureeMinutes} minutes`,
    `${en ? "Purpose" : "Motif"} : ${opts.motif}`,
    modalite ? `${en ? "Format" : "Modalité"} : ${opts.modalite}` : "",
    "",
    lien ? `${en ? "Join the meeting" : "Rejoindre la rencontre"} : ${lien}` : "",
    reservation ? `${en ? "Another time" : "Un autre moment"} : ${reservation}` : "",
  ].filter((l) => l !== "").join("\n")

  return { sujet, html: coquille(en ? "Appointment confirmed" : "Rendez-vous confirmé", corps, pied), texte }
}

/**
 * La date et l'heure d'un rendez-vous, écrites pour être lues.
 *
 * `date` arrive en « 2026-09-15 » et `heure` en « 14:30 ». Les deux sont
 * interprétées DANS LE FUSEAU DU CABINET : construire un `Date` depuis
 * « 2026-09-15 » seul le place à minuit UTC, soit 20 h la veille à Gatineau, et
 * le courriel annoncerait le 14 septembre au lieu du 15.
 */
export function composerMomentRendezVous(
  date: string,
  heure: string,
  langue: Langue,
  fuseau = "America/Toronto"
): { dateLisible: string; heureLisible: string; fuseauLisible: string } {
  const [a, m, j] = date.split("-").map(Number)

  // `heure` DOIT être « HH:MM ». Ailleurs dans l'application circule aussi un
  // libellé humain — « 10 h 00 – 11 h 00 (60 min) » — et le confondre avec
  // celui-ci donnerait NaN, donc « NaN h 00 » dans un courriel envoyé à un
  // client. On retombe sur 9 h plutôt que d'écrire une absurdité.
  const [hBrut, minBrut] = (heure || "").split(":").map(Number)
  const h = Number.isFinite(hBrut) && hBrut >= 0 && hBrut <= 23 ? hBrut : 9
  const min = Number.isFinite(minBrut) && minBrut >= 0 && minBrut <= 59 ? minBrut : 0

  // Midi UTC comme point d'ancrage : à cette heure-là, aucun fuseau du globe
  // n'est encore la veille ou déjà le lendemain, donc le jour de la semaine et
  // la date restent ceux qu'on a écrits.
  const ancre = new Date(Date.UTC(a, (m || 1) - 1, j || 1, 12, 0, 0))
  const loc = langue === "en" ? "en-CA" : "fr-CA"

  const dateLisible = new Intl.DateTimeFormat(loc, {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(ancre)

  const heureLisible = langue === "en"
    ? new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
        .format(new Date(Date.UTC(a, (m || 1) - 1, j || 1, h, min)))
    : `${h} h ${String(min).padStart(2, "0")}`

  const fuseauLisible = new Intl.DateTimeFormat(loc, { timeZone: fuseau, timeZoneName: "long" })
    .formatToParts(ancre).find((p) => p.type === "timeZoneName")?.value ?? fuseau

  return { dateLisible, heureLisible, fuseauLisible }
}
