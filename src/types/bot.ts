export type BotStatus = 'active' | 'paused' | 'draft'

export type BotTone = 'friendly' | 'formal' | 'casual'

export type BotWidgetPosition =
  | 'bottom_right'
  | 'bottom_left'
  | 'middle_right'
  | 'middle_left'

export type BotBusinessType =
  | 'cafe_restaurant'
  | 'hair_barber'
  | 'beauty_salon'
  | 'digital_agency'
  | 'ecommerce'
  | 'other'

export interface Bot {
  id: string
  user_id: string
  name: string
  description: string | null
  business_type: BotBusinessType
  welcome_message: string
  no_match_message: string
  tone: BotTone
  brand_color: string
  widget_position: BotWidgetPosition
  status: BotStatus
  lead_capture_enabled: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  conversation_count?: number
  qa_count?: number
}

export function getBotStatus(bot: Bot): BotStatus {
  return bot.status
}
