import { getDeadlines, getDeadlineRules, getCiccComplianceScore } from "@/lib/data/queries"
import { DeadlinesClient } from "./deadlines-client"

export const revalidate = 0

export default async function DeadlinesPage() {
  const [deadlines, rules, score] = await Promise.all([
    getDeadlines(),
    getDeadlineRules(),
    getCiccComplianceScore()
  ])

  return (
    <DeadlinesClient 
      initialDeadlines={deadlines}
      initialRules={rules}
      initialComplianceScore={score}
    />
  )
}
