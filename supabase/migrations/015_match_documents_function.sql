-- =============================================================================
-- 015_match_documents_function.sql
-- =============================================================================
-- Amac: Bir botun belge parcalari arasinda soruya en yakin olanlari bul (RAG).
--
-- - SECURITY INVOKER (varsayilan): chat fonksiyonu kullanici JWT'si ile
--   cagirdiginda documents RLS'i gecerli kalir; public-chat service_role ile
--   cagirir. Her iki durumda da p_bot_id filtresi zorunlu, baska botun
--   belgeleri asla donmez.
-- - Esik filtresi burada degil, uygulamada: fonksiyon en yakin match_count
--   parcayi benzerlikleriyle dondurur.
-- - hnsw.iterative_scan: hnsw indeksi WHERE filtresini aramadan SONRA
--   uygular; cok botlu tabloda bot basina match_count'tan az sonuc donebilir.
--   relaxed_order ile pgvector (0.8+) yeterli sonuc bulana kadar taramaya
--   devam eder; siralama dis sorguda kesinlestirilir.
--
-- Onkosul: 012, 014.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.match_documents(
  p_bot_id UUID,
  p_query_embedding extensions.vector(1024),
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_name TEXT,
  chunk_index INT,
  similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  -- Fonksiyon seviyesinde SET bu parametre icin izinli degil; islem
  -- (transaction) kapsaminda burada ayarlaniyor.
  PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);

  RETURN QUERY
  SELECT ranked.* FROM (
    SELECT
      d.id,
      d.content,
      d.source_name,
      d.chunk_index,
      1 - (d.embedding <=> p_query_embedding) AS similarity
    FROM public.documents d
    WHERE d.bot_id = p_bot_id
      AND d.deleted_at IS NULL
    ORDER BY d.embedding <=> p_query_embedding
    LIMIT LEAST(p_match_count, 20)
  ) ranked
  ORDER BY ranked.similarity DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.match_documents(UUID, extensions.vector, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_documents(UUID, extensions.vector, INT) TO authenticated, service_role;
