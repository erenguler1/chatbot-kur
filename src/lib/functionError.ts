import { FunctionsHttpError } from '@supabase/supabase-js'

// Turns an Edge Function error response into the Turkish message it carries.
export async function functionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err instanceof FunctionsHttpError) {
    try {
      const body: unknown = await err.context.json()
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // fall through to the generic message
    }
  }
  return fallback
}
