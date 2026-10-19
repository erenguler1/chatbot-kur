import { assert, assertEquals, assertFalse, assertStringIncludes } from 'jsr:@std/assert@1'
import { isExplicitYes, isValidEmail, kvkkSentence, normalizePhone, validateLead, type LeadContext } from './leads.ts'

const BUSINESS = 'Makas Kuaför'

const summary = (contact: string, name = 'Ayşe Yılmaz') =>
  `Özetliyorum: ${name}, ${contact}, not: fiyat teklifi. ${kvkkSentence(BUSINESS)} Onaylıyor musunuz?`

const ctx = (over: Partial<LeadContext> = {}): LeadContext => ({
  userMessages: ['Beni arayabilir misiniz?', 'Ben Ayşe Yılmaz, numaram 0532 123 45 67', 'Evet'],
  currentMessage: 'Evet',
  previousAssistant: summary('0532 123 45 67'),
  ...over,
})

const input = { name: 'Ayşe Yılmaz', phone: '0532 123 45 67', note: 'fiyat teklifi' }

Deno.test('phone formats', () => {
  assertEquals(normalizePhone('0532 123 45 67'), '+905321234567')
  assertEquals(normalizePhone('+90 (212) 555-12-12'), '+902125551212')
  assertEquals(normalizePhone('5321234567'), '+905321234567')
  assertEquals(normalizePhone('905321234567'), '+905321234567')
  assertEquals(normalizePhone('0850 222 33 44'), '+908502223344')
  assertEquals(normalizePhone('+49 30 1234567'), '+49301234567')
  assertEquals(normalizePhone('0123 456 78 90'), null) // no such area code
  assertEquals(normalizePhone('532 123'), null)
  assertEquals(normalizePhone('beni ara 0532'), null)
  assertEquals(normalizePhone('4111 1111 1111 1111'), null)
})

Deno.test('email format', () => {
  assert(isValidEmail('ayse@ornek.com'))
  assert(isValidEmail('a.y+iş@örnek.com.tr'))
  assertFalse(isValidEmail('ayse@ornek'))
  assertFalse(isValidEmail('ayse ornek.com'))
  assertFalse(isValidEmail('a@b.c'))
})

Deno.test('explicit yes', () => {
  for (const m of ['Evet', 'evet, onaylıyorum', 'Tamam gönderebilirsin', 'OLUR', 'Onay', 'evet başka notum yok']) {
    assert(isExplicitYes(m), m)
  }
  for (const m of ['Hayır', 'evet ama numara yanlış', 'Vazgeçtim', 'bilmiyorum', 'saat kaçta açıksınız', 'dur bir dakika']) {
    assertFalse(isExplicitYes(m), m)
  }
})

Deno.test('valid confirmed request passes and is normalized', () => {
  const r = validateLead(input, ctx(), BUSINESS)
  assert(r.ok)
  assertEquals(r.lead, { name: 'Ayşe Yılmaz', phone: '+905321234567', email: null, note: 'fiyat teklifi' })
})

Deno.test('email-only request, name typed without Turkish letters', () => {
  const r = validateLead(
    { name: 'Ayşe', email: 'Ayse@Ornek.com' },
    ctx({ userMessages: ['ayse burada, ayse@ornek.com', 'evet'], previousAssistant: summary('ayse@ornek.com', 'Ayşe') }),
    BUSINESS,
  )
  assert(r.ok)
})

Deno.test('contact that only appears in a document is rejected', () => {
  // A planted instruction in documents makes the model use a number the
  // customer never typed.
  const r = validateLead(
    { name: 'Ayşe Yılmaz', phone: '0555 999 88 77' },
    ctx({ previousAssistant: summary('0555 999 88 77') }),
    BUSINESS,
  )
  assertFalse(r.ok)
  if (!r.ok) assertStringIncludes(r.reason, 'müşterinin mesajlarında yok')
})

Deno.test('name the customer never wrote is rejected', () => {
  assertFalse(validateLead({ ...input, name: 'Mehmet Demir' }, ctx({ previousAssistant: summary('0532 123 45 67', 'Mehmet Demir') }), BUSINESS).ok)
})

Deno.test('no summary / no KVKK sentence → not saved', () => {
  const noKvkk = validateLead(input, ctx({ previousAssistant: 'Ayşe Yılmaz, 0532 123 45 67. Onaylıyor musunuz?' }), BUSINESS)
  assertFalse(noKvkk.ok)
  if (!noKvkk.ok) assertStringIncludes(noKvkk.reason, kvkkSentence(BUSINESS))
  assertFalse(validateLead(input, ctx({ previousAssistant: null }), BUSINESS).ok)
  // Summary showed a different number than the one being saved.
  assertFalse(validateLead(input, ctx({ previousAssistant: summary('0533 000 00 00') }), BUSINESS).ok)
})

Deno.test('without an explicit yes → not saved', () => {
  for (const m of ['Hayır', 'Ben Ayşe Yılmaz, 0532 123 45 67', 'emin değilim']) {
    const r = validateLead(input, ctx({ currentMessage: m }), BUSINESS)
    assertFalse(r.ok, m)
    if (!r.ok) assertStringIncludes(r.reason, 'onay')
  }
})

Deno.test('format errors and missing fields', () => {
  assertFalse(validateLead({ name: 'Ayşe' }, ctx(), BUSINESS).ok)
  assertFalse(validateLead({ phone: '05321234567' }, ctx(), BUSINESS).ok)
  assertFalse(validateLead({ name: 'Ayşe', phone: '123' }, ctx(), BUSINESS).ok)
  assertFalse(validateLead({ name: 'Ayşe', email: 'ayse@' }, ctx(), BUSINESS).ok)
  assertFalse(validateLead(null, ctx(), BUSINESS).ok)
  assertFalse(validateLead('Ayşe 0532', ctx(), BUSINESS).ok)
})
