export type MessageRole = 'user' | 'assistant'

export interface Conversation {
  id: string
  bot_id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
}
