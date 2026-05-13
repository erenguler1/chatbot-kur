import { useAuth } from '../hooks/useAuth'

export function Header() {
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut()
    } catch (err) {
      console.error('signOut başarısız:', err)
    }
  }

  return (
    <header className="h-[60px] bg-[var(--bg-content)] border-b border-[var(--border)] flex items-center px-6 gap-4">
      <div className="flex items-center gap-2 flex-1">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] font-bold">
          C
        </div>
        <div className="text-[var(--text)] font-bold text-lg tracking-tight">ChatBotKur</div>
      </div>

      {user?.email && (
        <span className="text-sm text-[var(--text-muted)]">{user.email}</span>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--accent-soft)] px-3 py-1.5 rounded-[var(--radius-btn)] transition-colors"
      >
        Çıkış Yap
      </button>
    </header>
  )
}
