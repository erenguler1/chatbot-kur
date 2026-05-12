import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function ForgotPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')
    setSuccessMessage('')

    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Geçerli bir e-posta gir.')
      return
    }
    setEmailError('')

    setSubmitting(true)
    try {
      await resetPassword(email.trim())
      setSuccessMessage('E-postanı kontrol et. Sıfırlama linki gönderildi.')
      setEmail('')
    } catch {
      setFormError('Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  const buttonLabel = submitting
    ? 'Gönderiliyor...'
    : successMessage
    ? 'Tekrar Gönder'
    : 'Sıfırlama Linki Gönder'

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] px-4 py-8">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] font-bold">
            C
          </div>
          <div className="text-[var(--text)] font-bold text-lg tracking-tight">ChatBotKur</div>
        </div>

        <h1 className="text-[var(--text)] text-2xl font-bold mb-1">Şifremi Unuttum</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          E-postanı gir, sıfırlama linki gönderelim.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="resetEmail" className="block text-[var(--text)] text-sm mb-1.5">
              E-posta
            </label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2.5 text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {emailError && (
              <div className="mt-1.5 text-xs text-[var(--danger)]">{emailError}</div>
            )}
          </div>

          {successMessage ? (
            <div className="mb-4 text-sm text-[var(--success)] bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)] rounded-[var(--radius-input)] px-3 py-2">
              {successMessage}
            </div>
          ) : formError ? (
            <div className="mb-4 text-sm text-[var(--danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-input)] px-3 py-2">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
          >
            {buttonLabel}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            Giriş sayfasına dön
          </Link>
        </div>
      </div>
    </main>
  )
}
