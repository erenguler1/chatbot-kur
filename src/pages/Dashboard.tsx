import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Edit3,
  Copy,
  Trash2,
  Plus,
  Search,
  Download,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  SearchX,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Header } from '../components/Header'
import { BotAvatar } from '../components/BotAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { BotActionMenu } from '../components/BotActionMenu'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { formatDate } from '../lib/date'
import { useBots } from '../hooks/useBots'
import { getBotStatus, type BotStatus } from '../types/bot'

type SortKey = 'conversation_count' | 'qa_count' | 'updated_at'
type SortOrder = 'asc' | 'desc'
type FilterValue = 'all' | BotStatus

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'draft', label: 'Taslak' },
]

const TH_CLASS =
  'px-4 py-3 bg-[var(--bg-app)] text-[var(--text-muted)] font-medium text-[12px] uppercase tracking-wider border-b border-[var(--border)]'

const SORT_BTN_CLASS =
  'inline-flex items-center gap-1.5 font-medium uppercase tracking-wider text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors'

const METRIC_CHIP_CLASS =
  'bg-[var(--bg-app)] rounded px-2 py-1 text-xs text-[var(--text-muted)]'

const SECONDARY_BTN_CLASS =
  'inline-flex items-center gap-2 border border-[var(--border)] bg-transparent hover:bg-[var(--bg-app)] text-[var(--text)] text-sm rounded-[var(--radius-btn)] px-3 py-1.5 transition-colors'

function BotRowSkeleton() {
  return (
    <tr className="border-b border-[var(--border)] last:border-b-0">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Skeleton width="w-8" height="h-8" className="rounded-lg" />
          <Skeleton width="w-32" height="h-4" />
        </div>
      </td>
      <td className="px-4 py-3.5">
        <Skeleton width="w-8" height="h-4" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton width="w-8" height="h-4" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton width="w-16" height="h-5" className="rounded-full" />
      </td>
      <td className="px-4 py-3.5">
        <Skeleton width="w-20" height="h-4" />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex justify-end">
          <Skeleton width="w-[90px]" height="h-7" />
        </div>
      </td>
    </tr>
  )
}

