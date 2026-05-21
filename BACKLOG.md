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
- [ ] Embed script veya web component (kullanıcı sitesine eklenecek)
- [ ] Public chat endpoint (anonim kullanıcılar bot ile konuşabilsin)
- [ ] Bot Detay'da "Web Sitene Ekle" sekmesi (embed kodu kopyala)
- [ ] Vercel deploy + env config
- [ ] Custom domain (opsiyonel)
- [ ] Faz 1 polish günü (UX küçük düzeltmeler, hata mesajları, edge case'ler)

---

## Faz 2 (sonra eklenir, Faz 1 bittiğinde başlar)

Faz 1 çalışıyor; Faz 2 üstüne kalite katar. Sırası kullanıcı geri bildirimine göre değişebilir.

### Kalite ve Eval
- [ ] Eval set'leri (bot başına test soruları, otomatik scoring)
- [ ] Bot kalite skoru dashboard'u
- [ ] Conversation analytics (en sık sorulan, en az anlaşılan sorular)

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
