import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, CheckCheck, Copy } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useQAPairs } from '../hooks/useQAPairs'
import { buildSystemPrompt } from '../lib/promptBuilder'
import type { Bot } from '../types/bot'

interface BotPromptContext {
  bot: Bot
  refetch: () => Promise<void>
}

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-1.5 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-xs rounded-[var(--radius-btn)] px-2.5 py-1.5 transition-colors'

const INTRO_TITLE = 'Sistem Promptu'
const INTRO_BODY =
  "Bot'unun Claude'a göndereceği talimat metni. Buradaki içerik bot'un nasıl davranacağını belirler. Değişiklikler yapmak için diğer sekmeleri kullan."

export function BotPrompt() {
  const { bot } = useOutletContext<BotPromptContext>()
  const { qaPairs, isLoading, error, refetch } = useQAPairs(bot.id)
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(() => buildSystemPrompt(bot, qaPairs), [bot, qaPairs])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const intro = (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-[var(--text)] mb-2">
        {INTRO_TITLE}
      </h3>
      <p className="text-sm text-[var(--text-muted)]">{INTRO_BODY}</p>
    </div>
  )

  if (isLoading) {
    return (
      <div className="py-6">
        {intro}
        <div className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <Skeleton width="w-32" height="h-3" />
            <Skeleton width="w-20" height="h-7" className="rounded-[var(--radius-btn)]" />
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="w-full" height="h-3" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6">
        {intro}
        <div className="flex flex-col items-center">
          <EmptyState
            icon={<AlertCircle size={20} />}
            title="Prompt oluşturulamadı"
            description={error.message}
          />
          <button
            type="button"
            onClick={() => {
              void refetch()
            }}
            className={SECONDARY_BTN_CLASS}
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-6">
      {intro}
      <div className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">Otomatik oluşturulur</span>
          <button
            type="button"
            onClick={() => {
              void handleCopy()
            }}
            className={SECONDARY_BTN_CLASS}
          >
            {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            {copied ? 'Kopyalandı ✓' : 'Kopyala'}
          </button>
        </div>
        <pre className="px-4 py-3 text-xs text-[var(--text)] whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[600px] overflow-y-auto">
          {prompt}
        </pre>
      </div>
    </div>
  )
}
