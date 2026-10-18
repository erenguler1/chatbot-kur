// Unanswered questions (RAG v0.3): when the bot replies with its no-match
// message, chat / public-chat store the question text only, with personal
// data masked. Retention (90 days) is a pg_cron job (migration 020).

import type { SupabaseClient } from 'npm:@supabase/supabase-js'

const MAX_QUESTION_CHARS = 500

// The prompt tells the model to answer with no_match_message verbatim when
// neither Q&A nor documents cover the question.
export function isNoMatchAnswer(answer: string, noMatchMessage: string): boolean {
  const msg = noMatchMessage.trim()
  return msg.length > 0 && answer.includes(msg)
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/gi
// Runs of digits with the separators people type in numbers: "0532 123 45 67",
// "+90 (212) 555-12-12", "4111-1111-1111-1111".
const DIGIT_RUN = /\+?\(?\d[\d\s().-]*\d/g

function maskDigits(run: string): string {
  const digits = run.replace(/\D/g, '')
  if (digits.length < 10) return run
  if (/^\+?\(?(90|0)/.test(run.trim()) || (digits.length === 10 && digits.startsWith('5'))) {
    if (digits.length <= 13) return '[telefon]'
  }
  if (digits.length === 11 && /^[1-9]/.test(digits)) return '[kimlik no]'
  if (digits.length >= 13 && digits.length <= 19) return '[kart no]'
  return '[numara]'
}

export function maskPersonalData(text: string): string {
  return text
    .replace(EMAIL, '[e-posta]')
    .replace(IBAN, (m) => (/\d{10}/.test(m.replace(/\s/g, '')) ? '[IBAN]' : m))
    .replace(DIGIT_RUN, (run) => {
      // Keep trailing whitespace the run swallowed out of the replacement.
      const trimmed = run.trimEnd()
      return maskDigits(trimmed) + run.slice(trimmed.length)
    })
}

// Never throws: a failed write must not break the chat reply.
export async function recordUnanswered(client: SupabaseClient, botId: string, question: string): Promise<void> {
  const masked = maskPersonalData(question).replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS)
  if (!masked) return
  try {
    const { error } = await client.from('unanswered_questions').insert({ bot_id: botId, question: masked })
    if (error) console.error('unanswered question not saved:', error.message)
  } catch (err) {
    console.error('unanswered question not saved:', err)
  }
}
