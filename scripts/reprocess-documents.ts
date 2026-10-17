// Re-chunks stored documents whose chunker differs from the current one
// (CHUNKER_ID in supabase/functions/_shared/chunking.ts), from their original
// text in document_sources. Run after deploying embed-document with a new
// chunker:
//
//   deno run -A scripts/reprocess-documents.ts           # do it
//   deno run -A scripts/reprocess-documents.ts --dry     # list only
//
// Uses the service_role key (fetched via the Supabase CLI, never printed).

import { CHUNKER_ID } from '../supabase/functions/_shared/chunking.ts'

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
  `${URL_}/rest/v1/document_sources?select=id,source_name,chunker,chunk_count&deleted_at=is.null&chunker=neq.${encodeURIComponent(CHUNKER_ID)}`,
  { headers },
)
if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`)
const stale: { id: string; source_name: string | null; chunker: string; chunk_count: number }[] = await res.json()

console.log(`current chunker: ${CHUNKER_ID}; documents to reprocess: ${stale.length}`)
let failed = 0
for (const doc of stale) {
  const label = `${doc.id.slice(0, 8)} ${doc.source_name ?? 'Adsız'} (${doc.chunker}, ${doc.chunk_count} parça)`
  if (Deno.args.includes('--dry')) {
    console.log(`  would reprocess ${label}`)
    continue
  }
  const r = await fetch(`${URL_}/functions/v1/embed-document`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reprocess: doc.id }),
  })
  const body = await r.json()
  if (r.ok) {
    console.log(`  ok   ${label} -> ${body.chunks_created} parça`)
  } else {
    failed++
    console.log(`  FAIL ${label}: ${r.status} ${JSON.stringify(body)}`)
  }
}
if (failed > 0) Deno.exit(1)
