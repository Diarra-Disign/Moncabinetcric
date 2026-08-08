"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { getCurrentPlatformAdmin, getSessionSupabase } from "@/lib/supabase/session"
import { invaliderCatalogue } from "@/lib/billing/catalogue"

/**
 * Pilotage du catalogue par l'exploitant.
 *
 * Les écritures passent par le client de session, donc par la RLS : les
 * politiques de `plan_limits`, `plan_features` et `firm_feature_overrides`
 * exigent is_platform_admin(). Le contrôle applicatif ci-dessous ne sert qu'à
 * produire un message lisible — même contourné, la base refuserait.
 *
 * Chaque geste est consigné dans `platform_audit`, qui n'a AUCUNE politique
 * d'écriture : seule la clé de service y écrit, et uniquement depuis ce
 * fichier. Un journal qu'on peut corriger ne prouve rien.
 *
 * Ce que ces actions ne font pas, volontairement : toucher à Stripe. Modifier
 * un prix au catalogue change ce qui sera facturé aux PROCHAINES
 * souscriptions ; les abonnements en cours gardent le tarif auquel ils ont
 * souscrit, ce que Stripe garantit par l'immuabilité de ses prix. Répercuter un
 * changement de tarif sur les abonnés existants est une décision commerciale,
 * pas un effet de bord d'un formulaire.
 */

export interface ResultatCatalogue {
  ok: boolean
  message: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

async function exigerAdministrateur() {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) throw new Error("Réservé aux administrateurs de la plateforme.")
  return admin
}

/** Consigne un geste d'exploitation. Jamais silencieux, jamais modifiable. */
async function journaliser(params: {
  actorId: string
  actorEmail: string
  action: string
  firmId?: string | null
  firmName?: string
  summary: string
  details?: Record<string, unknown>
}) {
  await serviceClient().from("platform_audit").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    firm_id: params.firmId ?? null,
    firm_name: params.firmName ?? "",
    summary: params.summary,
    details: params.details ?? null,
  })
}

/** Lit un montant en dollars saisi au formulaire, et le rend en cents. */
function cents(valeur: FormDataEntryValue | null): number | null {
  const brut = String(valeur ?? "").trim().replace(",", ".")
  if (brut === "") return null
  const n = Number.parseFloat(brut)
  if (!Number.isFinite(n) || n < 0) return null
  // Arrondi explicite : 16.9 * 100 vaut 1689.9999… en virgule flottante, et
  // un forfait à 169 $ se retrouverait facturé 16,89 $.
  return Math.round(n * 100)
}

