// Streaming reply with tool use, shared by chat and public-chat. Text is
// streamed as it comes; when the model stops for a tool call, the tool runs
// on the server and the reply continues in a new request with its result.

import type Anthropic from 'npm:@anthropic-ai/sdk'
import type { ToolOutcome } from './leads.ts'

export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929' // Faz 1 lock
const MAX_TOKENS = 1024
// Tool rounds per reply; the last request may not call tools, so the reply
// always ends in text.
const MAX_TOOL_ROUNDS = 2

export interface ReplyResult {
  text: string
  inputTokens: number
  outputTokens: number
  toolCalls: Array<{ name: string; ok: boolean }>
}

export async function streamReply(
  anthropic: Anthropic,
  system: string,
  history: Anthropic.MessageParam[],
  tools: Anthropic.Tool[],
  onText: (text: string) => void,
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>,
): Promise<ReplyResult> {
  const messages = [...history]
  const result: ReplyResult = { text: '', inputTokens: 0, outputTokens: 0, toolCalls: [] }

  for (let round = 0; ; round++) {
    const lastRound = round === MAX_TOOL_ROUNDS
    const stream = anthropic.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      ...(tools.length > 0 ? { tools, ...(lastRound ? { tool_choice: { type: 'none' as const } } : {}) } : {}),
    })

    // Text before a tool call and after it are two paragraphs of one reply.
    let separator = result.text ? '\n\n' : ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = separator + event.delta.text
        separator = ''
        result.text += text
        onText(text)
      }
    }

    const final = await stream.finalMessage()
    result.inputTokens += final.usage.input_tokens
    result.outputTokens += final.usage.output_tokens
    if (final.stop_reason !== 'tool_use' || lastRound) return result

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue
      const outcome = await runTool(block.name, block.input)
      result.toolCalls.push({ name: block.name, ok: outcome.ok })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: outcome.message,
        is_error: !outcome.ok,
      })
    }
    messages.push({ role: 'assistant', content: final.content }, { role: 'user', content: toolResults })
  }
}
