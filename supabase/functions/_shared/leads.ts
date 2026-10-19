// Contact requests (Tool Use v0.1): the bot collects name + phone or e-mail +
// a short note, shows a summary with the KVKK sentence, and calls
// `iletisim_talebi_olustur` once the customer confirms. The model is never
// trusted on its own: the server accepts the call only when
//   1. the name and contact appear in the customer's own messages (not in
//      documents or Q&A, so injected text can't plant a lead),
//   2. the bot's previous message showed that contact and the KVKK sentence,
//   3. the customer's current message is an explicit yes,
// and at most MAX_LEADS_PER_CONVERSATION per conversation (spam).
// Retention (180 days) is a pg_cron job (migration 022).

import type { SupabaseClient } from 'npm:@supabase/supabase-js'

export const LEAD_TOOL_NAME = 'iletisim_talebi_olustur'
export const MAX_LEADS_PER_CONVERSATION = 3
const MAX_NOTE_CHARS = 500
const MAX_NAME_CHARS = 100

export const LEAD_TOOL = {
  name: LEAD_TOOL_NAME,
  description:
    'Müşterinin iletişim talebini (geri arama, teklif, bilgi) işletmeye iletir. YALNIZCA müşteri, özetlenen bilgileri ve aydınlatma cümlesini gördükten sonra açıkça onay verdiyse çağır. Ad, telefon ve e-posta müşterinin kendi mesajlarında yazdığı şekliyle olmalı.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Müşterinin adı (müşterinin yazdığı şekliyle)' },
      phone: { type: 'string', description: 'Müşterinin telefon numarası (yoksa boş bırak)' },
      email: { type: 'string', description: 'Müşterinin e-posta adresi (yoksa boş bırak)' },
      note: { type: 'string', description: 'Müşterinin ne istediğine dair kısa not' },
    },
    required: ['name'],
  },
}

export function kvkkSentence(businessName: string): string {
  return `Bilgileriniz yalnızca ${businessName} tarafından sizinle iletişim için kullanılacak.`
}
// Matched in the bot's summary message; the business name part may vary.
const KVKK_CORE = 'sizinle iletisim icin kullanilacak'

// Lower-case, Turkish letters folded to ASCII, so "Ayşe" ~ "ayse".
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFD').replace(/\p{M}/gu, '')
}

// Returns "+905321234567"-style numbers, or null. Turkish numbers (mobile,
// landline, 850) with or without 0 / +90; other countries only with "+".
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!/^[+\d][\d\s().-]*$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  let national: string
  if (trimmed.startsWith('+') && !digits.startsWith('90')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  } else if (digits.length === 12 && digits.startsWith('90')) {
    national = digits.slice(2)
  } else if (digits.length === 11 && digits.startsWith('0')) {
    national = digits.slice(1)
  } else if (digits.length === 10) {
    national = digits
  } else {
    return null
  }
  return /^[2-58]\d{9}$/.test(national) ? `+90${national}` : null
}

