import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, Inbox, Mail, Phone, Trash2 } from 'lucide-react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useLeads } from '../hooks/useLeads'
import { formatDate } from '../lib/date'
import type { Bot } from '../types/bot'
import type { Lead, LeadStatus } from '../types/lead'

interface BotLeadsContext {
  bot: Bot
  refreshNewLeads: () => void
}

const STATUSES: Array<{ value: LeadStatus; label: string; className: string }> = [
  { value: 'new', label: 'Yeni', className: 'bg-[var(--accent)] text-white border-[var(--accent)]' },
  { value: 'contacted', label: 'Arandı', className: 'bg-[rgba(245,158,11,0.15)] text-[var(--warning)] border-[rgba(245,158,11,0.4)]' },
  { value: 'closed', label: 'Kapandı', className: 'bg-[rgba(16,185,129,0.15)] text-[var(--success)] border-[rgba(16,185,129,0.4)]' },
]

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const ICON_BTN_DANGER_CLASS =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--danger)] transition-colors'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function BotLeads() {
  const { bot, refreshNewLeads } = useOutletContext<BotLeadsContext>()
  const { leads, isLoading, error, setStatus, remove } = useLeads(bot.id, refreshNewLeads)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [deleting, setDeleting] = useState<Lead | null>(null)

  const run = async (id: string, action: () => Promise<void>) => {
    setActionError('')
    setBusy(id)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem kaydedilemedi.')
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="py-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4">
            <Skeleton width="w-1/3" height="h-4" className="mb-3" />
            <Skeleton width="w-2/3" height="h-3" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6">
        <EmptyState icon={<AlertCircle size={20} />} title="Talepler yüklenemedi" description="Sayfayı yenileyip tekrar deneyin." />
      </div>
    )
  }

  return (
    <div className="py-6">
      {!bot.lead_capture_enabled && (
        <p className="text-xs text-[var(--warning)] border border-[rgba(245,158,11,0.3)] rounded-[var(--radius-card)] px-3 py-2 mb-4">
          İletişim talebi alma bu bot için kapalı. Ayarlar sekmesinden açabilirsiniz.
        </p>
      )}
      <p className="text-xs text-[var(--text-dim)] mb-4">
        Müşterilerin bot üzerinden onay vererek bıraktığı iletişim talepleri (son 180 gün; daha eskiler otomatik silinir).
      </p>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title="Henüz talep yok"
          description="Müşteri geri aranmak veya teklif almak isteyip onay verdiğinde burada görünür."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-[var(--text)] break-words">{lead.name}</p>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5">{formatTime(lead.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting(lead)}
                  className={ICON_BTN_DANGER_CLASS}
                  aria-label="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:text-[var(--accent-hover)]">
                    <Phone size={13} />
                    {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:text-[var(--accent-hover)] break-all">
                    <Mail size={13} />
                    {lead.email}
                  </a>
                )}
              </div>
              {lead.note && <p className="text-sm text-[var(--text-muted)] mt-2 break-words">{lead.note}</p>}
              <div className="flex gap-1.5 mt-3" role="group" aria-label="Durum">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={busy === lead.id}
                    aria-pressed={lead.status === s.value}
                    onClick={() => {
                      if (lead.status !== s.value) void run(lead.id, () => setStatus(lead.id, s.value))
                    }}
                    className={`text-xs rounded-full border px-2.5 py-0.5 transition-colors disabled:opacity-60 ${
                      lead.status === s.value
                        ? s.className
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="text-xs text-[var(--danger)] mt-3">{actionError}</p>}

      <AlertDialog.Root open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl">
            <AlertDialog.Title className="text-lg font-semibold text-[var(--text)]">Talebi Sil</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-[var(--text-muted)] mt-2">
              <span className="text-[var(--text)] font-medium">{deleting?.name}</span> adlı müşterinin talebi silinecek.
            </AlertDialog.Description>
            <div className="flex gap-2 justify-end mt-5">
              <AlertDialog.Cancel asChild>
                <button type="button" className={SECONDARY_BTN_CLASS}>Vazgeç</button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (deleting) void run(deleting.id, () => remove(deleting.id))
                  }}
                  className="inline-flex items-center bg-[var(--danger)] hover:bg-[rgba(239,68,68,0.9)] text-white font-medium text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors"
                >
                  Sil
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
