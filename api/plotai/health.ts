import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Health mínimo sin dependencias externas (diagnóstico Vercel). */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const gemini = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)
  res.status(200).json({
    ok: true,
    service: 'plotai',
    gemini_configured: gemini,
    ts: new Date().toISOString()
  })
}
