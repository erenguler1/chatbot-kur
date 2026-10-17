import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FileUp, X } from 'lucide-react'
import { MAX_DOCUMENT_CHARS } from '../types/document'

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (content: string, sourceName: string) => Promise<void>
}

const INPUT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors'

const TEXTAREA_CLASS =
  'w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors'

const LABEL_CLASS = 'block text-sm font-medium text-[var(--text)] mb-1.5'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2 transition-colors'

const MAX_NAME_LENGTH = 120

// .txt files from Turkish Windows setups are often Windows-1254, not UTF-8.
async function readTextFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('windows-1254').decode(buffer)
  }
}

export function DocumentFormDialog({ open, onOpenChange, onSubmit }: DocumentFormDialogProps) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [nameError, setNameError] = useState('')
  const [contentError, setContentError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setName('')
    setContent('')
    setNameError('')
    setContentError('')
    setFormError('')
  }

  const handleOpenChange = (next: boolean) => {
    if (submitting) return
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setContentError('Şimdilik sadece .txt dosyası yüklenebilir.')
      return
    }
    try {
      setContent(await readTextFile(file))
      setContentError('')
      if (name.trim().length === 0) setName(file.name.slice(0, MAX_NAME_LENGTH))
    } catch {
      setContentError('Dosya okunamadı.')
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')

    let valid = true

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setNameError('Belge adı gerekli.')
      valid = false
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      setNameError(`Belge adı ${MAX_NAME_LENGTH} karakteri geçemez.`)
      valid = false
    } else {
      setNameError('')
    }

    const trimmedContent = content.trim()
    if (trimmedContent.length === 0) {
      setContentError('Metin gerekli.')
      valid = false
    } else if (trimmedContent.length > MAX_DOCUMENT_CHARS) {
      setContentError('Metin çok uzun. En fazla 200.000 karakter yükleyebilirsiniz.')
      valid = false
    } else {
      setContentError('')
    }

    if (!valid) return

    setSubmitting(true)
    try {
      await onSubmit(trimmedContent, trimmedName)
      reset()
      onOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Belge yüklenemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold text-[var(--text)]">
              Belge Ekle
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
            Menü, fiyat listesi, çalışma saatleri gibi metinleri ekle. Bot, soru-cevap
            listesinde bulamadığı bilgileri burada arar.
          </Dialog.Description>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div>
              <label htmlFor="doc-name" className={LABEL_CLASS}>
                Belge adı
              </label>
              <input
                id="doc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn. Menü ve fiyatlar"
                disabled={submitting}
                className={INPUT_CLASS}
              />
              {nameError && <div className="text-xs text-[var(--danger)] mt-1">{nameError}</div>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="doc-content" className="text-sm font-medium text-[var(--text)]">
                  Metin
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-60 transition-colors"
                >
                  <FileUp size={14} />
                  .txt dosyası seç
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => void handleFile(e)}
                  className="hidden"
                />
              </div>
              <textarea
                id="doc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Metni buraya yapıştır veya .txt dosyası seç"
                disabled={submitting}
                className={`${TEXTAREA_CLASS} h-56`}
              />
              <div className="flex justify-between gap-2 mt-1">
                <div className="text-xs text-[var(--danger)]">{contentError}</div>
                <div className="text-xs text-[var(--text-dim)] shrink-0">
                  {content.length.toLocaleString('tr-TR')} / {MAX_DOCUMENT_CHARS.toLocaleString('tr-TR')}
                </div>
              </div>
            </div>

            {formError && <div className="text-sm text-[var(--danger)]">{formError}</div>}

            <div className="flex gap-2 justify-end mt-2">
              <Dialog.Close asChild>
                <button type="button" disabled={submitting} className={SECONDARY_BTN_CLASS}>
                  Vazgeç
                </button>
              </Dialog.Close>
              <button type="submit" disabled={submitting} className={PRIMARY_BTN_CLASS}>
                {submitting ? 'İşleniyor...' : 'Ekle'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
