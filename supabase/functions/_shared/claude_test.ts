import { assertEquals } from 'jsr:@std/assert@1'
import type Anthropic from 'npm:@anthropic-ai/sdk'
import { streamReply } from './claude.ts'

type Turn = { text: string; toolUse?: { name: string; input: unknown } }

// Fake client: each request streams one scripted turn and records its params.
function fakeClient(turns: Turn[]) {
  const requests: Record<string, unknown>[] = []
  const client = {
    messages: {
      stream(params: Record<string, unknown>) {
        requests.push(structuredClone(params))
        const turn = turns[requests.length - 1]
        const content: unknown[] = [{ type: 'text', text: turn.text }]
        if (turn.toolUse) content.push({ type: 'tool_use', id: `t${requests.length}`, ...turn.toolUse })
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: turn.text } }
          },
          finalMessage: () =>
            Promise.resolve({
              content,
              stop_reason: turn.toolUse ? 'tool_use' : 'end_turn',
              usage: { input_tokens: 10, output_tokens: 2 },
            }),
        }
      },
    },
  }
  return { client: client as unknown as Anthropic, requests }
}

const tool = { name: 'iletisim_talebi_olustur', input_schema: { type: 'object' as const } }

Deno.test('tool call result goes back to the model and the reply continues', async () => {
  const { client, requests } = fakeClient([
    { text: 'Kaydediyorum.', toolUse: { name: 'iletisim_talebi_olustur', input: { name: 'Ayşe' } } },
    { text: 'Talebiniz iletildi.' },
  ])
  const chunks: string[] = []
  const calls: unknown[] = []
  const r = await streamReply(client, 'sys', [{ role: 'user', content: 'evet' }], [tool], (t) => chunks.push(t), (_, input) => {
    calls.push(input)
    return Promise.resolve({ ok: true, message: 'Talep kaydedildi' })
  })
  assertEquals(calls, [{ name: 'Ayşe' }])
  assertEquals(r.text, 'Kaydediyorum.\n\nTalebiniz iletildi.')
  assertEquals(chunks.join(''), r.text)
  assertEquals([r.inputTokens, r.outputTokens], [20, 4])
  assertEquals(r.toolCalls, [{ name: 'iletisim_talebi_olustur', ok: true }])
  const second = requests[1].messages as Array<{ role: string; content: unknown }>
  assertEquals(second.at(-1), {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Talep kaydedildi', is_error: false }],
  })
})

Deno.test('a failed tool is reported as an error, and the last round cannot call tools', async () => {
  const use = { name: 'iletisim_talebi_olustur', input: {} }
  const { client, requests } = fakeClient([{ text: 'a', toolUse: use }, { text: 'b', toolUse: use }, { text: 'c' }])
  const r = await streamReply(client, 'sys', [{ role: 'user', content: 'x' }], [tool], () => {}, () =>
    Promise.resolve({ ok: false, message: 'Kaydedilmedi' }))
  assertEquals(r.toolCalls.map((c) => c.ok), [false, false])
  assertEquals(requests.length, 3)
  assertEquals(requests[2].tool_choice, { type: 'none' })
  assertEquals(requests[0].tool_choice, undefined)
})

Deno.test('no tools: single request without tool params', async () => {
  const { client, requests } = fakeClient([{ text: 'Merhaba' }])
  const r = await streamReply(client, 'sys', [{ role: 'user', content: 'selam' }], [], () => {}, () =>
    Promise.resolve({ ok: true, message: '' }))
  assertEquals(r.text, 'Merhaba')
  assertEquals('tools' in requests[0], false)
})
