import { assertEquals } from 'jsr:@std/assert@1'
import { sourcesForAnswer, type DocumentChunk } from './retrieval.ts'

const chunk = (source_name: string | null): DocumentChunk => ({
  id: crypto.randomUUID(), content: '', source_name, chunk_index: 0, similarity: 0.5,
})
const NO_MATCH = 'Bu soruya henüz cevap veremiyorum, ekibimize iletiyorum.'

Deno.test('unique sources in relevance order, unnamed ones labelled', () => {
  assertEquals(
    sourcesForAnswer([chunk('menu.txt'), chunk(null), chunk('menu.txt')], 'Latte 110 TL.', NO_MATCH),
    ['menu.txt', 'Adsız belge'],
  )
})

Deno.test('no sources when the bot gave its no-match answer', () => {
  assertEquals(sourcesForAnswer([chunk('kampanya.txt')], `${NO_MATCH}\n\nBizi arayabilirsiniz.`, NO_MATCH), [])
})

Deno.test('no chunks, no sources', () => {
  assertEquals(sourcesForAnswer([], 'Merhaba!', NO_MATCH), [])
})
