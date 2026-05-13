export type BotStatus = 'active' | 'paused' | 'draft'

export interface Bot {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  conversation_count?: number
  qa_count?: number
}

export function getBotStatus(bot: Bot): BotStatus {
  return bot.is_active ? 'active' : 'paused'
}
