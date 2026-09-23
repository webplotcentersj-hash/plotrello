import { plotLabApiUrl } from '../utils/plotLabApiOrigin'

const LIVE_CONFIG_PATH = '/api/plotai/live-voice'

/**
 * Clave para Gemini Live (WebSocket en el navegador).
 * Production: siempre `/api/plotai/live-voice` (`GEMINI_API_KEY` en Vercel).
 * Dev: `VITE_GEMINI_API_KEY` si no hay `vercel dev`.
 */
export async function fetchGeminiLiveApiKey(): Promise<string> {
  if (import.meta.env.DEV) {
    const fromEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
    if (fromEnv) return fromEnv
  }

  const res = await fetch(plotLabApiUrl(LIVE_CONFIG_PATH))
  const data = (await res.json().catch(() => ({}))) as { apiKey?: string; error?: string }
  if (!res.ok || !data.apiKey) {
    throw new Error(
      data.error ||
        'Gemini Live no configurado. En producción: GEMINI_API_KEY en Vercel. En local: vercel dev o VITE_GEMINI_API_KEY.'
    )
  }
  return data.apiKey
}
