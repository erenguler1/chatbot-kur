# ChatBotKur — Backlog

## Faz 1 (3-4 hafta) — Demo Edilebilir SaaS

Şu an çalışılan plan. Bittiğinde paylaşılabilir, çalışan SaaS.

### Hafta 1 — Foundation + Bot CRUD
- [x] DB tasarımı (bots, qa_pairs tabloları, RLS policies, GRANT) — Gün 1, tag: scaffold-v0.1
- [x] Auth (Login/Signup/ForgotPassword/Dashboard placeholder) — Gün 2, tag: auth-v0.1
- [x] Bot listesi sayfası (responsive, filter, sort, Supabase, RLS verified) — Gün 3, tag: bots-v0.1
- [ ] Yeni Bot Oluştur sayfası (/bots/new) — Gün 4
- [ ] Bot Detay sayfası (/bots/:id - görüntüle/düzenle) — Gün 5
- [ ] Bot silme (Radix Dialog ile onay) — Gün 5

### Hafta 2 — QA Pairs + Prompt Engineering
- [ ] QA pairs CRUD (bot detayında soru-cevap ekle/sil/güncelle)
- [ ] Bulk import (Excel veya CSV'den toplu QA yükleme) — opsiyonel
- [ ] System prompt builder (bot tonu + business_type + qa_pairs → final prompt)
- [ ] Prompt önizleme paneli (oluşan prompt'u görmek için)

### Hafta 3 — Claude API + Test Sohbeti
- [x] Claude API entegrasyonu (anthropic SDK, env'de API key) — Edge Function (chat) + streaming SSE
- [x] Bot Detay sayfasına "Test Sohbeti" sekmesi — BotTest sayfası
- [x] Mesajlaşma UI (kullanıcı → bot, bot → kullanıcı, history) — optimistic update + streaming bubble + Sıfırla
- [x] Token/cost takibi (mesaj başına basit log) — messages tablosunda input_tokens/output_tokens

### Hafta 4 — Public Widget + Deploy
- [x] Embed script veya web component (public/embed.js — vanilla JS IIFE, floating button + iframe toggle)
- [x] Public widget sayfası /widget/:botId (Widget.tsx — anonim chat + history)
- [x] Public chat endpoint (public-chat + public-get-messages Edge Functions, no JWT, service_role)
- [x] Bot Detay'da "Web Sitene Ekle" sekmesi (embed kodu kopyala)
- [x] Vercel deploy + env config (chatbot-kur.vercel.app live, SPA fallback vercel.json eklendi)
- [ ] Custom domain (opsiyonel)
- [x] Faz 1 polish günü (BACKLOG güncelleme, polish notları Faz 2'ye taşındı)

---

## Faz 2 (sonra eklenir, Faz 1 bittiğinde başlar)

Faz 1 çalışıyor; Faz 2 üstüne kalite katar. Sırası kullanıcı geri bildirimine göre değişebilir.

### RAG / Belgeler
- [x] PDF yükleme — metin tabanlı (v0.2)
- [x] Kısa/çok konulu metinlerde parçalama — section-30, eşik 0,40 (v0.2; "glutensiz" 0,26 → 0,45)
- [ ] Taranmış PDF için OCR
- [x] Web sitesinden içe aktarma — sitemap/bağlantılar, 30 sayfa, SSRF koruması, robots.txt + Crawl-delay, Yeniden tara (v0.3)
- [x] Cevaplanamayan sorular paneli — maskeleme, anlam bazlı gruplama, Q&A'ya çevir / yoksay, 90 gün (v0.3)
- [ ] JavaScript ile yüklenen siteler (SPA): içerik boş geliyor, şimdilik Türkçe uyarı veriliyor. Headless tarayıcı (ör. harici render servisi) gerekir; Edge Function'da çalışmaz
- [ ] Site içe aktarmada ürün/kategori sayfaları ve yasal metinler (KVKK, çerez) 30 sayfalık kotayı dolduruyor; sayfa seçimi (kullanıcı listeden işaretlesin) veya yasal sayfaları sona atma
- [ ] Zamanlanmış otomatik "Yeniden tara" (haftalık; pg_cron + import-site)
- [ ] DNS rebinding'e karşı tam koruma: çözülen IP'ye bağlanıp Host/SNI ile istek (şu an kontrol ile fetch arasında küçük pencere var)
- [ ] Belge düzenleme (şimdilik sil + yeniden ekle; orijinal metin artık saklandığı için kolaylaştı)
- [ ] Eş anlamlı ifade eşleşmesi: "Geç kalırsam ne olur?" ↔ "gecikmelerde" (0,379, eşik altı); v0.3 canlı örnek: "Kronotrop ne zaman kuruldu?" ↔ "2012'de yola çıktık" (0,335). Olası çözüm: **hibrit arama** — anlam araması (pgvector) + anahtar kelime araması (Postgres full-text, `tsvector`, Türkçe yapılandırma/unaccent) birlikte, sonuçlar RRF (reciprocal rank fusion) ile birleştirilir; alternatif/ek: sorgu genişletme/yeniden yazma. rag-eval'e bu soruları ekleyip ölç
- [ ] Eval setini büyüt (gerçek müşteri soruları geldikçe); şu an 36 + 106 soru, eşik payı dar (en yüksek yanlış 0,39 / eşik 0,40)

### Tool Use
- [x] İletişim talebi (lead capture) — özet + KVKK + açık onay, sunucu doğrulaması, Talepler sekmesi, rozet, aç/kapa, 180 gün (v0.1)
- [ ] E-posta bildirimi (yeni talep): alan adı alınınca Resend (ücretsiz: ayda 3.000 / günde 100 e-posta, 1 alan adı; DNS doğrulaması gerekir). Şimdilik yalnızca panel rozeti
- [ ] Randevu / rezervasyon talebi aracı (tarih-saat + hizmet; çalışma saatleriyle çakışma kontrolü)
- [ ] "Şu an açık mısınız?" aracı: gerçek saat (Europe/Istanbul) + işletmenin yapılandırılmış çalışma saatleri (yeni alan) — model saati bilmiyor
- [ ] Sipariş durumu sorgulama (e-ticaret; sipariş no + doğrulama, harici API/entegrasyon gerekir)
- [ ] Talepler: Test Sohbeti'nden gelenleri ayır (kaynak alanı) ve dışa aktar (CSV)
- [ ] Cevaplanamayan sorular için no-match'i metin yerine araçla işaretleme (yapılandırılmış sinyal)

### Kalite ve Eval
- [ ] Eval set'leri (bot başına test soruları, otomatik scoring)
- [ ] Bot kalite skoru dashboard'u
- [ ] Conversation analytics (en sık sorulan sorular; "anlaşılamayan" kısmı v0.3 cevaplanamayan sorular paneliyle kısmen geldi)
- [ ] Cevaplanamayan sorular: no-match tespiti metin eşleşmesine dayanıyor (model cümleyi değiştirebilir); yapılandırılmış sinyal (tool use / ayrı alan) Faz 2 Tool Use ile düşünülebilir
- [ ] Test Sohbeti soruları da panele düşüyor (bot sahibinin denemeleri); kaynağa göre filtre (widget / test) eklenebilir

### Maliyet ve Kullanım
- [ ] Detaylı Claude API logging (her conversation kaç token, kaç $)
- [ ] Bot başına maliyet dashboard'u
- [ ] Kullanım limiti / quota yönetimi
- [ ] Kullanıcı bazında plan/billing (free/pro tier)

### Güvenlik (Production katmanları)
- [ ] Rate limiting (saatte/günde max conversation)
- [ ] Prompt injection koruması
- [ ] Inappropriate content filter
- [ ] CAPTCHA public widget'ta

### Conversation Tracking
- [ ] Gerçek conversation_count tracking (bots tablosuna kolon veya aggregate view)
- [ ] qa_count tracking (qa_pairs sayımı)
- [ ] Conversation history kalıcı saklama
- [ ] Bot performansı metrikleri

### Analytics ve Monitoring
- [ ] Sentry error tracking
- [ ] Plausible veya Umami web analytics
- [ ] User behavior tracking (hangi sayfada ne kadar kalıyor)
- [ ] Database query performance monitoring

### Admin
- [ ] Admin paneli (tüm kullanıcılar, tüm botlar)
- [ ] Manuel bot askıya alma
- [ ] Kullanıcı destek paneli
- [ ] Audit log

### Deployment ve DevOps
- [ ] Staging environment (preview deployments)
- [ ] CI/CD pipeline (otomatik test + deploy)
- [ ] Database backup strategy
- [ ] Migration codification (Migration 004 GRANT — manuel uygulandı, dosyaya eklenecek)
- [ ] Custom domain SSL
- [ ] CDN config
- [ ] Health check endpoints

### Kullanıcı Deneyimi
- [ ] Email notifications (yeni soru geldi, haftalık özet)
- [ ] Dark / light mode toggle (şu an sadece dark)
- [ ] Bot template'leri (iş kollarına hazır şablonlar)
- [ ] Multi-language UI (en, tr beraber)
- [ ] Bulk operations (botları toplu sil/aktive et)
- [ ] Bot kopyalama gerçek işlev
- [ ] Bot dışa aktar (JSON/CSV)
- [ ] Onboarding tour (ilk kullanıcı için)

### Chat & Streaming (Hafta 3'ten gelen polish noktaları)
- [ ] AbortController: useStreamingChat hook unmount olduğunda aktif fetch'i durdurmak. Şu an unmount sırasında fetch arka planda devam ediyor.
- [ ] Network hata mesajlarının Türkçe çevirisi: "Failed to fetch", "NetworkError" gibi browser/SDK mesajları kullanıcıya İngilizce görünüyor. Bir mapping katmanı eklenmeli.
- [ ] Orphan user message cleanup: Streaming sırasında Claude fail olursa user mesajı DB'de kalıyor, assistant cevabı yok. UI'da "Tekrar Dene" veya soft-delete cleanup gerekli.
- [ ] Auto-scroll sticky bottom: streamingText değişince sürekli alta gider. Kullanıcı yukarı scroll yapınca auto-scroll devre dışı kalmalı, en alta inince geri açılmalı (ChatGPT/Slack pattern).
- [ ] Streaming chunk parçalama iyileştirmesi: Edge Function şu an Anthropic'in default chunk boyutunu kullanıyor (genelde 1-3 kelime). Kelime sınırından parçalamak daha akıcı hissettirebilir. Performans değil UX kararı.
- [ ] Token sayacı UI: Conversation'da toplam input/output token + yaklaşık dolar maliyeti göster ("Bu sohbet $0.003"). Verisi messages tablosunda zaten var.
- [ ] "Geçmiş sohbetlerim" listesi: BotTest sekmesinde dropdown veya sidebar — kullanıcı eski conversation'lara dönebilsin. Şu an Sıfırla yeni oluşturuyor ama eskiyi göremezsin.
- [ ] Bot mesajına "yanlış cevap" feedback butonu (thumbs down): Veri toplama + prompt iyileştirme için.

### Type & Code Quality (Hafta 1-3'te biriken)
- [ ] SubmitEvent<HTMLFormElement> vs React.FormEvent<HTMLFormElement> tutarsızlığı: BotSettings/NewBot/Login/Signup/ForgotPassword SubmitEvent kullanıyor (yanlış tip), QAFormDialog ve BotTest FormEvent kullanıyor (doğru tip). Tüm dosyaları FormEvent'e çevir.
- [ ] supabase.ts'te SUPABASE_URL export edilmemiş, useStreamingChat env'i tekrar okuyor. Tek yerden export pattern'i.
- [ ] Anthropic SDK npm:@anthropic-ai/sdk yerine Deno-native veya pinned version. Şu an "npm:@anthropic-ai/sdk" latest çekiyor, breaking change ihtimali.

### Hafta 4'ten Gelen Polish Noktaları
- [ ] iframe state senkronizasyonu (postMessage): Widget iframe içinde refresh olduğunda embed.js'in isOpen state'i sıfırlanmıyor, ama buton hala X ikonunda kalıyor. Parent ↔ iframe postMessage ile state senkronizasyonu yapılmalı.
- [ ] Environment variable validation: VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY yanlış formatta olursa app startup'ta net hata vermeli (anon key JWT format kontrolü, URL trailing dot kontrolü gibi). Şu an sessizce "ağ bağlantısı kesildi" hatasıyla patlıyor.
- [ ] CORS preflight headers pattern: public-* Edge Function'larda Access-Control-Allow-Headers'da apikey eksikti, browser preflight reddediyordu. Yeni public Edge Function eklenirse şablonda apikey otomatik olsun (template veya helper).
- [ ] localStorage erişimi olmayan ortamlar (iframe sandbox, Safari private mode): usePublicBot'ta session_id her refresh'te yeniden üretiliyor → history kaybı. Cookie veya postMessage-tabanlı parent storage düşünülmeli.
- [ ] iframe içinde Widget mobile detection: window.matchMedia('(max-width: 480px)') sadece mount'ta bakılıyor, resize olunca güncellenmiyor. resize listener ile reactive yapılmalı.
- [ ] Anon select policy genişletme: Migration 011 sadece bots tablosu için. Faz 2'de qa_pairs için de anon SELECT istenebilir (Hakan amca'nın bot'unun cevap kütüphanesini "şeffaf" göstermek için landing page'de — opsiyonel).
- [ ] Vercel SPA fallback dokümante edilmeli: README'de "vercel.json gerekli" notu olmalı.

### Diğer
- [ ] PWA support (telefona "app" gibi yüklenebilsin)
- [ ] Webhook destekleri (bot'a yeni soru gelince Slack/email)
- [ ] Bot için A/B test
- [ ] Multi-user team / workspace desteği

---

## Notlar

- Bu BACKLOG yaşayan bir dosya. Yeni fikir aklına gelirse "Faz 2 / Diğer" altına ekle.
- Faz 1 boyunca buraya bakma stresi yapma; kafan rahat olsun, her şey not edildi.
- Faz 1 bitince Faz 2'nin ilk işini seçmek için gerçek kullanıcı geri bildirimi en iyi rehber.
