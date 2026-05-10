-- =============================================================================
-- 001_create_update_trigger.sql
-- =============================================================================
-- Amac: Tablolarda updated_at kolonunu otomatik guncellemek icin tek bir
-- trigger fonksiyonu olustur. Her tablo bu fonksiyonu kendi BEFORE UPDATE
-- trigger'inda kullanir (002 ve 003 migration'larinda bind edilir).
--
-- CLAUDE.md kurali: "Her tabloda updated_at kolonu olmali" + DESIGN.md
-- Acik Sorular #5: "updated_at otomatik trigger ile yonetilecek".
-- =============================================================================

-- updated_at kolonunu now() ile gunceller. SECURITY INVOKER (varsayilan) ile
-- calisir; trigger calistiran kullanicinin yetkileri uygulanir. search_path
-- bos string'e set edilerek schema injection saldirilarina karsi sertlestirildi
-- (Supabase best practice).
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_updated_at_column() IS
  'BEFORE UPDATE trigger fonksiyonu: NEW.updated_at degerini now() ile gunceller. Her tablo kendi trigger''inda bu fonksiyonu cagirir.';
