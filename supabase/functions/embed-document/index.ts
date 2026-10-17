// Edge Function: embed-document
// Purpose: store a document's original text (document_sources), chunk it,
// embed each chunk via Voyage AI and save the chunks (documents).
//
// Modes:
// - upload:    { bot_id, content, source_name?, source_type? }  (bot owner)
// - reprocess: { reprocess: upload_id }  re-chunks a stored document with the
//   current chunker (bot owner, or the service_role key for admin batch runs:
//   scripts/reprocess-documents.ts).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getEmbeddings } from "../_shared/voyage.ts";
import { CHUNKER_ID, chunkDocument } from "../_shared/chunking.ts";

const MAX_CONTENT_CHARS = 200_000; // ~1000 section-30 chunks at most
const INSERT_BATCH = 200; // keeps each PostgREST insert (1024-dim vectors) small
const SOURCE_TYPES = ["text", "pdf"];

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

interface EmbedRequest {
  bot_id?: string;
  content?: string;
  source_name?: string;
  source_type?: string;
  reprocess?: string;
}

// The platform verifies the JWT signature before the function runs (deployed
// WITHOUT --no-verify-jwt), so reading the role claim is safe here. Comparing
// with SUPABASE_SERVICE_ROLE_KEY doesn't work: the env key and the legacy
// service_role JWT callers use can be different strings.
function jwtRole(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer\s+/i, "").split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

const NO_SESSION = "Oturum bulunamadı. Lütfen tekrar giriş yapın.";
const NO_BOT = "Bot bulunamadı veya bu bota erişim yetkiniz yok.";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: EmbedRequest = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: NO_SESSION }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const isAdmin = jwtRole(authHeader) === "service_role";

    // Bot ownership check through the user's own JWT (RLS on bots).
    const userOwnsBot = async (botId: string): Promise<boolean | null> => {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return null;
      const { data: bot, error: botError } = await userClient
        .from("bots")
        .select("id")
        .eq("id", botId)
        .is("deleted_at", null)
        .maybeSingle();
      return !botError && !!bot;
    };

    const insertChunks = async (rows: Record<string, unknown>[]) => {
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const { error } = await adminClient.from("documents").insert(rows.slice(i, i + INSERT_BATCH));
        if (error) throw error;
      }
    };

    // Chunk ids go in the query string; batches keep the URL short.
    const deleteChunks = async (ids: string[]) => {
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await adminClient.from("documents").delete().in("id", ids.slice(i, i + 100));
        if (error) throw error;
      }
    };

    const embedChunks = async (uploadId: string, botId: string, sourceName: string | null, text: string) => {
      const chunks = chunkDocument(text);
      if (chunks.length === 0) return null;
      const embeddings = await getEmbeddings(chunks, "document");
      return chunks.map((content, i) => ({
        upload_id: uploadId,
        bot_id: botId,
        content,
        embedding: embeddings[i],
        source_name: sourceName,
        chunk_index: i,
      }));
    };

    // ---- reprocess ---------------------------------------------------------
    if (body.reprocess) {
      const { data: source, error: sourceError } = await adminClient
        .from("document_sources")
        .select("id, bot_id, source_name, content")
        .eq("id", body.reprocess)
        .is("deleted_at", null)
        .maybeSingle();
      if (sourceError) throw sourceError;
      if (!source) return json({ error: "Belge bulunamadı." }, 404);
      if (!isAdmin) {
        const owns = await userOwnsBot(source.bot_id);
        if (owns === null) return json({ error: NO_SESSION }, 401);
        if (!owns) return json({ error: NO_BOT }, 403);
      }

      const rows = await embedChunks(source.id, source.bot_id, source.source_name, source.content);
      if (!rows) return json({ error: "Metin boş görünüyor." }, 400);

      // New chunks first, then drop the old ones: a failure leaves the old
      // chunks searchable instead of none.
      const { data: oldRows, error: oldError } = await adminClient
        .from("documents").select("id").eq("upload_id", source.id);
      if (oldError) throw oldError;
      const newIds = new Set<string>();
      try {
        await insertChunks(rows);
      } catch (err) {
        // Drop a partial new set; the old chunks stay searchable.
        const { data: all } = await adminClient.from("documents").select("id").eq("upload_id", source.id);
        const oldSet = new Set((oldRows ?? []).map((r) => r.id));
        for (const r of all ?? []) if (!oldSet.has(r.id)) newIds.add(r.id);
        await deleteChunks([...newIds]);
        throw err;
      }
      await deleteChunks((oldRows ?? []).map((r) => r.id));
      const { error: updateError } = await adminClient
        .from("document_sources")
        .update({ chunker: CHUNKER_ID, chunk_count: rows.length })
        .eq("id", source.id);
      if (updateError) throw updateError;

      return json({ success: true, upload_id: source.id, chunks_created: rows.length, chunker: CHUNKER_ID }, 200);
    }

    // ---- upload ------------------------------------------------------------
    const { bot_id } = body;
    const content = body.content?.trim();
    const source_name = body.source_name?.trim().slice(0, 200) || null;
    const source_type = body.source_type ?? "text";

    if (!bot_id || !content) {
      return json({ error: "Bot ve içerik alanları zorunlu." }, 400);
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return json({ error: "Metin çok uzun. En fazla 200.000 karakter yükleyebilirsiniz." }, 413);
    }
    if (!SOURCE_TYPES.includes(source_type)) {
      return json({ error: "Geçersiz belge türü." }, 400);
    }

    const owns = await userOwnsBot(bot_id);
    if (owns === null) return json({ error: NO_SESSION }, 401);
    if (!owns) return json({ error: NO_BOT }, 403);

    // All chunks of one upload share the source id (documents.upload_id).
    const upload_id = crypto.randomUUID();
    const rows = await embedChunks(upload_id, bot_id, source_name, content);
    if (!rows) return json({ error: "Metin boş görünüyor." }, 400);

    // Insert using service_role (bypasses RLS, ownership verified above).
    const { error: sourceError } = await adminClient.from("document_sources").insert({
      id: upload_id,
      bot_id,
      source_name,
      source_type,
      content,
      chunker: CHUNKER_ID,
      chunk_count: rows.length,
    });
    if (sourceError) throw sourceError;

    try {
      await insertChunks(rows);
    } catch (err) {
      // Cascades to any chunks already inserted.
      await adminClient.from("document_sources").delete().eq("id", upload_id);
      throw err;
    }

    return json({
      success: true,
      upload_id,
      chunks_created: rows.length,
      source_name,
    }, 200);
  } catch (err) {
    console.error("embed-document error:", err);
    return json({ error: "Belge işlenirken bir hata oluştu. Lütfen tekrar deneyin." }, 500);
  }
});
