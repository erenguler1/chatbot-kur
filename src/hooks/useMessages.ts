import { useCallback, useEffect, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Message } from '../types/conversation'

interface UseMessagesResult {
  messages: Message[]
  isLoading: boolean
  error: PostgrestError | null
  refetch: () => Promise<void>
}

export function useMessages(conversationId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<PostgrestError | null>(null)

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (queryError) {
      setError(queryError)
      setMessages([])
    } else {
      setMessages((data ?? []) as Message[])
    }
    setIsLoading(false)
  }, [conversationId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { messages, isLoading, error, refetch }
}
