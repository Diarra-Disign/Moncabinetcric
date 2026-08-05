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

/** Accusé de réception d'une demande de démonstration. */
export function courrielAccuseDemande(opts: { langue: Langue; nom: string }): CourrielCompose {
  if (opts.langue === "en") {
    return {
      sujet: "We received your request — moncabinetcric",
      html: coquille(
        "Request received",
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hello ${opts.nom}, we have your request for a demo. A regulated consultant reads it — not an autoresponder — and will write back to arrange a time.</p>
         <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">There is no open sign-up: access is granted one firm at a time, after a conversation.</p>`,
        "No action is needed on your side."
      ),
      texte: `Hello ${opts.nom}, we have your request for a demo and will write back to arrange a time.`,
    }
  }

  return {
    sujet: "Nous avons reçu votre demande — moncabinetcric",
    html: coquille(
      "Demande reçue",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bonjour ${opts.nom}, votre demande de démonstration nous est parvenue. Elle est lue par un consultant réglementé — pas par un automate — qui vous écrira pour convenir d'un moment.</p>
       <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">Il n'y a pas d'inscription libre : un accès s'ouvre cabinet par cabinet, après échange.</p>`,
      "Aucune action n'est attendue de votre part."
    ),
    texte: `Bonjour ${opts.nom}, votre demande de démonstration nous est parvenue. Nous vous écrirons pour convenir d'un moment.`,
  }
}
