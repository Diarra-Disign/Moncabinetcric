"use server"

import { randomBytes, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { envoyerCourriel, envoiConfigure, adresseDeReponse } from "@/lib/email/send"
import { siteUrl } from "@/lib/site-url"
import { identiteCourriel } from "./questionnaires"
import { verifierSections } from "./questionnaire-structure"
import { libelleCivilite, nomAvecCivilite } from "./identite"

/**
 * Actions de la bibliothèque de questionnaires.
 *
 * Même principe que matter-actions.ts : les règles vivent en base, ces
 * fonctions transmettent et traduisent. Ce qui est ici et nulle part ailleurs,
 * c'est ce que la base ne peut pas faire — engendrer un jeton, écrire un
 * courriel, prendre l'instantané d'un modèle.
 */

export interface Resultat {
  ok: boolean
  message: string
  /** Le lien d'accès, quand l'action vient d'en produire un. */
  lien?: string
}

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

function lisible(e: { message?: string; code?: string } | null): string {
  const brut = e?.message ?? "Erreur inattendue."
  if (e?.code === "42501" || /row-level security/i.test(brut)) {
    return "Vous n'avez pas le droit d'effectuer cette action."
  }
  if (e?.code === "23505") return "Cet élément existe déjà."
  if (/client_questionnaires_destinataire/.test(brut)) {
    return "Un questionnaire s'adresse à un client OU à un prospect, jamais aux deux."
  }
  return brut
}

/**
 * Un jeton d'accès et son empreinte.
 *
 * 32 octets tirés au sort, soit 256 bits : une énumération est hors de
 * portée. Seule l'empreinte part en base — le jeton lui-même n'existe que
 * dans le lien remis au destinataire, et nous ne pourrons plus le retrouver
 * ensuite. C'est voulu : « renvoyer le même lien » n'est pas une
 * fonctionnalité, c'est une fuite en puissance.
 *
 * L'empreinte doit être calculée exactement comme questionnaire_empreinte()
 * le fait en SQL, sans quoi tout lien émis serait refusé à l'ouverture.
 * ./cric questionnaires confronte les deux calculs.
 */
function nouveauJeton(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(32).toString("base64url")
  return { jeton, empreinte: createHash("sha256").update(jeton).digest("hex") }
}

function lienDuJeton(jeton: string, locale: string): string {
  return `${siteUrl()}/${locale}/q/${jeton}`
}

/**
 * Ce que le cabinet sait déjà du destinataire (§25).
 *
 * Conservé à part des réponses. Confondre les deux ferait disparaître la
 * distinction entre « le destinataire a confirmé cette information » et
 * « nous l'avons pré-remplie et personne ne l'a relue » — distinction qui
 * compte quand on signe une déclaration devant IRCC.
 */
function prefillDepuis(p: Record<string, unknown>): Record<string, unknown> {
  const nom = String(p.name ?? "")
  const prefill: Record<string, unknown> = {}
  const poser = (cle: string, valeur: unknown) => {
    if (valeur != null && String(valeur).trim() !== "") prefill[cle] = valeur
  }
  poser("lastName", p.last_name || nom.split(" ").slice(-1)[0])
  poser("firstName", p.first_name || (nom.includes(" ") ? nom.split(" ")[0] : ""))
  poser("email", p.email)
  poser("phone", p.phone)
  poser("citizenship", p.citizenship)
  // La civilité voyage avec la personne : un questionnaire qui la redemande
  // laisse croire au destinataire que le cabinet ne l'a pas notée.
  poser("civility", p.civility)
  return prefill
}

function substituer(modele: string, valeurs: Record<string, string>): string {
  return Object.entries(valeurs).reduce(
    (texte, [cle, valeur]) => texte.replaceAll(`[${cle}]`, valeur),
    modele
  )
}

// ---------------------------------------------------------------------------
// Envoyer
// ---------------------------------------------------------------------------

export async function envoyerQuestionnaire(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const templateId = String(formData.get("templateId") ?? "")
    const type = String(formData.get("destinataireType") ?? "")
    const destinataireId = String(formData.get("destinataireId") ?? "")
    const matterId = String(formData.get("matterId") ?? "").trim()
    const dueDate = String(formData.get("dueDate") ?? "").trim()
    const messageSaisi = String(formData.get("message") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    if (!templateId) return { ok: false, message: "Choisissez un questionnaire." }
    if (!destinataireId) return { ok: false, message: "Choisissez un destinataire." }
    if (type !== "client" && type !== "lead") {
      return { ok: false, message: "Type de destinataire inconnu." }
    }

    const { data: modele, error: eModele } = await sb
      .from("questionnaire_templates")
      .select("id, title_fr, title_en, description_fr, description_en, sections, message_fr, message_en")
      .eq("id", templateId)
      .maybeSingle()
    if (eModele || !modele) return { ok: false, message: "Ce questionnaire est introuvable." }

    // Le destinataire est relu en base : se fier au nom transmis par le
    // formulaire reviendrait à laisser le navigateur décider à qui l'on écrit.
    const table = type === "client" ? "clients" : "leads"
    const colonnes =
      type === "client"
        ? "id, name, first_name, last_name, email, phone, citizenship, civility"
        : "id, name, first_name, last_name, email, phone, civility"
    const { data: personne } = await sb.from(table).select(colonnes).eq("id", destinataireId).maybeSingle()
    if (!personne) return { ok: false, message: "Ce destinataire est introuvable." }

    const p = personne as unknown as Record<string, unknown>
    const courriel = String(p.email ?? "").trim()
    const nom = String(p.name ?? "")
    const prenom = String(p.first_name ?? "") || (nom.includes(" ") ? nom.split(" ")[0] : nom)

    const { jeton, empreinte } = nouveauJeton()
    const titre = locale === "en" ? String(modele.title_en) : String(modele.title_fr)
    const echeance = dueDate ? new Date(dueDate).toISOString() : null

    const message = substituer(
      messageSaisi || String(locale === "en" ? modele.message_en : modele.message_fr),
      {
        "Prénom": prenom,
        Prenom: prenom,
        Nom: nom,
        // « Monsieur Adama Diarra », ou le nom seul si la civilité manque —
        // jamais un espace en tête. Un courriel qui commence par «  Diarra »
        // se remarque, et c'est celui qu'on envoie à un futur client.
        Civilite: libelleCivilite(String(p.civility ?? ""), locale),
        "Civilité": libelleCivilite(String(p.civility ?? ""), locale),
        "Nom complet": nomAvecCivilite(
          { civility: String(p.civility ?? ""), name: nom, firstName: prenom },
          locale
        ),
        "Date limite": dueDate || "",
      }
    )

    const { data: insere, error } = await sb
      .from("client_questionnaires")
      .insert({
        firm_id: membre.firmId,
        client_id: type === "client" ? destinataireId : null,
        lead_id: type === "lead" ? destinataireId : null,
        matter_id: type === "client" && matterId ? matterId : null,
        template_id: modele.id,
        title: titre,
        description: locale === "en" ? modele.description_en : modele.description_fr,
        // L'instantané, et non une référence : remanier le modèle demain ne
        // doit pas déplacer le sol sous les pieds de qui remplit aujourd'hui.
        sections: modele.sections,
        message,
        prefill: prefillDepuis(p),
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_by: membre.profileId,
        due_date: echeance,
        token_hash: empreinte,
      })
      .select("id")
      .single()

    if (error) return { ok: false, message: lisible(error) }

    const lien = lienDuJeton(jeton, locale)
    const identite = await identiteCourriel()
    const envoi = await courrielDInvitation({ courriel, nom: prenom, titre, message, lien, dueDate, identite })

    revalidatePath(`/${locale}/questionnaires`)
    if (matterId) revalidatePath(`/${locale}/matters`)

    if (!courriel) {
      return { ok: true, lien, message: "Questionnaire créé. Ce destinataire n'a pas de courriel : copiez le lien." }
    }
    if (!envoi.configure) {
      return { ok: true, lien, message: "Questionnaire créé. L'envoi de courriel n'est pas configuré : copiez le lien." }
    }
    if (!envoi.envoye) {
      return { ok: true, lien, message: `Questionnaire créé, mais le courriel n'est pas parti (${envoi.erreur ?? "erreur inconnue"}). Copiez le lien.` }
    }
    return { ok: true, lien, message: `Questionnaire envoyé à ${courriel}.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

async function courrielDInvitation(o: {
  courriel: string
  nom: string
  titre: string
  message: string
  lien: string
  dueDate: string
  identite: { nom: string; nomExpediteur: string; repondreA: string | null }
}) {
  if (!o.courriel) return { envoye: false, configure: envoiConfigure() }

  const echeance = o.dueDate
    ? `<p style="font-size:14px;color:#b45309"><strong>À compléter avant le ${o.dueDate}.</strong></p>`
    : ""
  const repondreA = o.identite.repondreA ?? adresseDeReponse() ?? ""

  return envoyerCourriel({
    destinataire: o.courriel,
    nomExpediteur: o.identite.nomExpediteur,
    repondreA: o.identite.repondreA,
    sujet: `${o.titre} — ${o.identite.nom}`,
    texte:
      `${o.message}\n\n${o.titre}\n${o.lien}\n\n` +
      (o.dueDate ? `À compléter avant le ${o.dueDate}.\n\n` : "") +
      `${o.identite.nom}\n${repondreA}`,
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px">${o.identite.nom}</p>
        <h1 style="font-size:20px;margin:0 0 16px">${o.titre}</h1>
        <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${o.message}</div>
        ${echeance}
        <p style="margin:28px 0">
          <a href="${o.lien}" style="background:#1e3a8a;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">
            Remplir le questionnaire
          </a>
        </p>
        <p style="font-size:12px;color:#64748b">Ce lien vous est personnel : ne le transmettez à personne.</p>
        <p style="font-size:12px;color:#64748b">${o.identite.nom} — ${repondreA}</p>
      </div>`,
  })
}

// ---------------------------------------------------------------------------
// Suivre un envoi
// ---------------------------------------------------------------------------

export async function envoyerRappel(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const messageSaisi = String(formData.get("message") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    const { data: q } = await sb
      .from("client_questionnaires")
      .select("id, title, due_date, status, clients(name, email), leads(name, email)")
      .eq("id", id)
      .maybeSingle()
    if (!q) return { ok: false, message: "Questionnaire introuvable." }

    const cible = (q.clients ?? q.leads) as unknown as { name?: string; email?: string } | null
    const courriel = String(cible?.email ?? "").trim()
    if (!courriel) return { ok: false, message: "Ce destinataire n'a pas d'adresse courriel." }

    // Le jeton précédent n'est pas relisible — seule son empreinte est en
    // base, et c'est bien l'intérêt. Le rappel en émet donc un neuf, qui
    // remplace l'ancien plutôt que de s'y ajouter : à tout instant, une
    // personne dispose d'exactement un lien valide. Un rappel qui laisserait
    // vivre les deux multiplierait les accès à chaque relance, et le premier
    // lien — celui qui a le plus circulé — serait le dernier à s'éteindre.
    // Les réponses déjà saisies ne bougent pas : elles vivent sur la ligne,
    // pas sur le jeton.
    const { jeton, empreinte } = nouveauJeton()
    const lien = lienDuJeton(jeton, locale)

    const echeance = q.due_date ? new Date(String(q.due_date)).toLocaleDateString(locale === "en" ? "en-CA" : "fr-CA") : ""
    const nom = String(cible?.name ?? "").split(" ")[0]
    const message = substituer(messageSaisi || messageDeRappelParDefaut(String(q.title), echeance), {
      "Prénom": nom,
      Prenom: nom,
      "Date limite": echeance,
    })

    const identite = await identiteCourriel()
    const envoi = await envoyerCourriel({
      destinataire: courriel,
      nomExpediteur: identite.nomExpediteur,
      repondreA: identite.repondreA,
      sujet: `Rappel — ${q.title}`,
      texte: `${message}\n\n${lien}\n\n${identite.nom}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${message}</div>
        <p style="margin:28px 0">
          <a href="${lien}" style="background:#1e3a8a;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:700;display:inline-block">
            Remplir le questionnaire
          </a>
        </p>
        <p style="font-size:12px;color:#64748b">Ce nouveau lien remplace le précédent, qui ne fonctionne plus.</p>
        <p style="font-size:12px;color:#64748b;margin-top:24px">${identite.nom}</p>
      </div>`,
    })

    if (!envoi.configure) return { ok: false, message: "L'envoi de courriel n'est pas configuré." }
    if (!envoi.envoye) return { ok: false, message: `Le rappel n'est pas parti : ${envoi.erreur ?? "erreur inconnue"}.` }

    // Le jeton n'est remplacé qu'APRÈS le départ du courriel. L'inverse
    // couperait l'accès du destinataire au moindre échec d'envoi : son ancien
    // lien serait mort et le nouveau ne lui serait jamais parvenu.
    const { error } = await sb
      .from("client_questionnaires")
      .update({
        token_hash: empreinte,
        token_revoked_at: null,
        reminded_at: new Date().toISOString(),
        reminder_count: await prochainRappel(sb, id),
      })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, lien, message: `Rappel envoyé à ${courriel}. Un nouveau lien remplace le précédent.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

function messageDeRappelParDefaut(titre: string, echeance: string): string {
  return (
    `Bonjour [Prénom],\n\n` +
    `Nous vous rappelons que le questionnaire « ${titre} » est toujours en attente de votre réponse.\n\n` +
    (echeance ? `Merci de le compléter avant le ${echeance}.` : `Merci de le compléter dès que possible.`)
  )
}

/** Le compteur est relu puis incrémenté : deux rappels simultanés n'en font pas un. */
async function prochainRappel(sb: Awaited<ReturnType<typeof getSessionSupabase>>, id: string): Promise<number> {
  const { data } = await sb.from("client_questionnaires").select("reminder_count").eq("id", id).maybeSingle()
  return Number(data?.reminder_count ?? 0) + 1
}

export async function prolongerDateLimite(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const date = String(formData.get("dueDate") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    const { error } = await sb
      .from("client_questionnaires")
      .update({ due_date: date ? new Date(date).toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: date ? `Date limite reportée au ${date}.` : "Date limite retirée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Désactive le lien (§15).
 *
 * Le jeton n'est pas effacé mais daté : l'empreinte reste en place, ce qui
 * permet de distinguer « lien révoqué » d'« lien inconnu ». Un visiteur voit
 * alors « ce lien a été désactivé » plutôt qu'une erreur générique qui
 * l'aurait laissé croire à une faute de frappe.
 */
export async function revoquerLien(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { error } = await sb
      .from("client_questionnaires")
      .update({ token_revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: "Le lien a été désactivé." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Rouvre un envoi pour correction, en nommant ce qui doit être repris. */
export async function demanderCorrection(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const commentaire = String(formData.get("commentaire") ?? "").trim()
    const sectionId = String(formData.get("sectionId") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    if (!commentaire) return { ok: false, message: "Indiquez ce qui doit être corrigé." }

    const { data: q } = await sb.from("client_questionnaires").select("corrections").eq("id", id).maybeSingle()
    if (!q) return { ok: false, message: "Questionnaire introuvable." }

    const corrections = [
      { sectionId, comment: commentaire, status: "pending", requestedAt: new Date().toISOString() },
      ...((q.corrections as unknown[]) ?? []),
    ]

    const { error } = await sb
      .from("client_questionnaires")
      .update({ corrections, status: "to_correct", updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: "Correction demandée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Clôt un questionnaire : plus personne ne le modifie, ni le cabinet ni le destinataire. */
export async function cloreQuestionnaire(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { error } = await sb
      .from("client_questionnaires")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: "Questionnaire clos." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// La bibliothèque
// ---------------------------------------------------------------------------

/**
 * Duplique un modèle dans le cabinet (§22).
 *
 * C'est la seule façon de modifier un modèle système : l'original reste
 * intact pour les autres cabinets, et la copie appartient à celui qui l'a
 * faite. La contrainte d'unicité du slug fait le reste — « preconsultation »
 * du cabinet et « preconsultation » du système coexistent sans se confondre.
 */
export async function dupliquerModele(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const titre = String(formData.get("titre") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    const { data: src } = await sb
      .from("questionnaire_templates")
      .select("slug, title_fr, title_en, description_fr, description_en, sections, message_fr, message_en")
      .eq("id", id)
      .maybeSingle()
    if (!src) return { ok: false, message: "Modèle introuvable." }

    const nouveauTitre = titre || `${src.title_fr} (copie)`
    const { error } = await sb.from("questionnaire_templates").insert({
      firm_id: membre.firmId,
      slug: await slugLibre(sb, membre.firmId, String(src.slug)),
      title_fr: nouveauTitre,
      title_en: titre || `${src.title_en} (copy)`,
      description_fr: src.description_fr,
      description_en: src.description_en,
      sections: src.sections,
      message_fr: src.message_fr,
      message_en: src.message_en,
      created_by: membre.profileId,
    })
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: `« ${nouveauTitre} » ajouté à votre bibliothèque.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Trouve un slug libre dans le cabinet : preconsultation, -2, -3… */
async function slugLibre(
  sb: Awaited<ReturnType<typeof getSessionSupabase>>,
  firmId: string,
  base: string
): Promise<string> {
  const { data } = await sb.from("questionnaire_templates").select("slug").eq("firm_id", firmId)
  const pris = new Set((data ?? []).map((r) => String(r.slug)))
  if (!pris.has(base)) return base
  for (let n = 2; n < 100; n++) if (!pris.has(`${base}-${n}`)) return `${base}-${n}`
  return `${base}-${Date.now()}`
}

export async function enregistrerModele(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "").trim()
    const titreFr = String(formData.get("titreFr") ?? "").trim()
    const descriptionFr = String(formData.get("descriptionFr") ?? "").trim()
    const messageFr = String(formData.get("messageFr") ?? "").trim()
    const sectionsBrut = String(formData.get("sections") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    if (!titreFr) return { ok: false, message: "Donnez un titre au questionnaire." }

    let sections: unknown = []
    if (sectionsBrut) {
      let analyse: unknown
      try {
        analyse = JSON.parse(sectionsBrut)
      } catch {
        return { ok: false, message: "La structure des sections est illisible." }
      }
      const controle = verifierSections(analyse)
      if (!controle.ok) return { ok: false, message: controle.message }
      sections = controle.sections
    }

    if (id) {
      const { error } = await sb
        .from("questionnaire_templates")
        .update({
          title_fr: titreFr,
          title_en: titreFr,
          description_fr: descriptionFr,
          description_en: descriptionFr,
          message_fr: messageFr,
          message_en: messageFr,
          ...(sectionsBrut ? { sections } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
      if (error) return { ok: false, message: lisible(error) }
      revalidatePath(`/${locale}/questionnaires`)
      return { ok: true, message: "Questionnaire enregistré." }
    }

    const base = titreFr
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "questionnaire"

    const { error } = await sb.from("questionnaire_templates").insert({
      firm_id: membre.firmId,
      slug: await slugLibre(sb, membre.firmId, base),
      title_fr: titreFr,
      title_en: titreFr,
      description_fr: descriptionFr,
      description_en: descriptionFr,
      message_fr: messageFr,
      message_en: messageFr,
      sections,
      created_by: membre.profileId,
    })
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: `« ${titreFr} » ajouté à votre bibliothèque.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function supprimerModele(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    // Désactivé, jamais effacé : les questionnaires déjà envoyés depuis ce
    // modèle continuent de le désigner, et leur historique doit rester lisible.
    const { error } = await sb
      .from("questionnaire_templates")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: "Questionnaire retiré de la bibliothèque." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Désigne le questionnaire proposé d'emblée depuis une fiche prospect (§23). */
export async function definirParDefaut(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    // Le précédent est d'abord dégagé : l'index unique refuserait le second.
    await sb
      .from("questionnaire_templates")
      .update({ is_default_preconsultation: false })
      .eq("firm_id", membre.firmId)
      .eq("is_default_preconsultation", true)

    const { error } = await sb
      .from("questionnaire_templates")
      .update({ is_default_preconsultation: true })
      .eq("id", id)
      .eq("firm_id", membre.firmId)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/questionnaires`)
    return { ok: true, message: "Questionnaire proposé par défaut aux prospects." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
