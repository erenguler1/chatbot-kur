// Edge Function: import-site
// Purpose: "Web sitesinden ekle" — read the pages of one site and store each
// as a document (document_sources.source_type = 'url'), chunked and embedded
// like any other document.
//
// The work is split so no call nears the Edge Function time limit; the
// browser drives it and shows progress ("12/30 sayfa"):
// - start:  { action: "start", bot_id, url }  robots.txt + page discovery
//           (sitemap.xml, else the start page's links), creates site_imports.
// - step:   { action: "step", import_id }     processes the next few pages.
//           On Voyage 429 the pages go back in the queue and the response
//           carries retry_after (seconds).
// - rescan: { action: "rescan", import_id }   discovers again and re-runs the
//           steps; pages are replaced by URL, vanished pages are removed.
//
// Every fetch goes through _shared/web.ts (SSRF checks, size/time caps).
// Page text reaches the model only inside the <belgeler> data wrapper
// (_shared/prompt.ts), like uploaded documents.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getEmbeddings } from "../_shared/voyage.ts";
import { CHUNKER_ID, chunkDocument } from "../_shared/chunking.ts";
import { insertChunks, replaceChunks } from "../_shared/documents.ts";
import { extractPage } from "../_shared/html.ts";
import {
  checkUrl,
  fetchRobots,
  pageKey,
  pageUrl,
  parseSitemap,
  robotsAllows,
  robotsFromText,
  safeFetch,
  sameSite,
  WebError,
} from "../_shared/web.ts";

const MAX_PAGES = 30;
const PAGES_PER_STEP = 3;
const MAX_IMPORTS_PER_BOT = 5;
const MAX_CHILD_SITEMAPS = 3;
const MAX_PAGE_CHARS = 200_000; // same cap as an uploaded document
// A step that claimed pages and died never reports them; after this long
// without progress the scan is closed with what it has.
const STALE_MS = 3 * 60 * 1000;
const RETRY_AFTER_S = 20;

const IMPORT_COLUMNS =
  "id, bot_id, root_url, status, page_urls, pages_ok, pages_empty, pages_failed, error, created_at, updated_at";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Errors whose message is written for the user.
class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const NO_SESSION = "Oturum bulunamadı. Lütfen tekrar giriş yapın.";
const NO_BOT = "Bot bulunamadı veya bu bota erişim yetkiniz yok.";
const NO_IMPORT = "Site kaydı bulunamadı.";
const JS_SITE =
  "Bu sitenin içeriği JavaScript ile yükleniyor ve şimdilik okunamıyor. Bilgileri metin veya PDF olarak ekleyebilirsiniz.";
const NOTHING_READ = "Sitedeki sayfalar okunamadı. Adresi kontrol edip tekrar deneyin.";

function webErrorMessage(err: WebError): string {
  switch (err.code) {
    case "invalid_url":
      return "Geçerli bir web adresi girin (örn. https://ornekkafe.com).";
    case "blocked":
      return "Bu adrese erişilemiyor: yalnızca herkese açık web siteleri eklenebilir.";
    case "timeout":
      return "Site zamanında yanıt vermedi. Biraz sonra tekrar deneyin.";
    case "too_large":
      return "Sayfa çok büyük, okunamadı.";
    case "not_html":
      return "Bu adres bir web sayfası değil.";
    default:
      return "Siteye ulaşılamadı. Adresi kontrol edip tekrar deneyin.";
  }
}

// ---- discovery ------------------------------------------------------------------

