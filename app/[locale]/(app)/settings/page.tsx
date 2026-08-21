import { setRequestLocale } from "next-intl/server"
import { SettingsClient } from "./settings-client"
import { TeamPanel, type MembreVue, type InvitationVue } from "@/components/settings/team-panel"
import {
  PermissionsPanel,
  type PermissionVue,
  type MembrePermissions,
} from "@/components/settings/permissions-panel"
import { membrePeut } from "@/lib/auth/permissions"
import { SeatRequestPanel } from "@/components/settings/seat-request-panel"
import { getDemandesDuCabinet, getPlacesDuCabinet } from "@/lib/data/seat-reads"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"
import { DeuxFacteurs } from "@/components/securite/deux-facteurs"
import { etatCalendly } from "@/lib/data/calendly-actions"
import { PageReservation } from "@/components/settings/page-reservation"
import { listerPlages } from "@/lib/data/disponibilites-actions"
import { slugDepuis } from "@/lib/reservation/slug"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const membre = await getCurrentMember()
  const supabase = await getSessionSupabase()

  // La RLS restreint déjà ces deux lectures au cabinet du membre : aucun
  // filtre applicatif n'est nécessaire, et surtout aucun n'est oubliable.
  const [{ data: profils }, { data: invitations }, { data: perms }, { data: defauts }, { data: ajustements }, peutGererMembres] =
    await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, cicc_role, user_id, status")
      .order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, cicc_role, expires_at, accepted_at, revoked_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("permissions")
      .select("key, label_fr, description_fr, category, rank, owner_only")
      .order("rank", { ascending: true }),
    supabase.from("role_permissions").select("cicc_role, permission, granted"),
    supabase.from("profile_permissions").select("profile_id, permission, granted"),
    membrePeut("firm.members"),
  ])

  const [places, demandes, calendly] = await Promise.all([
    getPlacesDuCabinet(),
    getDemandesDuCabinet(),
    // Ne rend JAMAIS le jeton — seulement raccordé ou non, et les deux dates.
    etatCalendly(),
  ])

  const [plages, { data: reglagesRdv }] = await Promise.all([
    listerPlages(),
    supabase
      .from("firms")
      .select("name, booking_slug, booking_enabled, booking_slot_minutes, booking_lead_hours, booking_horizon_days")
      .eq("id", membre?.firmId ?? "")
      .maybeSingle(),
  ])

  // Défaut du rôle et ajustement individuel sont passés séparément : l'écran
  // doit pouvoir distinguer « suit le rôle » de « accordée », faute de quoi il
  // figerait le premier en écrivant le second.
  const defautsParRole: Record<string, Record<string, boolean>> = {}
  for (const d of defauts ?? []) {
    const r = d.cicc_role as string
    defautsParRole[r] ??= {}
    defautsParRole[r][d.permission as string] = Boolean(d.granted)
  }

  const ajustementsParProfil: Record<string, Record<string, boolean>> = {}
  for (const a of ajustements ?? []) {
    const pid = a.profile_id as string
    ajustementsParProfil[pid] ??= {}
    ajustementsParProfil[pid][a.permission as string] = Boolean(a.granted)
  }

  const permissions: PermissionVue[] = (perms ?? []).map((p) => ({
    key: p.key as string,
    labelFr: (p.label_fr as string) ?? "",
    descriptionFr: (p.description_fr as string) ?? "",
    category: (p.category as string) ?? "general",
    ownerOnly: Boolean(p.owner_only),
  }))

  const membres: MembreVue[] = (profils ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string) ?? "",
    fullName: (p.full_name as string) ?? "",
    ciccRole: (p.cicc_role as string) ?? "staff",
    estMoi: p.user_id === membre?.userId,
    statut: (p.status as string) ?? "active",
  }))

  const maintenant = new Date().toISOString()
  const enAttente: InvitationVue[] = (invitations ?? []).map((i) => ({
    id: i.id as string,
    email: (i.email as string) ?? "",
    ciccRole: (i.cicc_role as string) ?? "staff",
    expiresAt: String(i.expires_at ?? "").slice(0, 10),
    expiree: String(i.expires_at ?? "") < maintenant,
  }))

  return (
    <div className="space-y-8">
      <SettingsClient calendly={calendly} />
      {/* Le second facteur est un réglage PERSONNEL, pas un réglage du cabinet :
          chacun enrôle le sien, et personne ne peut l'activer pour autrui. Il
          se place donc avant les panneaux d'équipe, qui gouvernent les autres. */}
      <PageReservation
        plages={plages}
        slug={(reglagesRdv?.booking_slug as string) ?? ""}
        active={Boolean(reglagesRdv?.booking_enabled)}
        duree={Number(reglagesRdv?.booking_slot_minutes ?? 30)}
        preavis={Number(reglagesRdv?.booking_lead_hours ?? 24)}
        horizon={Number(reglagesRdv?.booking_horizon_days ?? 30)}
        slugPropose={slugDepuis(String(reglagesRdv?.name ?? ""))}
      />
      <DeuxFacteurs />
      <SeatRequestPanel
        occupees={places.occupees}
        limite={places.limite}
        peutDemander={peutGererMembres}
        demandes={demandes.map((d) => ({
          id: d.id,
          seats: d.seats,
          statut: d.statut,
          accordees: d.accordees,
          reponse: d.reponse,
          creeLe: d.creeLe,
        }))}
      />
      <TeamPanel
        membres={membres}
        invitations={enAttente}
        peutGerer={peutGererMembres}
      />
      <PermissionsPanel
        permissions={permissions}
        peutGerer={peutGererMembres}
        membres={(profils ?? []).map<MembrePermissions>((p) => ({
          profilId: p.id as string,
          nom: (p.full_name as string) || (p.email as string) || "—",
          role: (p.cicc_role as string) ?? "staff",
          statut: (p.status as string) ?? "active",
          estMoi: p.user_id === membre?.userId,
          defauts: defautsParRole[(p.cicc_role as string) ?? "staff"] ?? {},
          ajustements: ajustementsParProfil[p.id as string] ?? {},
        }))}
      />
    </div>
  )
}
