// Splits document text into chunks for embedding.
//
// Two strategies:
// - fixedChunks: sliding word window (RAG v0.1: 400 words, 50 overlap).
// - sectionChunks: follows the document's own structure. Short heading lines
//   ("Tatlılar", "İade Koşulları:") start a section; each section is split on
//   blank lines / list lines into chunks of at most maxWords, and every chunk
//   is prefixed with its heading so "Glutensiz brownie 120 TL" still carries
//   its context. Small businesses' texts (menus, price lists, policies) are
//   many short topics; one big window dilutes each topic's similarity.

export interface Chunk {
  content: string
  heading: string | null
}

const words = (text: string): string[] => text.split(/\s+/).filter((w) => w.length > 0)

export function fixedChunks(text: string, size: number, overlap: number): Chunk[] {
  const all = words(text)
  const chunks: Chunk[] = []
  if (all.length === 0) return chunks
  for (let i = 0; i < all.length; i += size - overlap) {
    chunks.push({ content: all.slice(i, i + size).join(' '), heading: null })
    if (i + size >= all.length) break
  }
  return chunks
}

const MAX_HEADING_WORDS = 6

// A heading is a short line with no digits that doesn't read like a sentence
// or a list item: "SICAK İÇECEKLER", "## Tatlılar", "İade Koşulları:",
// "1. İade Süresi".
export function isHeading(line: string): boolean {
  const t = line.trim()
  if (t.length === 0) return false
  if (/^#{1,6}\s/.test(t)) return true
  if (/^[-*•–]\s/.test(t)) return false
  // Numbered heading: "1. İade Süresi", "2) Kargo"
  const numbered = t.match(/^\d{1,2}[.)]\s+(.*)$/)
  if (numbered) return isHeading(numbered[1])
  if (/\d/.test(t)) return false
  if (/[.!?,;]$/.test(t)) return false
  return words(t).length <= MAX_HEADING_WORDS
}

const cleanHeading = (line: string): string =>
  line.trim().replace(/^#{1,6}\s+/, '').replace(/^\d{1,2}[.)]\s+/, '').replace(/:$/, '').trim()

interface Section {
  heading: string | null
  // Packing units: single sentences or single list/price lines.
  units: string[]
}

const isListLine = (line: string): boolean =>
  /^[-*•–]\s/.test(line) || (/\d/.test(line) && words(line).length <= 20)

// Sentence end = . ! ? followed by whitespace, so "6.000 TL" and "09.30" stay whole.
const SENTENCE_BREAK = /(?<=[.!?]["')\]]*)\s+/

function toSections(text: string): Section[] {
  const sections: Section[] = [{ heading: null, units: [] }]
  let title: string | null = null
  let paragraph: string[] = []
  const current = () => sections[sections.length - 1]
  const flush = () => {
    for (const s of paragraph.join(' ').split(SENTENCE_BREAK)) {
      if (s.trim().length > 0) current().units.push(s.trim())
    }
    paragraph = []
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())
  // Hard-wrapped prose (PDFs): a line followed by one starting lowercase is
  // mid-sentence, and a lowercase line continues the open paragraph.
  const startsLower = (l: string | undefined) => !!l && /^\p{Ll}/u.test(l)

  for (const [i, line] of lines.entries()) {
    if (line.length === 0) {
      flush()
    } else if (paragraph.length > 0 && startsLower(line)) {
      paragraph.push(line)
    } else if (startsLower(lines[i + 1])) {
      paragraph.push(line)
    } else if (isHeading(line)) {
      flush()
      // The first heading directly followed by another heading is the
      // document title ("Makas Kuaför Fiyat Listesi"); it prefixes every
      // later section so each chunk keeps the business context.
      const prev = current()
      if (title === null && prev.heading && prev.units.length === 0) {
        title = prev.heading
        sections.pop()
      }
      const heading = cleanHeading(line)
      sections.push({ heading: title ? `${title} › ${heading}` : heading, units: [] })
    } else if (isListLine(line)) {
      // List items and short price lines ("Latte 110 TL") stand alone so a
      // chunk boundary can fall between any two of them.
      flush()
      current().units.push(line)
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return sections.filter((s) => s.units.length > 0)
}

export function sectionChunks(text: string, maxWords: number): Chunk[] {
  const chunks: Chunk[] = []
  for (const section of toSections(text)) {
    let buf: string[] = []
    let bufWords = 0
    const emit = () => {
      if (buf.length === 0) return
      const body = buf.join('\n')
      chunks.push({
        content: section.heading ? `${section.heading}\n${body}` : body,
        heading: section.heading,
      })
      buf = []
      bufWords = 0
    }
    const units = section.units.flatMap((u) =>
      words(u).length > maxWords ? fixedChunks(u, maxWords, 0).map((c) => c.content) : [u],
    )
    for (const unit of units) {
      const n = words(unit).length
      if (bufWords + n > maxWords) emit()
      buf.push(unit)
      bufWords += n
    }
    emit()
  }
  return chunks
}

// Strategy for new uploads, chosen with scripts/rag-eval (RAG v0.2): section
// chunks of at most 30 words caught 35/36 on-topic questions with no false
// matches at MIN_SIMILARITY 0.40; v0.1's 400-word window caught 24/36 at its
// 0.35. Changing it means bumping CHUNKER_ID, re-running the eval for the
// threshold, and scripts/reprocess-documents.ts for stored documents.
export const CHUNKER_ID = 'section-30'

export function chunkDocument(text: string): string[] {
  return sectionChunks(text, 30).map((c) => c.content)
}
