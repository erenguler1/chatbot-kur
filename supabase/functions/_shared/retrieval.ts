// RAG retrieval: finds the bot's document chunks closest to the user's question.

import type { SupabaseClient } from 'npm:@supabase/supabase-js'
import { getEmbeddings } from './voyage.ts'

const MATCH_COUNT = 5
// Cosine similarity floor for voyage-3 query/document pairs; chunks below it
// are treated as unrelated. Calibrated on Turkish cafe data: on-topic questions
// scored 0.37-0.47, off-topic ones 0.18-0.30.
export const MIN_SIMILARITY = 0.3

export interface DocumentChunk {
  id: string
  content: string
  source_name: string | null
  chunk_index: number
  similarity: number
}

export interface RetrievalResult {
  // Relevant chunks (above MIN_SIMILARITY), best first.
  chunks: DocumentChunk[]
  // Whether the bot has any documents at all, relevant or not.
  hasDocuments: boolean
  // Diagnostics: wall time and similarities of all top matches (pre-threshold).
  ms: number
  scores: number[]
  error?: string
}

// Never throws: retrieval problems degrade to "no documents" so chat keeps
// working on Q&A pairs alone.
export async function retrieveDocuments(
  supabase: SupabaseClient,
  botId: string,
  question: string,
): Promise<RetrievalResult> {
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  try {
    // Most bots have no documents: skip the embedding call (latency + quota).
    const { data: anyDoc, error: existsError } = await supabase
      .from('documents')
      .select('id')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .limit(1)
    if (existsError) throw existsError
    if (!anyDoc || anyDoc.length === 0) {
      return { chunks: [], hasDocuments: false, ms: elapsed(), scores: [] }
    }

    const [queryEmbedding] = await getEmbeddings([question], 'query')
    const { data, error } = await supabase.rpc('match_documents', {
      p_bot_id: botId,
      p_query_embedding: queryEmbedding,
      p_match_count: MATCH_COUNT,
    })
    if (error) throw error

    const rows = (data ?? []) as DocumentChunk[]
    return {
      chunks: rows.filter((r) => r.similarity >= MIN_SIMILARITY),
      hasDocuments: rows.length > 0,
      ms: elapsed(),
      scores: rows.map((r) => Math.round(r.similarity * 1000) / 1000),
    }
  } catch (err) {
    console.error('Document retrieval failed:', err)
    const error = err instanceof Error ? err.message : String(err)
    return { chunks: [], hasDocuments: false, ms: elapsed(), scores: [], error }
  }
}

// Server-Timing header value, e.g. `retrieval;dur=312;desc="0.61 0.42"`.
export function serverTiming(r: RetrievalResult): string {
  const desc = r.error ? `error ${r.error.slice(0, 80)}` : r.scores.join(' ')
  return `retrieval;dur=${r.ms};desc="${desc.replace(/["\\\r\n]/g, ' ')}"`
}

// Unique source names of the chunks given to the model, in relevance order.
export function sourceNames(chunks: DocumentChunk[]): string[] {
  return [...new Set(chunks.map((c) => c.source_name ?? 'Adsız belge'))]
}
