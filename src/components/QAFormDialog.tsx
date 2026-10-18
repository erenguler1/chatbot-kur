import { useEffect, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { QAPair } from '../types/qa'

interface QAFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  botId: string
  qaPair?: QAPair
  // Create mode: question to start with ("Q&A olarak cevapla").
  initialQuestion?: string
  onSuccess: () => void
}

const TEXTAREA_CLASS =
  'w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors'

const LABEL_CLASS = 'block text-sm font-medium text-[var(--text)] mb-1.5'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2 transition-colors'

export function QAFormDialog({
  open,
  onOpenChange,
  mode,
  botId,
  qaPair,
  initialQuestion,
  onSuccess,
}: QAFormDialogProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [questionError, setQuestionError] = useState('')
  const [answerError, setAnswerError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && qaPair) {
      setQuestion(qaPair.question)
      setAnswer(qaPair.answer)
    } else {
      setQuestion(initialQuestion ?? '')
      setAnswer('')
    }
    setQuestionError('')
    setAnswerError('')
    setFormError('')
  }, [open, mode, qaPair, initialQuestion])

  const handleOpenChange = (next: boolean) => {
    if (submitting) return
    onOpenChange(next)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')

    let valid = true

    const trimmedQ = question.trim()
    if (trimmedQ.length === 0) {
      setQuestionError('Soru gerekli.')
      valid = false
    } else if (trimmedQ.length > 500) {
      setQuestionError('Soru 500 karakteri geçemez.')
      valid = false
    } else {
      setQuestionError('')
    }

    const trimmedA = answer.trim()
    if (trimmedA.length === 0) {
      setAnswerError('Cevap gerekli.')
      valid = false
    } else if (trimmedA.length > 2000) {
      setAnswerError('Cevap 2000 karakteri geçemez.')
      valid = false
    } else {
      setAnswerError('')
    }

    if (!valid) return

    setSubmitting(true)
    try {
      if (mode === 'create') {
        const { error } = await supabase.from('qa_pairs').insert({
          bot_id: botId,
          question: trimmedQ,
          answer: trimmedA,
        })
        if (error) throw error
      } else {
        if (!qaPair) throw new Error('Düzenlenecek soru bulunamadı.')
        const { error } = await supabase
          .from('qa_pairs')
          .update({
            question: trimmedQ,
            answer: trimmedA,
          })
          .eq('id', qaPair.id)
        if (error) throw error
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  const title = mode === 'create' ? 'Yeni Soru Ekle' : 'Soruyu Düzenle'

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold text-[var(--text)]">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={submitting}
                aria-label="Kapat"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-[var(--text-muted)] mt-1 mb-4">
            Sorular ve cevaplar bot'unun bilgi tabanını oluşturur.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="qa-question" className={LABEL_CLASS}>
                Soru
              </label>
              <textarea
                id="qa-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="örn. Çalışma saatleriniz nedir?"
                disabled={submitting}
                className={`${TEXTAREA_CLASS} h-20`}
              />
              {questionError && (
                <div className="text-xs text-[var(--danger)] mt-1">{questionError}</div>
              )}
            </div>

            <div>
              <label htmlFor="qa-answer" className={LABEL_CLASS}>
                Cevap
              </label>
              <textarea
                id="qa-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Müşteriye verilecek cevap"
                disabled={submitting}
                className={`${TEXTAREA_CLASS} h-32`}
              />
              {answerError && (
                <div className="text-xs text-[var(--danger)] mt-1">{answerError}</div>
              )}
            </div>

            {formError && (
              <div className="text-sm text-[var(--danger)]">{formError}</div>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={submitting}
                  className={SECONDARY_BTN_CLASS}
                >
                  Vazgeç
                </button>
              </Dialog.Close>
              <button type="submit" disabled={submitting} className={PRIMARY_BTN_CLASS}>
                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
