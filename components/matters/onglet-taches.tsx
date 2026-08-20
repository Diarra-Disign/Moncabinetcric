"use client"

import React, { useState, useTransition, useMemo } from "react"
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  User,
  Filter,
  Check,
  Search,
} from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { TaskRecord, TaskPriority, TaskStatus, TaskMember } from "@/lib/data/types"
import { creerTache, basculerEtatTache, supprimerTache } from "@/lib/data/tasks-actions"

interface OngletTachesProps {
  matterId: string
  clientId?: string | null
  initialTasks?: TaskRecord[]
  members?: TaskMember[]
}

const PRIORITE_STYLES: Record<TaskPriority, { label: string; badgeClass: string }> = {
  urgent: { label: "Urgente", badgeClass: "bg-error/15 text-error border-error/30 font-bold" },
  high: { label: "Haute", badgeClass: "bg-warning/15 text-warning border-warning/30 font-semibold" },
  normal: { label: "Normale", badgeClass: "bg-muted text-muted-foreground border-border" },
  low: { label: "Basse", badgeClass: "bg-secondary/40 text-muted-foreground border-border/50 text-[11px]" },
}

export function OngletTaches({
  matterId,
  clientId,
  initialTasks = [],
  members = [],
}: OngletTachesProps) {
  const t = useTranslations("Tasks")
  const locale = useLocale()
  const [tasks, setTasks] = useState<TaskRecord[]>(initialTasks)
  const [isPending, startTransition] = useTransition()
  const [showAddForm, setShowAddForm] = useState(false)
  const [filtreStatut, setFiltreStatut] = useState<"all" | "todo" | "done">("todo")
  const [recherche, setRecherche] = useState("")

  // Form state
  const [titre, setTitre] = useState("")
  const [description, setDescription] = useState("")
  const [priorite, setPriorite] = useState<TaskPriority>("normal")
  const [echeance, setEcheance] = useState("")
  const [assigneA, setAssigneA] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const tachesFiltrees = useMemo(() => {
    return tasks.filter((tache) => {
      // Filtre statut
      if (filtreStatut === "todo" && tache.status === "done") return false
      if (filtreStatut === "done" && tache.status !== "done") return false

      // Filtre texte
      if (recherche.trim()) {
        const query = recherche.toLowerCase()
        const matchTitre = tache.title.toLowerCase().includes(query)
        const matchDesc = tache.description?.toLowerCase().includes(query) ?? false
        if (!matchTitre && !matchDesc) return false
      }

      return true
    })
  }, [tasks, filtreStatut, recherche])

  const handleToggle = (tache: TaskRecord) => {
    const nouveauStatut: TaskStatus = tache.status === "done" ? "todo" : "done"

    // Mise à jour optimiste
    setTasks((anciennes) =>
      anciennes.map((t) =>
        t.id === tache.id
          ? {
              ...t,
              status: nouveauStatut,
              completedAt: nouveauStatut === "done" ? new Date().toISOString() : null,
            }
          : t
      )
    )

    startTransition(async () => {
      const res = await basculerEtatTache(tache.id, nouveauStatut, locale)
      if (!res.ok) {
        // Rollback en cas d'échec
        setTasks(initialTasks)
      }
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titre.trim()) {
      setFormError(t("taskTitle"))
      return
    }

    setFormError(null)
    const formData = new FormData()
    formData.append("title", titre.trim())
    if (description.trim()) formData.append("description", description.trim())
    formData.append("matterId", matterId)
    if (clientId) formData.append("clientId", clientId)
    formData.append("priority", priorite)
    if (echeance) formData.append("dueDate", echeance)
    if (assigneA) formData.append("assignedTo", assigneA)
    formData.append("locale", locale)

    const membreChoisi = members.find((m) => m.id === assigneA)

    startTransition(async () => {
      const res = await creerTache(formData)
      if (res.ok) {
        // Ajout optimiste
        const nouvelleTache: TaskRecord = {
          id: res.id ?? crypto.randomUUID(),
          firmId: "",
          matterId,
          title: titre.trim(),
          description: description.trim() || null,
          priority: priorite,
          status: "todo",
          dueDate: echeance || null,
          assignedTo: assigneA || null,
          assignedToName: membreChoisi?.fullName || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setTasks((anciennes) => [nouvelleTache, ...anciennes])
        setTitre("")
        setDescription("")
        setPriorite("normal")
        setEcheance("")
        setAssigneA("")
        setShowAddForm(false)
      } else {
        setFormError(res.message)
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm(t("deleteConfirm"))) return

    setTasks((anciennes) => anciennes.filter((t) => t.id !== id))
    startTransition(async () => {
      await supprimerTache(id, locale)
    })
  }

  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Barre d'actions & Filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setFiltreStatut("todo")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filtreStatut === "todo"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterTodo")} (
              {tasks.filter((t) => t.status !== "done").length})
            </button>
            <button
              type="button"
              onClick={() => setFiltreStatut("done")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filtreStatut === "done"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterDone")} (
              {tasks.filter((t) => t.status === "done").length})
            </button>
            <button
              type="button"
              onClick={() => setFiltreStatut("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filtreStatut === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterAll")} ({tasks.length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Filtrer…"
              className="h-8.5 pl-8 pr-3 text-xs rounded-xl border border-border bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-32 sm:w-44"
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-xl h-9 text-xs font-bold gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {t("newTask")}
        </Button>
      </div>

      {/* Formulaire d'ajout rapide */}
      {showAddForm && (
        <Card className="rounded-2xl border-primary/30 bg-primary/5 shadow-sm animate-fadeIn">
          <CardContent className="p-4 sm:p-5">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold tracking-tight text-foreground uppercase">
                  {t("newTask")}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl border border-error/30 bg-error/10 text-error text-xs font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  required
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder={t("taskTitlePlaceholder")}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
                />
              </div>

              <div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder={t("descriptionPlaceholder")}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">{t("priority")} :</span>
                  <select
                    value={priorite}
                    onChange={(e) => setPriorite(e.target.value as TaskPriority)}
                    className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="low">{t("priorityLow")}</option>
                    <option value="normal">{t("priorityNormal")}</option>
                    <option value="high">{t("priorityHigh")}</option>
                    <option value="urgent">{t("priorityUrgent")}</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">{t("dueDate")} :</span>
                  <input
                    type="date"
                    value={echeance}
                    onChange={(e) => setEcheance(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
                  />
                </div>

                {members.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">{t("delegateTo")} :</span>
                    <select
                      value={assigneA}
                      onChange={(e) => setAssigneA(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="">{t("unassigned")}</option>
                      {members.map((m) => {
                        const roleLibelle =
                          m.role === "staff"
                            ? t("roleStaff")
                            : m.role === "rcic"
                            ? t("roleRcic")
                            : m.role === "owner"
                            ? t("roleOwner")
                            : m.role === "bookkeeper"
                            ? t("roleBookkeeper")
                            : m.role
                        return (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({roleLibelle})
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}

                <div className="ml-auto">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl h-8 text-xs font-bold px-4 cursor-pointer"
                  >
                    {isPending ? "Création…" : t("createTask")}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des tâches */}
      <div className="space-y-2.5">
        {tachesFiltrees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/50">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">{t("noTasksMatter")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ajoutez des rappels ou des consignes pour ce dossier.
            </p>
          </div>
        ) : (
          tachesFiltrees.map((tache) => {
            const isDone = tache.status === "done"
            const isOverdue = !isDone && tache.dueDate && tache.dueDate < aujourdhui
            const isToday = !isDone && tache.dueDate && tache.dueDate === aujourdhui

            return (
              <div
                key={tache.id}
                className={`group flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  isDone
                    ? "bg-card/40 border-border/60 opacity-60"
                    : "bg-card border-border hover:border-primary/40 shadow-xs"
                }`}
              >
                {/* Case à cocher */}
                <button
                  type="button"
                  onClick={() => handleToggle(tache)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  title={isDone ? t("markTodo") : t("markDone")}
                >
                  {isDone ? (
                    <div className="w-5 h-5 rounded-md bg-success/20 border border-success/40 text-success flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md border border-muted-foreground/50 hover:border-primary transition-colors bg-background" />
                  )}
                </button>

                {/* Contenu */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-xs sm:text-sm font-bold leading-snug break-words ${
                        isDone ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {tache.title}
                    </p>

                    {/* Priorité */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${
                        PRIORITE_STYLES[tache.priority].badgeClass
                      }`}
                    >
                      {PRIORITE_STYLES[tache.priority].label}
                    </span>
                  </div>

                  {tache.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {tache.description}
                    </p>
                  )}

                  {/* Métadonnées */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground font-medium">
                    {tache.dueDate && (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isOverdue
                            ? "text-error font-bold"
                            : isToday
                            ? "text-warning font-bold"
                            : ""
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {isOverdue && "⚠️ En retard : "}
                        {isToday && "Aujourd'hui : "}
                        {tache.dueDate}
                      </span>
                    )}

                    {tache.assignedToName && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/8 text-foreground text-[11px] font-medium border border-primary/20">
                        <User className="w-3 h-3 text-primary-strong" />
                        <span>{tache.assignedToName}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bouton supprimer */}
                <button
                  type="button"
                  onClick={() => handleDelete(tache.id)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-all cursor-pointer shrink-0"
                  title={t("deleteTask")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
