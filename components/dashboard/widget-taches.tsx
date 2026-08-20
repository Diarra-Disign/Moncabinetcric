"use client"

import React, { useState, useTransition } from "react"
import {
  CheckCircle2,
  Plus,
  Calendar,
  Check,
  ArrowUpRight,
  ListTodo,
  AlertTriangle,
  User,
} from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import type { TaskRecord, TaskPriority, TaskStatus, TaskMember } from "@/lib/data/types"
import { creerTache, basculerEtatTache } from "@/lib/data/tasks-actions"

interface WidgetTachesProps {
  initialTasks: TaskRecord[]
  members?: TaskMember[]
  currentMemberId?: string
}

const PRIORITE_STYLES: Record<TaskPriority, string> = {
  urgent: "bg-error/15 text-error border-error/30",
  high: "bg-warning/15 text-warning border-warning/30",
  normal: "bg-muted text-muted-foreground border-border",
  low: "bg-secondary/40 text-muted-foreground border-border/50",
}

export function WidgetTaches({
  initialTasks = [],
  members = [],
  currentMemberId,
}: WidgetTachesProps) {
  const t = useTranslations("Tasks")
  const locale = useLocale()
  const [tasks, setTasks] = useState<TaskRecord[]>(initialTasks)
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [quickTitle, setQuickTitle] = useState("")
  const [quickPriority, setQuickPriority] = useState<TaskPriority>("normal")
  const [quickAssignee, setQuickAssignee] = useState<string>("")
  const [filtre, setFiltre] = useState<"todo" | "done">("todo")
  const [filtreMembre, setFiltreMembre] = useState<"all" | "mine">("all")
  const aujourdhui = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

  const tachesFiltrees = tasks.filter((task) => {
    if (filtre === "todo" && task.status === "done") return false
    if (filtre === "done" && task.status !== "done") return false
    if (filtreMembre === "mine" && currentMemberId && task.assignedTo !== currentMemberId) {
      return false
    }
    return true
  })

  const handleToggle = (task: TaskRecord) => {
    const nouveauStatut: TaskStatus = task.status === "done" ? "todo" : "done"

    setTasks((anciennes) =>
      anciennes.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nouveauStatut,
              completedAt: nouveauStatut === "done" ? new Date().toISOString() : null,
            }
          : t
      )
    )

    startTransition(async () => {
      await basculerEtatTache(task.id, nouveauStatut, locale)
    })
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTitle.trim()) return

    const formData = new FormData()
    formData.append("title", quickTitle.trim())
    formData.append("priority", quickPriority)
    if (quickAssignee) formData.append("assignedTo", quickAssignee)
    formData.append("locale", locale)

    const membreChoisi = members.find((m) => m.id === quickAssignee)

    startTransition(async () => {
      const res = await creerTache(formData)
      if (res.ok) {
        const nouvelle: TaskRecord = {
          id: res.id ?? crypto.randomUUID(),
          firmId: "",
          title: quickTitle.trim(),
          priority: quickPriority,
          status: "todo",
          assignedTo: quickAssignee || null,
          assignedToName: membreChoisi?.fullName || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setTasks((anciennes) => [nouvelle, ...anciennes])
        setQuickTitle("")
        setQuickAssignee("")
        setShowAdd(false)
      }
    })
  }

  return (
    <div className="bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 space-y-4 flex flex-col justify-between h-full animate-fadeIn">
      {/* En-tête du widget */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/12 text-primary-strong flex items-center justify-center font-bold">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base text-foreground">{t("title")}</h3>
            <p className="text-xs text-muted-foreground font-medium">{t("subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {currentMemberId && (
            <button
              type="button"
              onClick={() => setFiltreMembre(filtreMembre === "all" ? "mine" : "all")}
              className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                filtreMembre === "mine"
                  ? "bg-primary/10 text-primary-strong border-primary/30"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
              title={filtreMembre === "mine" ? t("filterCabinet") : t("filterMine")}
            >
              {filtreMembre === "mine" ? t("filterMine") : t("filterCabinet")}
            </button>
          )}

          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFiltre("todo")}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                filtre === "todo"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterTodo")} ({tasks.filter((t) => t.status !== "done").length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("done")}
              className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                filtre === "done"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("filterDone")}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={t("newTask")}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ajout rapide */}
      {showAdd && (
        <form onSubmit={handleQuickAdd} className="space-y-2 animate-fadeIn pt-1">
          <div className="flex gap-2">
            <input
              type="text"
              required
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={t("taskTitlePlaceholder")}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium"
            />
            <button
              type="submit"
              disabled={isPending}
              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
            >
              {isPending ? "…" : "Ajouter"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="low">{t("priorityLow")}</option>
              <option value="normal">{t("priorityNormal")}</option>
              <option value="high">{t("priorityHigh")}</option>
              <option value="urgent">{t("priorityUrgent")}</option>
            </select>

            {members.length > 0 && (
              <select
                value={quickAssignee}
                onChange={(e) => setQuickAssignee(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            )}

            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste compacte */}
      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 flex-1 flex flex-col justify-center">
        {tachesFiltrees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center flex-1 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-2 opacity-40 text-success" />
            <p className="text-xs font-bold text-muted-foreground">{t("noTasks")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {filtreMembre === "mine"
                ? "Aucune tâche ne vous est assignée."
                : "Créez une tâche pour organiser vos priorités."}
            </p>
          </div>
        ) : (
          tachesFiltrees.map((task) => {
            const isDone = task.status === "done"
            const isOverdue = !isDone && task.dueDate && task.dueDate < aujourdhui

            return (
              <div
                key={task.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                  isDone
                    ? "bg-muted/40 border-border/50 opacity-60"
                    : "bg-background border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(task)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    title={isDone ? t("markTodo") : t("markDone")}
                  >
                    {isDone ? (
                      <div className="w-4 h-4 rounded bg-success/20 border border-success/40 text-success flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded border border-muted-foreground/50 hover:border-primary bg-card" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium truncate ${
                        isDone ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.assignedToName && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                        <User className="w-2.5 h-2.5 text-primary-strong" />
                        <span>{task.assignedToName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.matterId && task.matterReference && (
                    <Link
                      href={`/matters/${task.matterId}`}
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                    >
                      <span>{task.matterReference}</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </Link>
                  )}

                  {task.dueDate && (
                    <span
                      className={`text-[10px] font-semibold flex items-center gap-1 ${
                        isOverdue ? "text-error" : "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="w-2.5 h-2.5" />
                      {task.dueDate.slice(5)}
                    </span>
                  )}

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                      PRIORITE_STYLES[task.priority]
                    }`}
                  >
                    {task.priority === "urgent"
                      ? "Urg"
                      : task.priority === "high"
                      ? "Haut"
                      : task.priority === "low"
                      ? "Bas"
                      : "Norm"}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
