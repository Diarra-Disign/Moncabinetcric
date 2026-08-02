"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  BookOpen,
  Scale,
  Search,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Globe,
  BookmarkPlus,
  Sparkles,
  Layers,
  X,
} from "lucide-react"
import { LegislationProvision, ResearchWorkspace, Matter } from "@/lib/data/types"
import {
  createResearchWorkspace,
  addResearchSourceToWorkspace,
  deleteResearchSourceFromWorkspace,
  searchLegislationAction,
} from "@/lib/data/actions"
import { PageHeader } from "@/components/app-shell/page-header"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

interface ResearchClientProps {
  initialProvisions: LegislationProvision[]
  /** Nombre total de dispositions correspondant, avant troncature. */
  initialTotal: number
  initialWorkspaces: ResearchWorkspace[]
  initialMatters: Matter[]
}

type InstrumentFilter = "all" | "lipr" | "ripr"
type ViewMode = "fr" | "en" | "bilingual"
type Tab = "provisions" | "workspaces"

/** Classes communes aux champs de saisie, alignées sur components/ui/input.tsx. */
const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

export function ResearchClient({
  initialProvisions,
  initialTotal,
  initialWorkspaces,
  initialMatters,
}: ResearchClientProps) {
  const t = useTranslations("Research")

  const [provisions, setProvisions] = React.useState(initialProvisions)
  const [total, setTotal] = React.useState(initialTotal)
  const [isSearching, setIsSearching] = React.useState(false)

  const [workspaces, setWorkspaces] = React.useState<ResearchWorkspace[]>(initialWorkspaces)
  const [activeTab, setActiveTab] = React.useState<Tab>("provisions")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [instrumentFilter, setInstrumentFilter] = React.useState<InstrumentFilter>("all")
  const [viewMode, setViewMode] = React.useState<ViewMode>("bilingual")
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [copyError, setCopyError] = React.useState(false)

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [selectedMatterId, setSelectedMatterId] = React.useState("")
  const [newNotes, setNewNotes] = React.useState("")

  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [targetProvision, setTargetProvision] = React.useState<LegislationProvision | null>(null)
  const [targetWorkspaceId, setTargetWorkspaceId] = React.useState("")
  const [analysisNote, setAnalysisNote] = React.useState("")

  const [isPending, startTransition] = React.useTransition()

  // La recherche s'exécute sur le serveur : le corpus complet pèse environ
  // 1,4 Mo et ne doit pas être transmis au navigateur. On débat la frappe
  // pour ne pas déclencher un aller-retour à chaque caractère, et on ignore
  // les réponses arrivées dans le désordre.
  const requestRef = React.useRef(0)

  React.useEffect(() => {
    const requestId = ++requestRef.current
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await searchLegislationAction(searchQuery, instrumentFilter)
        if (requestRef.current === requestId) {
          setProvisions(res.items)
          setTotal(res.total)
        }
      } finally {
        if (requestRef.current === requestId) setIsSearching(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchQuery, instrumentFilter])

  const filteredProvisions = provisions
  const truncated = total > filteredProvisions.length

  // Le minuteur doit être annulé au démontage, sinon React signale une mise à
  // jour d'état sur un composant démonté quand on quitte la page après copie.
  React.useEffect(() => {
    if (!copiedId) return
    const timer = window.setTimeout(() => setCopiedId(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copiedId])

  const handleCopyCitation = async (provision: LegislationProvision) => {
    const citation = `${provision.instrument.toUpperCase()} ${t("articlePrefix")} ${provision.provisionNo} (${t("consolidatedDate")}: ${provision.consolidatedOn}) — ${provision.headingFr} / ${provision.headingEn}`
    try {
      // L'API presse-papiers échoue hors contexte sécurisé ou si l'utilisateur
      // refuse la permission : l'échec doit être visible, pas silencieux.
      await navigator.clipboard.writeText(citation)
      setCopyError(false)
      setCopiedId(provision.id)
    } catch {
      setCopyError(true)
    }
  }

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    startTransition(async () => {
      const created = await createResearchWorkspace(
        newTitle,
        selectedMatterId || undefined,
        newNotes || undefined
      )
      setWorkspaces((prev) => [created, ...prev])
      setIsCreateModalOpen(false)
      setNewTitle("")
      setSelectedMatterId("")
      setNewNotes("")
      setActiveTab("workspaces")
    })
  }

  const handleOpenAddModal = (provision: LegislationProvision) => {
    setTargetProvision(provision)
    setTargetWorkspaceId(workspaces[0]?.id ?? "")
    setAnalysisNote("")
    setIsAddModalOpen(true)
  }

  const handleAddToWorkspace = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetProvision || !targetWorkspaceId) return
    startTransition(async () => {
      const updated = await addResearchSourceToWorkspace(
        targetWorkspaceId,
        targetProvision.id,
        analysisNote || undefined
      )
      if (updated) {
        setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      }
      setIsAddModalOpen(false)
      setTargetProvision(null)
      setAnalysisNote("")
    })
  }

  const handleDeleteSource = (workspaceId: string, sourceId: string) => {
    startTransition(async () => {
      const updated = await deleteResearchSourceFromWorkspace(workspaceId, sourceId)
      if (updated) {
        setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      }
    })
  }

  const instrumentOptions: { value: InstrumentFilter; label: string }[] = [
    { value: "all", label: t("allInstruments") },
    { value: "lipr", label: t("liprOnly") },
    { value: "ripr", label: t("riprOnly") },
  ]

  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: "fr", label: t("viewFr") },
    { value: "en", label: t("viewEn") },
    { value: "bilingual", label: t("viewBilingual") },
  ]

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        badgeText={t("badge")}
        badgeVariant="sky"
        action={
          <Button type="button" onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("newWorkspace")}
          </Button>
        }
      />

      {/* Avertissement réglementaire — la base est une aide à la recherche,
          jamais la source officielle opposable. */}
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="flex flex-1 flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <strong className="block text-sm font-bold text-foreground">
              {t("disclaimerTitle")}
            </strong>
            <span className="text-xs text-muted-foreground sm:text-sm">{t("disclaimerBody")}</span>
          </div>
          <a
            href="https://laws-lois.justice.gc.ca/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("officialJusticeLink")}
          </a>
        </div>
      </div>

      {/* Barre d'outils : recherche, filtre d'instrument, langue d'affichage */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            // Étiquette courte : un lecteur d'écran annonce l'aria-label à
            // chaque focus, le placeholder complet y serait interminable.
            aria-label={t("searchLabel")}
            className={cn(FIELD, "h-11 pl-10 pr-10")}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label={t("clearSearch")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label={t("filterInstrumentLabel")}
          className="flex items-center gap-1.5 rounded-xl bg-muted p-1"
        >
          {instrumentOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setInstrumentFilter(opt.value)}
              aria-pressed={instrumentFilter === opt.value}
              className={cn(
                "min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                instrumentFilter === opt.value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label={t("viewModeLabel")}
          className="flex items-center gap-1.5 rounded-xl bg-muted p-1"
        >
          <Globe aria-hidden className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
          {viewOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewMode(opt.value)}
              aria-pressed={viewMode === opt.value}
              className={cn(
                "min-h-9 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                viewMode === opt.value
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {copyError && (
        <p role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs font-bold text-error">
          {t("copyFailed")}
        </p>
      )}

      {/* Onglets — sémantique ARIA complète, navigation clavier native */}
      <div role="tablist" aria-label={t("title")} className="flex items-center border-b border-border">
        {([
          { id: "provisions" as const, icon: BookOpen, label: t("tabProvisions"), count: total },
          { id: "workspaces" as const, icon: Layers, label: t("tabWorkspaces"), count: workspaces.length },
        ]).map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex min-h-11 items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {label}
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Onglet 1 — dispositions législatives et réglementaires */}
      {activeTab === "provisions" && (
        <div role="tabpanel" id="panel-provisions" aria-labelledby="tab-provisions" className="flex flex-col gap-4">
          <p className="sr-only" aria-live="polite">
            {isSearching ? t("searching") : t("resultsCount", { count: total })}
          </p>

          {/* La liste est tronquée : le dire explicitement, sinon l'utilisateur
              croit que le corpus s'arrête là — c'est exactement le malentendu
              qui a motivé ce chantier. */}
          {truncated && (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              {t("truncatedResults", { shown: filteredProvisions.length, total })}
            </p>
          )}

          {filteredProvisions.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title={t("emptyProvisions")}
              hint={t("emptyProvisionsHint")}
            />
          ) : (
            filteredProvisions.map((prov) => (
              <article
                key={prov.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-wide",
                        prov.instrument === "lipr"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-sky-200 bg-sky-50 text-sky-800"
                      )}
                    >
                      {prov.instrument.toUpperCase()}
                    </span>
                    <h3 className="text-base font-black text-foreground">
                      {t("articlePrefix")} {prov.provisionNo}
                    </h3>
                    {prov.frequentlyUsed && (
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gold">
                        {t("frequentlyUsed")}
                      </span>
                    )}
                    {prov.hierarchyPath && (
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        • {prov.hierarchyPath}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                      {t("consolidatedDate")}: {prov.consolidatedOn}
                    </span>
                    {/* Masqué faute de source vérifiée : un badge « décisions
                        citant » sans nombre est pire qu'absent. */}
                    {typeof prov.citingCaseCount === "number" && (
                      <span className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-bold text-success">
                        {prov.citingCaseCount} {t("casesCiting")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {viewMode === "bilingual" ? (
                    <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                      <span className="text-sm font-bold text-foreground">{prov.headingFr}</span>
                      <span className="text-xs font-medium italic text-muted-foreground">
                        {prov.headingEn}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-foreground">
                      {viewMode === "fr" ? prov.headingFr : prov.headingEn}
                    </span>
                  )}

                  {viewMode === "bilingual" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ProvisionBody lang="fr" label={t("frenchLabel")} text={prov.bodyFr} />
                      <ProvisionBody lang="en" label={t("englishLabel")} text={prov.bodyEn} />
                    </div>
                  ) : (
                    <p
                      lang={viewMode}
                      className="rounded-lg border border-border bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground"
                    >
                      {viewMode === "fr" ? prov.bodyFr : prov.bodyEn}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <ul className="flex flex-wrap items-center gap-1.5">
                    {prov.tags?.map((tag) => (
                      <li
                        key={tag}
                        className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        #{tag}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center gap-2">
                    <a
                      href={prov.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                      {t("officialSource")}
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyCitation(prov)}
                      aria-label={t("copyCitationAria", { no: prov.provisionNo })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {copiedId === prov.id ? (
                        <>
                          <Check aria-hidden className="h-3.5 w-3.5 text-success" />
                          <span className="text-success">{t("cited")}</span>
                        </>
                      ) : (
                        <>
                          <Copy aria-hidden className="h-3.5 w-3.5" />
                          {t("copyCitation")}
                        </>
                      )}
                    </button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenAddModal(prov)}
                      className="gap-1.5 text-xs"
                    >
                      <BookmarkPlus aria-hidden className="h-3.5 w-3.5" />
                      {t("addToWorkspace")}
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* Onglet 2 — espaces de recherche et citations retenues */}
      {activeTab === "workspaces" && (
        <div role="tabpanel" id="panel-workspaces" aria-labelledby="tab-workspaces" className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{t("workspaceSubtitle")}</p>
            <Button type="button" size="sm" onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus aria-hidden className="h-4 w-4" />
              {t("newWorkspace")}
            </Button>
          </div>

          {workspaces.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title={t("emptyWorkspaces")}
              hint={t("emptyWorkspacesHint")}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {workspaces.map((ws) => (
                <section
                  key={ws.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-xs"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2.5">
                        <Scale aria-hidden className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-black text-foreground">{ws.title}</h3>
                        {ws.matterReference && (
                          <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 font-mono text-xs font-bold text-foreground">
                            {ws.matterReference}
                          </span>
                        )}
                      </div>
                      {ws.clientName && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("clientLabel")} :{" "}
                          <strong className="font-bold text-foreground">{ws.clientName}</strong>
                          {ws.program && <> • {t("programLabel")} : {ws.program}</>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {t("updatedLabel")} : {ws.updatedAt}
                      </span>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {ws.sources.length} {t("sourcesCount")}
                      </span>
                    </div>
                  </div>

                  {ws.notes && (
                    <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
                      <strong className="mb-0.5 block font-bold">{t("ciccNoteTitle")} :</strong>
                      {ws.notes}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {ws.sources.length === 0 ? (
                      <p className="py-6 text-center text-sm italic text-muted-foreground">
                        {t("emptySources")}
                      </p>
                    ) : (
                      ws.sources.map((src) => (
                        <div
                          key={src.id}
                          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-black uppercase",
                                  src.instrument === "lipr"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-sky-50 text-sky-800"
                                )}
                              >
                                {src.instrument.toUpperCase()}
                              </span>
                              <span className="text-sm font-black text-foreground">
                                {t("articlePrefix")} {src.provisionNo}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                [{src.citationSnapshot}]
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteSource(ws.id, src.id)}
                              disabled={isPending}
                              aria-label={t("deleteCitationAria", { no: src.provisionNo })}
                              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:opacity-50"
                            >
                              <Trash2 aria-hidden className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t("deleteCitation")}</span>
                            </button>
                          </div>

                          <blockquote className="rounded border border-border bg-card p-2.5 font-serif text-xs leading-relaxed text-foreground">
                            {src.textSnapshotFr}
                          </blockquote>

                          {src.note && (
                            <div className="flex items-start gap-1.5 rounded bg-primary/10 p-2 text-xs text-foreground">
                              <Sparkles aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <p>
                                <strong className="font-bold">{t("consultantAnalysis")} : </strong>
                                {src.note}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modale — création d'un espace de recherche */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("createModalTitle")}
        description={t("createModalSubtitle")}
        closeLabel={t("closeModal")}
      >
        <form onSubmit={handleCreateWorkspace} className="flex flex-col gap-4">
          <div>
            <label htmlFor="ws-title" className="mb-1.5 block text-xs font-bold text-foreground">
              {t("workspaceTitleLabel")}
            </label>
            <input
              id="ws-title"
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("workspaceTitlePlaceholder")}
              className={cn(FIELD, "h-11")}
            />
          </div>

          <div>
            <label htmlFor="ws-matter" className="mb-1.5 block text-xs font-bold text-foreground">
              {t("linkMatterLabel")}
            </label>
            <select
              id="ws-matter"
              value={selectedMatterId}
              onChange={(e) => setSelectedMatterId(e.target.value)}
              className={cn(FIELD, "h-11")}
            >
              <option value="">{t("selectMatter")}</option>
              {initialMatters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} — {m.clientName} ({m.program})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ws-notes" className="mb-1.5 block text-xs font-bold text-foreground">
              {t("notesLabel")}
            </label>
            <textarea
              id="ws-notes"
              rows={3}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              className={FIELD}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !newTitle.trim()}>
              {t("create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modale — rattachement d'une disposition à un espace */}
      <Modal
        open={isAddModalOpen && targetProvision !== null}
        onClose={() => setIsAddModalOpen(false)}
        title={t("addToWorkspaceTitle")}
        description={
          targetProvision && (
            <span className="font-mono text-primary">
              {targetProvision.instrument.toUpperCase()} {t("articlePrefix")}{" "}
              {targetProvision.provisionNo} — {targetProvision.headingFr}
            </span>
          )
        }
        closeLabel={t("closeModal")}
      >
        <form onSubmit={handleAddToWorkspace} className="flex flex-col gap-4">
          <div>
            <label htmlFor="target-ws" className="mb-1.5 block text-xs font-bold text-foreground">
              {t("selectWorkspaceLabel")}
            </label>
            <select
              id="target-ws"
              required
              value={targetWorkspaceId}
              onChange={(e) => setTargetWorkspaceId(e.target.value)}
              className={cn(FIELD, "h-11")}
            >
              <option value="" disabled>
                {t("selectWorkspace")}
              </option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.title} ({ws.sources.length} {t("citationsCount")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="analysis-note" className="mb-1.5 block text-xs font-bold text-foreground">
              {t("citationNoteLabel")}
            </label>
            <textarea
              id="analysis-note"
              rows={3}
              value={analysisNote}
              onChange={(e) => setAnalysisNote(e.target.value)}
              placeholder={t("citationNotePlaceholder")}
              className={FIELD}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddModalOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !targetWorkspaceId}>
              {t("addCitationBtn")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function ProvisionBody({ lang, label, text }: { lang: "fr" | "en"; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3.5">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <p lang={lang} className="text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
