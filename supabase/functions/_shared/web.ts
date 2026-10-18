// Fetching third-party web pages for URL import (import-site), safely.
//
// SSRF protection: only http/https on default ports, no credentials in the
// URL, the hostname must resolve to public addresses only (localhost, private,
// link-local, CGNAT, metadata, multicast... are refused), and redirects are
// followed by hand so every hop is checked again. Bodies are capped in size
// and every request has a timeout.
//
// Known residual risk: the address is checked before fetch() resolves the name
// again, so a DNS-rebinding host could still swap the answer in between. The
// function runs on Supabase's edge network, not next to our database, which
// limits what such a request could reach.

export const USER_AGENT = 'ChatBotKurBot/1.0 (+https://chatbot-kur.vercel.app)'
const ROBOTS_TOKEN = 'chatbotkurbot'
const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 5

// Codes the caller maps to Turkish messages / skip reasons.
export class WebError extends Error {
  constructor(
    public code:
      | 'invalid_url'
      | 'blocked'
      | 'http'
      | 'too_large'
      | 'timeout'
      | 'not_html'
      | 'network',
    message: string,
  ) {
    super(message)
    this.name = 'WebError'
  }
}

// ---- address checks ---------------------------------------------------------

function parseIPv4(s: string): number[] | null {
  const parts = s.split('.')
  if (parts.length !== 4) return null
  const n = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return n.every((x) => x >= 0 && x <= 255) ? n : null
}

// Expands an IPv6 literal (no brackets, no zone) to 8 16-bit groups.
function parseIPv6(s: string): number[] | null {
  let str = s.toLowerCase()
  // Trailing dotted IPv4 ("::ffff:1.2.3.4")
  const v4 = str.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const b = parseIPv4(v4[2])
    if (!b) return null
    str = `${v4[1]}${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`
  }
  const halves = str.split('::')
  if (halves.length > 2) return null
  const toGroups = (h: string) => (h === '' ? [] : h.split(':'))
  const head = toGroups(halves[0])
  const tail = halves.length === 2 ? toGroups(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN))
  return out.every((x) => !isNaN(x)) ? out : null
}

function isPublicIPv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false // this-net, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
  if (a === 169 && b === 254) return false // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false // IETF, TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking
  if (a === 198 && b === 51 && c === 100) return false // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false // TEST-NET-3
  if (a >= 224) return false // multicast, reserved, broadcast
  return true
}

function isPublicIPv6(g: number[]): boolean {
  // Only global unicast (2000::/3) is reachable; this also refuses ::1, ::,
  // IPv4-mapped/NAT64 (they embed v4 addresses), fc00::/7, fe80::/10, ff00::/8.
  if ((g[0] & 0xe000) !== 0x2000) return false
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false // documentation
  if (g[0] === 0x2001 && g[1] === 0x0000) return false // Teredo
  if (g[0] === 0x2002) {
    // 6to4 embeds an IPv4 address
    return isPublicIPv4([g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff])
  }
  return true
}

export function isPublicIP(ip: string): boolean {
  const v4 = parseIPv4(ip)
  if (v4) return isPublicIPv4(v4)
  const v6 = parseIPv6(ip.replace(/^\[|\]$/g, '').replace(/%.*$/, ''))
  if (v6) return isPublicIPv6(v6)
  return false
}

const BLOCKED_HOST = /(^|\.)(localhost|local|internal|localdomain|home|lan|intranet|corp)$/i

