// Compares chunking strategies and picks the similarity threshold.
//
//   scripts/test-users.sh create
//   supabase functions deploy rag-eval
//   deno run -A scripts/rag-eval/eval.ts            # --dry: only print chunk stats
//   supabase functions delete rag-eval && scripts/test-users.sh cleanup
//
// Retrieval mirrors production: per document ("bot"), top 5 chunks by cosine;
// a query is answered if a chunk containing `expect` is in the top 5 AND
// scores >= threshold. Negatives: off-topic questions, plus other businesses'
// non-generic questions (a barber question asked to a cafe bot); a negative
// is a false positive if any chunk scores >= threshold.

import { type Chunk, fixedChunks, sectionChunks } from '../../supabase/functions/_shared/chunking.ts'
import { DOCS, OFF_TOPIC, QUERIES } from './dataset.ts'

const STRATEGIES: Record<string, (t: string) => Chunk[]> = {
  'fixed-400/50 (v0.1)': (t) => fixedChunks(t, 400, 50),
  'fixed-150/30': (t) => fixedChunks(t, 150, 30),
  'fixed-60/15': (t) => fixedChunks(t, 60, 15),
  'fixed-30/10': (t) => fixedChunks(t, 30, 10),
  'section-150': (t) => sectionChunks(t, 150),
  'section-80': (t) => sectionChunks(t, 80),
  'section-40': (t) => sectionChunks(t, 40),
  'section-30': (t) => sectionChunks(t, 30),
  'section-25': (t) => sectionChunks(t, 25),
}
// ONLY=section-30,section-25 runs a subset (saves Voyage calls).
const only = Deno.env.get('ONLY')?.split(',')
const TOP_K = 5
const DOMAIN: Record<string, string> = { 'kafe-kisa': 'kafe', 'kafe-menu': 'kafe', kuafor: 'kuafor', iade: 'iade' }

