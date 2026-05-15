import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, SearchX } from 'lucide-react'
import { Header } from '../components/Header'
import { BotAvatar } from '../components/BotAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { useBot } from '../hooks/useBot'
import { getBotStatus } from '../types/bot'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

const TABS = [
  { to: 'settings', label: 'Ayarlar' },
  { to: 'qa', label: 'Sorular & Cevaplar' },
  { to: 'test', label: 'Test Sohbeti' },
]

export function BotDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bot, isLoading, error, refetch } = useBot(id)

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Header />
      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Botlarıma Dön
        </button>

        {isLoading ? (
          <div className="flex items-center gap-3 mb-6">
            <Skeleton width="w-12" height="h-12" className="rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton width="w-48" height="h-6" />
              <Skeleton width="w-20" height="h-5" className="rounded-full" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center">
            <EmptyState
              icon={<AlertCircle size={20} />}
              title="Bot yüklenemedi"
              description={error.message}
            />
            <button
              type="button"
              onClick={() => {
                void refetch()
              }}
              className={SECONDARY_BTN_CLASS}
            >
              Yeniden Dene
            </button>
          </div>
        ) : !bot ? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="Bot bulunamadı"
            description="Bu bot silinmiş veya erişim yetkin yok."
          />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <BotAvatar name={bot.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-[var(--text)] truncate">
                    {bot.name}
                  </h1>
                  <StatusBadge status={getBotStatus(bot)} />
                </div>
              </div>
            </div>

            <nav className="flex gap-1 border-b border-[var(--border)]">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      isActive
                        ? 'text-[var(--accent)] border-[var(--accent)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] border-transparent'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>

            <Outlet context={{ bot, refetch }} />
          </>
        )}
      </main>
    </div>
  )
}
