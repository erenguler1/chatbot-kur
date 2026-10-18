/// <reference lib="deno.ns" />
// deno test src/lib/questionGroups_test.ts  (excluded from the app build)
import { assertEquals } from 'jsr:@std/assert@1'
import { groupQuestions, similarity, tokens } from './questionGroups.ts'

let n = 0
const q = (question: string) => ({ id: `q${++n}`, question, created_at: `2026-10-18T10:${String(n).padStart(2, '0')}:00Z` })

Deno.test('tokens fold Turkish letters and drop particles / masked data', () => {
  assertEquals(tokens('Pazar günü açık mısınız?'), ['pazar', 'gunu', 'acik'])
  assertEquals(tokens('[telefon] numaradan arar mısınız'), ['numaradan', 'arar'])
})

Deno.test('similar wordings group together, different topics do not', () => {
  assertEquals(similarity(tokens('Pazar açık mısınız?'), tokens('pazar gunu acik mi')) >= 0.6, true)
  assertEquals(similarity(tokens('Pazar açık mısınız?'), tokens('Pazartesi açık mısınız?')) < 0.6, true)
  assertEquals(similarity(tokens('Kahve fiyatı ne kadar'), tokens('Kahvaltı fiyatı ne kadar')) < 0.6, true)
})

Deno.test('groupQuestions counts groups and puts the most asked first', () => {
  const rows = [
    q('Otopark var mı?'),
    q('Pazar açık mısınız?'),
    q('pazar günü açık mı'),
    q('Pazar açık mısınız?'),
    q('Pazartesi açık mısınız?'),
    q('Otoparkınız var mı'),
    q('Köpek kabul ediyor musunuz?'),
  ]
  const groups = groupQuestions(rows)
  assertEquals(groups.map((g) => [g.label, g.count]), [
    ['Pazar açık mısınız?', 3],
    ['Otoparkınız var mı', 2],
    ['Köpek kabul ediyor musunuz?', 1],
    ['Pazartesi açık mısınız?', 1],
  ])
  assertEquals(groups[0].ids.sort(), ['q2', 'q3', 'q4'])
})
