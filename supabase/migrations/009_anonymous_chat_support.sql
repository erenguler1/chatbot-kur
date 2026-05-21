-- Migration 009: Anonymous chat support for public widget
--
-- Hafta 4'te public widget gelecek: Hakan amca'nın sitesine gelen anonim
-- müşteriler login olmadan bot'la konuşacak. Bu migration:
-- 1. conversations.user_id'i NULLABLE yapar
-- 2. conversations'a session_id (TEXT) kolonu ekler — anonim kimlik (localStorage UUID)
-- 3. CHECK constraint: ya user_id ya session_id dolu (XOR)
-- 4. Performance index: session_id + bot_id lookup için
-- 5. Anon role için SELECT policy (false — anon doğrudan SELECT yapamaz, Edge Function service_role kullanır)

-- 1. user_id NULLABLE
ALTER TABLE public.conversations
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. session_id kolonu
ALTER TABLE public.conversations
  ADD COLUMN session_id TEXT;

-- 3. XOR constraint: user_id veya session_id dolu, ikisi birden değil
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_or_session_check
  CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  );

-- 4. Performance index: session_id + bot_id ile conversation lookup
CREATE INDEX idx_conversations_session_bot
  ON public.conversations(session_id, bot_id)
  WHERE deleted_at IS NULL AND session_id IS NOT NULL;

-- 5. Anon role için SELECT policy (defensive, false döner — anon Edge Function üzerinden gider)
CREATE POLICY conversations_select_anon ON public.conversations
  FOR SELECT
  TO anon
  USING (false);
