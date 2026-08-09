import { setRequestLocale } from "next-intl/server"
import { ouvrirParJeton } from "@/lib/data/questionnaire-public"
import { FormulairePublic } from "./formulaire-public"

/**
 * La page qu'ouvre un destinataire depuis son lien.
 *
 * Hors de tout groupe protégé et hors du portail client : un prospect n'a pas
 * de compte, et le brief demande explicitement qu'il n'accède pas au portail.
 * Le jeton de l'URL est la seule clé.
 */
export default async function QuestionnaireParLienPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  setRequestLocale(locale)

  const { questionnaire, erreur } = await ouvrirParJeton(token)

  if (!questionnaire) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-black text-foreground">Ce lien n&apos;est pas utilisable</h1>
          <p className="text-sm text-muted-foreground">{erreur ?? "Ce lien n'est pas valide."}</p>
          <p className="text-xs text-muted-foreground">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, répondez au courriel reçu de votre
            consultant : il pourra vous en envoyer un nouveau.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        <header className="space-y-1">
          <p className="text-[11px] uppercase font-black tracking-wider text-muted-foreground">
            {questionnaire.firmName}
          </p>
          <h1 className="text-2xl font-black text-foreground">{questionnaire.title}</h1>
          {questionnaire.description && (
            <p className="text-sm text-muted-foreground">{questionnaire.description}</p>
          )}
        </header>

        <FormulairePublic jeton={token} questionnaire={questionnaire} locale={locale} />

        <footer className="text-[11px] text-muted-foreground border-t border-border pt-4">
          Ce lien vous est personnel. Ne le transmettez à personne : il donne accès à vos réponses.
        </footer>
      </div>
    </main>
  )
}
