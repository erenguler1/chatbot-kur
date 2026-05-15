import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Bot } from '../types/bot'

interface UseBotsResult {
  bots: Bot[]
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
}

export function useBots(): UseBotsResult {
  const { user } = useAuth()
  const [bots, setBots] = useState<Bot[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setBots([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (queryError) {
      setError(queryError)
      setBots([])
    } else {
      setBots((data ?? []) as Bot[])
    }
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { bots, isLoading, error, refetch }
}
