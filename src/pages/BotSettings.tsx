import { useEffect, useState, type SubmitEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type {
  Bot,
  BotBusinessType,
  BotStatus,
  BotTone,
  BotWidgetPosition,
} from '../types/bot'

interface BotDetailContext {
  bot: Bot
  refetch: () => Promise<void>
}

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

const STATUSES: Array<{ value: BotStatus; label: string }> = [
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'draft', label: 'Taslak' },
]

const INPUT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors'

const TEXTAREA_CLASS =
  'w-full h-24 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] resize-none transition-colors'

const SELECT_CLASS =
  'w-full h-10 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 pr-9 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] appearance-none transition-colors'

const LABEL_CLASS = 'block text-sm font-medium text-[var(--text)] mb-1.5'

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export function BotSettings() {
  const { bot, refetch } = useOutletContext<BotDetailContext>()

  const [name, setName] = useState(bot.name)
  const [description, setDescription] = useState(bot.description ?? '')
  const [businessType, setBusinessType] = useState<BotBusinessType>(bot.business_type)
  const [welcomeMessage, setWelcomeMessage] = useState(bot.welcome_message)
  const [noMatchMessage, setNoMatchMessage] = useState(bot.no_match_message)
  const [tone, setTone] = useState<BotTone>(bot.tone)
  const [brandColor, setBrandColor] = useState(bot.brand_color)
  const [widgetPosition, setWidgetPosition] = useState<BotWidgetPosition>(bot.widget_position)
  const [status, setStatus] = useState<BotStatus>(bot.status)

  const [nameError, setNameError] = useState('')
  const [welcomeError, setWelcomeError] = useState('')
  const [noMatchError, setNoMatchError] = useState('')
  const [colorError, setColorError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setName(bot.name)
    setDescription(bot.description ?? '')
    setBusinessType(bot.business_type)
    setWelcomeMessage(bot.welcome_message)
    setNoMatchMessage(bot.no_match_message)
    setTone(bot.tone)
    setBrandColor(bot.brand_color)
    setWidgetPosition(bot.widget_position)
    setStatus(bot.status)
  }, [bot])

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setSuccessMessage('')

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

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('bots')
        .update({
          name: trimmedName,
          description: description.trim() || null,
          business_type: businessType,
          welcome_message: trimmedWelcome,
          no_match_message: trimmedNoMatch,
          tone,
          brand_color: brandColor,
          widget_position: widgetPosition,
          status,
        })
        .eq('id', bot.id)
      if (error) throw error
      await refetch()
      setSuccessMessage('Değişiklikler kaydedildi.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="py-6">
      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="botName" className={LABEL_CLASS}>
            Bot Adı
          </label>
          <input
            id="botName"
            type="text"
            maxLength={100}
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

        <div>
          <label htmlFor="botStatus" className={LABEL_CLASS}>
            Durum
          </label>
          <div className="relative">
            <select
              id="botStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as BotStatus)}
              className={SELECT_CLASS}
            >
              {STATUSES.map((opt) => (
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

        {successMessage && (
          <div className="text-sm text-[var(--success)]">{successMessage}</div>
        )}
        {formError && (
          <div className="text-sm text-[var(--danger)]">{formError}</div>
        )}

        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
          >
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </form>
  )
}