function entier(valeur: FormDataEntryValue | null): number | null {
  const brut = String(valeur ?? "").trim()
  if (brut === "") return null
  const n = Number.parseInt(brut, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Modifie un forfait du catalogue.
 *
 * Les contraintes de `plan_limits` font le gros du travail — montants positifs,
 * annuel supérieur au mensuel, forfait souscriptible obligatoirement tarifé.
 * On ne les recopie pas ici : les redoubler créerait deux vérités à tenir
 * synchronisées, et c'est la base qui doit avoir le dernier mot.
 */
export async function modifierForfait(formData: FormData): Promise<ResultatCatalogue> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const plan = String(formData.get("plan") ?? "").trim()
    if (!plan) return { ok: false, message: "Forfait manquant." }

    const champs = {
      label_fr: String(formData.get("label_fr") ?? "").trim(),
      label_en: String(formData.get("label_en") ?? "").trim(),
      monthly_cents: cents(formData.get("monthly")),
      annual_cents: cents(formData.get("annual")),
      extra_seat_monthly_cents: cents(formData.get("extra_monthly")) ?? 0,
      extra_seat_annual_cents: cents(formData.get("extra_annual")) ?? 0,
      seats_included: entier(formData.get("seats_included")) ?? 1,
      max_seats: entier(formData.get("max_seats")),
      purchasable: String(formData.get("purchasable") ?? "") === "1",
      updated_at: new Date().toISOString(),
    }

    if (!champs.label_fr || !champs.label_en) {
      return { ok: false, message: "Les deux libellés sont obligatoires : l'application est bilingue." }
    }

    const { data: avant } = await supabase
      .from("plan_limits")
      .select("label_fr, monthly_cents, annual_cents, seats_included, purchasable")
      .eq("plan", plan)
      .maybeSingle()

    const { error } = await supabase.from("plan_limits").update(champs).eq("plan", plan)
    if (error) return { ok: false, message: error.message }

    invaliderCatalogue()
    await journaliser({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "plan.update",
      summary: `Forfait « ${champs.label_fr} » modifié.`,
      details: { plan, avant, apres: champs },
    })

    revalidatePath("/[locale]/admin", "page")
    return {
      ok: true,
      // Dire ce que la modification ne fait PAS vaut mieux que de le laisser
      // découvrir : un exploitant qui croit avoir augmenté ses revenus du mois
      // se trompe de plusieurs semaines.
      message: `Forfait « ${champs.label_fr} » mis à jour. Les abonnements en cours gardent leur tarif ; seules les nouvelles souscriptions suivent.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Active ou retire une fonctionnalité pour un forfait entier. */
export async function basculerFonctionnalite(formData: FormData): Promise<ResultatCatalogue> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const plan = String(formData.get("plan") ?? "")
    const feature = String(formData.get("feature") ?? "")
    const activer = String(formData.get("activer") ?? "") === "1"
    if (!plan || !feature) return { ok: false, message: "Forfait ou fonctionnalité manquant." }

    // Une fonctionnalité « toujours incluse » ne se retire pas : le journal
    // d'audit répond d'une obligation de tenue de dossiers, et le décrocher
    // d'un forfait reviendrait à vendre la conformité.
    const { data: f } = await supabase
      .from("features")
      .select("label_fr, always_on")
      .eq("key", feature)
      .maybeSingle()

    if (f?.always_on) {
      return {
        ok: false,
        message: `« ${f.label_fr} » est comprise dans tous les forfaits et ne peut pas en être retirée.`,
      }
    }

    const { error } = await supabase
      .from("plan_features")
      .upsert({ plan, feature, enabled: activer }, { onConflict: "plan,feature" })

    if (error) return { ok: false, message: error.message }

    await journaliser({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: activer ? "plan_feature.enable" : "plan_feature.disable",
      summary: `« ${f?.label_fr ?? feature} » ${activer ? "activée" : "retirée"} pour le forfait ${plan}.`,
      details: { plan, feature, enabled: activer },
    })

    revalidatePath("/[locale]/admin", "page")
    return {
      ok: true,
      message: `« ${f?.label_fr ?? feature} » ${activer ? "activée" : "retirée"} pour ${plan}. Effet immédiat sur tous les cabinets de ce forfait.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Accorde ou retire une fonctionnalité à UN cabinet, sans changer son forfait.
 *
 * L'échéance n'est pas décorative. Une faveur sans date devient un droit acquis
 * que personne ne pense à retirer, et l'écart entre ce qui est facturé et ce
 * qui est ouvert se creuse cabinet par cabinet jusqu'à ce que plus personne ne
 * sache ce que vaut réellement un forfait.
 */
export async function accorderException(formData: FormData): Promise<ResultatCatalogue> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const firmId = String(formData.get("firmId") ?? "")
    const feature = String(formData.get("feature") ?? "")
    const activer = String(formData.get("activer") ?? "") === "1"
    const jours = entier(formData.get("jours"))
    const motif = String(formData.get("motif") ?? "").trim()

    if (!firmId || !feature) return { ok: false, message: "Cabinet ou fonctionnalité manquant." }
    if (!motif) {
      // Exigé, et non facultatif : une exception dont personne ne sait
      // pourquoi elle existe ne se retire jamais, faute de pouvoir juger.
      return { ok: false, message: "Indiquez le motif : c'est ce qui permettra de décider un jour de la retirer." }
    }

    const [{ data: cabinet }, { data: f }] = await Promise.all([
      supabase.from("firms").select("name").eq("id", firmId).maybeSingle(),
      supabase.from("features").select("label_fr, always_on").eq("key", feature).maybeSingle(),
    ])

    if (f?.always_on) {
      return { ok: false, message: `« ${f.label_fr} » est comprise partout : aucune exception n'a d'effet.` }
    }

    const { error } = await supabase.from("firm_feature_overrides").upsert(
      {
        firm_id: firmId,
        feature,
        enabled: activer,
        reason: motif,
        granted_by: admin.userId,
        granted_at: new Date().toISOString(),
        expires_at: jours ? new Date(Date.now() + jours * 86400000).toISOString() : null,
      },
      { onConflict: "firm_id,feature" }
    )

    if (error) return { ok: false, message: error.message }

    await journaliser({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: activer ? "override.grant" : "override.deny",
      firmId,
      firmName: (cabinet?.name as string) ?? "",
      summary: `« ${f?.label_fr ?? feature} » ${activer ? "accordée" : "retirée"} à ${cabinet?.name ?? "un cabinet"}${jours ? ` pour ${jours} jour(s)` : " sans échéance"}.`,
      details: { feature, enabled: activer, jours, motif },
    })

    revalidatePath("/[locale]/admin", "page")
    return {
      ok: true,
      message: jours
        ? `Exception posée jusque dans ${jours} jour(s). Elle s'éteindra d'elle-même.`
        : "Exception posée sans échéance. Pensez à la revoir : rien ne la retirera à votre place.",
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Retire une exception : le cabinet retombe sur ce que son forfait prévoit. */
export async function retirerException(formData: FormData): Promise<ResultatCatalogue> {
  try {
    const admin = await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const firmId = String(formData.get("firmId") ?? "")
    const feature = String(formData.get("feature") ?? "")
    if (!firmId || !feature) return { ok: false, message: "Cabinet ou fonctionnalité manquant." }

    const { data: cabinet } = await supabase.from("firms").select("name").eq("id", firmId).maybeSingle()

    const { error } = await supabase
      .from("firm_feature_overrides")
      .delete()
      .eq("firm_id", firmId)
      .eq("feature", feature)

    if (error) return { ok: false, message: error.message }

    await journaliser({
      actorId: admin.userId,
      actorEmail: admin.email,
      action: "override.remove",
      firmId,
      firmName: (cabinet?.name as string) ?? "",
      summary: `Exception « ${feature} » retirée à ${cabinet?.name ?? "un cabinet"}.`,
      details: { feature },
    })

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: "Exception retirée. Le cabinet suit de nouveau son forfait." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
