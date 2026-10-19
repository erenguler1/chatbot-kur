-- =============================================================================
-- 023_bot_contact_info.sql
-- =============================================================================
-- Amac: Isletmenin kendi iletisim bilgisi + soz vermeyen varsayilan mesaj
-- (Faz 2 Tool Use v0.1).
--
-- - bots.contact_phone / contact_email / contact_address / contact_whatsapp:
--   bot musteriyi buraya yonlendirir (prompt + iletisim talebi kapaliyken
--   sunucunun ekledigi sabit cumle, _shared/leads.ts contactRedirect).
--   Bossa bot iletisim bilgisi uydurmaz.
-- - no_match_message varsayilani "ekibimize iletiyorum" diyordu: talep alma
--   kapaliyken bu bir soz (canli testte bot "ekibimiz sizinle iletisime
--   gececek" diye uzatti). Yeni varsayilan NewBot formundakiyle ayni.
--   Yalnizca hala ESKI varsayilani tasiyan botlar guncellenir; isletmenin
--   elle yazdigi mesajlara dokunulmaz (panelde uyari gosterilir).
--
-- Onkosul: 002, 022.
-- =============================================================================

ALTER TABLE public.bots
  ADD COLUMN contact_phone    TEXT,
  ADD COLUMN contact_email    TEXT,
  ADD COLUMN contact_address  TEXT,
  ADD COLUMN contact_whatsapp TEXT,
  ADD CONSTRAINT bots_contact_phone_length    CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 30),
  ADD CONSTRAINT bots_contact_email_length    CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  ADD CONSTRAINT bots_contact_address_length  CHECK (contact_address IS NULL OR char_length(contact_address) <= 300),
  ADD CONSTRAINT bots_contact_whatsapp_length CHECK (contact_whatsapp IS NULL OR char_length(contact_whatsapp) <= 30);

ALTER TABLE public.bots
  ALTER COLUMN no_match_message
  SET DEFAULT 'Üzgünüm, bu konuda yardımcı olamıyorum. Başka bir sorunuz var mı?';

UPDATE public.bots
SET no_match_message = 'Üzgünüm, bu konuda yardımcı olamıyorum. Başka bir sorunuz var mı?'
WHERE no_match_message = 'Bu soruya henüz cevap veremiyorum, ekibimize iletiyorum.';
