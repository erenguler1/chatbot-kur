-- =============================================================================
-- 002_create_bots_table.sql
-- =============================================================================
-- Amac: bots tablosunu olustur. Her chatbot'un kimligi, sahibi, gorunumu ve
-- runtime davranisi (welcome/no_match mesajlari, tone, brand_color, position)
-- bu tabloda tutulur.
--
-- Kaynak: DESIGN.md §1 (bots tablo semasi) + §3 (RLS) + §4 (indeksler).
-- Onkosul: 001_create_update_trigger.sql (update_updated_at_column fonksiyonu).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablo: bots
-- -----------------------------------------------------------------------------
-- Kolon kisitlari DESIGN.md'deki tabloya birebir uyar:
--  - id: UUID PK, gen_random_uuid() ile otomatik olusur
--  - user_id: auth.users'a FK; kullanici silinince botlari da kaskadla silinir
--  - name: min 3 karakter (mockup'taki createBot validasyonu ile birebir)
--  - business_type / tone / widget_position / status: CHECK constraint ile enum
--  - brand_color: hex regex ile validate (#RRGGBB)
--  - welcome_message / no_match_message: NOT NULL + Turkce default'lar
--  - created_at / updated_at: zorunlu (CLAUDE.md), trigger ile auto-update
--  - deleted_at: NULL = aktif, NOT NULL = soft-deleted
CREATE TABLE public.bots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  business_type   TEXT        NOT NULL,
  welcome_message TEXT        NOT NULL DEFAULT 'Merhaba! Size nasıl yardımcı olabilirim?',
  no_match_message TEXT       NOT NULL DEFAULT 'Bu soruya henüz cevap veremiyorum, ekibimize iletiyorum.',
  tone            TEXT        NOT NULL DEFAULT 'friendly',
  brand_color     TEXT        NOT NULL DEFAULT '#f43f5e',
  widget_position TEXT        NOT NULL DEFAULT 'bottom_right',
  status          TEXT        NOT NULL DEFAULT 'draft',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,

  -- name min 3 karakter (mockup createBot validasyonu)
  CONSTRAINT bots_name_min_length
    CHECK (char_length(name) >= 3),

  -- business_type whitelist: mockup'taki 6 secenek
  CONSTRAINT bots_business_type_check
    CHECK (business_type IN (
      'cafe_restaurant',
      'hair_barber',
      'beauty_salon',
      'digital_agency',
      'ecommerce',
      'other'
    )),

  -- tone whitelist (DESIGN.md Acik Sorular #1)
  CONSTRAINT bots_tone_check
    CHECK (tone IN ('friendly', 'formal', 'casual')),

  -- widget_position whitelist (mockup editBotPosition secenekleri)
  CONSTRAINT bots_widget_position_check
    CHECK (widget_position IN (
      'bottom_right',
      'bottom_left',
      'middle_right',
      'middle_left'
    )),

  -- status whitelist (taslak / aktif / duraklatilmis)
  CONSTRAINT bots_status_check
    CHECK (status IN ('draft', 'active', 'paused')),

  -- brand_color hex format (#RRGGBB) regex ile dogrulanir
  CONSTRAINT bots_brand_color_hex
    CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$')
);

COMMENT ON TABLE  public.bots IS 'Kullanicilarin olusturdugu chatbot tanimlari. Soft-delete (deleted_at).';
COMMENT ON COLUMN public.bots.user_id IS 'Botun sahibi. RLS bu kolon uzerinden auth.uid() ile karsilastirir.';
COMMENT ON COLUMN public.bots.deleted_at IS 'NULL = aktif kayit. Set edildiginde bot soft-delete kabul edilir; RLS gizler.';

-- -----------------------------------------------------------------------------
-- Indeksler (DESIGN.md §4)
-- -----------------------------------------------------------------------------
-- Partial index'ler sadece aktif (deleted_at IS NULL) kayitlari kapsar.
-- Bu hem indeks boyutunu kucultur hem de tipik sorgularla (RLS filtresi)
-- birebir ortusur.

-- "Botlarim" sayfasi: WHERE user_id = auth.uid() AND deleted_at IS NULL
CREATE INDEX idx_bots_user_id
  ON public.bots(user_id)
  WHERE deleted_at IS NULL;

-- "Aktif botlarim" gibi durum filtreli listeler icin composite partial index
CREATE INDEX idx_bots_user_status
  ON public.bots(user_id, status)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- Trigger: updated_at otomatik guncelleme
-- -----------------------------------------------------------------------------
-- 001 migration'inda tanimlanan public.update_updated_at_column() fonksiyonunu
-- her UPDATE oncesi calistir. Boylece application kodu updated_at'i unutsa
-- bile tutarli kalir.
CREATE TRIGGER set_bots_updated_at
  BEFORE UPDATE ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- CLAUDE.md: "RLS her tabloda ACIK olmali, RLS'siz tablo birakma."
-- DELETE policy bilincli olarak yazilmiyor → hard-delete deny. Silme islemi
-- "UPDATE ... SET deleted_at = now()" ile yapilir (soft-delete).
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- SELECT: kullanici sadece kendi silinmemis botlarini gorur
CREATE POLICY "bots_select_own"
  ON public.bots
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
  );

-- INSERT: yeni kayit auth.uid() ile esit user_id tasimak zorunda
-- (kullanici baskasinin adina bot olusturamaz)
CREATE POLICY "bots_insert_own"
  ON public.bots
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- UPDATE: sadece kendi (silinmemis) botlarini guncelleyebilir.
-- WITH CHECK aynisini tekrar kontrol eder → user_id baskasina degistirilemez.
-- Soft-delete icin "UPDATE ... SET deleted_at = now()" bu policy ile gecer.
CREATE POLICY "bots_update_own"
  ON public.bots
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
  );

-- DELETE policy YOK → PostgreSQL default deny ile hard-delete engellenir.