function BotCardSkeleton() {
  return (
    <div className="p-4 border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Skeleton width="w-10" height="h-10" className="rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton width="w-40" height="h-4" />
            <Skeleton width="w-12" height="h-3" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <Skeleton width="w-16" height="h-5" className="rounded-full" />
        <Skeleton width="w-20" height="h-4" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton width="w-24" height="h-6" />
        <Skeleton width="w-24" height="h-6" />
      </div>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const { bots, isLoading, error, refetch } = useBots()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortOrder('asc')
      return
    }
    if (sortOrder === 'asc') {
      setSortOrder('desc')
      return
    }
    setSortKey(null)
    setSortOrder('asc')
  }

  function renderSortIcon(key: SortKey) {
    if (sortKey !== key) return <ChevronsUpDown size={12} />
    return sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const filteredBots = useMemo(() => {
    let result = bots

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
      result = result.filter((bot) =>
        bot.name.toLocaleLowerCase('tr-TR').includes(q),
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((bot) => getBotStatus(bot) === statusFilter)
    }

    if (sortKey) {
      const dir = sortOrder === 'asc' ? 1 : -1
      result = [...result].sort((a, b) => {
        let av: number
        let bv: number
        if (sortKey === 'updated_at') {
          av = new Date(a.updated_at).getTime()
          bv = new Date(b.updated_at).getTime()
        } else {
          av = a[sortKey] ?? 0
          bv = b[sortKey] ?? 0
        }
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir
      })
    }

    return result
  }, [bots, searchQuery, statusFilter, sortKey, sortOrder])

  const hasNoBots = !isLoading && !error && bots.length === 0
  const hasNoFilterResults =
    !isLoading && !error && bots.length > 0 && filteredBots.length === 0

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)]">
      <Header />
      <main className="p-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Botlarım</h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">
              Tüm chatbotlarını buradan yönet
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/bots/new')}
            className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            Yeni Bot Oluştur
          </button>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center gap-3 flex-wrap">
            <div className="relative w-60">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                placeholder="Bot ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 bg-[var(--bg-app)] border border-[var(--border)] rounded-[var(--radius-input)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {FILTERS.map((filter) => {
                const isActive = statusFilter === filter.value
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`inline-flex items-center h-8 rounded-full px-3 text-xs font-medium transition-colors shrink-0 ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className={`md:ml-auto ${SECONDARY_BTN_CLASS}`}
            >
              <Download size={14} />
              Dışa Aktar
            </button>
          </div>

          {error ? (
            <div className="flex flex-col items-center">
              <EmptyState
                icon={<AlertCircle size={20} />}
                title="Bot listesi yüklenemedi"
                description={error.message}
              />
              <button
                type="button"
                onClick={() => {
                  void refetch()
                }}
                className={`${SECONDARY_BTN_CLASS} mb-[60px]`}
              >
                Yeniden Dene
              </button>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${TH_CLASS} text-left`}>Bot Adı</th>
                      <th className={`${TH_CLASS} text-left`}>
                        <button
                          type="button"
                          onClick={() => handleSort('conversation_count')}
                          className={SORT_BTN_CLASS}
                        >
                          Konuşmalar
                          {renderSortIcon('conversation_count')}
                        </button>
                      </th>
                      <th className={`${TH_CLASS} text-left`}>
                        <button
                          type="button"
                          onClick={() => handleSort('qa_count')}
                          className={SORT_BTN_CLASS}
                        >
                          Sorular
                          {renderSortIcon('qa_count')}
                        </button>
                      </th>
                      <th className={`${TH_CLASS} text-left`}>Durum</th>
                      <th className={`${TH_CLASS} text-left`}>
                        <button
                          type="button"
                          onClick={() => handleSort('updated_at')}
                          className={SORT_BTN_CLASS}
                        >
                          Son Güncelleme
                          {renderSortIcon('updated_at')}
                        </button>
                      </th>
                      <th className={`${TH_CLASS} text-right w-[120px]`}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <BotRowSkeleton key={i} />
                      ))
                    ) : hasNoBots ? (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState
                            icon={<Sparkles size={20} />}
                            title="Henüz bot oluşturmadın"
                            description="İlk botunu oluştur ve hemen başla."
                          />
                        </td>
                      </tr>
                    ) : hasNoFilterResults ? (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState
                            icon={<SearchX size={20} />}
                            title="Bot bulunamadı"
                            description="Arama veya filtreni değiştirmeyi dene."
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredBots.map((bot) => (
                        <tr
                          key={bot.id}
                          onClick={() => navigate(`/bots/${bot.id}/settings`)}
                          className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <BotAvatar name={bot.name} />
                              <div>
                                <div className="font-medium text-[var(--text)]">
                                  {bot.name}
                                </div>
                                <div className="text-[11px] text-[var(--text-dim)]">
                                  Chatbot
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text)]">
                            {(bot.conversation_count ?? 0).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text)]">
                            {(bot.qa_count ?? 0).toLocaleString('tr-TR')}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={getBotStatus(bot)} />
                          </td>
                          <td className="px-4 py-3.5 text-[var(--text-muted)]">
                            {formatDate(bot.updated_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div
                              className="flex items-center gap-1 justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                title="Düzenle"
                                className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] transition-colors"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                title="Kopyala"
                                className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--text)] transition-colors"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                title="Sil"
                                className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-app)] hover:text-[var(--danger)] transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <BotCardSkeleton key={i} />
                  ))
                ) : hasNoBots ? (
                  <EmptyState
                    icon={<Sparkles size={20} />}
                    title="Henüz bot oluşturmadın"
                    description="İlk botunu oluştur ve hemen başla."
                  />
                ) : hasNoFilterResults ? (
                  <EmptyState
                    icon={<SearchX size={20} />}
                    title="Bot bulunamadı"
                    description="Arama veya filtreni değiştirmeyi dene."
                  />
                ) : (
                  filteredBots.map((bot) => (
                    <div
                      key={bot.id}
                      onClick={() => navigate(`/bots/${bot.id}/settings`)}
                      className="p-4 border-b border-[var(--border)] last:border-b-0 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <BotAvatar name={bot.name} size={40} />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[15px] font-medium text-[var(--text)] truncate">
                              {bot.name}
                            </h3>
                            <p className="text-[11px] text-[var(--text-dim)]">
                              Chatbot
                            </p>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <BotActionMenu
                            botId={bot.id}
                            onEdit={() => {}}
                            onCopy={() => {}}
                            onDelete={() => {}}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <StatusBadge status={getBotStatus(bot)} />
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(bot.updated_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={METRIC_CHIP_CLASS}>
                          {(bot.conversation_count ?? 0).toLocaleString('tr-TR')}{' '}
                          Konuşma
                        </span>
                        <span className={METRIC_CHIP_CLASS}>
                          {(bot.qa_count ?? 0).toLocaleString('tr-TR')} Soru
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
