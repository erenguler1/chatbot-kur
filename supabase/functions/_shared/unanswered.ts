// Unanswered questions (RAG v0.3): when the bot replies with its no-match
// message, chat / public-chat store the question text only, with personal
// data masked, grouped by meaning. Retention (90 days) is a pg_cron job
// (migration 020).

import type { SupabaseClient } from 'npm:@supabase/supabase-js'
import { getEmbeddings } from './voyage.ts'

const MAX_QUESTION_CHARS = 500

const words = (s: string) =>
  s.toLocaleLowerCase('tr').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3)

// Share of the no-match message's words that must appear in the answer.
const NO_MATCH_OVERLAP = 0.6

// The prompt asks for no_match_message verbatim when neither Q&A nor documents
// cover the question, but the model sometimes rewords it ("Bu soruyu ekibimize
// iletiyorum"). So besides an exact hit, most of the message's words matching
// on a 5-letter stem ("soruya" ~ "soruyu") counts too.
export function isNoMatchAnswer(answer: string, noMatchMessage: string): boolean {
  const msg = noMatchMessage.trim()
  if (msg.length === 0) return false
  if (answer.includes(msg)) return true
  const target = words(msg)
  if (target.length < 3) return false
  const answerWords = words(answer)
  const hits = target.filter((t) => answerWords.some((w) => w.startsWith(t.slice(0, 5)))).length
  return hits / target.length >= NO_MATCH_OVERLAP
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

type Embed = (texts: string[], inputType: 'query') => Promise<number[][]>

// Never throws: a failed write must not break the chat reply. The embedding
// groups the question with similar open ones (record_unanswered_question,
// migration 021) and is always computed from the MASKED text, so no personal
// data is encoded in what we store. The retrieval embedding (of the raw
// question) is reused only when masking changed nothing, i.e. same input.
export async function recordUnanswered(
  client: SupabaseClient,
  botId: string,
  question: string,
  rawQueryEmbedding?: number[],
  embed: Embed = getEmbeddings,
): Promise<void> {
  const normalized = question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS)
  const masked = maskPersonalData(question).replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS)
  if (!masked) return
  try {
    let embedding: number[] | null = masked === normalized && rawQueryEmbedding ? rawQueryEmbedding : null
    if (!embedding) {
      embedding = await embed([masked], 'query').then(([e]) => e).catch(() => null)
    }
    const { error } = await client.rpc('record_unanswered_question', {
      p_bot_id: botId,
      p_question: masked,
      p_embedding: embedding,
    })
    if (error) console.error('unanswered question not saved:', error.message)
  } catch (err) {
    console.error('unanswered question not saved:', err)
  }
}
