import { useState, type ReactElement } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertCircle, FileText, Globe, Plus, Trash2 } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { DocumentFormDialog } from '../components/DocumentFormDialog'
import { DocumentDeleteDialog, type DeleteTarget } from '../components/DocumentDeleteDialog'
import { SiteImportCard } from '../components/SiteImportCard'
import { SiteImportDialog } from '../components/SiteImportDialog'
import { useDocuments } from '../hooks/useDocuments'
import { useSiteImports } from '../hooks/useSiteImports'
import { formatDate } from '../lib/date'
import { hostOf } from '../lib/url'
import type { Bot } from '../types/bot'

interface BotDocumentsContext {
  bot: Bot
  refetch: () => Promise<void>
}

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const PRIMARY_BTN_CLASS =
  'inline-flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const ICON_BTN_DANGER_CLASS =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--danger)] transition-colors'

export function BotDocuments() {
  const { bot } = useOutletContext<BotDocumentsContext>()
  const { documents, isLoading, error, refetch, uploadDocument, deleteDocument } = useDocuments(
    bot.id,
  )

  const sites = useSiteImports(bot.id, refetch)

  const [formOpen, setFormOpen] = useState(false)
  const [siteFormOpen, setSiteFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)

  const openDeleteDialog = (target: DeleteTarget) => {
    setDeleting(target)
    setDeleteOpen(true)
  }

  const confirmDelete = (target: DeleteTarget) =>
    target.kind === 'site' ? sites.removeImport(target.id) : deleteDocument(target.id)

  const renderTopBar = (count: number) => (
    <>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <span className="text-sm text-[var(--text-muted)]">{count} belge</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSiteFormOpen(true)} className={SECONDARY_BTN_CLASS}>
            <Globe size={14} />
            Web sitesinden ekle
          </button>
          <button type="button" onClick={() => setFormOpen(true)} className={PRIMARY_BTN_CLASS}>
            <Plus size={14} />
            Belge Ekle
          </button>
        </div>
      </div>
      {sites.imports.map((s) => (
        <SiteImportCard
          key={s.id}
          siteImport={s}
          stepError={sites.stepErrors[s.id]}
          waiting={sites.waiting[s.id] ?? false}
          onRescan={() => sites.rescan(s.id)}
          onResume={() => sites.resume(s.id)}
          onRemove={() => openDeleteDialog({ kind: 'site', id: s.id, name: hostOf(s.root_url) })}
        />
      ))}
    </>
  )

  let body: ReactElement

  if (isLoading) {
    body = (
      <>
        <div className="flex items-center justify-between mb-4">
          <Skeleton width="w-20" height="h-4" />
          <Skeleton width="w-28" height="h-9" className="rounded-[var(--radius-btn)]" />
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4"
            >
              <Skeleton width="w-1/2" height="h-4" className="mb-3" />
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
          title="Belgeler yüklenemedi"
          description="Bağlantını kontrol edip tekrar dene."
        />
        <button type="button" onClick={() => void refetch()} className={SECONDARY_BTN_CLASS}>
          Yeniden Dene
        </button>
      </div>
    )
  } else if (documents.length === 0) {
    body = (
      <>
        {renderTopBar(0)}
        {sites.imports.length === 0 && (
        <EmptyState
          icon={<FileText size={20} />}
          title="Henüz belge yok"
          description="Menü, fiyat listesi gibi metinler ya da web siteni ekle; bot soru-cevap listesinde olmayan bilgileri buradan cevaplasın."
        />
        )}
      </>
    )
  } else {
    body = (
      <>
        {renderTopBar(documents.length)}
        <ul className="flex flex-col">
          {documents.map((doc) => (
            <li
              key={doc.upload_id}
              className="bg-[var(--bg-card-hover)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 mb-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {doc.source_type === 'url' ? (
                    <Globe size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  ) : (
                    <FileText size={16} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-[var(--text)] break-words">
                      {doc.source_name ?? 'Adsız belge'}
                    </p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5 break-all">
                      {formatDate(doc.created_at)} · {doc.chunk_count} parça
                      {doc.source_type === 'pdf' && ' · PDF'}
                      {doc.source_url && (
                        <>
                          {' · '}
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--text-muted)] underline-offset-2 hover:underline"
                          >
                            {doc.source_url.replace(/^https?:\/\//, '')}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openDeleteDialog({ kind: 'document', id: doc.upload_id, name: doc.source_name ?? 'Adsız belge' })
                  }
                  className={`${ICON_BTN_DANGER_CLASS} shrink-0`}
                  aria-label="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2 break-words line-clamp-2">
                {doc.preview}
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
      <DocumentFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={uploadDocument} />
      <SiteImportDialog open={siteFormOpen} onOpenChange={setSiteFormOpen} onSubmit={sites.startImport} />
      <DocumentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        target={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