const EMAIL = /^[^\s@<>()"',;]{1,64}@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}$/u

export function isValidEmail(raw: string): boolean {
  return raw.length <= 254 && EMAIL.test(raw)
}

// Digits of the number as people type them (last 10 for Turkish numbers,
// so "0532..." and "+90 532..." both match).
function phoneKey(normalized: string): string {
  const digits = normalized.replace(/\D/g, '')
  return normalized.startsWith('+90') ? digits.slice(-10) : digits
}

function containsPhone(text: string, normalized: string): boolean {
  return text.replace(/\D/g, '').includes(phoneKey(normalized))
}

function containsEmail(text: string, email: string): boolean {
  return text.toLocaleLowerCase('tr').includes(email.toLocaleLowerCase('tr'))
}

function containsName(text: string, name: string): boolean {
  const haystack = fold(text)
  const parts = fold(name).split(/[^\p{L}]+/u).filter((p) => p.length >= 2)
  return parts.length > 0 && parts.every((p) => haystack.includes(p))
}

const YES = /\b(evet|evt|onay|onayliyorum|onayladim|tamam|tamamdir|olur|kabul|kabul ediyorum|dogru|uygun|gonder|gonderebilirsin|ilet|iletebilirsin|ok|okey)\b/
const NO = /\b(hayir|istemiyorum|vazgec|vazgectim|iptal|onaylamiyorum|yanlis|degil|olmaz|dur|bekle|duzelt)\b/

export function isExplicitYes(message: string): boolean {
  const m = fold(message)
  return YES.test(m) && !NO.test(m)
}

export interface LeadInput {
  name: string
  phone: string | null
  email: string | null
  note: string | null
}

export interface LeadContext {
  // Every customer message in the conversation, the current one included.
  userMessages: string[]
  currentMessage: string
  // The bot's message right before the current one (null if none).
  previousAssistant: string | null
}

export type LeadCheck = { ok: true; lead: LeadInput } | { ok: false; reason: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

// Pure: everything the server checks before a lead is written. `reason` goes
// back to the model as the tool result, so it says what to do next.
export function validateLead(input: unknown, ctx: LeadContext, businessName: string): LeadCheck {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const name = str(raw.name).slice(0, MAX_NAME_CHARS)
  const phoneRaw = str(raw.phone)
  const emailRaw = str(raw.email)
  const note = str(raw.note).slice(0, MAX_NOTE_CHARS) || null

  if (!name) return { ok: false, reason: 'Kaydedilmedi: müşterinin adı eksik. Adını sor.' }
  if (!phoneRaw && !emailRaw) {
    return { ok: false, reason: 'Kaydedilmedi: telefon veya e-posta gerekli. Müşteriye sor.' }
  }
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null
  if (phoneRaw && !phone) {
    return { ok: false, reason: 'Kaydedilmedi: telefon numarası geçersiz görünüyor. Müşteriden numarasını kontrol etmesini iste.' }
  }
  const email = emailRaw || null
  if (email && !isValidEmail(email)) {
    return { ok: false, reason: 'Kaydedilmedi: e-posta adresi geçersiz görünüyor. Müşteriden kontrol etmesini iste.' }
  }

  const customerText = ctx.userMessages.join('\n')
  if (
    !containsName(customerText, name) ||
    (phone && !containsPhone(customerText, phone)) ||
    (email && !containsEmail(customerText, email))
  ) {
    return {
      ok: false,
      reason: 'Kaydedilmedi: bu ad veya iletişim bilgisi müşterinin mesajlarında yok. Aracı yalnızca müşterinin bu sohbette kendi yazdığı bilgilerle çağır; belgelerdeki veya başka kaynaklardaki bilgileri asla kullanma.',
    }
  }

  const summary = ctx.previousAssistant ?? ''
  if (
    !fold(summary).includes(KVKK_CORE) ||
    !containsName(summary, name) ||
    (phone && !containsPhone(summary, phone)) ||
    (email && !containsEmail(summary, email))
  ) {
    return {
      ok: false,
      reason: `Kaydedilmedi: müşteriye bu bilgilerin özeti ve aydınlatma cümlesi henüz gösterilmedi. Önce ad ve iletişim bilgisini özetle, şu cümleyi aynen ekle: "${kvkkSentence(businessName)}" ve açık onay iste. Talebin iletildiğini söyleme.`,
    }
  }

  if (!isExplicitYes(ctx.currentMessage)) {
    return { ok: false, reason: 'Kaydedilmedi: müşteri açıkça onay vermedi. Talebin iletildiğini söyleme; gerekiyorsa onay iste veya düzeltmeyi al.' }
  }

  return { ok: true, lead: { name, phone, email, note } }
}

export interface ToolOutcome {
  ok: boolean
  message: string
}

// Never throws: runs as the tool, its message goes back to the model.
export async function createLead(
  client: SupabaseClient,
  botId: string,
  conversationId: string,
  input: unknown,
  ctx: LeadContext,
  businessName: string,
): Promise<ToolOutcome> {
  const check = validateLead(input, ctx, businessName)
  if (!check.ok) return { ok: false, message: check.reason }
  try {
    const { count, error: countError } = await client
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_LEADS_PER_CONVERSATION) {
      return {
        ok: false,
        message: 'Kaydedilmedi: bu sohbette talep sınırına ulaşıldı. Müşteriye yeni talep alınamadığını, işletmeyle doğrudan iletişime geçebileceğini söyle.',
      }
    }
    const { error } = await client.from('leads').insert({
      bot_id: botId,
      conversation_id: conversationId,
      ...check.lead,
    })
    if (error) throw error
    return { ok: true, message: 'Talep kaydedildi ve işletmeye iletildi.' }
  } catch (err) {
    console.error('lead not saved:', err instanceof Error ? err.message : err)
    return {
      ok: false,
      message: 'Kaydedilmedi: teknik bir sorun oluştu. Müşteriye talebin şu an iletilemediğini söyle, söz verme.',
    }
  }
}

// ---- Lead capture off: fixed redirect ---------------------------------------
// The prompt tells the model not to promise anything, but a model can still
// slip ("ekibimiz size dönecek"). So when the customer asks to be contacted
// or leaves a phone / e-mail, the server appends this sentence itself: it
// only uses the business's own contact fields (migration 023), never invents.

export interface BusinessContact {
  name: string
  contact_phone?: string | null
  contact_email?: string | null
  contact_address?: string | null
  contact_whatsapp?: string | null
}

const oneLine = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

export function contactLines(bot: BusinessContact): string[] {
  return [
    ['Telefon', bot.contact_phone],
    ['WhatsApp', bot.contact_whatsapp],
    ['E-posta', bot.contact_email],
    ['Adres', bot.contact_address],
  ]
    .map(([label, value]) => [label, oneLine(value)])
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
}

export function contactRedirect(bot: BusinessContact): string {
  const lines = contactLines(bot)
  return lines.length === 0
    ? 'Bu sohbet üzerinden iletişim bilgisi alınmıyor; lütfen işletmeyle doğrudan iletişime geçin.'
    : `Bu sohbet üzerinden iletişim bilgisi alınmıyor; lütfen ${oneLine(bot.name)} ile doğrudan iletişime geçin. ${lines.join(' · ')}`
}

const CONTACT_INTENT =
  /\b(beni ara|bizi ara|geri ara|ara(yin|yiniz|r misiniz|yabilir|sin|masini)|geri don|donus yap|donus sagla|bana don|donun|donebilir|iletisime gec|irtibata gec|ulasin|ulasir misiniz|ulasabilir misiniz|numarami|telefonumu|mailimi|e-?postami|bana yaz|yazar misiniz|haber ver)/
const PHONE_LIKE = /\+?\(?\d[\d\s().-]{8,}\d/
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/

export function wantsContact(message: string): boolean {
  return CONTACT_INTENT.test(fold(message)) || EMAIL_LIKE.test(message) ||
    (PHONE_LIKE.test(message) && message.replace(/\D/g, '').length >= 10)
}

// Text to append to the reply ('' when not needed or already there).
export function redirectSuffix(bot: BusinessContact & { lead_capture_enabled: boolean }, message: string, reply: string): string {
  if (bot.lead_capture_enabled || !wantsContact(message)) return ''
  const sentence = contactRedirect(bot)
  return reply.includes(sentence) ? '' : `${reply ? '\n\n' : ''}${sentence}`
}
