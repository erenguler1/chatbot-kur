import { useCallback, useEffect, useState } from 'react'

export interface PublicMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface UsePublicMessagesResult {
  messages: PublicMessage[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function usePublicMessages(
  botId: string,
  sessionId: string | null,
): UsePublicMessagesResult {
  const [messages, setMessages] = useState<PublicMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/public-get-messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ botId, sessionId }),
        },
      )

      if (!response.ok) {
        let message = 'Mesajlar yüklenemedi'
        try {
          const errBody = (await response.json()) as { error?: string }
          if (errBody?.error) message = errBody.error
        } catch {
          // ignore parse error
        }
        throw new Error(message)
      }

      const data = (await response.json()) as { messages: PublicMessage[] }
      setMessages(data.messages ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
      setError(message)
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [botId, sessionId])

  useEffect(() => {
    void fetchMessages()
  }, [fetchMessages])

  return { messages, isLoading, error, refetch: fetchMessages }
}
