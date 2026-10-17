// RAG retrieval: finds the bot's document chunks closest to the user's question.

import type { SupabaseClient } from 'npm:@supabase/supabase-js'
import { getEmbeddings } from './voyage.ts'

const MATCH_COUNT = 5
// Cosine similarity floor for voyage-3 query/document pairs; chunks below it
// are treated as unrelated to the question.
export const MIN_SIMILARITY = 0.45

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
}

const EMPTY: RetrievalResult = { chunks: [], hasDocuments: false }

// Never throws: retrieval problems degrade to "no documents" so chat keeps
// working on Q&A pairs alone.
export async function retrieveDocuments(
  supabase: SupabaseClient,
  botId: string,
  question: string,
): Promise<RetrievalResult> {
  try {
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
    }
  } catch (err) {
    console.error('Document retrieval failed:', err)
    return EMPTY
  }
}

// Unique source names of the chunks given to the model, in relevance order.
export function sourceNames(chunks: DocumentChunk[]): string[] {
  return [...new Set(chunks.map((c) => c.source_name ?? 'Adsız belge'))]
}
