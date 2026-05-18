import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, SearchX, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Header } from '../components/Header'
import { BotAvatar } from '../components/BotAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useBot } from '../hooks/useBot'
import { supabase } from '../lib/supabase'
import { getBotStatus, type Bot } from '../types/bot'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const TABS = [
  { to: 'settings', label: 'Ayarlar' },
  { to: 'qa', label: 'Sorular & Cevaplar' },
  { to: 'test', label: 'Test Sohbeti' },
]

interface DeleteBotButtonProps {
  bot: Bot
}

function DeleteBotButton({ bot }: DeleteBotButtonProps) {
  const navigate = useNavigate()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase
        .from('bots')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bot.id)
      if (error) throw error
      navigate('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Bot silinemedi.')
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return
        setOpen(next)
        if (!next) setDeleteError('')
      }}
    >
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--danger)] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.1)] rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors"
        >
          <Trash2 size={14} />
          Sil
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl">
          <AlertDialog.Title className="text-lg font-semibold text-[var(--text)]">
            Bot'u Sil
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-[var(--text-muted)] mt-2">
            <span className="text-[var(--text)] font-medium">{bot.name}</span> silinecek.
            Bu işlem geri alınamaz.
          </AlertDialog.Description>
          {deleteError && (
            <div className="text-xs text-[var(--danger)] mt-3">{deleteError}</div>
          )}
          <div className="flex gap-2 justify-end mt-5">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                disabled={isDeleting}
                className={`${SECONDARY_BTN_CLASS} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
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

export function BotDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bot, isLoading, error, refetch } = useBot(id)

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Header />
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Botlarıma Dön
        </button>

        {isLoading && !bot ? (
          <div className="flex items-center gap-3 mb-6">
            <Skeleton width="w-12" height="h-12" className="rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton width="w-48" height="h-6" />
              <Skeleton width="w-20" height="h-5" className="rounded-full" />
            </div>
          </div>
        ) : error && !bot ? (
          <div className="flex flex-col items-center">
            <EmptyState
              icon={<AlertCircle size={20} />}
              title="Bot yüklenemedi"
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
        ) : !bot ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="Bot bulunamadı"
            description="Bu bot silinmiş veya erişim yetkin yok."
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <BotAvatar name={bot.name} size={48} />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-[var(--text)] truncate">
                    {bot.name}
                  </h1>
                  <div className="mt-1">
                    <StatusBadge status={getBotStatus(bot)} />
                  </div>
                </div>
              </div>
              <DeleteBotButton bot={bot} />
            </div>

            <nav className="flex gap-1 border-b border-[var(--border)]">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      isActive
                        ? 'text-[var(--accent)] border-[var(--accent)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] border-transparent'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>

            <Outlet context={{ bot, refetch }} />
          </>
        )}
      </main>
    </div>
  )
}
