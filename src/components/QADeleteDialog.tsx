import { useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { supabase } from '../lib/supabase'
import type { QAPair } from '../types/qa'

interface QADeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qaPair: QAPair | null
  onSuccess: () => void
}

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export function QADeleteDialog({
  open,
  onOpenChange,
  qaPair,
  onSuccess,
}: QADeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleOpenChange = (next: boolean) => {
    if (isDeleting) return
    onOpenChange(next)
    if (!next) setDeleteError('')
  }

  const handleDelete = async () => {
    if (!qaPair) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase
        .from('qa_pairs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', qaPair.id)
      if (error) throw error
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Soru silinemedi.')
    } finally {
      setIsDeleting(false)
    }
  }

  const preview = qaPair ? truncate(qaPair.question, 80) : ''

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold text-[var(--text)]">
            Soruyu Sil
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-[var(--text-muted)] mt-2">
            <span className="text-[var(--text)] font-medium">"{preview}"</span> silinecek.
            Bu işlem geri alınamaz.
          </AlertDialog.Description>
          {deleteError && (
            <div className="text-xs text-[var(--danger)] mt-3">{deleteError}</div>
          )}
          <div className="flex gap-2 justify-end mt-5">
            <AlertDialog.Cancel asChild>
              <button type="button" disabled={isDeleting} className={SECONDARY_BTN_CLASS}>
                Vazgeç
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault()
                  void handleDelete()
                }}
                className="inline-flex items-center bg-[var(--danger)] hover:bg-[rgba(239,68,68,0.9)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors"
              >
                {isDeleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
