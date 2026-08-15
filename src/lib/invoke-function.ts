import { supabase } from '@/lib/supabase/client'

type InvokeResult<T> = {
  data: T | null
  error: string | null
}

async function readFunctionError(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') {
    return 'Request failed'
  }

  const err = error as { message?: string; context?: Response }
  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = (await err.context.clone().json()) as {
        error?: string
        message?: string
      }
      if (body.error) return body.error
      if (body.message) return body.message
    } catch {
      // Fall through to generic message.
    }
  }

  const message = err.message ?? 'Request failed'
  if (message.includes('non-2xx')) {
    return 'The server rejected the request. Check Edge Function logs or try copying the invite link instead.'
  }

  return message
}

export async function invokeFunction<T extends { error?: string }>(
  name: string,
  body?: Record<string, unknown>
): Promise<InvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  const payload = (data ?? null) as T | null

  if (error) {
    return {
      data: payload,
      error: payload?.error || (await readFunctionError(error)),
    }
  }

  if (payload?.error) {
    return { data: payload, error: payload.error }
  }

  return { data: payload, error: null }
}
