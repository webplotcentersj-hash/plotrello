import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest, getGeminiServerKey } from './_http'

/** Entrega la API key de Gemini al tótem (origen permitido) para Gemini Live en el navegador. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = getGeminiServerKey()
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
