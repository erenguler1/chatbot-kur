import { Edit3, Copy, Trash2, Plus } from 'lucide-react'
import { Header } from '../components/Header'
import { BotAvatar } from '../components/BotAvatar'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate } from '../lib/date'
import { getBotStatus, type Bot } from '../types/bot'

const MOCK_BOTS: Bot[] = [
  {
    id: 'mock-1',
    name: 'Müşteri Destek Botu',
    description: 'E-ticaret SSS asistanı',
    is_active: true,
    created_at: '2026-05-10T14:30:00Z',
    updated_at: '2026-05-13T09:15:00Z',
    conversation_count: 247,
    qa_count: 89,
  },
  {
    id: 'mock-2',
    name: 'Teknik Destek Botu',
    description: null,
    is_active: false,
    created_at: '2026-05-08T11:00:00Z',
    updated_at: '2026-05-12T16:45:00Z',
    conversation_count: 56,
    qa_count: 23,
  },
]

const TH_CLASS =
  'px-4 py-3 bg-[var(--bg-app)] text-[var(--text-muted)] font-medium text-[12px] uppercase tracking-wider border-b border-[var(--border)]'

export function Dashboard() {
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
            className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium text-sm rounded-[var(--radius-btn)] px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            Yeni Bot Oluştur
          </button>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-card)] overflow-hidden">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${TH_CLASS} text-left`}>Bot Adı</th>
                <th className={`${TH_CLASS} text-left`}>Konuşmalar</th>
                <th className={`${TH_CLASS} text-left`}>Sorular</th>
                <th className={`${TH_CLASS} text-left`}>Durum</th>
                <th className={`${TH_CLASS} text-left`}>Son Güncelleme</th>
                <th className={`${TH_CLASS} text-right w-[120px]`}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_BOTS.map((bot) => (
                <tr
                  key={bot.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <BotAvatar name={bot.name} />
                      <div>
                        <div className="font-medium text-[var(--text)]">{bot.name}</div>
                        <div className="text-[11px] text-[var(--text-dim)]">Chatbot</div>
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
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
