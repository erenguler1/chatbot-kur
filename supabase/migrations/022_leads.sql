-- =============================================================================
-- 022_leads.sql
-- =============================================================================
-- Amac: Iletisim talepleri (Faz 2 Tool Use, ilk arac).
--
-- Musteri geri aranmak / teklif / bilgi isterse bot ad + telefon veya e-posta
-- + kisa not toplar, ozetleyip KVKK cumlesiyle acik onay alir ve
-- `iletisim_talebi_olustur` aracini cagirir. chat / public-chat araci
-- dogrulayip (_shared/leads.ts) buraya yazar.
--
-- - bots.lead_capture_enabled: isletme ozelligi kapatabilir (varsayilan acik).
-- - Saklama: 180 gunden eski satirlar (silinmis olsun olmasin) her gece
--   pg_cron ile kalici silinir.
-- - RLS: her isletme yalnizca kendi botlarinin taleplerini gorur/gunceller.
--   INSERT: chat kullanicinin JWT'si ile (bot sahibi, Test Sohbeti),
--   public-chat service_role ile.
-- - Panel yalnizca durum ve soft-delete degistirebilir; musteri bilgisi
--   sonradan degistirilemez.
--
-- Onkosul: 002, 008.
-- =============================================================================

ALTER TABLE public.bots
  ADD COLUMN lead_capture_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE public.leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID        NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  conversation_id UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  name            TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  note            TEXT,
  status          TEXT        NOT NULL DEFAULT 'new',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT leads_status_check CHECK (status IN ('new', 'contacted', 'closed')),
  CONSTRAINT leads_contact_required CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT leads_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT leads_phone_length CHECK (phone IS NULL OR char_length(phone) BETWEEN 7 AND 20),
  CONSTRAINT leads_email_length CHECK (email IS NULL OR char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT leads_note_length CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX idx_leads_bot_id
  ON public.leads(bot_id, created_at DESC) WHERE deleted_at IS NULL;
-- Oturum basina talep siniri (spam) bu indeksle sayilir.
CREATE INDEX idx_leads_conversation_id
  ON public.leads(conversation_id);
CREATE INDEX idx_leads_created_at
  ON public.leads(created_at);

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (Faz 1 kurali: SELECT/UPDATE'te deleted_at filtresi YOK, app layer'da)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own" ON public.leads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = leads.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "leads_insert_own" ON public.leads FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = leads.bot_id AND bots.user_id = auth.uid()));

CREATE POLICY "leads_update_own" ON public.leads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = leads.bot_id AND bots.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bots WHERE bots.id = leads.bot_id AND bots.user_id = auth.uid()));

GRANT SELECT, INSERT ON public.leads TO authenticated;
GRANT UPDATE (status, deleted_at) ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO service_role;

-- ---- 180 gun saklama -----------------------------------------------------------
SELECT cron.schedule(
  'purge-leads',
  '27 3 * * *',
  $$DELETE FROM public.leads WHERE created_at < now() - interval '180 days'$$
);
