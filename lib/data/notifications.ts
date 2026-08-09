import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"

/**
 * Lecture des notifications.
 *
 * « Non lu » n'est pas une colonne mais une ABSENCE : il n'existe pas de
 * ligne dans notification_reads pour ce membre. Cela évite d'écrire une ligne
 * par membre à chaque émission, et donne le bon comportement pour un membre
 * arrivé après coup — il voit comme non lues les notifications antérieures à
 * son arrivée, ce qu'un drapeau posé à l'émission n'aurait pas su faire.
 */

export interface Notification {
  id: string
  kind: string
  titre: string
  corps: string
  /** Chemin sans locale, tel qu'il est stocké. L'écran préfixe. */
  lien: string | null
  creeLe: string
  lu: boolean
}

export interface BoiteNotifications {
  liste: Notification[]
  nonLues: number
}

export async function listerNotifications(limite = 30): Promise<BoiteNotifications> {
  const membre = await getCurrentMember()
  if (!membre) return { liste: [], nonLues: 0 }

  const sb = await getSessionSupabase()

  const [{ data: notifs }, { data: lues }] = await Promise.all([
    sb
      .from("notifications")
      .select("id, kind, title, body, link, created_at")
      .order("created_at", { ascending: false })
      .limit(limite),
    sb.from("notification_reads").select("notification_id"),
  ])

  const dejaLues = new Set((lues ?? []).map((r) => String(r.notification_id)))

  const liste = (notifs ?? []).map((n) => ({
    id: String(n.id),
    kind: String(n.kind),
    titre: String(n.title ?? ""),
    corps: String(n.body ?? ""),
    lien: n.link ? String(n.link) : null,
    creeLe: String(n.created_at),
    lu: dejaLues.has(String(n.id)),
  }))

  return { liste, nonLues: liste.filter((n) => !n.lu).length }
}
