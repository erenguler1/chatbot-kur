import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')

    let valid = true
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError('Geçerli bir e-posta gir.')
      valid = false
    } else {
      setEmailError('')
    }
    if (password.length < 6) {
      setPasswordError('Şifre en az 6 karakter olmalı.')
      valid = false
    } else {
      setPasswordError('')
    }
    if (!valid) return

    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch {
      setFormError('E-posta veya şifre hatalı.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] px-4 py-8">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] font-bold">
            C
          </div>
          <div className="text-[var(--text)] font-bold text-lg tracking-tight">ChatBotKur</div>
        </div>

        <h1 className="text-[var(--text)] text-2xl font-bold mb-1">Tekrar hoş geldin</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          Hesabına giriş yap ve botlarını yönet
        </p>

        {/* TODO: Hafta 1 sonu — Supabase Dashboard'da Google enable et */}
        {/* <button type="button" className="...">Google ile Giriş Yap</button> */}
        {/* <div className="auth-divider">veya e-posta ile</div> */}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="loginEmail" className="block text-[var(--text)] text-sm mb-1.5">
              E-posta
            </label>
            <input
              id="loginEmail"
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

          <div className="mb-2">
            <label htmlFor="loginPassword" className="block text-[var(--text)] text-sm mb-1.5">
              Şifre
            </label>
            <input
              id="loginPassword"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2.5 text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {passwordError && (
              <div className="mt-1.5 text-xs text-[var(--danger)]">{passwordError}</div>
            )}
          </div>

          <div className="flex justify-end mb-4">
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              Şifremi unuttum
            </Link>
          </div>

          {formError && (
            <div className="mb-4 text-sm text-[var(--danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--radius-input)] px-3 py-2">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
          >
            {submitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Hesabın yok mu?{' '}
          <Link to="/signup" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Kayıt Ol
          </Link>
        </div>
      </div>
    </main>
  )
}
