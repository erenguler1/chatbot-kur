// Groups unanswered questions for the panel. The database assigns group_id by
// meaning when a question is saved (embedding, migration 021); here we only
// count, label and order the groups.

export interface UnansweredQuestion {
  id: string
  question: string
  group_id: string
  created_at: string
}

export interface QuestionGroup {
  label: string // the most frequent wording
  ids: string[]
  count: number
  lastAskedAt: string
}

export function groupQuestions(rows: UnansweredQuestion[]): QuestionGroup[] {
  const byGroup = new Map<string, UnansweredQuestion[]>()
  for (const row of [...rows].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    const list = byGroup.get(row.group_id)
    if (list) list.push(row)
    else byGroup.set(row.group_id, [row])
  }

  return [...byGroup.values()]
    .map((list) => {
      const counts = new Map<string, number>()
      for (const r of list) counts.set(r.question, (counts.get(r.question) ?? 0) + 1)
      // Most frequent wording; ties go to the most recent (list is newest first).
      const label = [...counts.entries()].reduce((best, e) => (e[1] > best[1] ? e : best))[0]
      return { label, ids: list.map((r) => r.id), count: list.length, lastAskedAt: list[0].created_at }
    })
    .sort((x, y) => y.count - x.count || y.lastAskedAt.localeCompare(x.lastAskedAt))
}
