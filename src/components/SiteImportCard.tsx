import { useState } from 'react'
import { AlertTriangle, Globe, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { formatDate } from '../lib/date'
import { hostOf } from '../lib/url'
import type { SiteImport } from '../types/document'

interface SiteImportCardProps {
  siteImport: SiteImport
  stepError: string | undefined
  waiting: boolean
  onRescan: () => Promise<void>
  onResume: () => void
  onRemove: () => void
}

const ICON_BTN_CLASS =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

const LINK_BTN_CLASS = 'text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors'

export function SiteImportCard({ siteImport: s, stepError, waiting, onRescan, onResume, onRemove }: SiteImportCardProps) {
  const [rescanError, setRescanError] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const total = s.page_urls.length
  const done = s.pages_ok + s.pages_empty + s.pages_failed
  const running = s.status === 'running'
  const host = hostOf(s.root_url)

  const handleRescan = async () => {
    setRescanError('')
    setRescanning(true)
    try {
      await onRescan()
    } catch (err) {
      setRescanError(err instanceof Error ? err.message : 'Site yeniden taranamadı.')
    } finally {
      setRescanning(false)
    }
  }

  let status: string
  if (running) {
    status = waiting ? `${done}/${total} sayfa · sıradaki sayfa için bekleniyor` : `${done}/${total} sayfa okunuyor...`
  } else if (s.status === 'failed') {
    status = 'Okunamadı'
  } else {
    status = `${s.pages_ok} sayfa eklendi · ${formatDate(s.updated_at)}`
  }

  return (
    <div className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {running && !stepError ? (
            <Loader2 size={16} className="text-[var(--accent)] mt-0.5 shrink-0 animate-spin" />
          ) : (
            <Globe size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[var(--text)] break-all">{host}</p>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">{status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => void handleRescan()}
            disabled={running || rescanning}
            className={ICON_BTN_CLASS}
            aria-label="Yeniden tara"
            title="Yeniden tara"
          >
            <RefreshCw size={14} className={rescanning ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className={`${ICON_BTN_CLASS} hover:!text-[var(--danger)]`}
            aria-label="Siteyi kaldır"
            title="Siteyi kaldır"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {running && total > 0 && (
        <div className="h-1 bg-[var(--bg-app)] rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}

      {s.status === 'failed' && s.error && (
        <p className="text-sm text-[var(--danger)] mt-2 flex gap-1.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {s.error}
        </p>
      )}
      {s.status === 'done' && s.pages_empty > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2 flex gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {s.pages_empty} sayfa boş geldi; içeriği JavaScript ile yükleniyor olabilir, bu sayfalar
          eklenmedi.
        </p>
      )}
      {s.status === 'done' && s.pages_failed > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{s.pages_failed} sayfa açılamadı ve atlandı.</p>
      )}
      {stepError && running && (
        <p className="text-sm text-[var(--danger)] mt-2">
          {stepError}{' '}
          <button type="button" onClick={onResume} className={LINK_BTN_CLASS}>
            Devam et
          </button>
        </p>
      )}
      {rescanError && <p className="text-sm text-[var(--danger)] mt-2">{rescanError}</p>}
    </div>
  )
}
