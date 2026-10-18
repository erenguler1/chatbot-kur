-- =============================================================================
-- 021_unanswered_question_groups.sql
-- =============================================================================
-- Amac: Cevaplanamayan sorulari ANLAMA gore grupla (RAG v0.3).
--
-- 020'de gruplama tarayicida kelime ortusmesiyle yapiliyordu; canli testte
-- "kopek kabul ediyor musunuz" / "kopekler iceri girebiliyor mu" / "Kopegimle
-- gelebilir miyim" ayri kaldi (unsuz yumusamasi, farkli fiiller). Artik her
-- sorunun voyage-4 embedding'i saklanir ve kayit aninda en yakin ACIK soruyla
-- (cosine >= 0.70) ayni group_id'yi alir; yoksa kendi grubunu acar.
--
-- - Kayit record_unanswered_question() ile (SECURITY INVOKER: chat'te
--   kullanicinin RLS'i, public-chat'te service_role).
-- - Embedding tarayiciya gitmez (panel kolonlari acikca secer).
-- - Embedding alinamazsa (Voyage hatasi) soru tek basina bir grup olur.
--
-- Onkosul: 020.
-- =============================================================================

ALTER TABLE public.unanswered_questions
  ADD COLUMN embedding extensions.vector(1024),
  ADD COLUMN group_id  UUID;

UPDATE public.unanswered_questions SET group_id = id WHERE group_id IS NULL;

ALTER TABLE public.unanswered_questions ALTER COLUMN group_id SET NOT NULL;

CREATE INDEX idx_unanswered_questions_group
  ON public.unanswered_questions(bot_id, group_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.record_unanswered_question(
  p_bot_id UUID, p_question TEXT, p_embedding extensions.vector(1024)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  -- Paraphrases of one question score ~0.75+ with voyage-4 query embeddings;
  -- different topics of the same business stay below (021 live check).
  v_min_similarity CONSTANT FLOAT := 0.70;
  v_id    UUID := gen_random_uuid();
  v_group UUID;
BEGIN
  IF p_embedding IS NOT NULL THEN
    SELECT q.group_id INTO v_group
      FROM public.unanswered_questions q
     WHERE q.bot_id = p_bot_id
       AND q.deleted_at IS NULL
       AND q.embedding IS NOT NULL
       AND 1 - (q.embedding OPERATOR(extensions.<=>) p_embedding) >= v_min_similarity
     ORDER BY q.embedding OPERATOR(extensions.<=>) p_embedding
     LIMIT 1;
  END IF;

  INSERT INTO public.unanswered_questions (id, bot_id, question, embedding, group_id)
  VALUES (v_id, p_bot_id, p_question, p_embedding, COALESCE(v_group, v_id));
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_unanswered_question(UUID, TEXT, extensions.vector) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_unanswered_question(UUID, TEXT, extensions.vector) TO authenticated, service_role;
