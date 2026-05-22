import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { botId, sessionId } = await req.json()

    if (!botId || !sessionId) {
      return jsonResponse({ error: 'botId ve sessionId gerekli' }, 400)
    }
    if (typeof sessionId !== 'string' || sessionId.length < 8) {
      return jsonResponse({ error: 'Geçersiz session' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('bot_id', botId)
      .eq('session_id', sessionId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (convError) {
      return jsonResponse({ error: 'Sohbet aranamadı' }, 500)
    }

    if (!conversation) {
      return jsonResponse({ messages: [] }, 200)
    }

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })

    if (msgError) {
      return jsonResponse({ error: 'Mesajlar yüklenemedi' }, 500)
    }

    return jsonResponse({ messages: messages || [] }, 200)
  } catch (error) {
    console.error('public-get-messages error:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Beklenmedik hata' },
      500
    )
  }
})
