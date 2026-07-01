import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBearerToken } from './security'
import { verifyStaffJwt, type StaffJwtPayload } from './staffJwt'

/** Valida JWT staff (Bearer). Devuelve payload o null y responde 401. */
export function requireStaffSession(
  req: VercelRequest,
  res: VercelResponse
): StaffJwtPayload | null {
  const token = getBearerToken(req)
  const payload = verifyStaffJwt(token)
  if (!payload) {
    res.status(401).json({ error: 'Sesión staff inválida o expirada' })
    return null
  }
  return payload
}
