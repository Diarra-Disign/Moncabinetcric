import { setRequestLocale } from "next-intl/server"
import { listerModeles, listerEnvois, listerDestinataires } from "@/lib/data/questionnaires"
import { QuestionnairesClient } from "./questionnaires-client"

/**
 * La bibliothèque de questionnaires.
 *
 * Point unique d'où l'on crée, consulte et envoie — de sorte que la question
 * « où dois-je aller pour envoyer un questionnaire ? » n'ait plus lieu d'être
 * posée. Les mêmes gestes existent aussi depuis un dossier et depuis une
 * fiche prospect, où le destinataire est alors déjà connu.
 */
export default async function QuestionnairesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [modeles, envois, destinataires] = await Promise.all([
    listerModeles(),
    listerEnvois(),
    listerDestinataires(),
  ])

  return (
    <QuestionnairesClient
      locale={locale}
      modeles={modeles}
      envois={envois}
      destinataires={destinataires}
    />
  )
}
