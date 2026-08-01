import { getTranslations, setRequestLocale } from "next-intl/server"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <SettingsClient />
}