const root = new URL('../../', import.meta.url).pathname
const env = Object.fromEntries(
  Deno.readTextFileSync(`${root}scripts/.test-users.env`).trim().split('\n')
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const URL_ = 'https://ddsaqzfjcisakwfambmv.supabase.co/functions/v1/rag-eval'

// Voyage accounts without a payment method get 3 requests / 10K tokens per
// minute: space calls out and wait out 429s.
const PACE_MS = Number(Deno.env.get('PACE_MS') ?? 21_000)
let lastCall = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function embed(texts: string[], input_type: 'document' | 'query'): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    for (let attempt = 1; ; attempt++) {
      await sleep(Math.max(0, lastCall + PACE_MS - Date.now()))
      lastCall = Date.now()
      const res = await fetch(URL_, {
        method: 'POST',
        headers: { apikey: env.ANON, Authorization: `Bearer ${env.TOK_A}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: texts.slice(i, i + 100), input_type }),
      })
      const body = await res.json()
      if (res.ok) {
        out.push(...body.embeddings)
        break
      }
      if (attempt >= 6 || !JSON.stringify(body).includes('429')) {
        throw new Error(`rag-eval ${res.status}: ${JSON.stringify(body).slice(0, 300)}`)
      }
      console.error(`  429, retrying (${attempt})`)
      await sleep(30_000)
    }
  }
  return out
}

const cos = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return d / Math.sqrt(na * nb)
}
const r3 = (x: number) => Math.round(x * 1000) / 1000
const lc = (s: string) => s.toLocaleLowerCase('tr')

for (const q of QUERIES) {
  const doc = DOCS.find((d) => d.id === q.doc)!
  if (!lc(doc.text).includes(lc(q.expect))) throw new Error(`expect not in doc: ${q.doc} / ${q.expect}`)
}

const dry = Deno.args.includes('--dry')
const queryTexts = [...QUERIES.map((q) => q.q), ...OFF_TOPIC]
const queryVecs = dry ? [] : await embed(queryTexts, 'query')
const qv = new Map(queryTexts.map((t, i) => [t, queryVecs[i]]))

const rows: string[] = []
for (const [name, chunker] of Object.entries(STRATEGIES).filter(([n]) => !only || only.includes(n))) {
  const chunks = DOCS.map((d) => ({ doc: d.id, chunks: chunker(d.text) }))
  const counts = chunks.map((c) => `${c.doc}:${c.chunks.length}`).join(' ')
  if (dry) { console.log(name, counts); continue }

  const flat = chunks.flatMap((c) => c.chunks.map((ch) => ({ doc: c.doc, text: ch.content })))
  const vecs = await embed(flat.map((f) => f.text), 'document')
  const byDoc = (doc: string) => flat.map((f, i) => ({ ...f, v: vecs[i] })).filter((f) => f.doc === doc)
  const rank = (q: string, doc: string) =>
    byDoc(doc).map((c) => ({ text: c.text, s: cos(qv.get(q)!, c.v) })).sort((a, b) => b.s - a.s).slice(0, TOP_K)

  // Positive: best score of a chunk that holds the answer (within top 5), else -1.
  const pos = QUERIES.map((q) => {
    const top = rank(q.q, q.doc)
    const hit = top.find((c) => lc(c.text).includes(lc(q.expect)))
    return { q, s: hit ? hit.s : -1, top1: lc(top[0].text).includes(lc(q.expect)) }
  })
  // Negative: top score for questions the document can't answer.
  const neg = [
    ...OFF_TOPIC.flatMap((q) => DOCS.map((d) => ({ q, doc: d.id, s: rank(q, d.id)[0].s }))),
    ...QUERIES.filter((q) => !q.generic).flatMap((q) =>
      DOCS.filter((d) => DOMAIN[d.id] !== DOMAIN[q.doc]).map((d) => ({ q: q.q, doc: d.id, s: rank(q.q, d.id)[0].s })),
    ),
  ]

  const maxNeg = Math.max(...neg.map((n) => n.s))
  const recallAt = (t: number) => pos.filter((p) => p.s >= t).length / pos.length
  const fpAt = (t: number) => neg.filter((n) => n.s >= t).length / neg.length
  // Lowest threshold with zero false positives, rounded up to 0.01.
  const t0 = Math.ceil((maxNeg + 0.0001) * 100) / 100
  const misses = pos.filter((p) => p.s < t0).map((p) => `${p.q.doc}:"${p.q.q}"(${r3(p.s)})`)
  const posScores = pos.filter((p) => p.s > 0).map((p) => p.s).sort((a, b) => a - b)

  rows.push(
    `\n## ${name}  [chunks ${counts}]\n` +
    `  top1 hit ${pos.filter((p) => p.top1).length}/${pos.length} | answer in top5 ${pos.filter((p) => p.s > 0).length}/${pos.length}\n` +
    `  positive scores min ${r3(posScores[0])} p10 ${r3(posScores[Math.floor(posScores.length * 0.1)])} median ${r3(posScores[Math.floor(posScores.length / 2)])}\n` +
    `  negatives max ${r3(maxNeg)} (${neg.sort((a, b) => b.s - a.s).slice(0, 3).map((n) => `${n.doc}:"${n.q}" ${r3(n.s)}`).join(', ')})\n` +
    `  zero-FP threshold ${t0}: recall ${r3(recallAt(t0))}  | at 0.35: recall ${r3(recallAt(0.35))} fp ${r3(fpAt(0.35))}` +
    ` | at 0.40: recall ${r3(recallAt(0.4))} fp ${r3(fpAt(0.4))} | at 0.45: recall ${r3(recallAt(0.45))} fp ${r3(fpAt(0.45))}\n` +
    `  misses at ${t0}: ${misses.join(', ') || '-'}\n` +
    `  sweep (threshold: recall/fp): ${[0.25, 0.3, 0.35, 0.4, 0.45, 0.5].map((t) => `${t}: ${r3(recallAt(t))}/${r3(fpAt(t))}`).join('  ')}\n` +
    `  negatives n=${neg.length}, positives n=${pos.length}`,
  )
}
console.log(rows.join('\n'))
