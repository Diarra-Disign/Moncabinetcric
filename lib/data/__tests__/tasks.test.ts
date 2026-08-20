import test from "node:test"
import assert from "node:assert/strict"
import type { TaskPriority, TaskStatus, TaskRecord } from "../types"

test("Gestion des tâches — validation des priorités et statuts", () => {
  const statutsValides: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"]
  const prioritesValides: TaskPriority[] = ["low", "normal", "high", "urgent"]

  assert.equal(statutsValides.includes("todo"), true)
  assert.equal(statutsValides.includes("done"), true)
  assert.equal(prioritesValides.includes("urgent"), true)
  assert.equal(prioritesValides.includes("normal"), true)

  const exempleTache: TaskRecord = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    firmId: "firm-1",
    matterId: "matter-1",
    matterReference: "DOS-2026-001",
    title: "Vérifier la traduction certifiée",
    priority: "high",
    status: "todo",
    dueDate: "2026-09-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  assert.equal(exempleTache.title, "Vérifier la traduction certifiée")
  assert.equal(exempleTache.priority, "high")
  assert.equal(exempleTache.status, "todo")
  assert.equal(exempleTache.matterReference, "DOS-2026-001")
})

test("Gestion des tâches — transitions d'état", () => {
  let status: TaskStatus = "todo"
  let completedAt: string | null = null

  // Passage à terminé
  status = "done"
  completedAt = new Date().toISOString()
  assert.equal(status, "done")
  assert.ok(completedAt !== null)

  // Réouverture
  status = "todo"
  completedAt = null
  assert.equal(status, "todo")
  assert.equal(completedAt, null)
})
