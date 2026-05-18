import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { QAPair } from '../types/qa'

interface UseQAPairsResult {
  qaPairs: QAPair[]
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
}

export function useQAPairs(botId: string | undefined): UseQAPairsResult {
  const [qaPairs, setQaPairs] = useState<QAPair[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!botId) {
      setQaPairs([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('qa_pairs')
      .select('*')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError)
      setQaPairs([])
    } else {
      setQaPairs((data ?? []) as QAPair[])
    }
    setIsLoading(false)
  }, [botId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { qaPairs, isLoading, error, refetch }
}
