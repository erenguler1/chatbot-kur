import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Bot } from '../types/bot'

interface UseBotResult {
  bot: Bot | null
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
}

export function useBot(botId: string | undefined): UseBotResult {
  const [bot, setBot] = useState<Bot | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!botId) {
      setBot(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .maybeSingle()

    if (queryError) {
      setError(queryError)
      setBot(null)
    } else {
      setBot((data ?? null) as Bot | null)
    }
    setIsLoading(false)
  }, [botId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { bot, isLoading, error, refetch }
}
