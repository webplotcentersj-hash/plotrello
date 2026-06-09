import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Clave Gemini solo server-side. Acepta GEMINI_API_KEY o VITE_GEMINI_API_KEY (Vercel). */
export function getGeminiServerKey(): string {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

export function setCorsRestricted(req: VercelRequest, res: VercelResponse, methods = 'GET, POST, OPTIONS'): void {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS || 'https://plotrello.vercel.app,https://trello.plotcenter.com.ar')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
