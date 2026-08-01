import { NextResponse } from "next/server"

export async function GET() {
  const mcpManifest = {
    name: "moncabinetcric-mcp-server",
    version: "1.0.0",
    description: "Serveur MCP Officiel MonCabinetCRIC pour Claude Desktop",
    tools: [
      {
        name: "list_agreements",
        description: "Lister les ententes de service du cabinet"
      },
      {
        name: "create_agreement_draft",
        description: "Ouvrir un nouveau brouillon d'entente de service"
      },
      {
        name: "add_government_fee",
        description: "Ajouter des frais gouvernementaux depuis le catalogue tenu à jour (IRCC / MIFI)"
      },
      {
        name: "validate_agreement",
        description: "Lancer une validation de conformité CICC sur le brouillon"
      }
    ],
    humanOnlyReservedTools: [
      "finalize",
      "send",
      "sign",
      "cancel"
    ]
  }

  return NextResponse.json(mcpManifest)
}
