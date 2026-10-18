-- =============================================================================
-- 020_unanswered_questions.sql
-- =============================================================================
-- Amac: Botun cevaplayamadigi sorular (RAG v0.3).
--
-- Bot no_match_message ile cevap verdiginde (Q&A'da da belgelerde de yok)
-- chat / public-chat sorunun METNINI buraya yazar; sohbetin geri kalani
-- yazilmaz. Telefon, e-posta, kimlik no, IBAN, kart no Edge Function'da
-- maskelenir (_shared/unanswered.ts). Panelde benzer sorular gruplanir;
-- "Q&A olarak cevapla" ve "Yoksay" grubun satirlarini soft-delete eder.
--
-- - Saklama: 90 gunden eski satirlar (silinmis olsun olmasin) her gece
--   pg_cron ile kalici silinir.
-- - RLS: her isletme yalnizca kendi botlarinin sorularini gorur/gunceller.
--   INSERT: chat kullanicinin JWT'si ile yazar (bot sahibi), public-chat
--   service_role ile.
--
-- Onkosul: 002.
-- =============================================================================

CREATE TABLE public.unanswered_questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id      UUID        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT unanswered_questions_question_length CHECK (char_length(question) BETWEEN 1 AND 500)
);

CREATE INDEX idx_unanswered_questions_bot_id
  ON public.unanswered_questions(bot_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_unanswered_questions_created_at
  ON public.unanswered_questions(created_at);

CREATE TRIGGER set_unanswered_questions_updated_at
  BEFORE UPDATE ON public.unanswered_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (Faz 1 kurali: SELECT/UPDATE'te deleted_at filtresi YOK, app layer'da)
ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unanswered_questions_select_own" ON public.unanswered_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = unanswered_questions.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "unanswered_questions_insert_own" ON public.unanswered_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = unanswered_questions.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "unanswered_questions_update_own" ON public.unanswered_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = unanswered_questions.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = unanswered_questions.bot_id AND bots.user_id = auth.uid()));

GRANT SELECT, INSERT ON public.unanswered_questions TO authenticated;
-- Panel yalnizca soft-delete yapar; soru metni sonradan degistirilemez.
GRANT UPDATE (deleted_at) ON public.unanswered_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unanswered_questions TO service_role;

-- ---- 90 gun saklama -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'purge-unanswered-questions',
  '17 3 * * *',
  $$DELETE FROM public.unanswered_questions WHERE created_at < now() - interval '90 days'$$
);
