import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPlotLabAllowedOrigins } from '../../lib/api/plotLabOrigins'

/** Diagnóstico rápido: API viva + Gemini configurado (sin llamar a Google). */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const allowed = getPlotLabAllowedOrigins()
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const gemini = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '')
  res.status(200).json({
    ok: true,
    service: 'plotai',
    gemini_configured: gemini,
    ts: new Date().toISOString()
  })
}
