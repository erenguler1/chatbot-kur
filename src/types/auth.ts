import type { Session, User } from '@supabase/supabase-js'

export type { Session, User }

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}
