// Chunk-row writes shared by embed-document and import-site (service_role
// client). A document can have ~1000 small chunks, so both go in batches.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const INSERT_BATCH = 200 // keeps each PostgREST insert (1024-dim vectors) small
const DELETE_BATCH = 100 // ids go in the query string; batches keep the URL short

// Inserts chunk rows; if a later batch fails, the earlier ones are removed
// again so a document never ends up half-indexed.
export async function insertChunks(client: SupabaseClient, rows: Record<string, unknown>[]): Promise<void> {
  const inserted: string[] = []
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { data, error } = await client.from('documents').insert(rows.slice(i, i + INSERT_BATCH)).select('id')
    if (error) {
      await deleteChunks(client, inserted).catch(() => {})
      throw error
    }
    inserted.push(...(data ?? []).map((r: { id: string }) => r.id))
  }
}

export async function deleteChunks(client: SupabaseClient, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const { error } = await client.from('documents').delete().in('id', ids.slice(i, i + DELETE_BATCH))
    if (error) throw error
  }
}

// Swaps a stored document's chunks: new ones first, then the old ones go, so
// a failure leaves the old chunks searchable instead of none.
export async function replaceChunks(
  client: SupabaseClient,
  uploadId: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const { data: oldRows, error } = await client.from('documents').select('id').eq('upload_id', uploadId)
  if (error) throw error
  await insertChunks(client, rows)
  await deleteChunks(client, (oldRows ?? []).map((r: { id: string }) => r.id))
}
