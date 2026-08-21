"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase } from "@/lib/supabase/session"
import { getServerSupabase } from "@/lib/supabase/server"
import { exigerPermission } from "@/lib/auth/permissions"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Les disponibilités du cabinet et sa page publique.
 *
 * Les plages passent par le client de SESSION, donc par la RLS : la politique
 * de `firm_availability` exige le cabinet de la session. Le contrôle applicatif
 * ne sert qu'à rendre un message lisible — même contourné, la base refuserait.
 *
 * L'adresse publique passe par la clé de service, parce qu'elle doit vérifier
 * l'unicité sur TOUTE la plateforme : un cabinet ne peut pas voir, sous la RLS,
 * qu'un autre a déjà pris le nom qu'il convoite.
 */

export interface Plage { id: string; weekday: number; start: string; end: string }
export interface ResultatDispo { ok: boolean; message: string }

export async function listerPlages(): Promise<Plage[]> {
  try {
    const sb = await getSessionSupabase()
    const { data } = await sb
      .from("firm_availability")
      .select("id, weekday, start_time, end_time")
      .order("weekday").order("start_time")
    return (data ?? []).map((p) => ({
      id: String(p.id),
      weekday: Number(p.weekday),
      start: String(p.start_time ?? "").slice(0, 5),
      end: String(p.end_time ?? "").slice(0, 5),
    }))
  } catch {
    return []
  }
}

export async function ajouterPlage(formData: FormData): Promise<ResultatDispo> {
  try {
    const membre = await exigerPermission("firm.members")
    const weekday = Number(formData.get("weekday"))
    const start = String(formData.get("start") ?? "").slice(0, 5)
    const end = String(formData.get("end") ?? "").slice(0, 5)

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, message: "Jour invalide." }
    }
    // La contrainte existe en base ; ce contrôle-ci n'existe que pour dire
    // POURQUOI, plutôt que de laisser remonter une violation de contrainte.
    if (end <= start) {
      return { ok: false, message: "L'heure de fin doit suivre l'heure de début." }
    }

    const sb = await getSessionSupabase()
    const { error } = await sb.from("firm_availability").insert({
      firm_id: membre.firmId, weekday, start_time: start, end_time: end,
    })
    if (error) return { ok: false, message: messageErreur(error) }

    revalidatePath("/settings")
    return { ok: true, message: "Plage ajoutée." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function retirerPlage(id: string): Promise<ResultatDispo> {
  try {
    await exigerPermission("firm.members")
    const sb = await getSessionSupabase()
    const { error } = await sb.from("firm_availability").delete().eq("id", id)
    if (error) return { ok: false, message: messageErreur(error) }
    revalidatePath("/settings")
    return { ok: true, message: "Plage retirée." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

export async function enregistrerPagePublique(formData: FormData): Promise<ResultatDispo> {
  try {
    const membre = await exigerPermission("firm.members")
    const slugBrut = String(formData.get("slug") ?? "").trim().toLowerCase()
    const active = String(formData.get("active") ?? "") === "on"
    const duree = Number(formData.get("duree") ?? 30)
    const preavis = Number(formData.get("preavis") ?? 24)
    const horizon = Number(formData.get("horizon") ?? 30)

    if (slugBrut && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slugBrut)) {
      return {
        ok: false,
        message: "L'adresse ne peut contenir que des lettres minuscules, des chiffres et des tirets, entre 3 et 40 caractères.",
      }
    }
    if (active && !slugBrut) {
      // Ouvrir sans adresse produirait une page inaccessible et un cabinet
      // persuadé d'être joignable.
      return { ok: false, message: "Choisissez une adresse avant d'ouvrir votre page." }
    }

    const service = getServerSupabase()
    if (slugBrut) {
      const { data: pris } = await service
        .from("firms").select("id").eq("booking_slug", slugBrut).maybeSingle()
      if (pris && pris.id !== membre.firmId) {
        return { ok: false, message: "Cette adresse est déjà prise. Choisissez-en une autre." }
      }
    }

    const { error } = await service.from("firms").update({
      booking_slug: slugBrut || null,
      booking_enabled: active,
      booking_slot_minutes: Math.min(240, Math.max(10, duree)),
      booking_lead_hours: Math.min(720, Math.max(0, preavis)),
      booking_horizon_days: Math.min(180, Math.max(1, horizon)),
    }).eq("id", membre.firmId)
    if (error) return { ok: false, message: messageErreur(error) }

    revalidatePath("/settings")
    return { ok: true, message: active ? "Votre page de réservation est ouverte." : "Réglages enregistrés." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
