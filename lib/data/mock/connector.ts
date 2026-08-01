import { AiConnectorSettings, AiApiKeyRecord, AiConnectorLogRecord } from "../types"

export const INITIAL_AI_CONNECTOR_SETTINGS: AiConnectorSettings = {
  enabled: false,
  enabledBy: "Me Adama Diarra (Owner)",
  enabledAt: undefined,
  allowedMemberIds: ["m-owner-01", "m-rcic-02"],
  allowedActions: [
    "list_agreements",
    "create_agreement_draft",
    "add_agreement_party",
    "add_agreement_service",
    "add_government_fee",
    "validate_agreement",
    "request_ai_review"
  ],
  reservedHumanActions: [
    "finalize",
    "send",
    "sign",
    "cancel"
  ],
  guideUrl: "rcicapp.ca/connector"
}

export const INITIAL_AI_API_KEYS: AiApiKeyRecord[] = [
  {
    id: "key-01",
    name: "ChatGPT Custom GPT — Me Adama Diarra",
    keyPrefix: "cric_live_7a8b9c0d",
    secretHash: "sha256-hash-secret-01",
    createdForMemberId: "m-owner-01",
    createdForMemberName: "Me Adama Diarra (RCIC #R-514982)",
    createdAt: "2026-07-29",
    lastUsedAt: "2026-08-01 14:15",
    isActive: true
  },
  {
    id: "key-02",
    name: "Claude Desktop MCP Server — Sophie Tremblay",
    keyPrefix: "cric_live_1e2f3a4b",
    secretHash: "sha256-hash-secret-02",
    createdForMemberId: "m-rcic-02",
    createdForMemberName: "Sophie Tremblay (Staff Adjointe)",
    createdAt: "2026-07-30",
    lastUsedAt: "2026-07-31 09:40",
    isActive: true
  }
]

export const INITIAL_AI_CONNECTOR_LOGS: AiConnectorLogRecord[] = [
  {
    id: "log-ai-01",
    occurredAt: "2026-08-01T14:15:22Z",
    apiKeyPrefix: "cric_live_7a8b...",
    clientIp: "198.51.100.42",
    action: "create_agreement_draft",
    resourceId: "SA-2026-000142",
    status: "success",
    summary: "Brouillon d'entente de service ouvert pour Les Industries Nordiques Inc. (PEQ-TRAVAILLEUR)",
    rowHash: "8a7f9b0c...sha256"
  },
  {
    id: "log-ai-02",
    occurredAt: "2026-08-01T14:16:05Z",
    apiKeyPrefix: "cric_live_7a8b...",
    clientIp: "198.51.100.42",
    action: "add_government_fee",
    resourceId: "SA-2026-000142",
    status: "success",
    summary: "Ajout du débours gouvernemental IRCC Frais de Traitement RP ($950.00 CAD) depuis le catalogue",
    rowHash: "3e4f5a6b...sha256"
  },
  {
    id: "log-ai-03",
    occurredAt: "2026-08-01T14:17:10Z",
    apiKeyPrefix: "cric_live_7a8b...",
    clientIp: "198.51.100.42",
    action: "sign",
    resourceId: "SA-2026-000142",
    status: "forbidden_reserved",
    summary: "BLOQUÉ (403 Forbidden) : Tentative de signature automatique par l'IA. Acte réservé exclusivement au consultant humain.",
    rowHash: "7b8c9d0e...sha256"
  }
]
