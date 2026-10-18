import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupQuestions, type QuestionGroup, type UnansweredQuestion } from '../lib/questionGroups'

interface UseUnansweredQuestionsResult {
  groups: QuestionGroup[]
  isLoading: boolean
  error: boolean
  // Soft-deletes a group's questions: answered as Q&A, or ignored.
  resolve: (group: QuestionGroup) => Promise<void>
}

const RETENTION_DAYS = 90 // pg_cron purges older rows nightly (migration 020)
const ID_BATCH = 100 // ids go in the query string

async function fetchQuestions(botId: string) {
  const since = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
  return supabase
    .from('unanswered_questions')
    .select('id, question, created_at')
    .eq('bot_id', botId)
    .is('deleted_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000)
}

export function useUnansweredQuestions(botId: string): UseUnansweredQuestionsResult {
  const [rows, setRows] = useState<UnansweredQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchQuestions(botId).then(({ data, error: queryError }) => {
      if (cancelled) return
      setError(!!queryError)
      setRows((data ?? []) as UnansweredQuestion[])
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [botId])

  const groups = useMemo(() => groupQuestions(rows), [rows])

  const resolve = useCallback(
    async (group: QuestionGroup) => {
      const now = new Date().toISOString()
      for (let i = 0; i < group.ids.length; i += ID_BATCH) {
        const { error: updateError } = await supabase
          .from('unanswered_questions')
          .update({ deleted_at: now })
          .eq('bot_id', botId)
          .in('id', group.ids.slice(i, i + ID_BATCH))
        if (updateError) throw new Error('İşlem kaydedilemedi. Lütfen tekrar deneyin.')
      }
      const done = new Set(group.ids)
      setRows((prev) => prev.filter((r) => !done.has(r.id)))
    },
    [botId],
  )

  return { groups, isLoading, error, resolve }
}
