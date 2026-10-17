import { assert, assertEquals } from 'jsr:@std/assert@1'
import { fixedChunks, isHeading, sectionChunks } from './chunking.ts'

const nWords = (s: string) => s.split(/\s+/).filter(Boolean).length

Deno.test('fixedChunks keeps v0.1 behaviour: 900 words -> 400/400/200 with 50 overlap', () => {
  const text = Array.from({ length: 900 }, (_, i) => `w${i}`).join(' ')
  const c = fixedChunks(text, 400, 50)
  assertEquals(c.map((x) => nWords(x.content)), [400, 400, 200])
  assert(c[1].content.startsWith('w350 '))
})

Deno.test('isHeading', () => {
  for (const h of ['TATLILAR', 'İade Koşulları:', '## Erkek', '1. İade Süresi', 'Çalışma Saatleri']) assert(isHeading(h), h)
  for (const n of ['Latte 110 TL', '- Fön: 250 TL', 'Pazartesi günleri kapalıyız.', 'Bu çok uzun bir satır olup başlık olamayacak kadar fazla kelime içeriyor', '']) assert(!isHeading(n), n)
})

Deno.test('sections: heading + document title prefix every chunk', () => {
  const c = sectionChunks('Makas Kuaför\n\n## Erkek\n- Saç kesimi: 300 TL\n\n## Ödeme\nNakit ve kart geçerlidir.', 80)
  assertEquals(c.map((x) => x.content), [
    'Makas Kuaför › Erkek\n- Saç kesimi: 300 TL',
    'Makas Kuaför › Ödeme\nNakit ve kart geçerlidir.',
  ])
})

Deno.test('unformatted paragraph is split on sentences, never inside "6.000"', () => {
  const text = 'Gelin paketi 6.000 TL. ' + 'Bu cümle on kelimelik bir dolgu cümlesidir ve tekrar eder. '.repeat(6)
  const c = sectionChunks(text, 25)
  assert(c.length > 1)
  assert(c[0].content.startsWith('Gelin paketi 6.000 TL.'))
  for (const x of c) assert(nWords(x.content) <= 25, x.content)
})

Deno.test('a sentence longer than maxWords is cut by word window', () => {
  const long = Array.from({ length: 70 }, (_, i) => `k${i}`).join(' ') + '.'
  assertEquals(sectionChunks(long, 30).map((x) => nWords(x.content)), [30, 30, 10])
})

Deno.test('empty / whitespace input gives no chunks', () => {
  assertEquals(sectionChunks('  \n\n  ', 40), [])
  assertEquals(fixedChunks('', 400, 50), [])
})
