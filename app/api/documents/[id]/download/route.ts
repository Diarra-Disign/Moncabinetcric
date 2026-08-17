import { NextResponse } from "next/server"
import { GET as getDocument } from "../route"

export async function GET(
  requete: Request,
  context: { params: Promise<{ id: string }> }
) {
  const url = new URL(requete.url)
  url.searchParams.set("telecharger", "1")
  const modifiedRequest = new Request(url.toString(), requete)
  return getDocument(modifiedRequest, context)
}
