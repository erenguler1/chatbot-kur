-- =============================================================================
-- 003_create_qa_pairs_table.sql
-- =============================================================================
-- Amac: qa_pairs tablosunu olustur. Her bot icin kullanicinin tanimladigi
-- soru/cevap ciftleri burada tutulur. Mockup'taki state.qas ve DEFAULT_QAS
-- yapisindan turetildi.
--
-- Kaynak: DESIGN.md §1 (qa_pairs semasi) + §3 (RLS) + §4 (indeksler).
-- Onkosul:
--   - 001_create_update_trigger.sql (update_updated_at_column fonksiyonu)
--   - 002_create_bots_table.sql      (bots tablosu, FK hedefi)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablo: qa_pairs
-- -----------------------------------------------------------------------------
-- Kolonlar (DESIGN.md §1 qa_pairs tablosuna birebir):
--  - id: UUID PK
--  - bot_id: bots(id) FK; bot hard-delete edilirse Q&A'lar kaskadla silinir
--  - question / answer: NOT NULL + trim sonrasi bos olamaz
--  - sort_order: UI listeleme sirasi (default Q&A'lar 0..11 ile gelir)
--  - created_at / updated_at: zorunlu (CLAUDE.md), trigger ile auto-update
--  - deleted_at: soft-delete bayragi
CREATE TABLE public.qa_pairs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id     UUID        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  question   TEXT        NOT NULL,
  answer     TEXT        NOT NULL,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- question trim sonrasi bos olmamali (mockup'taki qaQuestionError karsiligi)
  CONSTRAINT qa_pairs_question_not_empty
    CHECK (char_length(trim(question)) > 0),

  -- answer trim sonrasi bos olmamali (mockup'taki qaAnswerError karsiligi)
  CONSTRAINT qa_pairs_answer_not_empty
    CHECK (char_length(trim(answer)) > 0)
);

COMMENT ON TABLE  public.qa_pairs IS 'Bot bazli soru/cevap ciftleri. Soft-delete (deleted_at).';
COMMENT ON COLUMN public.qa_pairs.bot_id IS 'Sahip oldugu bot. RLS bots.user_id uzerinden auth.uid() ile karsilastirir.';
COMMENT ON COLUMN public.qa_pairs.sort_order IS 'UI listeleme sirasi. Default Q&A''lar 0..11 ile gelir.';

-- -----------------------------------------------------------------------------
-- Indeks (DESIGN.md §4)
-- -----------------------------------------------------------------------------
-- Bot detay sayfasinda Q&A listeleme: WHERE bot_id = X AND deleted_at IS NULL
-- Partial index → silinmis kayitlar indeksten dislanir.
CREATE INDEX idx_qa_pairs_bot_id
  ON public.qa_pairs(bot_id)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- Trigger: updated_at otomatik guncelleme
-- -----------------------------------------------------------------------------
CREATE TRIGGER set_qa_pairs_updated_at
  BEFORE UPDATE ON public.qa_pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Q&A erisimi her zaman bot sahipligi uzerinden dogrulanir (EXISTS subquery).
-- Bot soft-delete oldugunda (bots.deleted_at IS NOT NULL) Q&A'lar otomatik
-- gizlenir; ekstra bayrak gerekmez.
-- DELETE policy yazilmiyor → hard-delete deny. Silme = soft-delete.
ALTER TABLE public.qa_pairs ENABLE ROW LEVEL SECURITY;

-- SELECT: Q&A silinmemis olmali VE sahip oldugu bot kullanicininki + aktif olmali
CREATE POLICY "qa_pairs_select_own"
  ON public.qa_pairs
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  );

-- INSERT: hedef bot kullanicininki olmali (ve silinmemis olmali)
CREATE POLICY "qa_pairs_insert_own"
  ON public.qa_pairs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  );

-- UPDATE: hem mevcut kayit hem de yeni hali kullanicinin botuna ait olmali.
-- WITH CHECK eklendi → bot_id baskasinin botuna degistirilemez (DESIGN.md
-- taslagi WITH CHECK'siz biraktigi icin burada sertlestirildi).
CREATE POLICY "qa_pairs_update_own"
  ON public.qa_pairs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  );

-- DELETE policy YOK → PostgreSQL default deny ile hard-delete engellenir.
