-- Migration 008: Create conversations and messages tables for chat history
--
-- Hafta 3'te bot test sohbeti + Hafta 4'te public widget tüm mesaj akışını
-- bu iki tabloya yazacak. Soft-delete pattern bots/qa_pairs ile tutarlı.
-- Hafta 4'te conversations.user_id nullable yapılacak (anonim public chat için).

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Yeni sohbet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_bot_id ON public.conversations(bot_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id, created_at);

-- RLS aktif et
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- conversations RLS policy'leri
-- ÖNEMLI: Hafta 1+2'de yaşadığımız SOFT-DELETE bug'larını şimdiden engelle:
-- SELECT policy'sinde deleted_at IS NULL FİLTRESİ KOYMA (app layer filtrelesin)
-- UPDATE policy'sinin USING/WITH CHECK'inde deleted_at IS NULL FİLTRESİ KOYMA
-- Migration 005 ve 006'da öğrendiğimiz dersler.

CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY conversations_insert_own ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY conversations_update_own ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages RLS policy'leri
-- messages.user_id yok, parent conversations üzerinden filter
-- qa_pairs pattern'i: EXISTS subquery ile parent ownership check

CREATE POLICY messages_select_own ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- DELETE policy yok her iki tabloda — soft-delete via deleted_at (sadece conversations'da)
-- UPDATE policy yok messages'da — mesajlar değiştirilmez (immutable chat history)

-- GRANT'ler (Hafta 1'de bots için unutmuştuk, bu sefer şimdiden ekle)
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
-- UPDATE/DELETE yok: mesajlar değişmez, conversations soft-delete update üzerinden
