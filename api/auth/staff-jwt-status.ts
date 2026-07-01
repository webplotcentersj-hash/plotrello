import type { VercelRequest, VercelResponse } from '@vercel/node'

/** JWT status sin imports de _lib (diagnóstico). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const enabled = Boolean((process.env.PLOT_LAB_STAFF_JWT_SECRET || '').trim())
  res.status(200).json({ enabled })
}
