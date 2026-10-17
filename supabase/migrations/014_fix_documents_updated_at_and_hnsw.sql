-- =============================================================================
-- 014_fix_documents_updated_at_and_hnsw.sql
-- =============================================================================
-- Amac: Migration 012'deki iki hatayi duzelt.
--
-- 1) documents tablosunda updated_at kolonu yok ama BEFORE UPDATE trigger'i
--    (update_updated_at_column) NEW.updated_at'e yaziyor -> her UPDATE
--    (soft delete dahil) "record new has no field updated_at" hatasi verir.
--    Diger tum tablolarla tutarli olmak icin kolonu ekliyoruz (trigger'i
--    silmek yerine). Trigger adi da diger tablolardaki
--    set_<tablo>_updated_at desenine cekiliyor.
--
-- 2) ivfflat indeksi bos tabloda kuruldu; ivfflat liste merkezlerini kurulum
--    anindaki veriden hesapladigi icin bos tabloda kurulunca arama kalitesi
--    kotu olur. hnsw veri gerektirmez, sonradan eklenen satirlarla da dogru
--    calisir.
--
-- Onkosul: 012, 013. pgvector "extensions" semasinda; operator class semayla
-- yazildi cunku db push bos search_path ile calisir.
-- =============================================================================

-- 1) updated_at kolonu + trigger
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at ON public.documents;
DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) ivfflat -> hnsw (cosine)
DROP INDEX IF EXISTS public.idx_documents_embedding;
CREATE INDEX idx_documents_embedding ON public.documents
  USING hnsw (embedding extensions.vector_cosine_ops);
