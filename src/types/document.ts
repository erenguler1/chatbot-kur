export type DocumentSourceType = 'text' | 'pdf'

// One uploaded document as listed in the Belgeler tab (document_uploads view).
// The documents table itself stores one row per chunk.
export interface DocumentUpload {
  upload_id: string
  bot_id: string
  source_name: string | null
  source_type: DocumentSourceType
  chunk_count: number
  char_count: number
  preview: string
  created_at: string
}

// Must match MAX_CONTENT_CHARS in the embed-document Edge Function.
export const MAX_DOCUMENT_CHARS = 200_000
