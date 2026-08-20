"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Promotion d'un rendez-vous en prospect ou en client.
 *
 * Referme la boucle du flux d'acquisition : quelqu'un réserve une
 * consultation, et l'information saisie à cette occasion sert directement
 * à créer sa fiche — au lieu d'être recopiée à la main.
 *
 * La création d'un client est un acte professionnel : elle correspond au
 * moment où une personne devient cliente du cabinet, normalement à la
 * signature de l'entente. La création d'un prospect n'engage rien.
 */

export interface ResultatPromotion {
  ok: boolean
  message: string
  /** Identifiant créé, pour rediriger vers la fiche. */
  id?: string
}

/** Écrire est réservé aux rôles qui peuvent tenir un dossier. */
const PEUVENT_ECRIRE = ["owner", "rcic", "risia", "staff"]

async function exigerDroitEcriture() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session absente.")
  if (!PEUVENT_ECRIRE.includes(membre.ciccRole)) {
    throw new Error("Votre rôle ne permet pas de créer un dossier.")
  }
  return membre
}

/**
 * Numéro de dossier séquentiel par année : CRIC-2026-0001.
 *
 * Calculé à partir du plus grand numéro existant plutôt que du nombre de
 * clients — supprimer un client ne doit pas faire réattribuer son numéro,
 * qui figure sur des documents déjà transmis.
 */
async function prochainNumero(supabase: Awaited<ReturnType<typeof getSessionSupabase>>) {
  const annee = new Date().getFullYear()
  const prefixe = `CRIC-${annee}-`

  const { data } = await supabase
    .from("clients")
    .select("file_number")
    .like("file_number", `${prefixe}%`)
    .order("file_number", { ascending: false })
    .limit(1)

  const dernier = data?.[0]?.file_number as string | undefined
  const rang = dernier ? Number.parseInt(dernier.slice(prefixe.length), 10) : 0
  const suivant = Number.isFinite(rang) ? rang + 1 : 1
  return `${prefixe}${String(suivant).padStart(4, "0")}`
}

export async function creerProspectDepuisRdv(formData: FormData): Promise<ResultatPromotion> {
  try {
    const membre = await exigerDroitEcriture()
    const supabase = await getSessionSupabase()

    const nom = String(formData.get("nom") ?? "").trim()
    const courriel = String(formData.get("courriel") ?? "").trim().toLowerCase()
    const telephone = String(formData.get("telephone") ?? "").trim()
    const visa = String(formData.get("visa") ?? "").trim()
    const notes = String(formData.get("notes") ?? "").trim()

    if (!nom) return { ok: false, message: "Le nom est obligatoire." }
    if (!courriel) return { ok: false, message: "Le courriel est obligatoire." }

    const { data: doublon } = await supabase
      .from("leads")
      .select("id")
      .eq("firm_id", membre.firmId)
      .eq("email", courriel)
      .maybeSingle()
    if (doublon) return { ok: false, message: "Un prospect existe déjà avec ce courriel." }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        firm_id: membre.firmId,
        name: nom,
        email: courriel,
        phone: telephone,
        type: "b2c",
        visa_type: visa || "À déterminer",
        estimated_value: 0,
        score: 50,
        score_label: "med",
        stage: "consultation",
        last_contact: new Date().toISOString().slice(0, 10),
        notes,
        source: "Rendez-vous",
      })
      .select("id")
      .single()

    if (error) return { ok: false, message: messageErreur(error) }

    revalidatePath("/[locale]/pipeline", "page")
    return { ok: true, message: `Prospect « ${nom} » créé.`, id: data.id as string }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function creerClientDepuisRdv(formData: FormData): Promise<ResultatPromotion> {
  try {
    const membre = await exigerDroitEcriture()
    const supabase = await getSessionSupabase()

    const nom = String(formData.get("nom") ?? "").trim()
    const courriel = String(formData.get("courriel") ?? "").trim().toLowerCase()
    const telephone = String(formData.get("telephone") ?? "").trim()
    const programme = String(formData.get("programme") ?? "").trim()
    const motif = String(formData.get("motif") ?? "").trim()

    if (!nom) return { ok: false, message: "Le nom est obligatoire." }
    if (!courriel) return { ok: false, message: "Le courriel est obligatoire." }

    const { data: doublon } = await supabase
      .from("clients")
      .select("id, file_number")
      .eq("firm_id", membre.firmId)
      .eq("email", courriel)
      .maybeSingle()
    if (doublon) {
      return { ok: false, message: `Ce courriel est déjà celui du dossier ${doublon.file_number}.` }
    }

    const numero = await prochainNumero(supabase)

    const { data, error } = await supabase
      .from("clients")
      .insert({
        firm_id: membre.firmId,
        file_number: numero,
        name: nom,
        email: courriel,
        phone: telephone,
        program: programme,
        status: "active",
        intake_motif: motif,
      })
      .select("id")
      .single()

    if (error) return { ok: false, message: messageErreur(error) }

    // Le prospect correspondant n'est pas supprimé : l'historique du
    // pipeline — origine, durée du cycle, valeur estimée face au réel —
    // se perdrait. Il est marqué comme signé.
    await supabase
      .from("leads")
      .update({ stage: "signed", last_contact: new Date().toISOString().slice(0, 10) })
      .eq("firm_id", membre.firmId)
      .eq("email", courriel)

    revalidatePath("/[locale]/clients", "page")
    revalidatePath("/[locale]/pipeline", "page")
    return { ok: true, message: `Fiche client créée pour ${nom}.`, id: data.id as string }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
