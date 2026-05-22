import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface PublicBot {
  id: string
  name: string
  welcome_message: string
  brand_color: string
  status: 'active' | 'paused' | 'draft'
}

interface UsePublicBotResult {
  bot: PublicBot | null
  isLoading: boolean
  error: string | null
}

export function usePublicBot(botId: string | undefined): UsePublicBotResult {
  const [bot, setBot] = useState<PublicBot | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBot = useCallback(async () => {
    if (!botId) {
      setBot(null)
      setError('Bot bulunamadı')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('bots')
      .select('id, name, welcome_message, brand_color, status')
      .eq('id', botId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()

    if (queryError) {
      setBot(null)
      setError('Bot yüklenemedi')
    } else if (!data) {
      setBot(null)
      setError('Bot bulunamadı')
    } else {
      setBot(data as PublicBot)
    }

    setIsLoading(false)
  }, [botId])

  useEffect(() => {
    void fetchBot()
  }, [fetchBot])

  return { bot, isLoading, error }
}
