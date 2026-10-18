import { assert, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1'
import {
  checkUrl,
  isPublicIP,
  pageUrl,
  parseRobots,
  parseSitemap,
  robotsAllows,
  robotsFromText,
  safeFetch,
  WebError,
} from './web.ts'

Deno.test('isPublicIP refuses private, loopback, link-local, mapped and special ranges', () => {
  for (const ip of [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '64:ff9b::a00:1', '2002:c0a8:0101::1', '2001:db8::1', 'ff02::1',
  ]) {
    assertEquals(isPublicIP(ip), false, ip)
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::6810:84e5', '2002:0808:0808::1']) {
    assertEquals(isPublicIP(ip), true, ip)
  }
})

Deno.test('checkUrl allows only public http(s) on default ports', () => {
  assertEquals(checkUrl('https://www.ornek.com/menu#x').toString(), 'https://www.ornek.com/menu')
  for (const bad of [
    'ftp://ornek.com', 'file:///etc/passwd', 'javascript:alert(1)', 'http://localhost/', 'http://api.localhost/',
    'http://127.0.0.1/', 'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/', 'http://[::ffff:10.0.0.1]/',
    'http://169.254.169.254/latest/meta-data/', 'http://ornek.com:8080/', 'http://user:pw@ornek.com/',
    'http://intranet/', 'http://db.internal/', 'not a url',
  ]) {
    assertThrows(() => checkUrl(bad), WebError, undefined, bad)
  }
})

const publicDns = () => Promise.resolve(['93.184.216.34'])

Deno.test('safeFetch refuses a host that resolves to a private address', async () => {
  const err = await assertRejects(
    () => safeFetch('https://evil.example.com/', { accept: 'html', resolve: () => Promise.resolve(['10.0.0.5']) }),
    WebError,
  )
  assertEquals(err.code, 'blocked')
})

Deno.test('safeFetch re-checks every redirect hop', async () => {
  const fetchImpl = ((input: URL) => {
    if (input.hostname === 'ornek.com') {
      return Promise.resolve(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }))
    }
    return Promise.resolve(new Response('secret', { headers: { 'content-type': 'text/html' } }))
  }) as typeof fetch
  const err = await assertRejects(
    () => safeFetch('https://ornek.com/', { accept: 'html', resolve: publicDns, fetchImpl }),
    WebError,
  )
  assertEquals(err.code, 'blocked')

  // ...and a hop to a name that resolves privately
  const fetch2 = ((input: URL) =>
    Promise.resolve(
      input.hostname === 'ornek.com'
        ? new Response(null, { status: 301, headers: { location: 'https://rebind.example.net/x' } })
        : new Response('ok', { headers: { 'content-type': 'text/html' } }),
    )) as typeof fetch
  const resolve = (h: string) => Promise.resolve(h === 'ornek.com' ? ['93.184.216.34'] : ['127.0.0.1'])
  const err2 = await assertRejects(() => safeFetch('https://ornek.com/', { accept: 'html', resolve, fetchImpl: fetch2 }), WebError)
  assertEquals(err2.code, 'blocked')
})

Deno.test('safeFetch follows a safe redirect and reports the final URL', async () => {
  const fetchImpl = ((input: URL) =>
    Promise.resolve(
      input.pathname === '/'
        ? new Response(null, { status: 301, headers: { location: '/tr/' } })
        : new Response('<p>merhaba</p>', { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    )) as typeof fetch
  const res = await safeFetch('https://ornek.com/', { accept: 'html', resolve: publicDns, fetchImpl })
  assertEquals(res.url.toString(), 'https://ornek.com/tr/')
  assertEquals(res.text, '<p>merhaba</p>')
})

Deno.test('safeFetch caps body size and rejects non-HTML pages', async () => {
  const big = ((_: URL) =>
    Promise.resolve(new Response(new Uint8Array(3 * 1024 * 1024), { headers: { 'content-type': 'text/html' } }))) as typeof fetch
  const e1 = await assertRejects(() => safeFetch('https://ornek.com/', { accept: 'html', resolve: publicDns, fetchImpl: big }), WebError)
  assertEquals(e1.code, 'too_large')

  const pdf = ((_: URL) =>
    Promise.resolve(new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }))) as typeof fetch
  const e2 = await assertRejects(() => safeFetch('https://ornek.com/a', { accept: 'html', resolve: publicDns, fetchImpl: pdf }), WebError)
  assertEquals(e2.code, 'not_html')
})

Deno.test('safeFetch decodes windows-1254 pages', async () => {
  const bytes = new Uint8Array([0xc7, 0x61, 0x79, 0x20, 0xfe, 0x75, 0x72, 0x75, 0x62, 0x75]) // "Çay şurubu"
  const fetchImpl = ((_: URL) =>
    Promise.resolve(new Response(bytes, { headers: { 'content-type': 'text/html; charset=windows-1254' } }))) as typeof fetch
  const res = await safeFetch('https://ornek.com/', { accept: 'html', resolve: publicDns, fetchImpl })
  assertEquals(res.text, 'Çay şurubu')
})

Deno.test('robots.txt: our group wins over *, longest match, Allow wins ties, wildcards', () => {
  const r = parseRobots(`
User-agent: *
Disallow: /

User-agent: ChatBotKurBot
Disallow: /admin
Allow: /admin/public
Disallow: /*.php$

Sitemap: https://ornek.com/sitemap_index.xml
`)
  const ok = (p: string) => robotsAllows(r, new URL(`https://ornek.com${p}`))
  assert(ok('/menu'))
  assert(!ok('/admin/x'))
  assert(ok('/admin/public/a'))
  assert(!ok('/index.php'))
  assert(ok('/index.php?x=1'))
  assertEquals(r.sitemaps, ['https://ornek.com/sitemap_index.xml'])

  const star = parseRobots('User-agent: *\nDisallow: /private\nDisallow:\n')
  assert(!robotsAllows(star, new URL('https://ornek.com/private/1')))
  assert(robotsAllows(star, new URL('https://ornek.com/menu')))
  assert(robotsAllows(robotsFromText(''), new URL('https://ornek.com/x')))
  assert(!robotsAllows(robotsFromText(null), new URL('https://ornek.com/x')))
})

Deno.test('sitemap: pages vs index, CDATA and &amp;', () => {
  assertEquals(
    parseSitemap('<urlset><url><loc>https://ornek.com/a?x=1&amp;y=2</loc></url><url><loc><![CDATA[https://ornek.com/b]]></loc></url></urlset>'),
    { pages: ['https://ornek.com/a?x=1&y=2', 'https://ornek.com/b'], sitemaps: [] },
  )
  assertEquals(parseSitemap('<sitemapindex><sitemap><loc>https://ornek.com/s1.xml</loc></sitemap></sitemapindex>').sitemaps, [
    'https://ornek.com/s1.xml',
  ])
})

Deno.test('pageUrl keeps same-site pages only', () => {
  const site = new URL('https://ornek.com/')
  assertEquals(pageUrl('/menu#tatli', site, site)?.toString(), 'https://ornek.com/menu')
  assertEquals(pageUrl('https://www.ornek.com/iletisim', site, site)?.toString(), 'https://www.ornek.com/iletisim')
  assertEquals(pageUrl('https://baska.com/', site, site), null)
  assertEquals(pageUrl('/files/menu.pdf', site, site), null)
  assertEquals(pageUrl('/wp-admin/', site, site), null)
  assertEquals(pageUrl('http://127.0.0.1/', site, site), null)
})
