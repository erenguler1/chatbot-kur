import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'
import { buildSystemPrompt } from '../_shared/prompt.ts'
import { retrieveDocuments, sourceNames } from '../_shared/retrieval.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_WINDOW_MINUTES = 5
const RATE_LIMIT_MAX_MESSAGES = 30

interface PublicChatRequestBody {
  botId?: unknown
  sessionId?: unknown
  userMessage?: unknown
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationRow {
  id: string
  title: string
  updated_at: string
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
      return jsonResponse({ error: 'Sunucu yapılandırması eksik' }, 500)
    }

    let body: PublicChatRequestBody
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ error: 'Geçersiz istek gövdesi' }, 400)
    }

    const { botId, sessionId, userMessage } = body

    if (
      typeof botId !== 'string' ||
      typeof sessionId !== 'string' ||
      typeof userMessage !== 'string'
    ) {
      return jsonResponse(
        { error: 'botId, sessionId ve userMessage gerekli' },
        400,
      )
    }

    if (sessionId.length < 8) {
      return jsonResponse({ error: 'Geçersiz session' }, 400)
    }

    const trimmedMessage = userMessage.trim()
    if (trimmedMessage.length === 0) {
      return jsonResponse({ error: 'Mesaj boş olamaz' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .is('deleted_at', null)
      .maybeSingle()

    if (botError || !bot) {
      return jsonResponse({ error: 'Bot bulunamadı' }, 404)
    }

    if (bot.status !== 'active') {
      return jsonResponse({ error: 'Bu bot şu anda erişime kapalı' }, 403)
    }

    const { data: qaPairs, error: qaError } = await supabase
      .from('qa_pairs')
      .select('*')
      .eq('bot_id', botId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (qaError) {
      return jsonResponse({ error: 'Bilgi tabanı yüklenemedi' }, 500)
    }

    const rateLimitSince = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    ).toISOString()

    const { count: recentMessageCount, error: rateLimitError } = await supabase
      .from('messages')
      .select('id, conversations!inner(session_id)', {
        count: 'exact',
        head: true,
      })
      .eq('conversations.session_id', sessionId)
      .eq('role', 'user')
      .gte('created_at', rateLimitSince)

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError)
    } else if ((recentMessageCount ?? 0) >= RATE_LIMIT_MAX_MESSAGES) {
      return jsonResponse(
        { error: 'Çok fazla mesaj gönderdin, biraz bekle' },
        429,
      )
    }

    // Started after the rate limit so throttled sessions don't spend embedding
    // calls; runs in parallel with the conversation queries and never rejects.
    const retrievalPromise = retrieveDocuments(supabase, botId, trimmedMessage)

    let conversation: ConversationRow | null = null
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('bot_id', botId)
      .eq('session_id', sessionId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      return jsonResponse({ error: 'Sohbet bulunamadı' }, 500)
    }

    if (existing) {
      conversation = existing as ConversationRow
    } else {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          bot_id: botId,
          session_id: sessionId,
          user_id: null,
          title: 'Yeni sohbet',
        })
        .select('id, title, updated_at')
        .single()

      if (createError || !newConv) {
        return jsonResponse({ error: 'Sohbet oluşturulamadı' }, 500)
      }
      conversation = newConv as ConversationRow
    }

    if (!conversation) {
      return jsonResponse({ error: 'Sohbet hazırlanamadı' }, 500)
    }

    const conversationId = conversation.id

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
    const sources = sourceNames(retrieval.chunks)
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

    const claudeMessages = [
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user' as const, content: trimmedMessage },
    ]

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const encoder = new TextEncoder()
    const sseEvent = (payload: Record<string, unknown>): Uint8Array =>
      encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = ''

        try {
          const claudeStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1024,
            system: systemPrompt,
            messages: claudeMessages,
          })

          for await (const event of claudeStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const text = event.delta.text
              assistantContent += text
              controller.enqueue(sseEvent({ type: 'chunk', text }))
            }
          }

          const finalMessage = await claudeStream.finalMessage()
          const inputTokens = finalMessage.usage.input_tokens
          const outputTokens = finalMessage.usage.output_tokens

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
      },
    })
  } catch (error) {
    console.error('public-chat error:', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Beklenmedik hata',
      },
      500,
    )
  }
})
