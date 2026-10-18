import { assertEquals } from 'jsr:@std/assert@1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js'
import { isNoMatchAnswer, maskPersonalData, recordUnanswered } from './unanswered.ts'

Deno.test('maskPersonalData masks phones, e-mails, ID, IBAN and card numbers', () => {
  const cases: [string, string][] = [
    ['Beni 0532 123 45 67 numaradan arar mısınız?', 'Beni [telefon] numaradan arar mısınız?'],
    ['+90 (212) 555-12-12 bu numara doğru mu', '[telefon] bu numara doğru mu'],
    ['5321234567 whatsapp var mı', '[telefon] whatsapp var mı'],
    ['ayse.yilmaz@gmail.com adresine fatura atın', '[e-posta] adresine fatura atın'],
    ['TC kimlik 12345678901 ile rezervasyon', 'TC kimlik [kimlik no] ile rezervasyon'],
    ['IBAN TR33 0006 1005 1978 6457 8413 26 doğru mu?', 'IBAN [IBAN] doğru mu?'],
    ['kartım 4111 1111 1111 1111 çekmedi', 'kartım [kart no] çekmedi'],
  ]
  for (const [input, expected] of cases) assertEquals(maskPersonalData(input), expected)
})

Deno.test('maskPersonalData leaves prices, hours and dates alone', () => {
  for (const s of [
    'Latte 110 TL mi?',
    'Pazar 10:00-22:00 açık mısınız?',
    '2.000 TL üzeri kargo bedava mı',
    '25.12.2026 tarihinde açık mısınız',
    '3 kişilik masa var mı',
  ]) {
    assertEquals(maskPersonalData(s), s)
  }
})

Deno.test('isNoMatchAnswer finds the no-match message, ignores an empty one', () => {
  const msg = 'Bu soruya henüz cevap veremiyorum, ekibimize iletiyorum.'
  assertEquals(isNoMatchAnswer(`Maalesef bilgim yok. ${msg} 😊`, msg), true)
  assertEquals(isNoMatchAnswer('Latte 110 TL.', msg), false)
  assertEquals(isNoMatchAnswer('Latte 110 TL.', '  '), false)
})

Deno.test('isNoMatchAnswer catches a reworded no-match message, not normal answers', () => {
  const msg = 'Bu soruya henüz cevap veremiyorum, ekibimize iletiyorum.'
  // Seen live: the model paraphrased the message.
  assertEquals(
    isNoMatchAnswer('Merhaba! Köpek dostu olup olmadığımız konusunda henüz net bir bilgim yok maalesef. Bu soruyu ekibimize iletiyorum.', msg),
    true,
  )
  assertEquals(isNoMatchAnswer('Rezervasyon talebinizi hemen ekibimize iletiyorum, 08:00-22:00 açığız.', msg), false)
  assertEquals(isNoMatchAnswer('Her gün 08:00-22:00 arası açığız, bekleriz!', msg), false)
})

// Captures what would be embedded and what would be stored.
function fakes() {
  const embedded: string[] = []
  const saved: Record<string, unknown>[] = []
  const embed = (texts: string[]) => {
    embedded.push(...texts)
    return Promise.resolve(texts.map(() => [0.5]))
  }
  const client = {
    rpc: (_fn: string, args: Record<string, unknown>) => {
      saved.push(args)
      return Promise.resolve({ error: null })
    },
  } as unknown as SupabaseClient
  return { embedded, saved, embed, client }
}

Deno.test('recordUnanswered embeds the masked text, never the raw question', async () => {
  const f = fakes()
  const raw = 'Köpeğimle gelebilir miyim? Beni 0532 111 22 33\'ten arayın'
  // The retrieval embedding of the raw text must not be reused here.
  await recordUnanswered(f.client, 'bot', raw, [9, 9, 9], f.embed)
  assertEquals(f.embedded, ["Köpeğimle gelebilir miyim? Beni [telefon]'ten arayın"])
  assertEquals(f.saved[0].p_question, "Köpeğimle gelebilir miyim? Beni [telefon]'ten arayın")
  assertEquals(f.saved[0].p_embedding, [0.5])
})

Deno.test('recordUnanswered reuses the retrieval embedding only when nothing was masked', async () => {
  const f = fakes()
  await recordUnanswered(f.client, 'bot', '  Otopark var mı? ', [9, 9, 9], f.embed)
  assertEquals(f.embedded, [])
  assertEquals(f.saved[0].p_embedding, [9, 9, 9])
})

Deno.test('recordUnanswered still saves the question if embedding fails', async () => {
  const f = fakes()
  await recordUnanswered(f.client, 'bot', 'Otopark var mı?', undefined, () => Promise.reject(new Error('429')))
  assertEquals(f.saved[0], { p_bot_id: 'bot', p_question: 'Otopark var mı?', p_embedding: null })
})
