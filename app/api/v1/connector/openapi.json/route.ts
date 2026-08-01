import { NextResponse } from "next/server"

export async function GET() {
  const openApiSpec = {
    openapi: "3.0.1",
    info: {
      title: "MonCabinetCRIC — Connecteur IA Officiel CICC",
      description: "API de préparation pour assistant IA (ChatGPT Custom GPT / Claude MCP). Les actes de décision (finaliser, envoyer, signer, annuler) sont strictement réservés aux consultants humains dans le tableau de bord MonCabinetCRIC.",
      version: "1.0.0"
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1/connector",
        description: "Serveur MonCabinetCRIC Local / Staging"
      }
    ],
    paths: {
      "/agreements": {
        get: {
          operationId: "listAgreements",
          summary: "Lister les ententes de service du cabinet",
          responses: {
            "200": { description: "Liste des ententes retournée avec succès" }
          }
        },
        post: {
          operationId: "createAgreementDraft",
          summary: "Ouvrir un nouveau brouillon d'entente de service",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    clientName: { type: "string" },
                    program: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "201": { description: "Brouillon créé" }
          }
        }
      },
      "/agreements/{id}/finalize": {
        post: {
          operationId: "finalizeAgreement",
          summary: "BLOQUÉ — Finaliser l'entente (Acte humain réservé)",
          responses: {
            "403": { description: "Refusé par le garde-fou CICC. Seul un humain peut finaliser dans le dashboard." }
          }
        }
      },
      "/agreements/{id}/sign": {
        post: {
          operationId: "signAgreement",
          summary: "BLOQUÉ — Signer l'entente (Acte humain réservé)",
          responses: {
            "403": { description: "Refusé par le garde-fou CICC. Seul un humain peut signer dans le dashboard." }
          }
        }
      }
    }
  }

  return NextResponse.json(openApiSpec)
}
