# ChatBotKur

Türk işletmeleri için AI destekli chatbot platformu. Kafe, kuaför, e-ticaret gibi KOBİ'ler bot oluşturup web sitelerine embed edebilir, müşterilerin sorularını Claude AI ile cevaplandırabilir.

🔗 Canlı: https://chatbot-kur.vercel.app

Bu, Faz 1 MVP sürümüdür. Aktif geliştirme devam etmektedir.

## Özellikler

- Email/şifre kimlik doğrulama (Supabase Auth)
- Bot CRUD (oluştur, düzenle, soft-delete)
- Soru-cevap çiftleri (bilgi tabanı)
- Otomatik sistem prompt oluşturma (Türkçe, esnek davranış)
- Streaming chat (Server-Sent Events, kelime kelime yanıt)
- Public widget (embed script ile her siteye eklenebilir)
- Anonim müşteri chat'i (login gerektirmez)
- Token/maliyet takibi (her mesajda input/output sayısı)
- Row Level Security (PostgreSQL RLS)

## Teknoloji Yığını

- **Frontend:** React 18 + Vite + TypeScript (strict) + Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI:** Anthropic Claude Sonnet 4.5 (streaming)
- **Deploy:** Vercel
- **UI:** Radix UI (Dialog, AlertDialog, Dropdown), Lucide Icons
- **Router:** React Router v6

## Mimari

- **Auth:** Supabase Auth (email/password)
- **RLS pattern:** Kullanıcılar sadece kendi bot'larını görür
- **Streaming:** Edge Function → Anthropic streaming API → SSE → frontend ReadableStream reader
- **Anonim chat:** `public-chat` Edge Function service_role ile çalışır (RLS bypass), `session_id` ile rate limit
- **Embed:** Vanilla JS `embed.js` floating button + iframe içinde `Widget.tsx`

## Yerel Kurulum

**Ön Koşullar:** Node.js 18+, npm, Supabase hesabı, Anthropic API hesabı + kredi, Supabase CLI

1. Repo'yu klonla:

   ```bash
   git clone https://github.com/erenguler1/chatbot-kur.git
   cd chatbot-kur
   ```

2. Bağımlılıkları yükle:

   ```bash
   npm install
   ```

3. Supabase projesi kur, URL ve anon key'i kopyala.

4. `.env.local` dosyası oluştur:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

5. `supabase/migrations/` klasöründeki SQL dosyalarını Supabase Dashboard SQL Editor'da sırayla çalıştır (001-011).

6. Anthropic API key'i Supabase'e ekle:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

7. Edge Function'ları deploy et:

   ```bash
   supabase functions deploy chat
   supabase functions deploy public-chat --no-verify-jwt
   supabase functions deploy public-get-messages --no-verify-jwt
   ```

8. Dev server'ı başlat:

   ```bash
   npm run dev
   ```

## Embed Kullanımı

Bot oluşturduktan sonra, kullanıcının botunu kendi web sitesine eklemesi için tek satırlık script:

```html
<script src="https://chatbot-kur.vercel.app/embed.js?botId=BOT_UUID_HERE"></script>
```

Bu, sayfanın sağ alt köşesine floating bir chat butonu ekler. Müşteri tıkladığında iframe içinde widget açılır.

## Proje Yapısı

```
chatbot-kur/
├── public/
│   ├── embed.js              # Vanilla JS embed script
│   └── embed-test.html       # Yerel test sayfası
├── src/
│   ├── pages/                # Login, Dashboard, BotDetail, Widget, ...
│   ├── hooks/                # useAuth, useBot, useStreamingChat, ...
│   ├── components/           # BotActionMenu, QAFormDialog, ...
│   ├── lib/                  # supabase client, promptBuilder, ...
│   └── types/                # TypeScript interfaces
├── supabase/
│   ├── migrations/           # PostgreSQL şema değişiklikleri (001-011)
│   └── functions/            # Edge Function'lar
│       ├── chat/             # Login'li streaming chat
│       ├── public-chat/      # Anonim streaming chat
│       └── public-get-messages/  # Anonim history endpoint
├── vercel.json               # SPA fallback config
└── BACKLOG.md                # Faz 1 ✅ + Faz 2 yol haritası
```

## Notlar

- `vercel.json` SPA fallback için zorunlu. Olmazsa hard refresh 404 verir.
- Supabase `service_role` key Edge Function'larda otomatik mevcut.
- Public Edge Function'lar `--no-verify-jwt` flag ile deploy edilmeli.

## Yol Haritası

Detaylı liste [BACKLOG.md](./BACKLOG.md)'de. Faz 2 hedefleri:

- Stripe ödeme entegrasyonu
- Email bildirimleri
- Multi-tenancy / workspace
- Analytics dashboard
- Widget customization
- Bot Detay'da "Web Sitene Ekle" sekmesi

## Geliştirici

Eren Güler ([@erenguler1](https://github.com/erenguler1)) — 2026

Bu proje [Anthropic Claude Code](https://claude.com/claude-code) yardımı ile geliştirilmiştir.
