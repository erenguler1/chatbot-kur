import { useState, type ReactElement } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, Edit3, HelpCircle, Plus, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { QAFormDialog } from '../components/QAFormDialog'
import { QADeleteDialog } from '../components/QADeleteDialog'
import { useQAPairs } from '../hooks/useQAPairs'
import type { Bot } from '../types/bot'
import type { QAPair } from '../types/qa'

interface BotQAContext {
  bot: Bot
  refetch: () => Promise<void>
}

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const ICON_BTN_CLASS =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] transition-colors'

const ICON_BTN_DANGER_CLASS =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--danger)] transition-colors'

export function BotQA() {
  const { bot } = useOutletContext<BotQAContext>()
  const { qaPairs, isLoading, error, refetch } = useQAPairs(bot.id)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingQA, setEditingQA] = useState<QAPair | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingQA, setDeletingQA] = useState<QAPair | null>(null)

  const openCreateDialog = () => {
    setDialogMode('create')
    setEditingQA(null)
    setDialogOpen(true)
  }

  const openEditDialog = (qa: QAPair) => {
    setDialogMode('edit')
    setEditingQA(qa)
    setDialogOpen(true)
  }

  const openDeleteDialog = (qa: QAPair) => {
    setDeletingQA(qa)
    setDeleteDialogOpen(true)
  }

  const renderTopBar = (count: number) => (
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm text-[var(--text-muted)]">
        {count} soru-cevap çifti
      </span>
      <button type="button" onClick={openCreateDialog} className={PRIMARY_BTN_CLASS}>
        <Plus size={14} />
        Yeni Soru Ekle
      </button>
    </div>
  )

  let body: ReactElement

  if (isLoading) {
    body = (
      <>
        <div className="flex items-center justify-between mb-4">
          <Skeleton width="w-32" height="h-4" />
          <Skeleton width="w-36" height="h-9" className="rounded-[var(--radius-btn)]" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4"
            >
              <Skeleton width="w-3/4" height="h-4" className="mb-3" />
              <Skeleton width="w-full" height="h-3" />
            </div>
          ))}
        </div>
      </>
    )
  } else if (error) {
    body = (
      <div className="flex flex-col items-center">
        <EmptyState
          icon={<AlertCircle size={20} />}
          title="Sorular yüklenemedi"
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
    )
  } else if (qaPairs.length === 0) {
    body = (
      <>
        {renderTopBar(0)}
        <EmptyState
          icon={<HelpCircle size={20} />}
          title="Henüz soru-cevap yok"
          description="Botuna sorular ekle ki müşterilerine yardımcı olabilsin."
        />
      </>
    )
  } else {
    body = (
      <>
        {renderTopBar(qaPairs.length)}
        <ul className="flex flex-col">
          {qaPairs.map((qa) => (
            <li
              key={qa.id}
              className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 mb-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-medium text-[var(--text)] min-w-0 break-words">
                  S: {qa.question}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditDialog(qa)}
                    className={ICON_BTN_CLASS}
                    aria-label="Düzenle"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(qa)}
                    className={ICON_BTN_DANGER_CLASS}
                    aria-label="Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2 break-words">
                C: {qa.answer}
              </p>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="py-6">
      {body}
      <QAFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        botId={bot.id}
        qaPair={editingQA ?? undefined}
        onSuccess={() => void refetch()}
      />
      <QADeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        qaPair={deletingQA}
        onSuccess={() => void refetch()}
      />
    </div>
  )
}