// Parses and checks a URL without touching the network.
export function checkUrl(raw: string, base?: string | URL): URL {
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    throw new WebError('invalid_url', `invalid url: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebError('invalid_url', `protocol not allowed: ${url.protocol}`)
  }
  if (url.username || url.password) throw new WebError('blocked', 'credentials in url')
  // Default ports only: no port scans through us.
  if (url.port !== '') throw new WebError('blocked', `port not allowed: ${url.port}`)
  const host = url.hostname.replace(/\.$/, '')
  if (host === '' || BLOCKED_HOST.test(host) || !host.includes('.') && !host.startsWith('[')) {
    throw new WebError('blocked', `host not allowed: ${host}`)
  }
  // IP literals (the URL parser already normalizes "2130706433", "0x7f.1"...)
  if (parseIPv4(host) || host.startsWith('[')) {
    if (!isPublicIP(host)) throw new WebError('blocked', `address not allowed: ${host}`)
  }
  url.hash = ''
  return url
}

type Resolver = (host: string) => Promise<string[]>

const denoResolver: Resolver = async (host) => {
  const settled = await Promise.allSettled([
    Deno.resolveDns(host, 'A'),
    Deno.resolveDns(host, 'AAAA'),
  ])
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

async function checkResolvedHost(url: URL, resolve: Resolver): Promise<void> {
  const host = url.hostname.replace(/\.$/, '')
  if (parseIPv4(host) || host.startsWith('[')) return // checked in checkUrl
  let ips: string[]
  try {
    ips = await resolve(host)
  } catch {
    throw new WebError('network', `dns failed: ${host}`)
  }
  if (ips.length === 0) throw new WebError('network', `no address: ${host}`)
  const bad = ips.find((ip) => !isPublicIP(ip))
  if (bad) throw new WebError('blocked', `${host} resolves to ${bad}`)
}

// ---- fetching -----------------------------------------------------------------

export interface FetchedText {
  url: URL // final URL after redirects
  contentType: string
  text: string
}

export interface SafeFetchOptions {
  accept: 'html' | 'xml' | 'text'
  resolve?: Resolver // tests
  fetchImpl?: typeof fetch // tests
}

const ACCEPT_HEADER = {
  html: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
  xml: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
  text: 'text/plain,*/*;q=0.1',
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? '0')
  if (declared > MAX_BYTES) {
    await res.body?.cancel()
    throw new WebError('too_large', `content-length ${declared}`)
  }
  if (!res.body) return new Uint8Array()
  const reader = res.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new WebError('too_large', `body over ${MAX_BYTES} bytes`)
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.byteLength
  }
  return out
}

// Turkish sites still serve windows-1254 / iso-8859-9 now and then.
function decode(bytes: Uint8Array, contentType: string): string {
  let label = contentType.match(/charset=["']?([\w-]+)/i)?.[1]
  if (!label) {
    const head = new TextDecoder('latin1').decode(bytes.slice(0, 2048))
    label = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]
  }
  try {
    return new TextDecoder(label ?? 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

export async function safeFetch(raw: string | URL, opts: SafeFetchOptions): Promise<FetchedText> {
  const resolve = opts.resolve ?? denoResolver
  const doFetch = opts.fetchImpl ?? fetch
  let url = checkUrl(raw.toString())
  const signal = AbortSignal.timeout(TIMEOUT_MS)

  for (let hop = 0; ; hop++) {
    await checkResolvedHost(url, resolve)
    let res: Response
    try {
      res = await doFetch(url, {
        redirect: 'manual',
        signal,
        headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT_HEADER[opts.accept] },
      })
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new WebError('timeout', `timeout: ${url}`)
      }
      throw new WebError('network', `fetch failed: ${url}`)
    }

    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel()
      const location = res.headers.get('location')
      if (!location || hop >= MAX_REDIRECTS) throw new WebError('http', `bad redirect from ${url}`)
      url = checkUrl(location, url)
      continue
    }
    if (!res.ok) {
      await res.body?.cancel()
      throw new WebError('http', `HTTP ${res.status}: ${url}`)
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (opts.accept === 'html' && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await res.body?.cancel()
      throw new WebError('not_html', `not html (${contentType}): ${url}`)
    }
    try {
      const bytes = await readCapped(res)
      return { url, contentType, text: decode(bytes, contentType) }
    } catch (err) {
      if (err instanceof WebError) throw err
      throw new WebError('timeout', `body read failed: ${url}`)
    }
  }
}

// ---- same site ------------------------------------------------------------------

const siteKey = (host: string) => host.toLowerCase().replace(/^www\./, '')

// "Same domain": example.com and www.example.com count as one site.
export function sameSite(a: URL, b: URL): boolean {
  return siteKey(a.hostname) === siteKey(b.hostname)
}

// Dedupe key: www./non-www and a trailing slash are the same page.
export function pageKey(url: URL): string {
  return `${siteKey(url.hostname)}${url.pathname.replace(/\/+$/, '')}${url.search}`
}

// Files we never treat as pages.
const NON_PAGE =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mp3|wav|ogg|zip|rar|7z|gz|tar|docx?|xlsx?|pptx?|csv|json|xml|txt|css|js|woff2?|ttf|eot|exe|dmg|apk)$/i

// Normalizes a candidate link to a page URL on the same site, or null.
export function pageUrl(raw: string, base: URL, site: URL): URL | null {
  let url: URL
  try {
    url = checkUrl(raw.trim(), base)
  } catch {
    return null
  }
  if (!sameSite(url, site) || NON_PAGE.test(url.pathname)) return null
  if (/^\/(wp-admin|wp-login|cart|sepet|checkout|odeme|login|giris|account|hesabim)\b/i.test(url.pathname)) {
    return null
  }
  return url
}

// ---- robots.txt ------------------------------------------------------------------

interface RobotsRule {
  allow: boolean
  pattern: string
}

export interface Robots {
  rules: RobotsRule[]
  sitemaps: string[]
  crawlDelay: number // seconds between requests the site asks for (0 = none)
}

// Crawl-delay is non-standard but sites use it; honored up to a minute.
const MAX_CRAWL_DELAY_S = 60

// RFC 9309: the group for our token if there is one, else "*". Rules are
// matched by longest pattern; Allow wins a tie.
export function parseRobots(text: string): Robots {
  type Group = { agents: string[]; rules: RobotsRule[]; delay: number }
  const groups: Group[] = []
  const sitemaps: string[] = []
  let current: Group | null = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'sitemap') {
      if (value) sitemaps.push(value)
      continue
    }
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], delay: 0 }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (key === 'allow' || key === 'disallow') {
      // "Disallow:" (empty) allows everything: no rule.
      if (value) current.rules.push({ allow: key === 'allow', pattern: value })
    } else if (key === 'crawl-delay') {
      const n = Number(value)
      if (n > 0) current.delay = Math.min(n, MAX_CRAWL_DELAY_S)
    }
  }

  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && ROBOTS_TOKEN.startsWith(a)))
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes('*'))
  return {
    rules: chosen.flatMap((g) => g.rules),
    sitemaps,
    crawlDelay: Math.max(0, ...chosen.map((g) => g.delay)),
  }
}

const ALLOW_ALL: Robots = { rules: [], sitemaps: [], crawlDelay: 0 }
const DISALLOW_ALL: Robots = { rules: [{ allow: false, pattern: '/' }], sitemaps: [], crawlDelay: 0 }

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const re = body.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${re}${anchored ? '$' : ''}`).test(path)
}

export function robotsAllows(robots: Robots, url: URL): boolean {
  const path = url.pathname + url.search
  let best: RobotsRule | null = null
  for (const rule of robots.rules) {
    if (!patternMatches(rule.pattern, path)) continue
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}

// Missing robots.txt (4xx) allows everything; an unreachable one (5xx,
// timeout) means "assume disallowed", as RFC 9309 asks.
export async function fetchRobots(site: URL, opts: Omit<SafeFetchOptions, 'accept'> = {}): Promise<string> {
  try {
    const res = await safeFetch(new URL('/robots.txt', site), { ...opts, accept: 'text' })
    return res.text
  } catch (err) {
    if (err instanceof WebError && err.code === 'http' && /HTTP 4\d\d/.test(err.message)) return ''
    if (err instanceof WebError && err.code === 'too_large') return ''
    throw err
  }
}

export function robotsFromText(text: string | null): Robots {
  if (text === null) return DISALLOW_ALL
  return text.trim() === '' ? ALLOW_ALL : parseRobots(text)
}

// ---- sitemap ----------------------------------------------------------------------

export function parseSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, '&'),
  )
  return /<sitemapindex[\s>]/i.test(xml) ? { pages: [], sitemaps: locs } : { pages: locs, sitemaps: [] }
}
