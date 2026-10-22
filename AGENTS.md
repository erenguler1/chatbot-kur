# ChatBotKur — AI Agent Talimatları

Bu dosya, ChatBotKur projesi üzerinde çalışan AI agent'ların (Claude Code, Codex, Cursor vb.) uyacağı kuralları ve Faz 1'de alınmış mimari kararları tanımlar.

---

## Proje Özeti

- **Ne:** Türk KOBİ'ler için AI destekli chatbot SaaS (kafe, kuaför, e-ticaret)
- **Canlı:** https://chatbot-kur.vercel.app
- **Repo:** github.com/erenguler1/chatbot-kur (private)
- **Faz 1:** Tamamlandı (Mayıs 2026, `faz-1-v1.0` tag)
- **Faz 2:** Devam ediyor — RAG (v0.3 canlıda: web sitesinden içe aktarma + cevaplanamayan sorular; v0.2: bölüm bazlı parçalama + PDF), Tool Use v0.1 canlıda (iletişim talebi), sırada Image, Voice, WhatsApp, MCP

## Teknoloji Yığını (Faz 1'de kilitlendi)

- **Frontend:** React 19 + Vite + TypeScript strict + Tailwind CSS v4
- **UI:** Radix UI (Dialog, AlertDialog, Dropdown) + Lucide Icons — shadcn/ui KULLANILMIYOR
- **Router:** React Router v7
- **Backend:** Supabase (project ref: ddsaqzfjcisakwfambmv, Frankfurt)
- **AI:** Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`), streaming SSE
- **Embeddings (Faz 2):** Voyage AI `voyage-4`, 1024 boyut, pgvector (hnsw, cosine)
- **Deploy:** Vercel (auto-deploy on push to main)

## Veritabanı — Gerçek Şema

Tablolar: `bots`, `qa_pairs`, `conversations`, `messages`, `document_sources` (RAG: yüklemenin ORİJİNAL metni, türü `text|pdf|url`, chunker'ı; web sayfasında `source_url`, `import_id`), `documents` (RAG: parça başına bir satır, `upload_id` → `document_sources.id`), `site_imports` (bir "Web sitesinden ekle" işlemi: sayfa listesi, ilerleme, robots.txt), `unanswered_questions` (maskelenmiş soru metni, embedding, `group_id`), `leads` (iletişim talepleri: ad, telefon/e-posta, not, `status new|contacted|closed`, `conversation_id`)
View: `document_uploads` (security_invoker; Belgeler sekmesi listesi, `document_sources`'tan okur). RPC: `match_documents` (RAG araması), `claim_site_import_pages` / `release_site_import_pages` / `record_site_import_progress` (import-site adımları, sadece service_role), `record_unanswered_question` (anlam bazlı gruplayarak ekler).
Belge silme: `document_sources.deleted_at` set edilir; trigger parçaları da soft-delete eder (018). Site kaldırma: `site_imports.deleted_at` → sayfaları → parçaları (019).
pg_cron: `purge-unanswered-questions` her gece 03:17'de 90 günden eski soruları kalıcı siler (020); `purge-leads` 03:27'de 180 günden eski talepleri (022).
`bots.lead_capture_enabled` (varsayılan true): iletişim talebi aracı açık/kapalı (022).

**Migration'lar `supabase db push` ile uygulanır** (Dashboard SQL Editor artık KULLANILMIYOR):
- 001–013 elle çalıştırılmıştı; uzak geçmişe `supabase migration repair --status applied` ile işlendi. 014+ push ile geldi.
- Yeni migration: `supabase/migrations/NNN_ad.sql` (3 haneli sıra numarası), sonra:
  1. Dry run: dosyayı `BEGIN; ... ROLLBACK;` arasına alıp `supabase db query --linked -f <dosya>` ile çalıştır.
  2. `supabase db push --linked --dry-run` → `supabase db push --linked`.
  3. `supabase migration list --linked` ile local/remote eşleşmesini kontrol et.
- `db push` boş `search_path` ile çalışır: pgvector `extensions` şemasında, tip/operator class'ı şemayla yaz (`extensions.vector(1024)`, `extensions.vector_cosine_ops`).
- Okuma amaçlı sorgu: `supabase db query --linked "select ..."` (bazen "login role" timeout verir; tekrar dene).

**KRİTİK RLS PATTERN:**
- SELECT/UPDATE policy'lerinde `deleted_at IS NULL` filter KOYMA.
- App layer'da filtreleniyor.
- Faz 1'de bu yüzden 3+ saatlik BotDetail bug'ı yaşandı (Migration 005, 006 fix'leri buradan).

**Diğer DB kuralları:**
- Her tabloda `id` (UUID), `created_at`, `updated_at`, `deleted_at` (soft delete)
- `user_id` her zaman indeksli
- Yeni tablo eklerken: service_role GRANT ver (Migration 010 pattern'i)
- Anonim erişim gerekirse: anon GRANT ver (Migration 011 pattern'i)
- Edge Function'ın okuyup işlediği alanları kullanıcı değiştirememeli: kolon bazlı GRANT (`GRANT UPDATE (deleted_at) ...`, 019/020 pattern'i)

## Edge Functions (Faz 1)

`supabase/functions/` altında:

- **`chat/`** — authenticated streaming chat. JWT verify.
- **`public-chat/`** — anonim widget streaming chat. `--no-verify-jwt` flag ile deploy. service_role ile RLS bypass.
- **`public-get-messages/`** — anonim history endpoint. `--no-verify-jwt`. Kolonları açıkça seçer (`messages.sources` müşteriye gitmez).
- **`import-site/`** (Faz 2, v0.3) — JWT ile; "Web sitesinden ekle". `start` (robots.txt + sitemap/bağlantılardan en çok 30 sayfa) → `step` (her çağrıda 3 sayfa; Crawl-delay varsa 1 sayfa + bekleme, sunucuda da zorlanır; Voyage 429'da sayfalar sıraya geri döner, `retry_after`) → `rescan` (aynı URL'nin kaynağını günceller, artık bulunmayan sayfaları siler). İşi tarayıcı sürer (`useSiteImports`), sekme açılınca yarım kalanı sürdürür.
- **`embed-document/`** (Faz 2) — JWT ile; bot sahipliğini doğrular, orijinal metni `document_sources`'a, parçaları `documents`'a yazar. `{ reprocess: upload_id }` modu belgeyi orijinal metinden güncel chunker ile yeniden parçalar (bot sahibi veya service_role JWT'si; admin kontrolü JWT `role` claim'iyle — fonksiyon `--no-verify-jwt` ile deploy EDİLMEMELİ, yoksa bu kontrol güvensiz olur).
- **`_shared/`** — deploy edilmez, fonksiyonlar import eder (kod tekrarı YOK):
  - `prompt.ts` — system prompt (chat + public-chat ortak)
  - `retrieval.ts` — RAG araması (`retrieveDocuments`, eşik, `sourcesForAnswer`)
  - `voyage.ts` — Voyage client (model sabiti burada; 128'lik batch'ler)
  - `chunking.ts` — parçalama (`chunkDocument`, `CHUNKER_ID`)
  - `documents.ts` — parça ekleme/silme/değiştirme (batch'li; embed-document + import-site)
  - `web.ts` — SSRF korumalı fetch, robots.txt, sitemap (import-site)
  - `html.ts` — HTML'den ana içerik (deno-dom; menü/footer/çerez bandı/bağlantı yoğun bloklar atılır, başlıklar `## `)
  - `unanswered.ts` — no-match tespiti, kişisel veri maskeleme, soru kaydı
  - `claude.ts` — model sabiti + araçlı streaming döngüsü (`streamReply`; chat + public-chat)
  - `leads.ts` — iletişim talebi aracı: tanım, KVKK cümlesi, sunucu doğrulaması (`validateLead`), kayıt (`createLead`)
  - Testler: `cd supabase/functions && deno test _shared/`; frontend saf modülleri: `deno test src/lib/questionGroups_test.ts` (`*_test.ts` app build'inden hariç)

**Kritik:** Public Edge Function'larda CORS preflight'ta `Access-Control-Allow-Headers`'a `apikey` eklemek zorunlu — yoksa browser preflight reddeder.

**Deploy komutları:**
```bash
supabase functions deploy chat
supabase functions deploy public-chat --no-verify-jwt
supabase functions deploy public-get-messages --no-verify-jwt
supabase functions deploy embed-document
supabase functions deploy import-site
```
`_shared/` değişirse onu kullanan TÜM fonksiyonları yeniden deploy et (chat, public-chat, embed-document, import-site). `prompt.ts`/`claude.ts`/`leads.ts` → chat + public-chat.

## RAG (Faz 2, v0.2)

- **Akış:** soru → Voyage `input_type: "query"` → `match_documents` (aynı botun en yakın 5 parçası) → benzerliği **0,40** altındakiler atılır → prompt'a eklenir.
- **Parçalama (`section-30b`):** başlıklar (BÜYÜK HARF, `##`, `1. Başlık`, `Başlık:`) bölüm açar; belge başlığı her parçaya önek olur ("Makas Kuaför › Erkek"); art arda gelen başlıklar iç içe birleşir ("Akbank Kampüs › Çalışma Saatleri"; v0.3, rag-eval parçaları birebir aynı → eşik geçerli); cümleler ve liste/fiyat satırları 30 kelimeye kadar paketlenir. Metin sınırı 200.000 karakter (frontend `MAX_DOCUMENT_CHARS` ile aynı).
- **Yöntem/eşik nasıl seçildi:** `scripts/rag-eval/` (Türkçe kafe/kuaför/iade metinleri, 36 alakalı + 106 alakasız/başka işletme sorusu). Sonuç: section-30 @0,40 → 35/36 isabet, 0 yanlış eşleşme; v0.1 (400/50 @0,35) → 24/36.
- **Kalibrasyon yeniden gerekirse** (model, chunker veya prompt dili değişince): `scripts/test-users.sh create` → `supabase functions deploy rag-eval` → `deno run -A scripts/rag-eval/eval.ts` → `supabase functions delete rag-eval` (silindiğini `functions list` + 404 ile doğrula) → `scripts/test-users.sh cleanup`. rag-eval sadece test kullanıcılarına açık; canlıda BIRAKMA.
- **Chunker değişince:** `CHUNKER_ID`'yi değiştir, embed-document'i deploy et, `deno run -A scripts/reprocess-documents.ts` (önce `--dry`) ile kayıtlı belgeleri yeniden işle.
- **PDF:** metin tarayıcıda çıkarılır (`src/lib/pdfText.ts`, pdfjs-dist, sadece PDF seçilince yüklenir). Sınır 10 MB / 100 sayfa. Taranmış/şifreli/bozuk PDF'te Türkçe hata. OCR yok. Dosyanın kendisi saklanmaz, sadece çıkan metin (`source_type = 'pdf'`).
- **Web sitesinden içe aktarma (v0.3):** her sayfa ayrı `document_sources` satırı (`source_type='url'`), ad "Sayfa başlığı · /yol". SSRF: yalnızca http/https ve varsayılan portlar, URL'de kullanıcı bilgisi yok, ad çözülüp tüm IP'ler herkese açık olmalı (localhost/özel/link-local/CGNAT/metadata/IPv6 ULA/mapped engelli), yönlendirmeler elle ve her adım yeniden kontrol, 2 MB / 10 sn. Kalan risk: DNS rebinding (kontrol ile fetch arasında). robots.txt: bizim grup (`ChatBotKurBot`) yoksa `*`; 5xx/zaman aşımı = okuma yok (RFC 9309). İçerik <200 karakter → "boş" (çoğunlukla JavaScript ile yüklenen site); hiç sayfa okunamazsa Türkçe JS uyarısı. Sınırlar: bot başına 5 site, site başına 30 sayfa, sayfa başına 200.000 karakter. Sayfa metni de `<belgeler>` içinde VERİ olarak gider.
- **Cevaplanamayan sorular (v0.3):** bot no-match ile cevap verince (`isNoMatchAnswer`: mesaj birebir ya da kelimelerinin ≥%60'ı kök eşleşmesiyle — model cümleyi bazen değiştiriyor) chat/public-chat yalnızca soru metnini kaydeder. Telefon/e-posta/kimlik/IBAN/kart maskelenir; embedding MASKELENMİŞ metinden üretilir (retrieval embedding'i yalnızca maskeleme hiçbir şey değiştirmediyse kullanılır, test var). `record_unanswered_question` soruyu en yakın açık soruyla (cosine ≥ 0,70; canlı ölçüm: aynı konu ≥0,72, farklı konu ≤0,41) aynı gruba koyar. Panel "Sorular & Cevaplar" sekmesinin üstünde; "Q&A olarak cevapla" kaydedilince ve "Yoksay" grubu soft-delete eder. 90 gün sonra pg_cron siler.
- **Öncelik:** Q&A çiftleri öncelikli, belgeler ek kaynak; çelişirse Q&A geçerli; ikisinde de yoksa `no_match_message` (uydurma yok).
- **Prompt injection:** belge içeriği `<belgeler><belge kaynak="...">` içinde "VERİ" olarak verilir, etiketler kaçırılır. Bu koruma `_shared/prompt_test.ts`'te test ediliyor; bozma.
- **İzolasyon:** `match_documents` her zaman `p_bot_id` ile filtreler. `chat` kullanıcı JWT'si ile çağırır (RLS de geçerli), `public-chat` service_role ile — orada TEK koruma bot filtresidir.
- **Dayanıklılık:** Voyage/arama hatası sohbeti kesmez, bot sadece Q&A ile cevaplar. Belgesi olmayan botta Voyage hiç çağrılmaz. Arama, diğer DB sorgularıyla paralel çalışır.
- **Kaynaklar:** `messages.sources` (text[]); bot "bilmiyorum" dediyse boş. Test Sohbeti'nde "Bakılan belgeler" olarak gösterilir.
- **Teşhis:** `chat` cevabında `Server-Timing: retrieval;dur=<ms>;desc="<skorlar veya hata>"` header'ı var (sadece bot sahibi; public-chat'te YOK).
- **Gecikme:** belgeli botta arama ~300–900 ms (medyan ~580 ms), belgesiz botta ~0.
- **Model değişirse:** tüm belgeler yeniden embed edilmeli (reprocess betiği) ve eşik rag-eval ile yeniden kalibre edilmeli. voyage-3/3.5 Voyage'ın 200M ücretsiz token kapsamında DEĞİL; voyage-4 kapsamda.
- **Voyage limiti:** hesapta ödeme yöntemi yoksa dakikada 3 istek / 10K token (429). Testleri buna göre yavaşlat; rag-eval ve reprocess betikleri 429'da bekleyip tekrar dener.

