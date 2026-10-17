-- =============================================================================
-- 016_document_uploads.sql
-- =============================================================================
-- Amac: Belgeler sekmesi icin "yukleme" kavrami.
--
-- documents tablosu parca (chunk) basina bir satir tutar; UI ise kullanicinin
-- yukledigi belgeyi tek kalem olarak listeler ve siler. source_name'e gore
-- gruplamak ayni adla iki yuklemeyi birlestirir, bu yuzden her yuklemenin
-- parcalari ortak bir upload_id tasir (embed-document atar).
--
-- document_uploads view'i: liste icin ozet (parca sayisi, uzunluk, onizleme).
-- security_invoker = true -> documents RLS'i view uzerinden de gecerli; kullanici
-- yalnizca kendi botlarinin yuklemelerini gorur. Embedding'ler ve tam metin
-- tarayiciya gitmez.
--
-- Onkosul: 012, 013, 014. Silme: upload_id'ye gore documents.deleted_at
-- guncellenir (mevcut UPDATE policy'si yeterli).
-- =============================================================================

-- Default sadece embed-document'in eski surumu icin emniyet; yeni surum her
-- yuklemenin tum parcalarina ayni upload_id'yi yazar. Tabloda satir yok.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS upload_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_documents_upload_id
  ON public.documents(upload_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.document_uploads
WITH (security_invoker = true) AS
SELECT
  d.upload_id,
  d.bot_id,
  MIN(d.source_name) AS source_name,
  COUNT(*)::INT AS chunk_count,
  SUM(char_length(d.content))::INT AS char_count,
  LEFT(MIN(d.content) FILTER (WHERE d.chunk_index = 0), 160) AS preview,
  MIN(d.created_at) AS created_at
FROM public.documents d
WHERE d.deleted_at IS NULL
GROUP BY d.upload_id, d.bot_id;

REVOKE ALL ON public.document_uploads FROM PUBLIC, anon;
GRANT SELECT ON public.document_uploads TO authenticated, service_role;
