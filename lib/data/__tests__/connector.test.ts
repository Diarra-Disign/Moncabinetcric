import { describe, it } from "node:test"
import assert from "node:assert"
import { toggleAiConnector, executeAiConnectorAction } from "../actions"
import { getAiConnectorSettings } from "../queries"

describe("AI Connector Governance & CICC Safety Gate Tests", () => {
  it("should be disabled by default", async () => {
    const settings = await getAiConnectorSettings()
    assert.strictEqual(settings.enabled, false)
  })

  it("should reject requests when connector is disabled", async () => {
    await toggleAiConnector(false)
    const res = await executeAiConnectorAction("list_agreements", {})
    assert.strictEqual(res.success, false)
    assert.strictEqual(res.error?.code, "CONNECTOR_DISABLED")
  })

  it("should allow preparation actions when connector is enabled", async () => {
    await toggleAiConnector(true)
    const res = await executeAiConnectorAction("create_agreement_draft", { clientName: "Test Client" })
    assert.strictEqual(res.success, true)
    assert.ok(res.data)
  })

  it("should STRICTLY BLOCK reserved human actions (finalize, send, sign, cancel) with HTTP 403 Forbidden", async () => {
    await toggleAiConnector(true)

    const reservedActions = ["finalize", "send", "sign", "cancel"]
    for (const action of reservedActions) {
      const res = await executeAiConnectorAction(action, { agreementId: "SA-2026-000142" })
      assert.strictEqual(res.success, false, `Action ${action} should be blocked!`)
      assert.strictEqual(res.error?.code, "RESERVED_HUMAN_ACTION")
      assert.ok(res.error?.message.includes("acte réservé exclusivement à un consultant humain"))
    }
  })
})
