import { useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { formatDate } from '../lib/date'
import type { QuestionGroup } from '../lib/questionGroups'

interface UnansweredQuestionsProps {
  groups: QuestionGroup[]
  onAnswer: (group: QuestionGroup) => void
  onIgnore: (group: QuestionGroup) => Promise<void>
}

const VISIBLE = 5

const SMALL_PRIMARY_BTN_CLASS =
  'inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-xs rounded-[var(--radius-btn)] px-2.5 py-1 transition-colors'

const SMALL_SECONDARY_BTN_CLASS =
  'inline-flex items-center border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text-muted)] text-xs rounded-[var(--radius-btn)] px-2.5 py-1 transition-colors disabled:opacity-60'

// Questions the bot couldn't answer, similar ones grouped, most asked first.
export function UnansweredQuestions({ groups, onAnswer, onIgnore }: UnansweredQuestionsProps) {
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (groups.length === 0) return null
  const visible = showAll ? groups : groups.slice(0, VISIBLE)

  const handleIgnore = async (group: QuestionGroup) => {
    setError('')
    setBusy(group.ids[0])
    try {
      await onIgnore(group)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem kaydedilemedi.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="border border-[var(--border)] rounded-[var(--radius-card)] p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircleQuestion size={16} className="text-[var(--accent)]" />
        <h2 className="text-[15px] font-semibold text-[var(--text)]">Cevaplanamayan sorular</h2>
        <span className="text-xs text-[var(--text-dim)]">{groups.length}</span>
      </div>
      <p className="text-xs text-[var(--text-dim)] mb-3">
        Botun cevap bulamadığı sorular (son 90 gün). Telefon, e-posta gibi bilgiler gizlenir.
      </p>
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {visible.map((g) => (
          <li key={g.ids[0]} className="py-2.5 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--text)] break-words">{g.label}</p>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">
                {g.count} kez soruldu · son {formatDate(g.lastAskedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => onAnswer(g)} className={SMALL_PRIMARY_BTN_CLASS}>
                Q&A olarak cevapla
              </button>
              <button
                type="button"
                onClick={() => void handleIgnore(g)}
                disabled={busy === g.ids[0]}
                className={SMALL_SECONDARY_BTN_CLASS}
              >
                Yoksay
              </button>
            </div>
          </li>
        ))}
      </ul>
      {groups.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] mt-2 transition-colors"
        >
          {showAll ? 'Daha az göster' : `Tümünü göster (${groups.length})`}
        </button>
      )}
      {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
    </section>
  )
}
