import "server-only"

import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"

/**
 * Permissions, côté application.
 *
 * L'autorité est en base : `member_can()`. Ce module ne fait que l'interroger,
 * pour produire un refus lisible avant qu'une action ne s'exécute. Il ne
 * REMPLACE jamais le contrôle de la base — les vingt politiques RLS qui
 * s'appuient sur can_write(), can_delete() et can_bill() refuseraient de toute
 * façon.
 *
 * Reconstituer la règle ici, en comparant des rôles, produirait deux vérités :
 * l'une dans le code, l'autre en base, et un cabinet qui ajuste les permissions
 * d'un membre verrait l'écran et la base se contredire.
 */

export const PERMISSIONS = [
  "records.write",
  "records.delete",
  "invoices.write",
  "portal.manage",
  "signatures.request",
  "audit.read",
  "firm.settings",
  "firm.members",
  "firm.billing",
  "firm.connector",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Le membre connecté porte-t-il cette permission ? */
export async function membrePeut(permission: Permission): Promise<boolean> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase.rpc("member_can", { permission_key: permission })
  return Boolean(data)
}

/**
 * Exige une permission, ou lève.
 *
 * Le message nomme la permission manquante plutôt que le rôle attendu : un
 * cabinet peut désormais confier `invoices.write` à une adjointe sans lui
 * donner le rôle d'un consultant, et « réservé au propriétaire » serait devenu
 * faux.
 */
export async function exigerPermission(permission: Permission) {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session absente. Reconnectez-vous.")

  if (!(await membrePeut(permission))) {
    throw new Error(
      `Il vous manque la permission « ${permission} ». Demandez-la au propriétaire du cabinet.`
    )
  }
  return membre
}

/** Toutes les permissions du membre connecté, pour n'afficher que ses écrans. */
export async function permissionsDuMembre(): Promise<Record<Permission, boolean>> {
  const supabase = await getSessionSupabase()
  const paires = await Promise.all(
    PERMISSIONS.map(async (p) => {
      const { data } = await supabase.rpc("member_can", { permission_key: p })
      return [p, Boolean(data)] as const
    })
  )
  return Object.fromEntries(paires) as Record<Permission, boolean>
}
