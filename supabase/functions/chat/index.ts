import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'
import { buildSystemPrompt } from './_prompt.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ChatRequestBody {
  botId?: unknown
  conversationId?: unknown
  userMessage?: unknown
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Yetkilendirme gerekli' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !anthropicKey) {
      return jsonResponse({ error: 'Sunucu yapılandırması eksik' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Geçersiz kullanıcı' }, 401)
    }

    let body: ChatRequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Geçersiz istek gövdesi' }, 400)
    }

    const { botId, conversationId, userMessage } = body
    if (
      typeof botId !== 'string' ||
      typeof conversationId !== 'string' ||
      typeof userMessage !== 'string'
    ) {
      return jsonResponse(
        { error: 'botId, conversationId ve userMessage gerekli' },
        400,
      )
    }

    const trimmedMessage = userMessage.trim()
    if (trimmedMessage.length === 0) {
      return jsonResponse({ error: 'Mesaj boş olamaz' }, 400)
    }

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .is('deleted_at', null)
      .maybeSingle()

    if (botError || !bot) {
      return jsonResponse({ error: 'Bot bulunamadı veya erişim yok' }, 404)
    }

    const { data: qaPairs, error: qaError } = await supabase
      .from('qa_pairs')
      .select('*')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (qaError) {
      return jsonResponse({ error: 'Sorular yüklenemedi' }, 500)
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .is('deleted_at', null)
      .maybeSingle()

    if (convError || !conversation) {
      return jsonResponse({ error: 'Sohbet bulunamadı' }, 404)
    }

    const { data: previousMessages, error: histError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (histError) {
      return jsonResponse({ error: 'Geçmiş yüklenemedi' }, 500)
    }

    const history: HistoryMessage[] = ((previousMessages ?? []) as HistoryMessage[])
      .slice()
      .reverse()

    const systemPrompt = buildSystemPrompt(bot, qaPairs ?? [])

    const { error: userMsgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: trimmedMessage,
    })

    if (userMsgError) {
      return jsonResponse({ error: 'Mesaj kaydedilemedi' }, 500)
    }

    if (conversation.title === 'Yeni sohbet' && history.length === 0) {
      const title = trimmedMessage.slice(0, 60)
      await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId)
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const claudeMessages = [
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: trimmedMessage },
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    })

    const assistantContent = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')

    if (!assistantContent) {
      return jsonResponse({ error: 'Bot cevap üretmedi' }, 500)
    }

    const { error: assistantMsgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantContent,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    if (assistantMsgError) {
      return jsonResponse({ error: 'Cevap kaydedilemedi' }, 500)
    }

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    return jsonResponse(
      {
        message: {
          role: 'assistant',
          content: assistantContent,
        },
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      },
      200,
    )
  } catch (error) {
    console.error('Edge Function error:', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Beklenmedik hata',
      },
      500,
    )
  }
})
