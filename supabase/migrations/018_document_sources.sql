-- =============================================================================
-- 018_document_sources.sql
-- =============================================================================
-- Amac: Yuklenen belgenin ORIJINAL metnini sakla (RAG v0.2).
--
-- v0.1 yalnizca parcalari (documents) tutuyordu; parcalarda satir sonlari
-- kayboldugu icin belgeyi yeni bir parcalama yontemiyle yeniden islemek
-- mumkun degildi. Artik her yukleme bir document_sources satiridir
-- (id = documents.upload_id) ve hangi yontemle parcalandigini (chunker)
-- bilir; yontem degisince embed-document'in reprocess modu bu metinden
-- parcalari yeniden uretir.
--
-- - Soft delete: document_sources.deleted_at set edilince trigger ayni
--   yuklemenin parcalarini da siler (SECURITY INVOKER; kullanicinin documents
--   UPDATE policy'si gecerli).
-- - document_uploads view'i artik bu tablodan okur (Belgeler sekmesi).
-- - Backfill: v0.1'den kalan yuklemeler (varsa) parcalardan yeniden kurulur.
--   400/50 pencerede her parca bir oncekiyle 50 kelime ortusur; ilk parca +
--   sonraki parcalarin 51. kelimeden sonrasi orijinal kelime dizisini verir
--   (satir sonlari kayip; reprocess yine de calisir).
--
-- Onkosul: 012-017.
-- =============================================================================

CREATE TABLE public.document_sources (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id       UUID        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  source_name  TEXT,
  source_type  TEXT        NOT NULL DEFAULT 'text',
  content      TEXT        NOT NULL,
  chunker      TEXT        NOT NULL,
  chunk_count  INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,

  CONSTRAINT document_sources_source_type_check
    CHECK (source_type IN ('text', 'pdf'))
);

CREATE INDEX idx_document_sources_bot_id
  ON public.document_sources(bot_id) WHERE deleted_at IS NULL;

CREATE TRIGGER set_document_sources_updated_at
  BEFORE UPDATE ON public.document_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (Faz 1 kurali: SELECT/UPDATE'te deleted_at filtresi YOK, app layer'da)
ALTER TABLE public.document_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_sources_select_own" ON public.document_sources FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = document_sources.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "document_sources_insert_own" ON public.document_sources FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = document_sources.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "document_sources_update_own" ON public.document_sources FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = document_sources.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = document_sources.bot_id AND bots.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.document_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_sources TO service_role;

-- Backfill v0.1 uploads (no-op when documents is empty)
INSERT INTO public.document_sources (id, bot_id, source_name, source_type, content, chunker, chunk_count, created_at, deleted_at)
SELECT
  d.upload_id,
  MIN(d.bot_id::text)::uuid,
  MIN(d.source_name),
  'text',
  string_agg(
    CASE WHEN d.chunk_index = 0 THEN d.content
         ELSE array_to_string((regexp_split_to_array(d.content, '\s+'))[51:], ' ')
    END,
    ' ' ORDER BY d.chunk_index
  ),
  'fixed-400/50',
  COUNT(*),
  MIN(d.created_at),
  CASE WHEN bool_and(d.deleted_at IS NOT NULL) THEN MAX(d.deleted_at) END
FROM public.documents d
GROUP BY d.upload_id;

ALTER TABLE public.documents
  ALTER COLUMN upload_id DROP DEFAULT,
  ADD CONSTRAINT documents_upload_id_fkey
    FOREIGN KEY (upload_id) REFERENCES public.document_sources(id) ON DELETE CASCADE;

-- Soft delete cascade: source -> its chunks
CREATE OR REPLACE FUNCTION public.cascade_document_source_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.documents
     SET deleted_at = NEW.deleted_at
   WHERE upload_id = NEW.id
     AND deleted_at IS DISTINCT FROM NEW.deleted_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cascade_document_source_soft_delete
  AFTER UPDATE OF deleted_at ON public.document_sources
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION public.cascade_document_source_soft_delete();

-- Belgeler sekmesi listesi artik kaynak tablodan
DROP VIEW IF EXISTS public.document_uploads;
CREATE VIEW public.document_uploads
WITH (security_invoker = true) AS
SELECT
  s.id AS upload_id,
  s.bot_id,
  s.source_name,
  s.source_type,
  s.chunk_count,
  char_length(s.content) AS char_count,
  LEFT(s.content, 160) AS preview,
  s.created_at
FROM public.document_sources s
WHERE s.deleted_at IS NULL;

REVOKE ALL ON public.document_uploads FROM PUBLIC, anon;
GRANT SELECT ON public.document_uploads TO authenticated, service_role;
