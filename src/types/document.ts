export type DocumentSourceType = 'text' | 'pdf' | 'url'

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
  source_url: string | null
  import_id: string | null
}

// Must match MAX_CONTENT_CHARS in the embed-document Edge Function.
export const MAX_DOCUMENT_CHARS = 200_000

// One "Web sitesinden ekle" run (site_imports); its pages are DocumentUploads
// with this import_id.
export interface SiteImport {
  id: string
  bot_id: string
  root_url: string
  status: 'running' | 'done' | 'failed'
  page_urls: string[]
  pages_ok: number
  pages_empty: number
  pages_failed: number
  error: string | null
  created_at: string
  updated_at: string
}
