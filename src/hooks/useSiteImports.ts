import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { functionErrorMessage } from '../lib/functionError'
import type { SiteImport } from '../types/document'

interface UseSiteImportsResult {
  imports: SiteImport[]
  // Per import: message of a stopped run ('' = none), and whether the run is
  // pausing (Voyage rate limit or the site's robots.txt Crawl-delay).
  stepErrors: Record<string, string>
  waiting: Record<string, boolean>
  startImport: (url: string) => Promise<void>
  rescan: (importId: string) => Promise<void>
  resume: (importId: string) => void
  removeImport: (importId: string) => Promise<void>
}

interface StepResponse {
  import: SiteImport
  retry_after?: number
}

const COLUMNS =
  'id, bot_id, root_url, status, page_urls, pages_ok, pages_empty, pages_failed, error, created_at, updated_at'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Site imports run in small steps (import-site Edge Function); this hook
// drives them while the Belgeler tab is open and resumes unfinished ones when
// it opens again. onPagesChanged refreshes the document list as pages land.
export function useSiteImports(botId: string, onPagesChanged: () => Promise<void>): UseSiteImportsResult {
  const [imports, setImports] = useState<SiteImport[]>([])
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [waiting, setWaiting] = useState<Record<string, boolean>>({})
  const driving = useRef(new Set<string>())
  const mounted = useRef(true)
  const onPagesChangedRef = useRef(onPagesChanged)

  useEffect(() => {
    onPagesChangedRef.current = onPagesChanged
  }, [onPagesChanged])

  const upsert = useCallback((row: SiteImport) => {
    setImports((prev) => {
      const i = prev.findIndex((p) => p.id === row.id)
      if (i === -1) return [row, ...prev]
      const next = [...prev]
      next[i] = row
      return next
    })
  }, [])

  const drive = useCallback(
    async (importId: string) => {
      if (driving.current.has(importId)) return
      driving.current.add(importId)
      setStepErrors((e) => ({ ...e, [importId]: '' }))
      try {
        let lastOk = -1
        while (mounted.current) {
          const { data, error } = await supabase.functions.invoke<StepResponse>('import-site', {
            body: { action: 'step', import_id: importId },
          })
          if (!mounted.current) return
          if (error || !data) {
            const message = await functionErrorMessage(error, 'Tarama durdu. Lütfen tekrar deneyin.')
            setStepErrors((e) => ({ ...e, [importId]: message }))
            return
          }
          upsert(data.import)
          if (data.import.pages_ok !== lastOk) {
            lastOk = data.import.pages_ok
            void onPagesChangedRef.current()
          }
          if (data.import.status !== 'running') return
          if (data.retry_after) {
            setWaiting((w) => ({ ...w, [importId]: true }))
            await sleep(data.retry_after * 1000)
            setWaiting((w) => ({ ...w, [importId]: false }))
          }
        }
      } finally {
        driving.current.delete(importId)
      }
    },
    [upsert],
  )

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void supabase
      .from('site_imports')
      .select(COLUMNS)
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return
        const rows = data as SiteImport[]
        setImports(rows)
        for (const row of rows) if (row.status === 'running') void drive(row.id)
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [botId, drive])

  const startImport = useCallback(
    async (url: string) => {
      const { data, error } = await supabase.functions.invoke<StepResponse>('import-site', {
        body: { action: 'start', bot_id: botId, url },
      })
      if (error || !data) {
        throw new Error(await functionErrorMessage(error, 'Site eklenemedi. Lütfen tekrar deneyin.'))
      }
      upsert(data.import)
      void drive(data.import.id)
    },
    [botId, drive, upsert],
  )

  const rescan = useCallback(
    async (importId: string) => {
      const { data, error } = await supabase.functions.invoke<StepResponse>('import-site', {
        body: { action: 'rescan', import_id: importId },
      })
      if (error || !data) {
        throw new Error(await functionErrorMessage(error, 'Site yeniden taranamadı. Lütfen tekrar deneyin.'))
      }
      upsert(data.import)
      void drive(importId)
    },
    [drive, upsert],
  )

  const resume = useCallback((importId: string) => void drive(importId), [drive])

  const removeImport = useCallback(
    async (importId: string) => {
      // A trigger soft-deletes the site's pages and their chunks (019).
      const { error } = await supabase
        .from('site_imports')
        .update({ deleted_at: new Date().toISOString() })
        .eq('bot_id', botId)
        .eq('id', importId)
      if (error) throw new Error('Site kaldırılamadı. Lütfen tekrar deneyin.')
      setImports((prev) => prev.filter((p) => p.id !== importId))
      await onPagesChangedRef.current()
    },
    [botId],
  )

  return { imports, stepErrors, waiting, startImport, rescan, resume, removeImport }
}
