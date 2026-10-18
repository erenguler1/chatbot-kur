// Re-chunks stored documents whose chunker differs from the current one
// (CHUNKER_ID in supabase/functions/_shared/chunking.ts), from their original
// text in document_sources. Run after deploying embed-document with a new
// chunker:
//
//   deno run -A scripts/reprocess-documents.ts           # do it
//   deno run -A scripts/reprocess-documents.ts --dry     # list + chunk diff only
//
// Both modes first save the affected documents and their current chunks to
// scripts/.reprocess-backup-<chunker>-<time>.json (gitignored): the original
// text stays in document_sources, the backup records what changed.
//
// Uses the service_role key (fetched via the Supabase CLI, never printed).

import { CHUNKER_ID, chunkDocument } from '../supabase/functions/_shared/chunking.ts'

const REF = 'ddsaqzfjcisakwfambmv'
const URL_ = `https://${REF}.supabase.co`

const out = new Deno.Command('supabase', {
  args: ['projects', 'api-keys', '--project-ref', REF, '-o', 'json'],
  stderr: 'null',
}).outputSync()
const keys: { name: string; api_key: string }[] = JSON.parse(new TextDecoder().decode(out.stdout))
const SR = keys.find((k) => k.name === 'service_role')!.api_key
const headers = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }

const res = await fetch(
  `${URL_}/rest/v1/document_sources?select=id,bot_id,source_name,source_type,chunker,chunk_count,content&deleted_at=is.null&chunker=neq.${encodeURIComponent(CHUNKER_ID)}`,
  { headers },
)
if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`)
const stale: {
  id: string
  bot_id: string
  source_name: string | null
  source_type: string
  chunker: string
  chunk_count: number
  content: string
}[] = await res.json()

// Current chunks + what the new chunker would produce.
const backup = []
let changedDocs = 0
let changedChunks = 0
for (const doc of stale) {
  const r = await fetch(
    `${URL_}/rest/v1/documents?select=content&upload_id=eq.${doc.id}&deleted_at=is.null&order=chunk_index`,
    { headers },
  )
  if (!r.ok) throw new Error(`chunks failed: ${r.status} ${await r.text()}`)
  const oldChunks = ((await r.json()) as { content: string }[]).map((c) => c.content)
  const newChunks = chunkDocument(doc.content)
  const oldSet = new Set(oldChunks)
  const newSet = new Set(newChunks)
  const diff = newChunks.filter((c) => !oldSet.has(c)).length + oldChunks.filter((c) => !newSet.has(c)).length
  if (diff > 0) changedDocs++
  changedChunks += diff
  const { content: _content, ...meta } = doc
  backup.push({ ...meta, new_chunk_count: newChunks.length, changed_chunks: diff, old_chunks: oldChunks })
}
const backupPath = new URL(
  `./.reprocess-backup-${CHUNKER_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  import.meta.url,
).pathname
Deno.writeTextFileSync(backupPath, JSON.stringify(backup, null, 2))

console.log(`current chunker: ${CHUNKER_ID}; documents to reprocess: ${stale.length}`)
console.log(`documents whose chunks change: ${changedDocs}; chunks added+removed: ${changedChunks}`)
console.log(`backup: ${backupPath}`)
for (const b of backup) {
  console.log(`  ${b.id.slice(0, 8)} ${b.source_name ?? 'Adsız'} [${b.source_type}] ${b.chunker} ${b.chunk_count} -> ${b.new_chunk_count} parça, ${b.changed_chunks} değişen`)
}
if (Deno.args.includes('--dry')) Deno.exit(0)

let failed = 0
for (const doc of stale) {
  const label = `${doc.id.slice(0, 8)} ${doc.source_name ?? 'Adsız'} (${doc.chunker}, ${doc.chunk_count} parça)`
  // Retries 5xx (e.g. Voyage 429 on accounts without a payment method: 3 req/min).
  let r: Response
  let body: Record<string, unknown>
  for (let attempt = 1; ; attempt++) {
    r = await fetch(`${URL_}/functions/v1/embed-document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reprocess: doc.id }),
    })
    body = await r.json()
    if (r.ok || r.status < 500 || attempt >= 4) break
    console.log(`  retry ${label} in 30s (HTTP ${r.status})`)
    await new Promise((res) => setTimeout(res, 30_000))
  }
  if (r.ok) {
    console.log(`  ok   ${label} -> ${body.chunks_created} parça`)
  } else {
    failed++
    console.log(`  FAIL ${label}: ${r.status} ${JSON.stringify(body)}`)
  }
}
if (failed > 0) Deno.exit(1)
