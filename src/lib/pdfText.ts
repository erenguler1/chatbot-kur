// Extracts plain text from a text-based PDF in the browser (PDF.js).
// Loaded with a dynamic import so PDF.js stays out of the main bundle.
// Scanned (image-only) PDFs have no text layer; OCR is not supported yet.

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_PDF_PAGES = 100
// Fewer letters than this across the whole file means no usable text layer.
const MIN_LETTERS = 20

// Errors carry a Turkish message that can be shown to the user as is.
export class PdfTextError extends Error {
  override name = 'PdfTextError'
}

interface Line {
  text: string
  y: number
  height: number
}

function pageLines(items: TextItem[]): Line[] {
  const lines: Line[] = []
  let current: Line | null = null
  for (const item of items) {
    if (!current) current = { text: '', y: item.transform[5], height: item.height }
    current.text += item.str
    current.height = Math.max(current.height, item.height)
    if (item.hasEOL) {
      lines.push(current)
      current = null
    }
  }
  if (current) lines.push(current)
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text)
}

// Rebuilds paragraphs: a vertical gap clearly larger than the line height
// becomes a blank line, so headings and sections survive for chunking.
// "kul-\nlanılmamış" style hyphenation is joined back.
function pageText(lines: Line[]): string {
  const out: string[] = []
  let prev: Line | null = null
  for (const line of lines) {
    if (prev) {
      const gap = Math.abs(prev.y - line.y)
      const lineHeight = Math.max(prev.height, line.height, 1)
      if (gap > lineHeight * 1.8) out.push('')
    }
    const last = out.length - 1
    if (last >= 0 && /\p{Ll}-$/u.test(out[last]) && /^\p{Ll}/u.test(line.text)) {
      out[last] = out[last].slice(0, -1) + line.text
    } else {
      out.push(line.text)
    }
    prev = line
  }
  return out.join('\n')
}

export async function extractPdfText(file: File): Promise<string> {
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfTextError('PDF dosyası çok büyük. En fazla 10 MB yükleyebilirsiniz.')
  }

  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let pdf
  try {
    pdf = await task.promise
  } catch (err) {
    void task.destroy()
    if (err instanceof Error && err.name === 'PasswordException') {
      throw new PdfTextError('Bu PDF şifreli. Şifresiz bir kopyasını yükleyin.')
    }
    throw new PdfTextError('PDF dosyası okunamadı. Dosya bozuk olabilir.')
  }

  try {
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new PdfTextError(`PDF en fazla ${MAX_PDF_PAGES} sayfa olabilir (bu dosya ${pdf.numPages} sayfa).`)
    }
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const items = content.items.filter((it): it is TextItem => 'str' in it)
      pages.push(pageText(pageLines(items)))
      page.cleanup()
    }
    const text = pages.filter((p) => p.trim()).join('\n\n').trim()
    if ((text.match(/\p{L}/gu) ?? []).length < MIN_LETTERS) {
      throw new PdfTextError(
        "Bu PDF'ten metin çıkarılamadı. Taranmış (fotoğraf) bir belge olabilir; şimdilik yalnızca metin içeren PDF'ler destekleniyor. Metni kopyalayıp buraya yapıştırabilirsiniz.",
      )
    }
    return text
  } finally {
    void task.destroy()
  }
}
