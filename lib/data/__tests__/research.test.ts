import { test, describe } from "node:test"
import assert from "node:assert"
import {
  getLegislationProvisions,
  getLegislationProvisionById,
  getResearchWorkspaces,
  getResearchWorkspaceById,
  createResearchWorkspace,
  addResearchSourceToWorkspace,
  deleteResearchSourceFromWorkspace
} from "../index"

describe("Legal Research (LIPR / RIPR) Unit Tests", () => {
  test("should fetch all legislation provisions", async () => {
    const provisions = await getLegislationProvisions()
    assert.ok(provisions.length > 0, "Should return mock legislation provisions")
  })

  test("should filter provisions by instrument", async () => {
    const lipr = await getLegislationProvisions("lipr")
    assert.ok(lipr.every(p => p.instrument === "lipr"), "All provisions should be LIPR")

    const ripr = await getLegislationProvisions("ripr")
    assert.ok(ripr.every(p => p.instrument === "ripr"), "All provisions should be RIPR")
  })

  test("should search provisions by keyword or article number", async () => {
    const searchRes = await getLegislationProvisions("all", "38")
    assert.ok(searchRes.length > 0, "Should find article 38")
    assert.ok(searchRes.some(p => p.provisionNo.includes("38")), "Should include provisionNo 38")
  })

  test("should create a new research workspace", async () => {
    const ws = await createResearchWorkspace("Analyse Test CICC", "#DOS-12345", "Note test")
    assert.strictEqual(ws.title, "Analyse Test CICC")
    assert.strictEqual(ws.matterReference, "#DOS-12345")
    assert.strictEqual(ws.sources.length, 0)

    const allWs = await getResearchWorkspaces()
    assert.ok(allWs.some(w => w.id === ws.id), "New workspace should be in list")
  })

  test("should add and remove a citation from a research workspace", async () => {
    const allProv = await getLegislationProvisions()
    const prov = allProv[0]
    const ws = await createResearchWorkspace("Workspace de Citations")

    const updated = await addResearchSourceToWorkspace(ws.id, prov.id, "Point d'analyse critique")
    assert.ok(updated, "Workspace should be returned after adding source")
    assert.strictEqual(updated?.sources.length, 1)
    assert.strictEqual(updated?.sources[0].citationSnapshot.includes(prov.provisionNo), true)
    assert.strictEqual(updated?.sources[0].note, "Point d'analyse critique")

    const afterDelete = await deleteResearchSourceFromWorkspace(ws.id, updated!.sources[0].id)
    assert.strictEqual(afterDelete?.sources.length, 0)
  })
})