## Tool Use (Faz 2, v0.1)

- **Akış:** `streamReply` (`_shared/claude.ts`) metni akıtır; model `tool_use` ile durursa araç sunucuda çalışır, sonucu `tool_result` (hata ise `is_error`) olarak geri verilir ve cevap yeni istekle sürer. Cevap başına en fazla 2 araç turu, son istekte `tool_choice: none`. Token'lar turlar boyunca toplanır. `messages`'a yalnızca metin yazılır.
- **İletişim talebi (`iletisim_talebi_olustur`):** bot ad + telefon/e-posta + not toplar → tek mesajda özet + KVKK cümlesi ("Bilgileriniz yalnızca [bot adı] tarafından sizinle iletişim için kullanılacak.") + onay sorusu → müşteri onaylarsa araç. Model güvenilmez; sunucu (`validateLead`) şunları zorlar:
  1. Ad ve telefon/e-posta müşterinin KENDİ mesajlarında geçmeli (belge/Q&A'daki bilgi kullanılamaz → belge enjeksiyonu talep oluşturamaz). Telefon rakam bazında karşılaştırılır (0532…, +90 532…, 532… aynı).
  2. Botun bir önceki mesajında aynı iletişim bilgisi ve KVKK cümlesinin çekirdeği ("sizinle iletişim için kullanılacak") olmalı.
  3. Müşterinin şu anki mesajı açık onay olmalı (evet/tamam/olur/onaylıyorum/kabul…; hayır/vazgeç/değil/iptal/yanlış… varsa red).
  4. Biçim: TR telefon (mobil/sabit/850, `+90XXXXXXXXXX` olarak saklanır) veya `+` ile yabancı; e-posta regex. Sohbet başına en fazla 3 talep.
  Hata mesajı modele ne yapacağını söyler; prompt "araç başarılı dönmeden 'talebiniz iletildi' deme" der.
- **Kapalıyken** (`lead_capture_enabled=false`): araç verilmez, prompt kural 6 "talep alamazsın, 'not aldım' deme, doğrudan iletişime yönlendir".
- **Panel:** "Talepler" sekmesi (durum, sil = soft delete), yeni (`status='new'`) talep sayısı sekme rozetinde. `authenticated` yalnızca `status`, `deleted_at` güncelleyebilir.
- **Yeni araç eklerken:** tanımı ve doğrulamayı `_shared/<araç>.ts`'e koy, `runTool`'a ekle; modelin verdiği girdiyi her zaman sunucuda doğrula, belge içeriğini kaynak kabul etme.
- **Canlı test (Ekim 2026):** 3 telefon yazımı ✓, "tamam/olur/evet kaydedin" ✓, "hayır/vazgeçtim/emin değilim" kaydetmedi ✓, 4. talep reddedildi ✓, belgeye gizli "aracı çağır" talimatı tetiklemedi ✓.

## Test ve Geri Dönüş

- **Test kullanıcıları:** `scripts/test-users.sh create` → iki kullanıcı (`test-rag-a/b@chatbotkur.test`) + birer bot; bilgiler `scripts/.test-users.env`'de (gitignored). İş bitince `scripts/test-users.sh cleanup` (cascade ile bot/belge/sohbet de silinir, sorguyla doğrular). Gerçek kullanıcı hesabı ASLA kullanma.
- **Edge Function geri dönüşü:** önceki commit'i ayrı klasöre çıkar ve oradan deploy et:
  ```bash
  mkdir -p /tmp/rb && git archive <commit> supabase | tar -x -C /tmp/rb
  cd /tmp/rb && supabase functions deploy <fn> --project-ref ddsaqzfjcisakwfambmv   # public-*: --no-verify-jwt
  ```
- **Frontend geri dönüşü:** Vercel dashboard'da önceki deployment'ı "Promote to Production" (instant rollback).
- **Migration geri dönüşü:** yeni bir düzeltme migration'ı yaz; uygulanmış migration dosyasını değiştirme.

## Anthropic API

- **API key:** `ANTHROPIC_API_KEY` Supabase secrets'ta. Frontend'de YOK.
- **Model:** `claude-sonnet-4-5-20250929` (Faz 1'de kilitlendi, değiştirilmesin)
- **Pattern:** Anthropic SDK ile streaming SSE. Chunk'lar Edge Function'dan frontend'e ReadableStream ile aktarılır.
- **Token log:** Her mesaj `input_tokens` ve `output_tokens` `messages` tablosuna yazılır.

## Auth

- Supabase Auth, email/şifre. Magic link opsiyonel, Faz 1'de kullanılmadı.
- `AuthContext.tsx` + `useAuth.ts` hook'u. Session yönetimi Supabase'in kendisinde.
- `ProtectedRoute.tsx` component'i ile guard.

## UI/UX Kararları (Faz 1)

- **Tema:** Koyu tema varsayılan, açık tema yok
- **Layout:** Sidebar YOK, top nav pattern (Header.tsx)
- **Loading:** Skeleton loader (Skeleton.tsx)
- **Dil:** UI Türkçe, kod İngilizce, commit mesajları İngilizce
- **Renk:** Tailwind utility class'ları, sıfır custom CSS

## Env Variables (dikkat!)

- `VITE_SUPABASE_URL=https://ddsaqzfjcisakwfambmv.supabase.co` (**sonda nokta YOK**, Faz 1'de bu yüzden bug yaşandı)
- `VITE_SUPABASE_ANON_KEY=eyJ...` (**JWT format**, `sb_publishable_` DEĞİL — Faz 1'de bu yüzden bug yaşandı)
- `ANTHROPIC_API_KEY=sk-ant-...` (**Sadece Supabase secrets'ta**, Vercel'de YOK)
- `VOYAGE_API_KEY` (**Sadece Supabase secrets'ta**, Vercel'de YOK)

## Vercel

`vercel.json` SPA fallback için zorunlu:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
Yoksa hard refresh 404 verir.

## Faz 1'de Yakalanan 7 Kritik Bug (tekrar yaşanmasın)

1. Service_role GRANT eksiği → Migration 010
2. CORS preflight'ta `apikey` header eksiği → public Edge Function'larda hatırla
3. Vercel env'de `VITE_SUPABASE_URL` sonunda fazla nokta → format kontrolü
4. Vercel ANON_KEY yanlış format → JWT format kontrol
5. Vercel SPA fallback eksik → `vercel.json` rewrites
6. RLS UPDATE `WITH CHECK` eksiği → policy yazarken WITH CHECK zorunlu
7. BotDetail unmount'ta isLoading branch bug'ı → loading kontrolü dikkatli

## Faz 2'de Yakalananlar (RAG)

1. `documents`'ta `updated_at` yokken trigger vardı → her UPDATE (soft delete) patlıyordu → Migration 014
2. ivfflat boş tabloda kurulmuştu → hnsw'ye geçildi (014)
3. `db push` boş search_path → `vector_cosine_ops` bulunamadı → operator class'ı `extensions.` ile yaz
4. `hnsw.iterative_scan` fonksiyon seviyesinde `SET` ile ayarlanamıyor → fonksiyon gövdesinde `set_config(..., true)` (015)
5. Edge Function hata yanıtlarında CORS header yoktu → tarayıcı gerçek hatayı göremez; TÜM yanıtlara corsHeaders ekle, `x-client-info`'yu Allow-Headers'a koy
6. Voyage 429 (ödeme yöntemi yok) → arama sessizce düşüyordu; `Server-Timing` desc'inde hata görünür
7. v0.1 orijinal metni saklamıyordu (parçalarda satır sonları kayıp) → yeniden parçalama imkânsızdı → `document_sources` (018)
8. Edge Function'da `SUPABASE_SERVICE_ROLE_KEY` env'i, CLI'nın verdiği legacy service_role JWT'siyle aynı string DEĞİL → admin kontrolünü string karşılaştırmasıyla yapma
9. Küçük parçalarla belge başına ~1000 parça → Voyage (128), insert (200) ve `.in("id", ...)` delete (100) batch'lenmeli; uzun `in` listesi URL sınırını aşar
10. PDF satır kaydırması: rakam içeren kısa satır fiyat satırı sanılıyordu ("7 iş / günü") → küçük harfle devam eden satır paragrafın devamı sayılır
11. (v0.3) Art arda iki başlıkta ilk başlık kayboluyordu → şube adı düşüyordu ("Akbank Kampüs" + "Çalışma Saatleri:") → başlıklar iç içe birleşir (section-30b)
12. (v0.3) robots.txt Crawl-delay'e yalnızca tarayıcı uyuyordu → sunucu da `updated_at`'e bakıp zorlar
13. (v0.3) Model no-match mesajını kendi cümleleriyle yazınca soru kaydedilmiyordu → toleranslı tespit + prompt "kelimesi kelimesine"
14. (v0.3) Prompt'ta telefondan bahsetmek modele müşterinin numarasını işletmenin numarası gibi söyletti → kural: müşterinin verdiği bilgiyi tekrar etme, kaydettiğini söyleme
15. (v0.3) Kelime örtüşmesiyle soru gruplama Türkçede tutmadı (köpek/köpeğim, farklı fiiller) → embedding + `group_id` (021)
16. `npm:` ve `jsr:` supabase-js tipleri birbirine atanamaz → `_shared` modülü onu çağıran fonksiyonun client'ıyla aynı kaynaktan tip almalı (chat/public-chat: npm, embed-document/import-site: jsr)
17. (Tool Use) Talep alma kapalıyken model "bilgilerinizi not aldım" diyordu → kapalı mod için ayrı kural 6 (söz verme, doğrudan iletişime yönlendir)

## TypeScript Kuralları

- Strict mode, `any` yasak
- Type-only import: `import type { Foo } from '...'`
- Form events: `React.FormEvent<HTMLFormElement>` (SubmitEvent değil)

## Faz 3'e Ertelenenler (YAPMA)

- Stripe / ödeme entegrasyonu
- Multi-tenancy / workspace desteği
- Email bildirimleri
- Bunlar Faz 2'nin scope'unda değil, kod ekleme.

## Genel Kurallar

- Her yeni özellik için önce mevcut kodu kontrol et, tekrar yazma
- DB değişiklikleri migration dosyası olarak
- Console.log production'da bırakma
- Hata mesajları kullanıcıya Türkçe ve anlaşılır