import { setRequestLocale } from "next-intl/server"
import { SettingsClient } from "./settings-client"
import { TeamPanel, type MembreVue, type InvitationVue } from "@/components/settings/team-panel"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"

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
  const [{ data: profils }, { data: invitations }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, cicc_role, user_id").order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, cicc_role, expires_at, accepted_at, revoked_at")
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ])

  const membres: MembreVue[] = (profils ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string) ?? "",
    fullName: (p.full_name as string) ?? "",
    ciccRole: (p.cicc_role as string) ?? "staff",
    estMoi: p.user_id === membre?.userId,
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
      <SettingsClient />
      <TeamPanel
        membres={membres}
        invitations={enAttente}
        peutGerer={membre?.ciccRole === "owner"}
      />
    </div>
  )
}
