import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Lead, LeadStatus } from '../types/lead'

interface UseLeadsResult {
  leads: Lead[]
  isLoading: boolean
  error: boolean
  setStatus: (id: string, status: LeadStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

const RETENTION_DAYS = 180 // pg_cron purges older rows nightly (migration 022)

const since = () => new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()

// Contact requests the bot collected (Tool Use v0.1). `onChange` lets the
// tab badge recount after a status change or delete.
export function useLeads(botId: string, onChange: () => void): UseLeadsResult {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('leads')
      .select('id, bot_id, conversation_id, name, phone, email, note, status, created_at')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .gte('created_at', since())
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        setError(!!queryError)
        setLeads((data ?? []) as Lead[])
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [botId])

  const setStatus = useCallback(
    async (id: string, status: LeadStatus) => {
      const { error: updateError } = await supabase.from('leads').update({ status }).eq('id', id)
      if (updateError) throw new Error('Durum kaydedilemedi. Lütfen tekrar deneyin.')
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
      onChange()
    },
    [onChange],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (updateError) throw new Error('Talep silinemedi. Lütfen tekrar deneyin.')
      setLeads((prev) => prev.filter((l) => l.id !== id))
      onChange()
    },
    [onChange],
  )

  return { leads, isLoading, error, setStatus, remove }
}

// "Talepler" tab badge: requests nobody has handled yet.
export function useNewLeadCount(botId: string | undefined): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (!botId) return
    void supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('bot_id', botId)
      .eq('status', 'new')
      .is('deleted_at', null)
      .gte('created_at', since())
      .then(({ count: newCount }) => setCount(newCount ?? 0))
  }, [botId])

  useEffect(refresh, [refresh])

  return { count, refresh }
}
