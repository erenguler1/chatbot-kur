# ChatBotKur — AI Agent Talimatları

Bu dosya, ChatBotKur projesi üzerinde çalışan AI agent'ların (Claude Code, Codex, Cursor vb.) uyacağı kuralları ve Faz 1'de alınmış mimari kararları tanımlar.

---

## Proje Özeti

- **Ne:** Türk KOBİ'ler için AI destekli chatbot SaaS (kafe, kuaför, e-ticaret)
- **Canlı:** https://chatbot-kur.vercel.app
- **Repo:** github.com/erenguler1/chatbot-kur (private)
- **Faz 1:** Tamamlandı (Mayıs 2026, `faz-1-v1.0` tag)
- **Faz 2:** Devam ediyor — RAG, Tool Use, Image, Voice, WhatsApp, MCP

## Teknoloji Yığını (Faz 1'de kilitlendi)

- **Frontend:** React 19 + Vite + TypeScript strict + Tailwind CSS v4
- **UI:** Radix UI (Dialog, AlertDialog, Dropdown) + Lucide Icons — shadcn/ui KULLANILMIYOR
- **Router:** React Router v7
- **Backend:** Supabase (project ref: ddsaqzfjcisakwfambmv, Frankfurt)
- **AI:** Anthropic Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`), streaming SSE
- **Deploy:** Vercel (auto-deploy on push to main)

## Veritabanı — Gerçek Şema

Tablolar: `bots`, `qa_pairs`, `conversations`, `messages`
Migration'lar: `supabase/migrations/001` — `011` sırayla, Dashboard SQL Editor'da manuel çalıştırılır.

**KRİTİK RLS PATTERN:**
- SELECT/UPDATE policy'lerinde `deleted_at IS NULL` filter KOYMA.
- App layer'da filtreleniyor.
- Faz 1'de bu yüzden 3+ saatlik BotDetail bug'ı yaşandı (Migration 005, 006 fix'leri buradan).

**Diğer DB kuralları:**
- Her tabloda `id` (UUID), `created_at`, `updated_at`, `deleted_at` (soft delete)
- `user_id` her zaman indeksli
- Yeni tablo eklerken: service_role GRANT ver (Migration 010 pattern'i)
- Anonim erişim gerekirse: anon GRANT ver (Migration 011 pattern'i)

## Edge Functions (Faz 1)

`supabase/functions/` altında:

- **`chat/`** — authenticated streaming chat. JWT verify.
- **`public-chat/`** — anonim widget streaming chat. `--no-verify-jwt` flag ile deploy. service_role ile RLS bypass.
- **`public-get-messages/`** — anonim history endpoint. `--no-verify-jwt`.

**Kritik:** Public Edge Function'larda CORS preflight'ta `Access-Control-Allow-Headers`'a `apikey` eklemek zorunlu — yoksa browser preflight reddeder.

**Deploy komutları:**
```bash
supabase functions deploy chat
supabase functions deploy public-chat --no-verify-jwt
supabase functions deploy public-get-messages --no-verify-jwt
```

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