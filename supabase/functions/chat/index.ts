import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'
import { buildSystemPrompt } from '../_shared/prompt.ts'
import { retrieveDocuments, serverTiming, sourcesForAnswer } from '../_shared/retrieval.ts'
import { isNoMatchAnswer, recordUnanswered } from '../_shared/unanswered.ts'
import { streamReply } from '../_shared/claude.ts'
import { createLead, LEAD_TOOL, LEAD_TOOL_NAME, type LeadContext } from '../_shared/leads.ts'

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

    // Runs in parallel with the queries below; never rejects.
    const retrievalPromise = retrieveDocuments(supabase, botId, trimmedMessage)

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

    const retrieval = await retrievalPromise
    const systemPrompt = buildSystemPrompt(bot, qaPairs ?? [], retrieval)

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

    // What the lead tool may use (_shared/leads.ts): only the customer's own
    // messages, and the bot's last message must be the confirmation summary.
    const lastMessage = history.at(-1)
    const leadContext: LeadContext = {
      userMessages: [
        ...history.filter((m) => m.role === 'user').map((m) => m.content),
        trimmedMessage,
      ],
      currentMessage: trimmedMessage,
      previousAssistant: lastMessage?.role === 'assistant' ? lastMessage.content : null,
    }

    const encoder = new TextEncoder()
    const sseEvent = (payload: Record<string, unknown>): Uint8Array =>
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = ''

        try {
          const reply = await streamReply(
            anthropic,
            systemPrompt,
            claudeMessages,
            bot.lead_capture_enabled ? [LEAD_TOOL] : [],
            (text) => controller.enqueue(sseEvent({ type: 'chunk', text })),
            (name, input) =>
              name === LEAD_TOOL_NAME
                ? createLead(supabase, botId, conversationId, input, leadContext, bot.name)
                : Promise.resolve({ ok: false, message: 'Bilinmeyen araç' }),
          )
          assistantContent = reply.text
          const sources = sourcesForAnswer(
            retrieval.chunks,
            assistantContent,
            bot.no_match_message,
          )
          const inputTokens = reply.inputTokens
          const outputTokens = reply.outputTokens

          if (!assistantContent) {
            controller.enqueue(
              sseEvent({ type: 'error', message: 'Bot cevap üretmedi' }),
            )
            return
          }

          const { error: insertError } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantContent,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            sources: sources.length > 0 ? sources : null,
          })

          if (insertError) {
            controller.enqueue(
              sseEvent({ type: 'error', message: 'Cevap kaydedilemedi' }),
            )
            return
          }

          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)

          // Question text only, masked; never blocks the reply on failure.
          if (isNoMatchAnswer(assistantContent, bot.no_match_message)) {
            await recordUnanswered(supabase, botId, trimmedMessage, retrieval.queryEmbedding)
          }

          controller.enqueue(
            sseEvent({
              type: 'done',
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              sources,
            }),
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Bilinmeyen hata'
          controller.enqueue(sseEvent({ type: 'error', message }))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Server-Timing': serverTiming(retrieval),
      },
    })
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
