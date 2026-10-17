import { useCallback, useEffect, useState } from 'react'
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { DocumentUpload } from '../types/document'

interface UseDocumentsResult {
  documents: DocumentUpload[]
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
  uploadDocument: (content: string, sourceName: string) => Promise<void>
  deleteDocument: (uploadId: string) => Promise<void>
}

// Turns an embed-document error response into the Turkish message it carries.
async function functionErrorMessage(err: unknown): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body: unknown = await err.context.json()
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // fall through to the generic message
    }
  }
  return 'Belge yüklenemedi. Lütfen tekrar deneyin.'
}

interface FetchResult {
  data: DocumentUpload[] | null
  error: PostgrestError | null
}

async function fetchUploads(botId: string): Promise<FetchResult> {
  const { data, error } = await supabase
    .from('document_uploads')
    .select('*')
    .eq('bot_id', botId)
    .order('created_at', { ascending: false })
  return { data: data as DocumentUpload[] | null, error }
}

export function useDocuments(botId: string): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentUpload[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  // Never toggles isLoading back on, so the list doesn't flash a skeleton
  // after every upload/delete.
  const applyResult = useCallback(({ data, error: queryError }: FetchResult) => {
    if (queryError) {
      setError(queryError)
    } else {
      setError(null)
      setDocuments(data ?? [])
    }
    setIsLoading(false)
  }, [])

  const refetch = useCallback(async () => {
    applyResult(await fetchUploads(botId))
  }, [botId, applyResult])

  useEffect(() => {
    let cancelled = false
    void fetchUploads(botId).then((result) => {
      if (!cancelled) applyResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [botId, applyResult])

  const uploadDocument = useCallback(
    async (content: string, sourceName: string) => {
      const { error: invokeError } = await supabase.functions.invoke('embed-document', {
        body: { bot_id: botId, content, source_name: sourceName },
      })
      if (invokeError) throw new Error(await functionErrorMessage(invokeError))
      await refetch()
    },
    [botId, refetch],
  )

  const deleteDocument = useCallback(
    async (uploadId: string) => {
      const { error: updateError } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('bot_id', botId)
        .eq('upload_id', uploadId)
      if (updateError) throw new Error('Belge silinemedi. Lütfen tekrar deneyin.')
      await refetch()
    },
    [botId, refetch],
  )

  return { documents, isLoading, error, refetch, uploadDocument, deleteDocument }
}
