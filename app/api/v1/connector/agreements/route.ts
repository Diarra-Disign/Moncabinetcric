import { NextResponse } from "next/server"
import { getAgreements } from "@/lib/data/queries"
import { executeAiConnectorAction } from "@/lib/data/actions"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || ""
  const keyPrefix = authHeader.replace("Bearer ", "").substring(0, 16) || "cric_live_7a8b..."

  const res = await executeAiConnectorAction("list_agreements", {}, keyPrefix)
  if (!res.success) {
    return NextResponse.json({ success: false, error: res.error }, { status: 403 })
  }

  const agreements = await getAgreements()
  return NextResponse.json({
    success: true,
    data: agreements.map(a => ({
      id: a.id,
      reference: a.reference,
      clientName: a.clientName,
      program: a.program,
      status: a.status,
      totalFeesCad: a.totalProfessionalFeesCents / 100,
      totalGovernmentFeesCad: a.totalGovernmentFeesCents / 100,
      grandTotalCad: a.grandTotalCents / 100
    }))
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const authHeader = request.headers.get("authorization") || ""
    const keyPrefix = authHeader.replace("Bearer ", "").substring(0, 16) || "cric_live_7a8b..."

    const res = await executeAiConnectorAction("create_agreement_draft", body, keyPrefix)
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      data: {
        agreementId: `SA-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        status: "draft",
        message: "Brouillon d'entente de service ouvert avec succès.",
        createdPayload: body
      }
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: "INVALID_JSON", message: "Payload JSON invalide." } }, { status: 400 })
  }
}
