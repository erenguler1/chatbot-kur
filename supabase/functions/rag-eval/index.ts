// Edge Function: rag-eval (TEMPORARY - deploy only while calibrating, then
// `supabase functions delete rag-eval`). Returns Voyage embeddings so
// scripts/rag-eval can compare chunking strategies and pick the threshold.
// Only the throwaway users from scripts/test-users.sh may call it.

import { createClient } from 'npm:@supabase/supabase-js'
import { getEmbeddings } from '../_shared/voyage.ts'

const TEST_USER = /^test-rag-[a-z]+@chatbotkur\.test$/
const MAX_TEXTS = 500

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !TEST_USER.test(user.email)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { texts, input_type } = await req.json()
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS ||
      !texts.every((t) => typeof t === 'string') || !['document', 'query'].includes(input_type)) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }

  try {
    return Response.json({ embeddings: await getEmbeddings(texts, input_type) })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 })
  }
})
