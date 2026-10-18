-- =============================================================================
-- 019_site_imports.sql
-- =============================================================================
-- Amac: Web sitesinden ice aktarma (RAG v0.3).
--
-- Bir site_imports satiri = bir "Web sitesinden ekle" islemi. import-site Edge
-- Function'i baslangicta sayfa listesini (page_urls, en fazla 30) bulur; sonra
-- her "step" cagrisi siradaki birkac sayfayi claim_site_import_pages ile
-- atomik olarak alir, isler ve record_site_import_progress ile sayaclari
-- arttirir. Boylece is Edge Function sure sinirina takilmadan parcalara
-- bolunur ve ayni anda iki sekme ayni sayfayi islemez.
--
-- Her basarili sayfa ayri bir document_sources satiridir (source_type 'url',
-- source_url, import_id). "Yeniden tara" ayni URL'nin satirini gunceller;
-- taramada artik bulunmayan sayfalar soft-delete edilir (Edge Function).
--
-- - Kullanici site_imports'ta yalnizca deleted_at'i guncelleyebilir (kolon
--   bazli GRANT): page_urls/robots_txt'yi degistirip fonksiyona istedigi
--   adresi okutamasin (fonksiyon her adresi yine de SSRF kontrolunden gecirir).
-- - Soft delete: site_imports.deleted_at -> o taramanin sayfalari
--   (document_sources) -> parcalari (documents, 018 trigger'i).
--
-- Onkosul: 018.
-- =============================================================================

CREATE TABLE public.site_imports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  root_url        TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'running',
  page_urls       TEXT[]      NOT NULL DEFAULT '{}',
  next_index      INT         NOT NULL DEFAULT 0,
  pages_ok        INT         NOT NULL DEFAULT 0,
  pages_empty     INT         NOT NULL DEFAULT 0,
  pages_failed    INT         NOT NULL DEFAULT 0,
  robots_txt      TEXT        NOT NULL DEFAULT '',
  error           TEXT,
  scan_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT site_imports_status_check CHECK (status IN ('running', 'done', 'failed'))
);

CREATE INDEX idx_site_imports_bot_id
  ON public.site_imports(bot_id) WHERE deleted_at IS NULL;

CREATE TRIGGER set_site_imports_updated_at
  BEFORE UPDATE ON public.site_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (Faz 1 kurali: SELECT/UPDATE'te deleted_at filtresi YOK, app layer'da)
ALTER TABLE public.site_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_imports_select_own" ON public.site_imports FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = site_imports.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "site_imports_update_own" ON public.site_imports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = site_imports.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = site_imports.bot_id AND bots.user_id = auth.uid()));

-- Ekleme ve ilerleme yalnizca Edge Function (service_role) uzerinden.
GRANT SELECT ON public.site_imports TO authenticated;
GRANT UPDATE (deleted_at) ON public.site_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_imports TO service_role;

-- ---- document_sources: web sayfalari ------------------------------------------
ALTER TABLE public.document_sources
  ADD COLUMN source_url TEXT,
  ADD COLUMN import_id  UUID REFERENCES public.site_imports(id) ON DELETE CASCADE,
  DROP CONSTRAINT document_sources_source_type_check,
  ADD CONSTRAINT document_sources_source_type_check CHECK (source_type IN ('text', 'pdf', 'url'));

-- Bir taramada ayni URL tek kaynak
CREATE UNIQUE INDEX idx_document_sources_import_url
  ON public.document_sources(import_id, source_url) WHERE deleted_at IS NULL AND import_id IS NOT NULL;

-- Soft delete cascade: site import -> its pages (-> chunks via 018 trigger)
CREATE OR REPLACE FUNCTION public.cascade_site_import_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.document_sources
     SET deleted_at = NEW.deleted_at
   WHERE import_id = NEW.id
     AND deleted_at IS DISTINCT FROM NEW.deleted_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cascade_site_import_soft_delete
  AFTER UPDATE OF deleted_at ON public.site_imports
  FOR EACH ROW
  WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
  EXECUTE FUNCTION public.cascade_site_import_soft_delete();

-- Belgeler sekmesi: sayfa adresi ve hangi taramadan geldigi (yeni kolonlar sonda)
CREATE OR REPLACE VIEW public.document_uploads
WITH (security_invoker = true) AS
SELECT
  s.id AS upload_id,
  s.bot_id,
  s.source_name,
  s.source_type,
  s.chunk_count,
  char_length(s.content) AS char_count,
  LEFT(s.content, 160) AS preview,
  s.created_at,
  s.source_url,
  s.import_id
FROM public.document_sources s
WHERE s.deleted_at IS NULL;

-- ---- step yardimcilari (yalnizca service_role) ----------------------------------

-- Siradaki en fazla p_count sayfayi alir: imleci atomik ilerletir.
CREATE OR REPLACE FUNCTION public.claim_site_import_pages(p_import_id UUID, p_count INT)
RETURNS TABLE (page_url TEXT, page_index INT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_start INT;
  v_end   INT;
  v_urls  TEXT[];
BEGIN
  SELECT next_index, page_urls INTO v_start, v_urls
    FROM public.site_imports
   WHERE id = p_import_id AND status = 'running' AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_end := LEAST(v_start + p_count, cardinality(v_urls));
  IF v_end <= v_start THEN RETURN; END IF;
  UPDATE public.site_imports SET next_index = v_end WHERE id = p_import_id;
  RETURN QUERY SELECT v_urls[i], i - 1 FROM generate_series(v_start + 1, v_end) AS i;
END;
$$;

-- Claim edilip islenemeyen sayfalari (Voyage 429 vb.) siraya geri koyar.
CREATE OR REPLACE FUNCTION public.release_site_import_pages(p_import_id UUID, p_from INT, p_to INT)
RETURNS VOID
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.site_imports SET next_index = p_from
   WHERE id = p_import_id AND next_index = p_to AND status = 'running';
$$;

-- Sayaclari arttirir; tum sayfalar islendiyse (veya p_force) taramayi bitirir.
-- finished = bu cagri taramayi bitirdi (temizlik bu cagriyi yapanda).
CREATE OR REPLACE FUNCTION public.record_site_import_progress(
  p_import_id UUID, p_ok INT, p_empty INT, p_failed INT, p_force BOOLEAN DEFAULT false
)
RETURNS TABLE (finished BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  r public.site_imports;
BEGIN
  UPDATE public.site_imports
     SET pages_ok = pages_ok + p_ok,
         pages_empty = pages_empty + p_empty,
         pages_failed = pages_failed + p_failed
   WHERE id = p_import_id AND status = 'running'
  RETURNING * INTO r;
  IF NOT FOUND THEN RETURN QUERY SELECT false; RETURN; END IF;
  IF p_force OR r.pages_ok + r.pages_empty + r.pages_failed >= cardinality(r.page_urls) THEN
    UPDATE public.site_imports SET status = 'done', next_index = cardinality(page_urls)
     WHERE id = p_import_id AND status = 'running';
    RETURN QUERY SELECT FOUND;
    RETURN;
  END IF;
  RETURN QUERY SELECT false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_site_import_pages(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_site_import_pages(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_site_import_progress(UUID, INT, INT, INT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_site_import_pages(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_site_import_pages(UUID, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_site_import_progress(UUID, INT, INT, INT, BOOLEAN) TO service_role;
