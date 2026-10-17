-- =============================================================================
-- 017_messages_sources.sql
-- =============================================================================
-- Amac: Asistan mesajinin cevaplanirken bakilan belgelerini (documents.
-- source_name) sakla; Test Sohbeti gecmisi yeniden yuklendiginde kaynaklar
-- gosterilebilsin.
--
-- NULL = belge kullanilmadi (Faz 1 mesajlari, belgesiz botlar, "bilmiyorum"
-- cevaplari). Widget'in public-get-messages endpoint'i kolonlari acikca
-- sectigi icin bu alan musteriye gitmez. Yeni GRANT/policy gerekmez.
-- =============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sources TEXT[];
