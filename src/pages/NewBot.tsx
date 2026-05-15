import { useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { Header } from '../components/Header'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { BotBusinessType, BotTone, BotWidgetPosition } from '../types/bot'

const BUSINESS_TYPES: Array<{ value: BotBusinessType; label: string }> = [
  { value: 'cafe_restaurant', label: 'Kafe / Restoran' },
  { value: 'hair_barber', label: 'Kuaför / Berber' },
  { value: 'beauty_salon', label: 'Güzellik Salonu' },
  { value: 'digital_agency', label: 'Dijital Ajans' },
  { value: 'ecommerce', label: 'E-ticaret' },
  { value: 'other', label: 'Diğer' },
]

const TONES: Array<{ value: BotTone; label: string }> = [
  { value: 'friendly', label: 'Samimi' },
  { value: 'formal', label: 'Resmi' },
  { value: 'casual', label: 'Günlük' },
]

const WIDGET_POSITIONS: Array<{ value: BotWidgetPosition; label: string }> = [
  { value: 'bottom_right', label: 'Sağ alt' },
  { value: 'bottom_left', label: 'Sol alt' },
  { value: 'middle_right', label: 'Sağ orta' },
  { value: 'middle_left', label: 'Sol orta' },
]

const INPUT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors'

const TEXTAREA_CLASS =
  'w-full h-24 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors'

const SELECT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 pr-9 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] appearance-none transition-colors'

const LABEL_CLASS = 'block text-sm font-medium text-[var(--text)] mb-1.5'

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export function NewBot() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [businessType, setBusinessType] = useState<BotBusinessType>('cafe_restaurant')
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Merhaba! Size nasıl yardımcı olabilirim?',
  )
  const [noMatchMessage, setNoMatchMessage] = useState(
    'Üzgünüm, bu konuda yardımcı olamıyorum. Başka bir sorunuz var mı?',
  )
  const [tone, setTone] = useState<BotTone>('friendly')
  const [brandColor, setBrandColor] = useState('#E91E63')
  const [widgetPosition, setWidgetPosition] = useState<BotWidgetPosition>('bottom_right')

  const [nameError, setNameError] = useState('')
  const [welcomeError, setWelcomeError] = useState('')
  const [noMatchError, setNoMatchError] = useState('')
  const [colorError, setColorError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')

    let valid = true

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setNameError('Bot adı gerekli.')
      valid = false
    } else if (trimmedName.length > 100) {
      setNameError('Bot adı 100 karakteri geçemez.')
      valid = false
    } else {
      setNameError('')
    }

    const trimmedWelcome = welcomeMessage.trim()
    if (trimmedWelcome.length === 0) {
      setWelcomeError('Karşılama mesajı gerekli.')
      valid = false
    } else {
      setWelcomeError('')
    }

    const trimmedNoMatch = noMatchMessage.trim()
    if (trimmedNoMatch.length === 0) {
      setNoMatchError('Anlamadığında mesajı gerekli.')
      valid = false
    } else {
      setNoMatchError('')
    }

    if (!HEX_REGEX.test(brandColor)) {
      setColorError('Geçerli bir renk gir (#RRGGBB).')
      valid = false
    } else {
      setColorError('')
    }

    if (!valid) return

    if (!user) {
      setFormError('Oturum bulunamadı. Lütfen tekrar giriş yap.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('bots')
        .insert({
          user_id: user.id,
          name: trimmedName,
          description: description.trim() || null,
          business_type: businessType,
          welcome_message: trimmedWelcome,
          no_match_message: trimmedNoMatch,
          tone,
          brand_color: brandColor,
          widget_position: widgetPosition,
          status: 'draft',
        })
        .select()
        .single()
      if (error) throw error
      navigate('/')
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Bot oluşturulamadı. Lütfen tekrar dene.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Header />
      <main className="max-w-2xl mx-auto p-4 md:p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Bot Listesine Dön
        </button>

        <h1 className="text-2xl font-bold text-[var(--text)]">Yeni Bot Oluştur</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 mb-6">
          Bot'unun temel ayarlarını gir, sonra QA çiftlerini ekle
        </p>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-6"
        >
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="botName" className={LABEL_CLASS}>
                Bot Adı
              </label>
              <input
                id="botName"
                type="text"
                maxLength={100}
                placeholder="Örn: Müşteri Destek Botu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
              {nameError && (
                <div className="text-xs text-[var(--danger)] mt-1">{nameError}</div>
              )}
            </div>

            <div>
              <label htmlFor="botDescription" className={LABEL_CLASS}>
                Açıklama
              </label>
              <textarea
                id="botDescription"
                placeholder="Botun ne işe yarayacağını kısaca anlat"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div>
              <label htmlFor="botBusinessType" className={LABEL_CLASS}>
                İşletme Türü
              </label>
              <div className="relative">
                <select
                  id="botBusinessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as BotBusinessType)}
                  className={SELECT_CLASS}
                >
                  {BUSINESS_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="botWelcomeMessage" className={LABEL_CLASS}>
                Karşılama Mesajı
              </label>
              <textarea
                id="botWelcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className={TEXTAREA_CLASS}
              />
              {welcomeError && (
                <div className="text-xs text-[var(--danger)] mt-1">{welcomeError}</div>
              )}
            </div>

            <div>
              <label htmlFor="botNoMatchMessage" className={LABEL_CLASS}>
                Anlamadığında Mesaj
              </label>
              <textarea
                id="botNoMatchMessage"
                value={noMatchMessage}
                onChange={(e) => setNoMatchMessage(e.target.value)}
                className={TEXTAREA_CLASS}
              />
              {noMatchError && (
                <div className="text-xs text-[var(--danger)] mt-1">{noMatchError}</div>
              )}
            </div>

            <div>
              <label htmlFor="botTone" className={LABEL_CLASS}>
                Konuşma Tonu
              </label>
              <div className="relative">
                <select
                  id="botTone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as BotTone)}
                  className={SELECT_CLASS}
                >
                  {TONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="botBrandColor" className={LABEL_CLASS}>
                Marka Rengi
              </label>
              <div className="flex gap-2">
                <input
                  id="botBrandColor"
                  type="color"
                  value={HEX_REGEX.test(brandColor) ? brandColor : '#E91E63'}
                  onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                  className="w-12 h-10 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--bg-app)] cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#E91E63"
                  className={`${INPUT_CLASS} flex-1 font-mono`}
                />
              </div>
              {colorError && (
                <div className="text-xs text-[var(--danger)] mt-1">{colorError}</div>
              )}
            </div>

            <div>
              <label htmlFor="botWidgetPosition" className={LABEL_CLASS}>
                Widget Konumu
              </label>
              <div className="relative">
                <select
                  id="botWidgetPosition"
                  value={widgetPosition}
                  onChange={(e) => setWidgetPosition(e.target.value as BotWidgetPosition)}
                  className={SELECT_CLASS}
                >
                  {WIDGET_POSITIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>

            {formError && (
              <div className="text-sm text-[var(--danger)]">{formError}</div>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
              >
                {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
