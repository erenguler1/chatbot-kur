// Edge Function: embed-document
// Purpose: Take raw text, chunk it, embed each chunk via Voyage AI, save to documents table.
// Auth: Requires JWT (user must own the bot).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getEmbeddings } from "../_shared/voyage.ts";

const CHUNK_SIZE = 400; // words per chunk
const CHUNK_OVERLAP = 50; // word overlap between chunks
const MAX_CONTENT_CHARS = 200_000; // keeps one Voyage batch under its 120k token limit

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
  bot_id: string;
  content: string;
  source_name?: string;
}

// Split text into overlapping word chunks
function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    if (i + CHUNK_SIZE >= words.length) break;
  }
  
  return chunks;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Parse request
    const { bot_id, content, source_name }: EmbedRequest = await req.json();
    
    if (!bot_id || !content) {
      return json({ error: "Bot ve içerik alanları zorunlu." }, 400);
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return json({ error: "Metin çok uzun. En fazla 200.000 karakter yükleyebilirsiniz." }, 413);
    }
    
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." }, 401);
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify user owns the bot
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." }, 401);
    }
    
    const { data: bot, error: botError } = await userClient
      .from("bots")
      .select("id")
      .eq("id", bot_id)
      .is("deleted_at", null)
      .single();
    
    if (botError || !bot) {
      return json({ error: "Bot bulunamadı veya bu bota erişim yetkiniz yok." }, 403);
    }
    
    // Chunk the text
    const chunks = chunkText(content);
    if (chunks.length === 0) {
      return json({ error: "Metin boş görünüyor." }, 400);
    }
    
    // Get embeddings from Voyage (batch call)
    const embeddings = await getEmbeddings(chunks, "document");
    
    // Insert into DB using service_role (bypasses RLS, we already verified ownership)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const rows = chunks.map((content, i) => ({
      bot_id,
      content,
      embedding: embeddings[i],
      source_name: source_name || null,
      chunk_index: i,
    }));
    
    const { error: insertError } = await adminClient
      .from("documents")
      .insert(rows);
    
    if (insertError) {
      throw new Error(`DB insert failed: ${insertError.message}`);
    }
    
    return json({
      success: true,
      chunks_created: chunks.length,
      source_name: source_name || null,
    }, 200);
  } catch (err) {
    console.error("embed-document error:", err);
    return json({ error: "Belge işlenirken bir hata oluştu. Lütfen tekrar deneyin." }, 500);
  }
});