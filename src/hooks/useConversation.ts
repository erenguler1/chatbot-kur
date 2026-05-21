import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { Conversation } from '../types/conversation'

interface UseConversationResult {
  conversation: Conversation | null
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
  createNew: () => Promise<void>
}

export function useConversation(botId: string | undefined): UseConversationResult {
  const { user } = useAuth()
  const userId = user?.id

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!botId) {
      setConversation(null)
      setError(null)
      setIsLoading(false)
      return
    }
    if (!userId) {
      setConversation(null)
      setError(null)
      setIsLoading(true)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data: existing, error: queryError } = await supabase
      .from('conversations')
      .select('*')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (queryError) {
      setError(queryError)
      setConversation(null)
      setIsLoading(false)
      return
    }

    if (existing) {
      setConversation(existing as Conversation)
      setIsLoading(false)
      return
    }

    const { data: created, error: insertError } = await supabase
      .from('conversations')
      .insert({ bot_id: botId, user_id: userId, title: 'Yeni sohbet' })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError)
      setConversation(null)
    } else {
      setConversation((created ?? null) as Conversation | null)
    }
    setIsLoading(false)
  }, [botId, userId])

  const createNew = useCallback(async () => {
    if (!botId || !userId) return

    setIsLoading(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('conversations')
      .insert({ bot_id: botId, user_id: userId, title: 'Yeni sohbet' })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError)
    } else {
      setConversation((data ?? null) as Conversation | null)
    }
    setIsLoading(false)
  }, [botId, userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { conversation, isLoading, error, refetch, createNew }
}
