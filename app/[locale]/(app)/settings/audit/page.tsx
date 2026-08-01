import { getAuditLogs, getApprovalQueue } from "@/lib/data/queries"
import { AuditClient } from "./audit-client"

export const revalidate = 0

export default async function AuditPage() {
  const [logs, approvals] = await Promise.all([
    getAuditLogs(),
    getApprovalQueue()
  ])

  return (
    <AuditClient 
      initialLogs={logs}
      initialApprovals={approvals}
    />
  )
}
