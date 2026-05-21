import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface StreamTokens {
  input_tokens: number
  output_tokens: number
}

interface StartStreamParams {
  botId: string
  conversationId: string
  userMessage: string
}

interface StreamingState {
  isStreaming: boolean
  streamingText: string
  error: string | null
  tokens: StreamTokens | null
  startStream: (params: StartStreamParams) => Promise<void>
  reset: () => void
}

export function useStreamingChat(): StreamingState {
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [streamingText, setStreamingText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<StreamTokens | null>(null)

  const reset = useCallback(() => {
    setStreamingText('')
    setError(null)
    setTokens(null)
  }, [])

  const startStream = useCallback(
    async ({ botId, conversationId, userMessage }: StartStreamParams) => {
      setIsStreaming(true)
      setStreamingText('')
      setError(null)
      setTokens(null)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        if (!accessToken) {
          throw new Error('Yetkilendirme gerekli')
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ botId, conversationId, userMessage }),
        })

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => ({}))) as {
            error?: unknown
          }
          const message =
            typeof errorBody.error === 'string'
              ? errorBody.error
              : 'Bot cevap veremedi'
          throw new Error(message)
        }

        if (!response.body) {
          throw new Error('Stream alınamadı')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''

          for (const event of events) {
            const line = event.trim()
            if (!line.startsWith('data:')) continue

            const jsonStr = line.slice(5).trim()
            if (!jsonStr) continue

            let payload: unknown
            try {
              payload = JSON.parse(jsonStr)
            } catch {
              continue
            }

            if (typeof payload !== 'object' || payload === null) continue
            const data = payload as Record<string, unknown>

            if (data.type === 'chunk' && typeof data.text === 'string') {
              const chunkText = data.text
              setStreamingText((prev) => prev + chunkText)
            } else if (data.type === 'done') {
              const inputTokens =
                typeof data.input_tokens === 'number' ? data.input_tokens : 0
              const outputTokens =
                typeof data.output_tokens === 'number' ? data.output_tokens : 0
              setTokens({
                input_tokens: inputTokens,
                output_tokens: outputTokens,
              })
            } else if (
              data.type === 'error' &&
              typeof data.message === 'string'
            ) {
              throw new Error(data.message)
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Beklenmedik bir hata oluştu')
      } finally {
        setIsStreaming(false)
      }
    },
    [],
  )

  return { isStreaming, streamingText, error, tokens, startStream, reset }
}
