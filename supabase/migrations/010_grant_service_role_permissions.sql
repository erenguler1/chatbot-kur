-- Migration 010: Grant service_role permissions on all public tables
--
-- Supabase default'ta service_role'e tabloya otomatik erişim VERMEZ.
-- Migration 004 sadece authenticated rolüne GRANT vermişti.
-- public-chat Edge Function service_role ile bağlanıyor (anonim erişim için
-- gerekli), bu yüzden bots/qa_pairs/conversations/messages tablolarına
-- erişimi olmalı. Aksi halde "permission denied" sessizce maybeSingle() null
-- döndürüyor, kullanıcıya "Bot bulunamadı" hatası gibi görünüyor.
--
-- Migration 004'ün service_role karşılığı. Bu hatayı tekrar yaşamamak için
-- tüm public tablolar için service_role GRANT'lerini codify ediyoruz.

GRANT SELECT, INSERT, UPDATE ON public.bots TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.qa_pairs TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.conversations TO service_role;
GRANT SELECT, INSERT ON public.messages TO service_role;
-- messages için UPDATE yok (immutable history)
-- DELETE her tablo için yok (soft-delete pattern)
