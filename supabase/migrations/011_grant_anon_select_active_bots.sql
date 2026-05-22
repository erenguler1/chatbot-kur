-- Migration 011: Grant anon role limited SELECT on bots
--
-- Public widget anonim kullanıcılar için bot bilgisini (name, brand_color,
-- welcome_message) okuyabilmeli. Yeni Edge Function yazmak yerine RLS policy
-- + anon SELECT GRANT pattern'i:
--   - Sadece status='active' AND deleted_at IS NULL bot'lar görünür
--   - Hassas alan yok (name/brand_color/welcome_message public bilgi)
--   - authenticated policy (bots_select_own) ile çakışmaz (farklı role)

GRANT SELECT ON public.bots TO anon;

CREATE POLICY bots_select_anon_active ON public.bots
  FOR SELECT
  TO anon
  USING (status = 'active' AND deleted_at IS NULL);
