export type LeadStatus = 'new' | 'contacted' | 'closed'

export interface Lead {
  id: string
  bot_id: string
  conversation_id: string | null
  name: string
  phone: string | null
  email: string | null
  note: string | null
  status: LeadStatus
  created_at: string
}
