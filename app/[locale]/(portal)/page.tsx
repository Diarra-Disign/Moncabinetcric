import { getTranslations, setRequestLocale } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Info } from "lucide-react"
import { getCurrentPortalClient, getSessionSupabase } from "@/lib/supabase/session"
import { VirtualMeetingCard } from "./virtual-meeting-card"
import { ActionsFichier } from "@/components/documents/file-actions"

/**
 * Portail client.
 *
 * Le contrôle d'accès est dans le layout : cette page n'est atteinte que
 * par un compte client authentifié. Tout ce qu'elle affiche provient de la
 * base, filtré par les politiques du portail — un client ne voit que sa
 * propre fiche, ses propres dossiers et ses propres pièces.
 *
 * Elle affichait auparavant un avancement figé à 50 %, un questionnaire
 * pré-rempli et un téléverseur qui ne déposait rien.
 */
export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Portal")
  const client = await getCurrentPortalClient()
  if (!client) return null // le layout a déjà redirigé

  const supabase = await getSessionSupabase()

  // Les politiques du portail restreignent déjà ces lectures au client
  // connecté : aucun filtre applicatif n'est nécessaire, et surtout aucun
  // n'est oubliable.
  const [{ data: dossiers }, { data: pieces }] = await Promise.all([
    supabase
      .from("matters")
      .select("id, reference, program, status, opened_date, deadline")
      .order("opened_date", { ascending: false }),
    supabase.from("documents").select("id, name, category, date, status, storage_path, sha256"),
  ])

  const nbPieces = pieces?.length ?? 0

  // Les libellés traversent la frontière serveur/client : un composant
  // client ne peut pas appeler getTranslations lui-même.
  const tDoc = await getTranslations("Documents")
  const etiquettes = {
    upload: tDoc("uploadLabel"),
    uploadRunning: tDoc("uploadRunning"),
    uploadDone: tDoc("uploadDone"),
    uploadHint: tDoc("uploadHint"),
    download: tDoc("downloadLabel"),
    verify: tDoc("verifyLabel"),
    verifyRunning: tDoc("verifyRunning"),
    noFile: tDoc("noFile"),
    fingerprint: tDoc("fingerprintLabel"),
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("welcome", { name: client.name })}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {t("fileLabel")} <strong className="font-mono text-foreground">{client.fileNumber}</strong>
          </span>
          <span>
            {t("programLabel")}{" "}
            <strong className="text-foreground">{client.program || t("noProgram")}</strong>
          </span>
        </p>
      </header>

      <VirtualMeetingCard />

      {/* Avancement : affiché seulement si un dossier existe. Une barre
          figée à 50 % laissait croire à une progression réelle. */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <h2 className="mb-3 text-xl font-semibold text-primary">{t("stepTitle")}</h2>
          {(dossiers?.length ?? 0) === 0 ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {t("progressUnknown")}
            </p>
          ) : (
            <ul className="space-y-3">
              {dossiers!.map((d) => (
                <li
                  key={d.id as string}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="font-mono text-sm font-bold text-foreground">
                    {d.reference as string}
                  </span>
                  <span className="text-sm text-muted-foreground">{d.program as string}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {d.status as string}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-base font-black tracking-tight text-foreground">
          {t("docsHeading")}
        </h2>

        {nbPieces === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            {t("docsEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pieces!.map((p) => (
              <li key={p.id as string} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {p.name as string}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.date as string}
                  </span>
                </div>
                {/* Le client télécharge sa pièce, la signe à la main, puis
                    dépose la version signée. Il ne peut pas la supprimer :
                    la base le refuse, quel que soit ce composant. */}
                <div className="mt-2 pl-7">
                  <ActionsFichier
                    documentId={p.id as string}
                    clientId={client.clientId}
                    storagePath={(p.storage_path as string) ?? null}
                    sha256={(p.sha256 as string) ?? null}
                    peutVerifier={false}
                    labels={etiquettes}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

      </section>
    </div>
  )
}
