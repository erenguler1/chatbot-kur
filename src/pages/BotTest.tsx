import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, FileText, MessageCircle, RotateCcw, Send } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useConversation } from '../hooks/useConversation'
import { useMessages } from '../hooks/useMessages'
import { useStreamingChat } from '../hooks/useStreamingChat'
import type { Bot } from '../types/bot'
import type { Message } from '../types/conversation'

interface BotTestContext {
  bot: Bot
  refetch: () => Promise<void>
}

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'bg-[var(--accent)] text-white rounded-lg rounded-br-sm px-3 py-2 max-w-[75%] break-words'
            : 'bg-[var(--bg-card-hover)] text-[var(--text)] rounded-lg rounded-bl-sm px-3 py-2 max-w-[75%] break-words'
        }
      >
        {message.content === '●' ? (
          <span className="inline-flex gap-1">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>
              ●
            </span>
            <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>
              ●
            </span>
          </span>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
            <FileText size={12} className="mt-0.5 shrink-0" />
            <span>Bakılan belgeler: {message.sources.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="flex justify-start mb-3">
        <Skeleton width="w-2/3" height="h-12" className="rounded-lg" />
      </div>
      <div className="flex justify-end mb-3">
        <Skeleton width="w-1/2" height="h-10" className="rounded-lg" />
      </div>
      <div className="flex justify-start mb-3">
        <Skeleton width="w-2/3" height="h-12" className="rounded-lg" />
      </div>
    </div>
  )
}

export function BotTest() {
  const { bot } = useOutletContext<BotTestContext>()
  const {
    conversation,
    isLoading: convLoading,
    error: convError,
    refetch: refetchConversation,
    createNew: createNewConversation,
  } = useConversation(bot.id)
  const {
    messages,
    isLoading: msgLoading,
    error: msgError,
    refetch: refetchMessages,
  } = useMessages(conversation?.id ?? null)

  const [inputText, setInputText] = useState('')
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<
    string | null
  >(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const {
    isStreaming,
    streamingText,
    error: streamError,
    startStream,
    reset: resetStream,
  } = useStreamingChat()

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

  const isInitialLoading = convLoading || (msgLoading && messages.length === 0)
  const error = convError ?? msgError

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !conversation || isStreaming) return

    const messageToSend = trimmed
    setInputText('')
    setOptimisticUserMessage(messageToSend)
    resetStream()

    try {
      await startStream({
        botId: bot.id,
        conversationId: conversation.id,
        userMessage: messageToSend,
      })

      await refetchMessages()
      setOptimisticUserMessage(null)
    } catch {
      setInputText(messageToSend)
      setOptimisticUserMessage(null)
    }
  }

  const handleReset = async () => {
    if (isStreaming) return
    setOptimisticUserMessage(null)
    setInputText('')
    resetStream()
    await createNewConversation()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  const canSend =
    Boolean(conversation) && !isStreaming && inputText.trim().length > 0

  return (
    <div className="py-6 flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-[var(--text-muted)]" />
          <h3 className="text-base font-semibold text-[var(--text)]">
            Test Sohbeti
          </h3>
        </div>
        {conversation && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              void handleReset()
            }}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={12} />
            Sıfırla
          </button>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Botunla konuşarak nasıl cevap verdiğini test edebilirsin.
      </p>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto pr-2 mb-4"
      >
        {isInitialLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center">
            <EmptyState
              icon={<AlertCircle size={20} />}
              title="Sohbet yüklenemedi"
              description={error.message}
            />
            <button
              type="button"
              onClick={() => {
                void refetchConversation()
              }}
              className={SECONDARY_BTN_CLASS}
            >
              Yeniden Dene
            </button>
          </div>
        ) : messages.length === 0 && !optimisticUserMessage ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--text-muted)]">
              Bot'unu test etmek için ilk mesajını yaz.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {optimisticUserMessage && (
              <MessageBubble
                message={{
                  id: 'optimistic-user',
                  conversation_id: conversation?.id ?? '',
                  role: 'user',
                  content: optimisticUserMessage,
                  input_tokens: null,
                  output_tokens: null,
                  created_at: new Date().toISOString(),
                }}
              />
            )}
            {optimisticUserMessage && !streamError && (
              <MessageBubble
                message={{
                  id: 'streaming-assistant',
                  conversation_id: conversation?.id ?? '',
                  role: 'assistant',
                  content: streamingText || '●',
                  input_tokens: null,
                  output_tokens: null,
                  created_at: new Date().toISOString(),
                }}
              />
            )}
          </>
        )}
      </div>

      <form className="flex gap-2" onSubmit={handleSubmit}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesajını yaz..."
          rows={2}
          disabled={isStreaming}
          className="flex-1 bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[var(--radius-btn)] px-4 self-stretch transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
      {streamError && !isStreaming && (
        <div className="flex items-center justify-between mt-2 p-2 bg-[var(--bg-card-hover)] border border-[var(--danger)] rounded-[var(--radius-input)]">
          <p className="text-xs text-[var(--danger)]">{streamError}</p>
          <button
            type="button"
            onClick={() => resetStream()}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  )
}
