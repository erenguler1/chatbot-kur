export interface QAPair {
  id: string
  bot_id: string
  question: string
  answer: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}
