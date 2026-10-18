import { useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface SiteImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (url: string) => Promise<void>
}

const INPUT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2 transition-colors'

export function SiteImportDialog({ open, onOpenChange, onSubmit }: SiteImportDialogProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (submitting) return
    if (!next) {
      setUrl('')
      setError('')
    }
    onOpenChange(next)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (trimmed.length === 0) {
      setError('Web adresi gerekli.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setUrl('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Site eklenemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold text-[var(--text)]">
              Web Sitesinden Ekle
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
            Sitenin adresini gir; aynı sitedeki en fazla 30 sayfanın metni okunup belge olarak
            eklenir. Menü, alt bilgi ve çerez bandı gibi kısımlar atlanır.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="site-url" className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Web adresi
              </label>
              <input
                id="site-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ornekkafe.com"
                disabled={submitting}
                className={INPUT_CLASS}
              />
              {error && <div className="text-xs text-[var(--danger)] mt-1">{error}</div>}
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <Dialog.Close asChild>
                <button type="button" disabled={submitting} className={SECONDARY_BTN_CLASS}>
                  Vazgeç
                </button>
              </Dialog.Close>
              <button type="submit" disabled={submitting} className={PRIMARY_BTN_CLASS}>
                {submitting ? 'Sayfalar aranıyor...' : 'Ekle'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
