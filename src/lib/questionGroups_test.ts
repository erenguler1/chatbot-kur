/// <reference lib="deno.ns" />
// deno test src/lib/questionGroups_test.ts  (excluded from the app build)
import { assertEquals } from 'jsr:@std/assert@1'
import { groupQuestions } from './questionGroups.ts'

let n = 0
const q = (question: string, group_id: string) => ({
  id: `q${++n}`,
  question,
  group_id,
  created_at: `2026-10-18T10:${String(n).padStart(2, '0')}:00Z`,
})

Deno.test('groupQuestions counts groups, most asked first, most frequent wording as label', () => {
  const groups = groupQuestions([
    q('Otopark var mı?', 'park'),
    q('Pazar açık mısınız?', 'pazar'),
    q('pazar günü açık mı', 'pazar'),
    q('Pazar açık mısınız?', 'pazar'),
    q('Otoparkınız var mı', 'park'),
    q('Köpek kabul ediyor musunuz?', 'kopek'),
  ])
  assertEquals(groups.map((g) => [g.label, g.count]), [
    ['Pazar açık mısınız?', 3],
    ['Otoparkınız var mı', 2],
    ['Köpek kabul ediyor musunuz?', 1],
  ])
  assertEquals(groups[0].ids.sort(), ['q2', 'q3', 'q4'])
  assertEquals(groups[0].lastAskedAt, '2026-10-18T10:04:00Z')
})
