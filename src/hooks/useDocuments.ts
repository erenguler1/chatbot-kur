import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { functionErrorMessage } from '../lib/functionError'
import type { DocumentSourceType, DocumentUpload } from '../types/document'

interface UseDocumentsResult {
  documents: DocumentUpload[]
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
  uploadDocument: (content: string, sourceName: string, sourceType: DocumentSourceType) => Promise<void>
  deleteDocument: (uploadId: string) => Promise<void>
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
    async (content: string, sourceName: string, sourceType: DocumentSourceType) => {
      const { error: invokeError } = await supabase.functions.invoke('embed-document', {
        body: { bot_id: botId, content, source_name: sourceName, source_type: sourceType },
      })
      if (invokeError) throw new Error(await functionErrorMessage(invokeError, 'Belge yüklenemedi. Lütfen tekrar deneyin.'))
      await refetch()
    },
    [botId, refetch],
  )

  const deleteDocument = useCallback(
    async (uploadId: string) => {
      // A trigger soft-deletes the upload's chunks too (migration 018).
      const { error: updateError } = await supabase
        .from('document_sources')
        .update({ deleted_at: new Date().toISOString() })
        .eq('bot_id', botId)
        .eq('id', uploadId)
      if (updateError) throw new Error('Belge silinemedi. Lütfen tekrar deneyin.')
      await refetch()
    },
    [botId, refetch],
  )

  return { documents, isLoading, error, refetch, uploadDocument, deleteDocument }
}
