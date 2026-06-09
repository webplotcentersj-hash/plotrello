import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getBearerToken,
  handleOptions,
  isPlotLabSameOrigin,
  isProduction,
  setCorsRestricted
} from '../../lib/api/security'
import { isStaffJwtConfigured, verifyStaffJwt } from '../../lib/api/staffJwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res, 'GET, OPTIONS')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (isProduction() && !isPlotLabSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  if (!isStaffJwtConfigured()) {
    res.status(503).json({ error: 'JWT staff no configurado' })
    return
  }

  const token = getBearerToken(req)
  const payload = verifyStaffJwt(token)
  if (!payload) {
    res.status(401).json({ error: 'Sesión inválida o expirada' })
    return
  }

  res.status(200).json({
    success: true,
    usuario: {
      id: payload.sub,
      nombre: payload.nombre,
      rol: payload.rol
    },
    exp: payload.exp
  })
}
