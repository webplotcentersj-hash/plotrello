import type { VercelRequest, VercelResponse } from '@vercel/node'

function getEnvKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
}

function setCors(req: VercelRequest, res: VercelResponse): void {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS ||
    'https://plotrello.vercel.app,https://trello.plotcenter.com.ar,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
}

/** Entrega la API key de Gemini al tótem (origen permitido) para Gemini Live en el navegador. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getEnvKey()
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' })
    return
  }

  res.status(200).json({
    success: true,
    apiKey,
    model: 'gemini-2.5-flash-native-audio-preview-12-2025'
  })
}
