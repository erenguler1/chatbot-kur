import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthError } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [fullNameError, setFullNameError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordConfirmError, setPasswordConfirmError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError('')

    let valid = true

    const trimmedName = fullName.trim()
    if (trimmedName.length === 0) {
      setFullNameError('İsmini gir.')
      valid = false
    } else if (trimmedName.length < 2) {
      setFullNameError('İsim en az 2 karakter olmalı.')
      valid = false
    } else {
      setFullNameError('')
    }

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

    if (password !== passwordConfirm) {
      setPasswordConfirmError('Şifreler eşleşmiyor.')
      valid = false
    } else {
      setPasswordConfirmError('')
    }

    if (!valid) return

    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUp(email.trim(), password, trimmedName)
      if (needsEmailConfirmation) {
        setSuccessMessage(
          'Hesabın oluşturuldu. E-postandaki doğrulama linkine tıkla, sonra giriş yap.',
        )
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setSuccessMessage('')
      if (err instanceof AuthError && err.code === 'user_already_exists') {
        setFormError('Bu e-posta zaten kayıtlı.')
      } else if (
        err instanceof Error &&
        /already registered|already exists|user_already_exists/i.test(err.message)
      ) {
        setFormError('Bu e-posta zaten kayıtlı.')
      } else {
        setFormError('Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.')
      }
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

        <h1 className="text-[var(--text)] text-2xl font-bold mb-1">Hesap Oluştur</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6">
          Yeni hesap oluştur ve botlarını yönetmeye başla
        </p>

        {/* TODO: Hafta 1 sonu — Supabase Dashboard'da Google enable et */}
        {/* <button type="button" className="...">Google ile Kayıt Ol</button> */}
        {/* <div className="auth-divider">veya e-posta ile</div> */}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="regName" className="block text-[var(--text)] text-sm mb-1.5">
              Ad Soyad
            </label>
            <input
              id="regName"
              type="text"
              autoComplete="name"
              placeholder="Mehmet Yılmaz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2.5 text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {fullNameError && (
              <div className="mt-1.5 text-xs text-[var(--danger)]">{fullNameError}</div>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="regEmail" className="block text-[var(--text)] text-sm mb-1.5">
              E-posta
            </label>
            <input
              id="regEmail"
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

          <div className="mb-4">
            <label htmlFor="regPassword" className="block text-[var(--text)] text-sm mb-1.5">
              Şifre
            </label>
            <input
              id="regPassword"
              type="password"
              autoComplete="new-password"
              placeholder="En az 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2.5 text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {passwordError && (
              <div className="mt-1.5 text-xs text-[var(--danger)]">{passwordError}</div>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="regPasswordConfirm" className="block text-[var(--text)] text-sm mb-1.5">
              Şifre tekrar
            </label>
            <input
              id="regPasswordConfirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] px-3 py-2.5 text-[var(--text)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
            />
            {passwordConfirmError && (
              <div className="mt-1.5 text-xs text-[var(--danger)]">{passwordConfirmError}</div>
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
            {submitting ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Hesabın var mı?{' '}
          <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Giriş Yap
          </Link>
        </div>
      </div>
    </main>
  )
}
