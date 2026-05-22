import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useParams } from 'react-router-dom'
import { MessageCircle, Send } from 'lucide-react'
import { usePublicBot } from '../hooks/usePublicBot'
import { usePublicMessages } from '../hooks/usePublicMessages'
import { usePublicStreamingChat } from '../hooks/usePublicStreamingChat'

const DEFAULT_BRAND_COLOR = '#7C3AED'
const SESSION_KEY_PREFIX = 'chatbotkur-session-'

interface BubbleMessage {
  id: string
  role: 'user' | 'assistant' | string
  content: string
}

function Bubble({
  message,
  brandColor,
}: {
  message: BubbleMessage
  brandColor: string
}) {
  const isUser = message.role === 'user'

  if (message.content === '●') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
            padding: '8px 12px',
            borderRadius: '12px',
            borderBottomLeftRadius: '4px',
            fontSize: '14px',
          }}
        >
          <span style={{ display: 'inline-flex', gap: '4px' }}>
            <span style={{ animation: 'chatbotkur-pulse 1.5s ease-in-out infinite' }}>
              ●
            </span>
            <span
              style={{
                animation: 'chatbotkur-pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s',
              }}
            >
              ●
            </span>
            <span
              style={{
                animation: 'chatbotkur-pulse 1.5s ease-in-out infinite',
                animationDelay: '0.4s',
              }}
            >
              ●
            </span>
          </span>
        </div>
      </div>
    )
  }

  const bubbleStyle: CSSProperties = {
    backgroundColor: isUser ? brandColor : '#f3f4f6',
    color: isUser ? 'white' : '#1f2937',
    padding: '8px 12px',
    borderRadius: '12px',
    maxWidth: '75%',
    wordBreak: 'break-word',
    fontSize: '14px',
    whiteSpace: 'pre-wrap',
    ...(isUser
      ? { borderBottomRightRadius: '4px' }
      : { borderBottomLeftRadius: '4px' }),
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '8px',
      }}
    >
      <div style={bubbleStyle}>{message.content}</div>
    </div>
  )
}

export function Widget() {
  const { botId } = useParams<{ botId: string }>()

  const sessionId = useMemo<string>(() => {
    if (!botId) return ''
    const key = SESSION_KEY_PREFIX + botId
    try {
      const existing = localStorage.getItem(key)
      if (existing) return existing
      const fresh = crypto.randomUUID()
      localStorage.setItem(key, fresh)
      return fresh
    } catch {
      return crypto.randomUUID()
    }
  }, [botId])

  const { bot, isLoading: botLoading, error: botError } = usePublicBot(botId)
  const {
    messages,
    isLoading: msgLoading,
    refetch: refetchMessages,
  } = usePublicMessages(botId ?? '', sessionId || null)
  const {
    isStreaming,
    streamingText,
    error: streamError,
    startStream,
    reset: resetStream,
  } = usePublicStreamingChat()

  const [inputText, setInputText] = useState('')
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<
    string | null
  >(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }, [messages.length, isStreaming, streamingText, optimisticUserMessage])

  useEffect(() => {
    if (streamError && optimisticUserMessage) {
      setInputText(optimisticUserMessage)
      setOptimisticUserMessage(null)
    }
  }, [streamError, optimisticUserMessage])

  if (!botId) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#6b7280',
        }}
      >
        Bot bulunamadı
      </div>
    )
  }

  const brandColor = bot?.brand_color ?? DEFAULT_BRAND_COLOR

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !bot || isStreaming) return

    const messageToSend = trimmed
    setInputText('')
    setOptimisticUserMessage(messageToSend)
    resetStream()

    try {
      await startStream({ botId, sessionId, userMessage: messageToSend })
      await refetchMessages()
      setOptimisticUserMessage(null)
    } catch {
      setInputText(messageToSend)
      setOptimisticUserMessage(null)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  const showInitialLoading = botLoading || (msgLoading && messages.length === 0)
  const showWelcome =
    !showInitialLoading &&
    !botError &&
    messages.length === 0 &&
    !optimisticUserMessage

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`
        @keyframes chatbotkur-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      <div
        style={{
          padding: '16px',
          backgroundColor: brandColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <MessageCircle size={20} />
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {bot?.name ?? 'Yükleniyor...'}
        </h2>
      </div>

      <div
        ref={messagesContainerRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px' }}
      >
        {showInitialLoading ? (
          <p style={{ color: '#666', textAlign: 'center' }}>Yükleniyor...</p>
        ) : botError ? (
          <p style={{ color: '#ef4444', textAlign: 'center' }}>{botError}</p>
        ) : showWelcome ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p style={{ color: '#666', marginBottom: '8px' }}>
              {bot?.welcome_message ?? 'Merhaba!'}
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble
                key={m.id}
                message={{ id: m.id, role: m.role, content: m.content }}
                brandColor={brandColor}
              />
            ))}
            {optimisticUserMessage && (
              <Bubble
                message={{
                  id: 'optimistic-user',
                  role: 'user',
                  content: optimisticUserMessage,
                }}
                brandColor={brandColor}
              />
            )}
            {optimisticUserMessage && !streamError && (
              <Bubble
                message={{
                  id: 'streaming-assistant',
                  role: 'assistant',
                  content: streamingText || '●',
                }}
                brandColor={brandColor}
              />
            )}
          </>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px',
        }}
      >
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesajını yaz..."
          rows={2}
          disabled={isStreaming || !bot}
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: '14px',
            outline: 'none',
            color: '#1f2937',
            backgroundColor: '#ffffff',
          }}
        />
        <button
          type="submit"
          disabled={!bot || isStreaming || !inputText.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: brandColor,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: !bot || isStreaming || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: !bot || isStreaming || !inputText.trim() ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} />
        </button>
      </form>

      {streamError && !isStreaming && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            borderTop: '1px solid #ef4444',
            fontSize: '12px',
            color: '#dc2626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{streamError}</span>
          <button
            type="button"
            onClick={() => resetStream()}
            style={{
              marginLeft: '8px',
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  )
}
