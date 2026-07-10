import type { VercelRequest, VercelResponse } from '@vercel/node'

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

/** En producción exige RELOJ_TABLET_API_KEY + header X-Reloj-Tablet-Key. */
export function assertRelojTabletAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expected = String(process.env.RELOJ_TABLET_API_KEY || '').trim()
  if (!expected) {
    if (isProduction()) {
      res.status(503).json({
        success: false,
        error: 'RELOJ_TABLET_API_KEY no configurada en el servidor.'
      })
      return false
    }
    return true
  }
  const got = String(req.headers['x-reloj-tablet-key'] || req.headers['X-Reloj-Tablet-Key'] || '').trim()
  if (!got || got !== expected) {
    res.status(401).json({ success: false, error: 'No autorizado (tablet)' })
    return false
  }
  return true
}
