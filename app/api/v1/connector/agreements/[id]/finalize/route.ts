import { NextResponse } from "next/server"
import { executeAiConnectorAction } from "@/lib/data/actions"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authHeader = request.headers.get("authorization") || ""
  const keyPrefix = authHeader.replace("Bearer ", "").substring(0, 16) || "cric_live_7a8b..."

  // Strictly rejected via Safety Gate -> 403 Forbidden
  const res = await executeAiConnectorAction("finalize", { agreementId: id }, keyPrefix)
  return NextResponse.json({ success: false, error: res.error }, { status: 403 })
}
