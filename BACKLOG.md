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
- [ ] Claude API entegrasyonu (anthropic SDK, env'de API key)
- [ ] Bot Detay sayfasına "Test Sohbeti" sekmesi
- [ ] Mesajlaşma UI (kullanıcı → bot, bot → kullanıcı, history)
- [ ] Token/cost takibi (mesaj başına basit log)

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
