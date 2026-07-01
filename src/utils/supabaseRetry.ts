const TRANSIENT_PATTERNS = [
  'failed to fetch',
  'network',
  'timeout',
  'timed out',
  'echeckout',
  'connection',
  '503',
  '502',
  '504',
  '429',
  'temporarily unavailable',
  'statement timeout',
  'canceling statement'
]

export function isTransientSupabaseError(error: unknown): boolean {
  const msg =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')
  const lower = msg.toLowerCase()
  return TRANSIENT_PATTERNS.some((p) => lower.includes(p))
}

/** Reintenta operaciones ante fallos intermitentes de red/capacidad de Supabase. */
export async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; baseDelayMs?: number; label?: string }
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 3)
  const baseDelayMs = options?.baseDelayMs ?? 700
  const label = options?.label ?? 'supabase'

  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      const retryable = isTransientSupabaseError(e)
      if (!retryable || i === attempts - 1) throw e
      const delay = baseDelayMs * (i + 1)
      if (import.meta.env.DEV) {
        console.warn(`[${label}] reintento ${i + 2}/${attempts} en ${delay}ms`, e)
      }
      await new Promise((r) => window.setTimeout(r, delay))
    }
  }
  throw lastError
}
