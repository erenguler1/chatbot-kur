# SaaS Builder Projesi — Claude Code Talimatlari

Bu dosya, SaaS uygulamasi gelistirirken Claude Code'un uyacagi kurallari ve mimari kararlari tanimlar.

---

## Teknoloji Yigini

- **Frontend:** React (Vite ile) veya vanilla JS. Next.js sadece ben istedigimde kullanilir.
- **Backend:** Supabase (Auth, Database, Storage, Edge Functions). Ayri bir backend sunucusu kurma.
- **Odemeler:** Stripe (Checkout, Customer Portal, Webhooks). Baska odeme sistemi kullanma.
- **Deployment:** Vercel (frontend) + Supabase (backend). Alternatif: GitHub Pages veya AntiGravity.
- **Stil:** Tailwind CSS tercih edilir. Bilesenler icin shadcn/ui veya kendi bilesenlerini yaz.
- **State yonetimi:** React Context veya Zustand. Redux gibi agir cozumler kullanma.

## Kimlik Dogrulama (Auth)

- Supabase Auth kullan. Kendi auth sistemi yazma.
- Desteklenen yontemler: Email/Sifre + Magic Link. Sosyal giris (Google) opsiyonel.
- Auth durumunu `AuthContext` veya `useAuth` hook'u ile yonet.
- Korunan sayfalar icin route guard olustur. Giris yapmamis kullanici `/login`'e yonlendirilmeli.
- Session yonetimi Supabase'in kendi mekanizmasiyla yapilir. Token'lari manuel yonetme.
- Sifremi unuttum akisi her zaman olmali.

```
// Auth akisi
1. Kullanici kaydolur → Supabase Auth
2. Onay emaili → Email dogrulama
3. Ilk giris → Profil olusturma (profiles tablosu)
4. Stripe customer olustur → stripe_customer_id kaydet
```

## Veritabani Kurallari (Supabase/PostgreSQL)

- Tablo isimleri Ingilizce, snake_case: `user_profiles`, `subscriptions`, `invoices`.
- Her tabloda `id` (UUID, primary key), `created_at`, `updated_at` kolonlari olmali.
- Row Level Security (RLS) her tabloda ACIK olmali. RLS'siz tablo birakma.
- Foreign key iliskileri dogru kurulmali. Orphan kayit olusmasin.
- Soft delete kullan: `deleted_at` kolonu ekle, kaydi silme.
- Indeksler: Sik sorgulanan kolonlara indeks ekle. `user_id` her zaman indeksli olmali.

```sql
-- Ornek tablo yapisi
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

## API Tasarimi

- Supabase client ile dogrudan veritabani erisimi kullan (basit CRUD islemleri icin).
- Karmasik islemler icin Supabase Edge Functions yaz (Deno/TypeScript).
- Edge Function isimleri kebab-case: `create-checkout-session`, `handle-webhook`.
- Her Edge Function tek bir is yapsin. Buyuk fonksiyonlari parcala.
- Hata yonetimi standart olmali: `{ error: string, data: null }` veya `{ error: null, data: T }`.
- Rate limiting: Onemli endpoint'lerde rate limit uygula.

## Stripe Entegrasyonu

- Checkout Session ile odeme al. Kendi odeme formu yazma.
- Webhook'lari dinle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Webhook endpoint'inde `stripe.webhooks.constructEvent` ile imza dogrulama yap.
- Fiyatlandirma bilgisi Stripe'dan cekilmeli, hardcode yapma.
- Test modda gelistir. Canli anahtarlari `.env`'de tut, koda yazma.

```
// Stripe akisi
1. Kullanici "Satin Al" tiklar
2. Edge Function → Stripe Checkout Session olusturur
3. Kullanici Stripe'da oder
4. Webhook → subscription durumunu DB'ye yazar
5. Kullanici dashboard'a yonlendirilir
```

## UI/UX Prensipleri

- **Layout:** Sol sidebar navigasyon + sag tarafta icerik alani. Sidebar daraltilabilir olmali.
- **Dashboard:** Ozet kartlar (metrikler) ust kisimda, detay tablolar alt kisimda.
- **Tablolar:** Siralama, filtreleme ve sayfalama olmali. Bos durum mesaji goster.
- **Formlar:** Inline validasyon, yukleniyor durumu, basari/hata bildirimi.
- **Loading:** Skeleton loader kullan, spinner degil.
- **Responsive:** Mobilde sidebar hamburger meniye donusmeli.
- **Renk:** Koyu tema varsayilan. Acik tema destegi opsiyonel.
- **Bildirimler:** Toast mesajlari icin sag ust kose. 3 saniye sonra otomatik kapansin.

## Deployment

```
# Vercel deployment
1. GitHub repo'ya push et
2. Vercel'de projeyi bagla
3. Environment variable'lari Vercel dashboard'dan ekle
4. Her push'ta otomatik deploy

# Environment variables (Vercel + lokal)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=          # Sadece Edge Functions'da
STRIPE_WEBHOOK_SECRET=      # Sadece Edge Functions'da
```

## Guvenlik Kurallari

- API anahtarlarini ASLA frontend koduna gommme. `VITE_` prefiksi sadece anon key icin.
- Stripe secret key sadece sunucu tarafinda (Edge Functions) kullanilir.
- RLS politikalari olmadan tablo olusturma.
- Kullanici girdilerini her zaman dogrula (frontend VE backend).
- CORS ayarlarini sadece gerekli domain'lere ac.
- SQL injection'a karsi parametreli sorgular kullan (Supabase client bunu otomatik yapar).
- XSS'e karsi kullanici girdilerini render etmeden once sanitize et.
- `.env` dosyasi `.gitignore`'da olmali. Kontrol et.
- Hassas islemler (silme, plan degisikligi) icin onay diyalogu goster.

## Dosya Yapisi

```
src/
  components/          # Yeniden kullanilabilir bilesenler
    ui/                # Genel UI bilesenleri (Button, Modal, Table)
    layout/            # Layout bilesenleri (Sidebar, Header)
  pages/               # Sayfa bilesenleri (Dashboard, Settings, Login)
  hooks/               # Custom hook'lar (useAuth, useSubscription)
  lib/                 # Yardimci fonksiyonlar ve Supabase client
    supabase.ts
    stripe.ts
  contexts/            # React Context'ler
supabase/
  functions/           # Edge Functions
  migrations/          # Veritabani migration'lari
```

## Onemli Uyarilar

- Her yeni ozellik icin once mevcut kodu kontrol et. Tekrar yazma.
- Veritabani degisikliklerini migration dosyasi olarak olustur.
- Console.log'lari production'da birakma.
- Turkce UI metinleri icin sabit degerleri tek bir dosyada topla.
- Hata mesajlari kullaniciya anlasilir sekilde gosterilmeli, teknik detay degil.
