// Groups similar unanswered questions for the panel ("Pazar açık mısınız?" ~
// "pazar gunu acik mi"). Plain word overlap, no embeddings: Turkish letters
// are folded, question particles dropped, and words match on a shared stem so
// "açık" ~ "açıksınız". Day names must match exactly (pazar ≠ pazartesi).

export interface UnansweredQuestion {
  id: string
  question: string
  created_at: string
}

export interface QuestionGroup {
  label: string // the most frequent wording
  ids: string[]
  count: number
  lastAskedAt: string
}

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }

const STOPWORDS = new Set([
  'mi', 'mu', 'misin', 'misiniz', 'musun', 'musunuz', 'midir', 'mudur', 'miyim', 'muyum', 'ne', 'neden', 'nasil',
  'acaba', 've', 'veya', 'ile', 'icin', 'de', 'da', 'bir', 'bu', 'su', 'o', 'var', 'yok', 'mu?', 'merhaba', 'selam',
  'lutfen', 'tesekkurler', 'sizin', 'sizde', 'siz', 'ben', 'bana', 'benim', 'ki', 'ya', 'hangi', 'kac', 'kadar',
  'iyi', 'gunler', 'abi', 'abla', 'hocam', 'olur', 'oluyor', 'mumkun',
])

const DAYS = new Set(['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'])
const MIN_SIMILARITY = 0.6

export function tokens(text: string): string[] {
  const folded = text
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]|i̇/g, (c) => FOLD[c] ?? c)
    .replace(/\[[^\]]*\]/g, ' ') // masked personal data
    .replace(/[^a-z0-9\s]/g, ' ')
  return folded.split(/\s+/).filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (DAYS.has(a) || DAYS.has(b)) return false
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length >= 4 && long.startsWith(short) && long.length - short.length <= 6) return true
  return short.length >= 5 && long.slice(0, 5) === short.slice(0, 5)
}

// Dice overlap of two word lists, with stem matching.
export function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const used = new Set<number>()
  let matches = 0
  for (const w of a) {
    const j = b.findIndex((v, k) => !used.has(k) && sameWord(w, v))
    if (j !== -1) {
      used.add(j)
      matches++
    }
  }
  return (2 * matches) / (a.length + b.length)
}

export function groupQuestions(rows: UnansweredQuestion[]): QuestionGroup[] {
  const sorted = [...rows].sort((x, y) => y.created_at.localeCompare(x.created_at))
  const groups: { key: string[]; exact: string; rows: UnansweredQuestion[] }[] = []
  for (const row of sorted) {
    const t = tokens(row.question)
    const exact = row.question.toLocaleLowerCase('tr').trim()
    let best: (typeof groups)[number] | null = null
    let bestScore = MIN_SIMILARITY
    for (const g of groups) {
      const score = t.length === 0 ? (g.exact === exact ? 1 : 0) : similarity(t, g.key)
      if (score >= bestScore) {
        best = g
        bestScore = score
      }
    }
    if (best) best.rows.push(row)
    else groups.push({ key: t, exact, rows: [row] })
  }

  return groups
    .map((g) => {
      const counts = new Map<string, number>()
      for (const r of g.rows) counts.set(r.question, (counts.get(r.question) ?? 0) + 1)
      const label = [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0]
      return { label, ids: g.rows.map((r) => r.id), count: g.rows.length, lastAskedAt: g.rows[0].created_at }
    })
    .sort((x, y) => y.count - x.count || y.lastAskedAt.localeCompare(x.lastAskedAt))
}
