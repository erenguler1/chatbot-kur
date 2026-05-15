import { useOutletContext } from 'react-router-dom'
import type { Bot } from '../types/bot'

interface BotDetailContext {
  bot: Bot
  refetch: () => Promise<void>
}

export function BotSettings() {
  const { bot } = useOutletContext<BotDetailContext>()

  return (
    <div className="py-6">
      <h2 className="text-lg font-semibold text-[var(--text)] mb-2">Bot Ayarları</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Form içeriği Mini-batch 4b'de gelecek. Şu an placeholder.
      </p>
      <p className="text-sm text-[var(--text-muted)] mt-2">
        Bu bot: <span className="text-[var(--text)] font-medium">{bot.name}</span>
      </p>
    </div>
  )
}
