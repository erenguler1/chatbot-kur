// Main-content extraction for URL import: HTML -> plain text the section
// chunker understands (headings become "## ..." lines, list items "- ...").
// Menus, headers/footers, cookie banners, scripts and forms are dropped.

import { DOMParser, type Element, type Node } from 'jsr:@b-fuze/deno-dom@0.1.56'

// Below this many characters of body text a page counts as empty; usually a
// site that renders its content with JavaScript.
export const MIN_PAGE_CHARS = 200

const DROP_TAGS =
  'script, style, noscript, template, iframe, object, embed, svg, canvas, video, audio, picture, img, ' +
  'nav, aside, form, button, select, textarea, input, dialog, ' +
  '[role=navigation], [role=banner], [role=contentinfo], [role=dialog], [role=alertdialog], ' +
  '[aria-hidden=true], [hidden]'

// Cookie/consent banners, popups, share bars... by id/class. "menu" is left
// out on purpose: a restaurant's menu is content (<nav> is dropped anyway).
const NOISE = /(cookie|consent|gdpr|cerez|çerez|popup|modal|newsletter|breadcrumb|share|social|skip-link|screen-reader|sr-only|visually-hidden)/i

const LINK_DENSITY = 0.5

const BLOCK = new Set([
  'address', 'article', 'blockquote', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
  'header', 'footer', 'hr', 'main', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'thead', 'tfoot', 'ul',
])

export interface ExtractedPage {
  title: string
  text: string // title line + body; empty body => text === ''
  links: string[] // raw hrefs, resolved by the caller
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

function toText(root: Element): string {
  const lines: string[] = []
  let line = ''
  const breakLine = () => {
    const t = squash(line)
    if (t) lines.push(t)
    line = ''
  }
  const blank = () => {
    breakLine()
    if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
  }

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      line += node.textContent
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName.toLowerCase()

    if (/^h[1-6]$/.test(tag)) {
      const t = squash(el.textContent)
      if (t) {
        blank()
        lines.push(`## ${t}`)
      }
      return
    }
    if (tag === 'br') {
      breakLine()
      return
    }
    if (tag === 'li') {
      breakLine()
      line = '- '
      for (const c of el.childNodes) walk(c)
      if (squash(line) === '-') line = ''
      breakLine()
      return
    }
    if (tag === 'tr') {
      // Price tables: "Latte | 110 TL" stays on one line.
      breakLine()
      const cells = [...el.children].map((c) => squash(c.textContent)).filter(Boolean)
      if (cells.length > 0) lines.push(cells.join(' | '))
      return
    }
    const block = BLOCK.has(tag)
    if (block) blank()
    for (const c of el.childNodes) walk(c)
    if (block) blank()
  }

  walk(root)
  breakLine()
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function extractPage(html: string): ExtractedPage {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc || !doc.body) return { title: '', text: '', links: [] }

  // Links first: the menus we are about to drop are what discovery needs.
  const links = [...doc.querySelectorAll('a[href]')]
    .map((a) => (a as Element).getAttribute('href') ?? '')
    .filter((h) => h && !/^(mailto:|tel:|javascript:|#)/i.test(h))

  const title = squash(
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
      doc.querySelector('title')?.textContent ??
      '',
  ).slice(0, 200)

  for (const el of [...doc.body.querySelectorAll(DROP_TAGS)]) (el as Element).remove()
  for (const el of [...doc.body.querySelectorAll('[id], [class]')]) {
    const e = el as Element
    if (NOISE.test(`${e.getAttribute('id') ?? ''} ${e.getAttribute('class') ?? ''}`)) e.remove()
  }
  // Page-level header/footer only; one inside <main>/<article> is content.
  for (const el of [...doc.body.querySelectorAll('header, footer')]) {
    const e = el as Element
    if (!e.parentElement?.closest('main, article, [role=main]')) e.remove()
  }

  // Link-heavy blocks are menus and category lists, wherever they sit.
  // Deepest first, so a content wrapper is judged after its menus are gone.
  for (const el of [...doc.body.querySelectorAll('ul, ol, div, section, p, td')].reverse()) {
    const e = el as Element
    const text = squash(e.textContent).length
    if (text === 0) continue
    // A card wrapped in <a> (heading + summary) is content, not a menu.
    const linked = [...e.querySelectorAll('a')]
      .filter((a) => !(a as Element).querySelector('h1, h2, h3, h4, h5, h6, p'))
      .reduce((n, a) => n + squash(a.textContent).length, 0)
    if (linked / text > LINK_DENSITY) e.remove()
  }

  const root =
    (doc.querySelector('main, [role=main]') as Element | null) ??
    (doc.querySelectorAll('article').length === 1 ? (doc.querySelector('article') as Element) : null) ??
    doc.body

  const body = toText(root)
  if (body.replace(/^## /gm, '').replace(/\s+/g, ' ').trim().length < MIN_PAGE_CHARS) {
    return { title, text: '', links }
  }
  // "## <title>" right before a "## H1" becomes the chunker's document title
  // prefix ("Kafe Ada › Menü"); "## " lines are always headings.
  return { title, text: title ? `## ${title}\n\n${body}` : body, links }
}