async function discover(start: URL): Promise<{ robotsTxt: string; pages: string[] }> {
  const site = new URL("/", start);

  let robotsTxt: string;
  try {
    robotsTxt = await fetchRobots(site);
  } catch (err) {
    if (err instanceof WebError && (err.code === "blocked" || err.code === "invalid_url" || err.code === "network")) {
      throw new UserError(webErrorMessage(err));
    }
    // RFC 9309: unreachable robots.txt = don't crawl.
    throw new UserError("Sitenin robots.txt dosyası okunamadı; site şu an yanıt vermiyor olabilir. Biraz sonra tekrar deneyin.");
  }
  const robots = robotsFromText(robotsTxt);
  if (!robotsAllows(robots, start)) {
    throw new UserError("Site sahibi robots.txt ile bu sayfanın okunmasına izin vermiyor.");
  }

  const pages: URL[] = [start];
  const seen = new Set([pageKey(start)]);
  const add = (raw: string, base: URL) => {
    if (pages.length >= MAX_PAGES) return;
    const url = pageUrl(raw, base, site);
    if (!url || !robotsAllows(robots, url) || seen.has(pageKey(url))) return;
    seen.add(pageKey(url));
    pages.push(url);
  };

  // 1) sitemap(s): robots.txt's Sitemap lines, else /sitemap.xml
  const queue = [...robots.sitemaps, new URL("/sitemap.xml", site).href];
  const fetched = new Set<string>();
  const candidates: string[] = [];
  while (queue.length > 0 && fetched.size < 1 + MAX_CHILD_SITEMAPS) {
    const raw = queue.shift()!;
    let url: URL;
    try {
      url = checkUrl(raw, site);
    } catch {
      continue;
    }
    if (!sameSite(url, site) || fetched.has(url.href) || /\.gz$/i.test(url.pathname)) continue;
    fetched.add(url.href);
    try {
      const res = await safeFetch(url, { accept: "xml" });
      const parsed = parseSitemap(res.text);
      candidates.push(...parsed.pages);
      queue.unshift(...parsed.sitemaps);
    } catch {
      // no sitemap there; try the next source
    }
  }
  // Shallow pages first: with a 30-page cap, /menu beats /blog/2019/03/x.
  const depth = (u: string) => {
    try {
      return new URL(u).pathname.split("/").filter(Boolean).length;
    } catch {
      return 99;
    }
  };
  candidates
    .map((u, i) => ({ u, i, d: depth(u) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .forEach(({ u }) => add(u, site));

  // 2) no sitemap pages: links on the start page
  if (pages.length === 1) {
    try {
      const res = await safeFetch(start, { accept: "html" });
      for (const href of extractPage(res.text).links) add(href, res.url);
    } catch (err) {
      throw new UserError(err instanceof WebError ? webErrorMessage(err) : "Siteye ulaşılamadı.");
    }
  }

  return { robotsTxt, pages: pages.map(String) };
}

// ---- pages ------------------------------------------------------------------------

type PageResult =
  | { kind: "ok"; url: string; name: string; text: string; chunks: string[] }
  | { kind: "empty" | "failed"; url: string; reason: string };

async function readPage(raw: string, site: URL, robotsTxt: string): Promise<PageResult> {
  const robots = robotsFromText(robotsTxt);
  try {
    const res = await safeFetch(raw, { accept: "html" });
    // A redirect may leave the site or land on a disallowed path.
    if (!sameSite(res.url, site)) return { kind: "failed", url: raw, reason: "redirected off-site" };
    if (!robotsAllows(robots, res.url)) return { kind: "failed", url: raw, reason: "robots.txt" };
    const page = extractPage(res.text);
    if (!page.text) return { kind: "empty", url: res.url.href, reason: "no text" };
    const text = page.text.slice(0, MAX_PAGE_CHARS);
    let path = res.url.pathname.replace(/\/+$/, "");
    try {
      path = decodeURI(path);
    } catch {
      // keep the encoded path
    }
    const base = page.title || res.url.hostname;
    const name = (path ? `${base} · ${path}` : base).slice(0, 200);
    return { kind: "ok", url: res.url.href, name, text, chunks: chunkDocument(text) };
  } catch (err) {
    return { kind: "failed", url: raw, reason: err instanceof Error ? err.message : String(err) };
  }
}

// ---- handler ------------------------------------------------------------------------

interface ImportRequest {
  action?: "start" | "step" | "rescan";
  bot_id?: string;
  url?: string;
  import_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ImportRequest = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: NO_SESSION }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Bot ownership through the user's own JWT (RLS on bots).
    const assertOwnsBot = async (botId: string) => {
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) throw new UserError(NO_SESSION, 401);
      const { data: bot, error } = await userClient
        .from("bots").select("id").eq("id", botId).is("deleted_at", null).maybeSingle();
      if (error || !bot) throw new UserError(NO_BOT, 403);
    };

    const loadImport = async (id: string | undefined) => {
      if (!id) throw new UserError(NO_IMPORT, 404);
      const { data, error } = await admin
        .from("site_imports")
        .select(`${IMPORT_COLUMNS}, robots_txt, next_index`)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new UserError(NO_IMPORT, 404);
      await assertOwnsBot(data.bot_id);
      return data;
    };

    const publicRow = async (id: string) => {
      const { data, error } = await admin.from("site_imports").select(IMPORT_COLUMNS).eq("id", id).single();
      if (error) throw error;
      return data;
    };

    // ---- start -------------------------------------------------------------
    if (body.action === "start") {
      if (!body.bot_id || !body.url?.trim()) throw new UserError("Bot ve web adresi zorunlu.");
      await assertOwnsBot(body.bot_id);

      const raw = body.url.trim();
      let start: URL;
      try {
        start = checkUrl(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      } catch (err) {
        throw new UserError(webErrorMessage(err as WebError));
      }

      const { data: existing, error: listError } = await admin
        .from("site_imports").select("root_url").eq("bot_id", body.bot_id).is("deleted_at", null);
      if (listError) throw listError;
      if ((existing ?? []).some((r) => sameSite(new URL(r.root_url), start))) {
        throw new UserError("Bu site zaten eklendi. Güncellemek için \"Yeniden tara\"yı kullanın.", 409);
      }
      if ((existing ?? []).length >= MAX_IMPORTS_PER_BOT) {
        throw new UserError(`Bir bota en fazla ${MAX_IMPORTS_PER_BOT} web sitesi eklenebilir.`, 409);
      }

      const { robotsTxt, pages } = await discover(start);
      const { data, error } = await admin
        .from("site_imports")
        .insert({ bot_id: body.bot_id, root_url: start.href, page_urls: pages, robots_txt: robotsTxt })
        .select(IMPORT_COLUMNS)
        .single();
      if (error) throw error;
      return json({ import: data }, 200);
    }

    // ---- rescan ------------------------------------------------------------
    if (body.action === "rescan") {
      const row = await loadImport(body.import_id);
      if (row.status === "running" && Date.now() - Date.parse(row.updated_at) < STALE_MS) {
        throw new UserError("Tarama zaten sürüyor.", 409);
      }
      const { robotsTxt, pages } = await discover(new URL(row.root_url));
      const { error } = await admin
        .from("site_imports")
        .update({
          status: "running",
          page_urls: pages,
          robots_txt: robotsTxt,
          next_index: 0,
          pages_ok: 0,
          pages_empty: 0,
          pages_failed: 0,
          error: null,
          scan_started_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      return json({ import: await publicRow(row.id) }, 200);
    }

    // ---- step --------------------------------------------------------------
    if (body.action !== "step") throw new UserError("Geçersiz istek.");
    const row = await loadImport(body.import_id);
    if (row.status !== "running") return json({ import: await publicRow(row.id) }, 200);

    const finish = async () => {
      // Pages this scan didn't save (gone from the site, now empty or
      // failing) are removed; a trigger takes their chunks along.
      const { data: current, error: currentError } = await admin
        .from("site_imports").select("scan_started_at, pages_ok, pages_empty").eq("id", row.id).single();
      if (currentError) throw currentError;
      const { error: staleError } = await admin
        .from("document_sources")
        .update({ deleted_at: new Date().toISOString() })
        .eq("import_id", row.id)
        .is("deleted_at", null)
        .lt("updated_at", current.scan_started_at);
      if (staleError) throw staleError;
      if (current.pages_ok === 0) {
        const { error } = await admin
          .from("site_imports")
          .update({ status: "failed", error: current.pages_empty > 0 ? JS_SITE : NOTHING_READ })
          .eq("id", row.id);
        if (error) throw error;
      }
    };

    const { data: claimed, error: claimError } = await admin.rpc("claim_site_import_pages", {
      p_import_id: row.id,
      p_count: PAGES_PER_STEP,
    });
    if (claimError) throw claimError;
    const urls = (claimed ?? []) as { page_url: string; page_index: number }[];

    if (urls.length === 0) {
      // Queue is empty; other steps still own the remaining pages. Close the
      // scan only if they have gone quiet for too long.
      if (Date.now() - Date.parse(row.updated_at) > STALE_MS) {
        const { data: done } = await admin.rpc("record_site_import_progress", {
          p_import_id: row.id, p_ok: 0, p_empty: 0, p_failed: 0, p_force: true,
        });
        if (done?.[0]?.finished) await finish();
      }
      return json({ import: await publicRow(row.id) }, 200);
    }

    const from = urls[0].page_index;
    const to = urls[urls.length - 1].page_index + 1;
    const site = new URL(row.root_url);
    const results = await Promise.all(urls.map((u) => readPage(u.page_url, site, row.robots_txt)));

    // One Voyage call for every chunk of this step's pages.
    const okPages = results.filter((r): r is Extract<PageResult, { kind: "ok" }> => r.kind === "ok" && r.chunks.length > 0);
    let embeddings: number[][] = [];
    try {
      if (okPages.length > 0) embeddings = await getEmbeddings(okPages.flatMap((p) => p.chunks), "document");
    } catch (err) {
      await admin.rpc("release_site_import_pages", { p_import_id: row.id, p_from: from, p_to: to });
      if (err instanceof Error && /Voyage API error: 429/.test(err.message)) {
        return json({ import: await publicRow(row.id), retry_after: RETRY_AFTER_S }, 200);
      }
      throw err;
    }

    let ok = 0;
    let offset = 0;
    for (const page of okPages) {
      const vectors = embeddings.slice(offset, offset + page.chunks.length);
      offset += page.chunks.length;
      try {
        const { data: existing, error: findError } = await admin
          .from("document_sources")
          .select("id")
          .eq("import_id", row.id)
          .eq("source_url", page.url)
          .is("deleted_at", null)
          .maybeSingle();
        if (findError) throw findError;
        const uploadId: string = existing?.id ?? crypto.randomUUID();
        const chunkRows = page.chunks.map((content, i) => ({
          upload_id: uploadId,
          bot_id: row.bot_id,
          content,
          embedding: vectors[i],
          source_name: page.name,
          chunk_index: i,
        }));
        const source = {
          source_name: page.name,
          content: page.text,
          chunker: CHUNKER_ID,
          chunk_count: chunkRows.length,
        };
        if (existing) {
          await replaceChunks(admin, uploadId, chunkRows);
          const { error } = await admin.from("document_sources").update(source).eq("id", uploadId);
          if (error) throw error;
        } else {
          const { error } = await admin.from("document_sources").insert({
            id: uploadId,
            bot_id: row.bot_id,
            source_type: "url",
            source_url: page.url,
            import_id: row.id,
            ...source,
          });
          if (error) throw error;
          try {
            await insertChunks(admin, chunkRows);
          } catch (err) {
            await admin.from("document_sources").delete().eq("id", uploadId);
            throw err;
          }
        }
        ok++;
      } catch (err) {
        console.error("import-site page save failed:", page.url, err);
      }
    }

    const empty = results.filter((r) => r.kind === "empty" || (r.kind === "ok" && r.chunks.length === 0)).length;
    const { data: progress, error: progressError } = await admin.rpc("record_site_import_progress", {
      p_import_id: row.id,
      p_ok: ok,
      p_empty: empty,
      p_failed: urls.length - ok - empty,
    });
    if (progressError) throw progressError;
    if (progress?.[0]?.finished) await finish();

    return json({ import: await publicRow(row.id) }, 200);
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, err.status);
    console.error("import-site error:", err);
    return json({ error: "Site içe aktarılırken bir hata oluştu. Lütfen tekrar deneyin." }, 500);
  }
});
