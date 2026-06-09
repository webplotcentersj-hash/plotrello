import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getGeminiServerKey, handleOptions, setCorsRestricted } from '../../lib/api/security'

/** Diagnóstico rápido: API viva + Gemini configurado (sin llamar a Google). */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res, 'GET, OPTIONS')

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const gemini = Boolean(getGeminiServerKey())
  res.status(200).json({
    ok: true,
    service: 'plotai',
    gemini_configured: gemini,
    ts: new Date().toISOString()
  })
}
