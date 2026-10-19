# ChatBotKur — Database Design v0.1

> Bu dosya **tasarım taslağıdır**. Henüz migration/SQL yazılmadı. Hafta 1 - Gün 1'de bu tasarıma göre Supabase'de tablolar oluşturulacak.

Kaynak: `CLAUDE.md` (DB kuralları) + `mockup/iskelet.html` (UI'dan çıkarılan alanlar).

---

## 1. Tablolar

### `bots`

Mockup'taki `initialBots` + `editBot*` form alanları + `createBotModal` alanları birleştirildi. CLAUDE.md'nin "her tabloda id/created_at/updated_at" ve "soft delete" kuralları uygulandı.

| Kolon | Tip | Kısıt | Açıklama |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Benzersiz bot kimliği. Embed kodunda `data-bot-id` olarak kullanılacak. |
| `user_id` | `uuid` | `NOT NULL`, `REFERENCES auth.users(id) ON DELETE CASCADE` | Botun sahibi. RLS bunun üstünden çalışır. |
| `name` | `text` | `NOT NULL`, `CHECK (char_length(name) >= 3)` | Bot adı. Mockup'ta min 3 karakter validasyonu var (`createBot` fonksiyonu). |
| `description` | `text` |  | Mockup'taki `newBotDesc` alanı. Opsiyonel. |
| `business_type` | `text` | `NOT NULL`, `CHECK (business_type IN (...))` | İşletme türü. Mockup seçenekleri: `cafe_restaurant`, `hair_barber`, `beauty_salon`, `digital_agency`, `ecommerce`, `other`. UI'da Türkçe gösterilecek, DB'de İngilizce/snake_case enum. |
| `welcome_message` | `text` | `NOT NULL`, `DEFAULT 'Merhaba! Size nasıl yardımcı olabilirim?'` | Karşılama mesajı (`editBotGreeting`). |
| `no_match_message` | `text` | `NOT NULL`, `DEFAULT 'Üzgünüm, bu konuda yardımcı olamıyorum. Başka bir sorunuz var mı?'` (023; eski: "…ekibimize iletiyorum.") | Q&A eşleşmediğinde gösterilecek mesaj. Mockup'ta yok ama brief'te isteniyor — runtime için şart. |
| `tone` | `text` | `NOT NULL`, `DEFAULT 'friendly'`, `CHECK (tone IN ('friendly','formal','casual'))` | Cevap üslubu. Mockup'ta yok ama brief'te isteniyor — bkz. Açık Sorular. |
| `brand_color` | `text` | `NOT NULL`, `DEFAULT '#f43f5e'`, `CHECK (brand_color ~ '^#[0-9A-Fa-f]{6}$')` | Hex renk. Mockup'ta `editBotColor` text input olarak duruyor → regex check ile validate. |
| `widget_position` | `text` | `NOT NULL`, `DEFAULT 'bottom_right'`, `CHECK (widget_position IN ('bottom_right','bottom_left','middle_right','middle_left'))` | Widget konumu (`editBotPosition`). |
| `status` | `text` | `NOT NULL`, `DEFAULT 'draft'`, `CHECK (status IN ('draft','active','paused'))` | Yayın durumu. Mockup `initialBots`'tan çıktı. |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | CLAUDE.md zorunlu. |
| `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | CLAUDE.md zorunlu. Trigger ile auto-update edilecek. |
| `deleted_at` | `timestamptz` |  | Soft delete (CLAUDE.md). NULL = aktif, NOT NULL = silinmiş. |

> **Not:** Mockup'taki `conversations` ve `questions` sayaçları `bots` tablosunda **tutulmayacak**. Bunlar türetilmiş veridir → `conversations` tablosundan COUNT, `questions` ise `qa_pairs` tablosundan COUNT. Aksi halde tutarsızlık riski. (Performans gerektiğinde view veya materialized view düşünülür.)

---

### `qa_pairs`

Mockup'taki `state.qas` ve `DEFAULT_QAS` yapısından çıkarıldı. Her Q&A bir bota bağlı.

| Kolon | Tip | Kısıt | Açıklama |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Benzersiz Q&A kimliği. |
| `bot_id` | `uuid` | `NOT NULL`, `REFERENCES bots(id) ON DELETE CASCADE` | Hangi bota ait. |
| `question` | `text` | `NOT NULL`, `CHECK (char_length(trim(question)) > 0)` | Soru. Mockup'ta boş olamıyor (`qaQuestionError`). |
| `answer` | `text` | `NOT NULL`, `CHECK (char_length(trim(answer)) > 0)` | Cevap. Mockup'ta boş olamıyor (`qaAnswerError`). |
| `sort_order` | `integer` | `NOT NULL`, `DEFAULT 0` | UI sıralaması. Default Q&A'lar 0..11 ile gelir, kullanıcı sürükle-bırak yapabilirse bunu güncelleriz. |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |
| `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |
| `deleted_at` | `timestamptz` |  | Soft delete. |

---

## 2. İlişkiler

```
auth.users (1) ──< (n) bots (1) ──< (n) qa_pairs
```

- `bots.user_id` → `auth.users.id` — `ON DELETE CASCADE` (kullanıcı silinince botları da silinir)
- `qa_pairs.bot_id` → `bots.id` — `ON DELETE CASCADE` (bot **hard delete** edilirse Q&A'lar da gider)

> **Soft delete + cascade ilişkisi:** Bot soft-delete olduğunda (deleted_at set) Q&A'lar otomatik silinmez, çünkü PG cascade sadece gerçek DELETE'te çalışır. Q&A'ları "görünmez" yapmak için query'de `bots.deleted_at IS NULL` filtresi eklemeyi RLS politikasına koyacağız (aşağıda).

---

## 3. RLS Policies

Tüm tablolarda RLS **AÇIK** olacak (CLAUDE.md kuralı). Aşağıdakiler taslak, migration'da finalize edilir.

### `bots`

```sql
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

-- SELECT: kullanıcı sadece kendi (silinmemiş) botlarını görür
CREATE POLICY "bots_select_own" ON bots FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: kullanıcı sadece kendi adına bot oluşturabilir
CREATE POLICY "bots_insert_own" ON bots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: kullanıcı sadece kendi botunu günceller (user_id değiştirilemesin)
CREATE POLICY "bots_update_own" ON bots FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: hard delete'e izin yok; silme = UPDATE deleted_at = now().
-- Bu yüzden DELETE policy'si yazmıyoruz (default: deny).
```

### `qa_pairs`

```sql
ALTER TABLE qa_pairs ENABLE ROW LEVEL SECURITY;

-- SELECT: kullanıcı sadece kendi botlarına ait Q&A'ları görür
CREATE POLICY "qa_pairs_select_own" ON qa_pairs FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = qa_pairs.bot_id
        AND bots.user_id = auth.uid()
        AND bots.deleted_at IS NULL
    )
  );

-- INSERT: bot kendisinin olmalı
CREATE POLICY "qa_pairs_insert_own" ON qa_pairs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_id AND bots.user_id = auth.uid())
  );

-- UPDATE: aynı şart
CREATE POLICY "qa_pairs_update_own" ON qa_pairs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = qa_pairs.bot_id AND bots.user_id = auth.uid())
  );
```

> **Public widget read:** Web sitelerine gömülen widget bot ve Q&A'ları okumalı ama o anda kullanıcı login değil. Bunun için ya (a) ayrı bir `service_role` Edge Function açarız (tercih edilen), ya da (b) `bots.status = 'active'` için anon SELECT policy'si açarız. Bu Hafta 1 - Gün 1'in scope'unda değil — runtime'a gelince netleşecek.

---

## 4. İndeksler

CLAUDE.md: "Sık sorgulanan kolonlara indeks ekle. `user_id` her zaman indeksli olmalı."

```sql
-- bots
CREATE INDEX idx_bots_user_id ON bots(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bots_user_status ON bots(user_id, status) WHERE deleted_at IS NULL;

-- qa_pairs
CREATE INDEX idx_qa_pairs_bot_id ON qa_pairs(bot_id) WHERE deleted_at IS NULL;
```

| İndeks | Neden |
|---|---|
| `idx_bots_user_id` | Botlarım sayfası: `WHERE user_id = X`. Partial index → silinmiş botlar dışarıda. |
| `idx_bots_user_status` | "Aktif botlarım" gibi filtreli listeler. |
| `idx_qa_pairs_bot_id` | Bot detay sayfasında Q&A listeleme. |

`(id)` PK'leri otomatik indekslenir, ekstra yazılmadı.

---

## 5. Soft Delete Stratejisi

- **Aktif kayıt:** `deleted_at IS NULL`
- **Silinmiş kayıt:** `deleted_at = now()` (UPDATE ile set edilir, gerçek DELETE çalıştırılmaz)
- Tüm SELECT query'leri `WHERE deleted_at IS NULL` filtresiyle çalışır → RLS policy'sine zaten gömülü.
- Restore için: `UPDATE bots SET deleted_at = NULL WHERE id = ...` (admin işlemi).
- Bot soft-silindiğinde Q&A'lar otomatik gizlenir (RLS policy'si bot'un `deleted_at IS NULL` olmasını şart koşar). Ayrıca bayrak gerekmez.
- **Uzun vadeli temizlik:** GDPR/KVKK için 30 gün sonra hard-delete eden bir cron job düşünülebilir → şimdi scope dışı, sadece not.

---

## 6. Default Q&A (mockup'ta 12 hazır soru)

Mockup'ta yeni bot oluşturulduğunda `DEFAULT_QAS` (12 adet) otomatik kopyalanıyor (`createBot` fonksiyonu). Bunu nerede yapacağız?

### Seçenek A — Application code (Edge Function veya client)
- **Artı:** En esnek; default listesi versiyonlanabilir (kodda dosya), kullanıcının diline/business_type'ına göre özelleştirilebilir.
- **Artı:** Test/değiştirme kolay — DB migration gerekmez.
- **Eksi:** Bot oluşturma akışında 2 adım: önce `bots` insert, sonra 12 satır `qa_pairs` insert. Transaction yönetilmeli (Edge Function'da Supabase RPC ile tek transaction'da yapılabilir).

### Seçenek B — DB trigger (`AFTER INSERT ON bots`)
- **Artı:** Atomik — bot oluşturulur oluşturulmaz Q&A'lar var, client unutamaz.
- **Eksi:** Default listesi DB'ye gömülü (trigger fonksiyonunda hardcoded SQL) → değiştirmek migration gerektirir.
- **Eksi:** Business_type'a göre farklı default'lar yapmak istersek trigger şişer.

### Seçenek C — Seed JSON + Edge Function
- Default listesi `defaults/qa_starters_<business_type>.json` dosyasında, Edge Function bot oluştururken okur ve insert eder.
- **Artı:** Hem versiyonlanabilir (git'te) hem business_type'a göre özelleştirilebilir → ileride büyük artı.

### Önerim: **Seçenek C** (Edge Function + JSON dosyaları), kısa vadede C'nin minimal hali olarak Seçenek A.

İlk migration'da sadece tablolar oluşturulur, default Q&A insertion'ı `create-bot` Edge Function'a yazılır. Bu hem CLAUDE.md'nin "karmaşık işlemler için Edge Function" kuralına uyar hem de DB schema'yı sade tutar.

---

## 7. Açık Sorular

Hafta 1 - Gün 1 başlamadan netleştirilmeli:

1. **`tone` alanı enum mu, free text mi?**  
   Önerim: `CHECK (tone IN ('friendly','formal','casual'))`. Mockup'ta UI yok ama runtime cevap üretiminde lazım. Free text bırakırsak validation yükü artar.

2. **`brand_color` hex string mi, preset enum mu?**  
   Mockup'ta hex text input (`#f43f5e`). Önerim: hex string + regex check. Preset palette ileride UI'da color picker olarak gelir.

3. **`business_type` ileride genişleyecek mi?**  
   Şu an 6 seçenek (`cafe_restaurant`, `hair_barber`, `beauty_salon`, `digital_agency`, `ecommerce`, `other`). CHECK constraint vs gerçek PG `ENUM` tipi? CHECK daha esnek (yeni değer eklemek migration ama ENUM altering daha sancılı). **Önerim: CHECK constraint.**

4. **Bot başına Q&A limiti?**  
   Free tier'da örn. max 30 Q&A? Stripe planı gelene kadar limitsiz, sonra plan tablosundan okunur. **Şimdi: limit yok, ileride.**

5. **`updated_at` otomatik trigger mı, application'da mı?**  
   Önerim: PG trigger (`BEFORE UPDATE` → `NEW.updated_at = now()`). Tek bir trigger fonksiyonu yazıp her tabloya bağlanır. Application'a güvenmek hata kaynağı.

6. **Public widget okuma için anon access?**  
   Bu Gün 1 scope'u dışı, ama Gün 1'de RLS yazarken anon SELECT policy'si bırakırsak sonradan eklemek kolay olur. **Şu an: yok, runtime'da eklenecek.**

7. **Embed kodundaki `data-bot-id` UUID mi olacak (uzun) yoksa kısa slug mı?**  
   UUID güvenli ama embed kodu daha çirkin görünür. Slug eklemek istersek `bots.public_slug TEXT UNIQUE` kolonu lazım. **Önerim: şimdilik UUID, slug v2'de.**

---

## 8. v0.1 Scope Özeti (Gün 1'de yapılacak)

- [ ] `bots` tablosu (yukarıdaki şema)
- [ ] `qa_pairs` tablosu (yukarıdaki şema)
- [ ] RLS policies (yukarıdaki taslak)
- [ ] İndeksler (3 adet)
- [ ] `updated_at` trigger fonksiyonu (her iki tabloya bind)

**Scope dışı (sonraki günler):** `create-bot` Edge Function, default Q&A seed, Stripe entegrasyonu, public widget access, conversations tablosu.
