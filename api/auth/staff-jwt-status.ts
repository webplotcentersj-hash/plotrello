import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginCorsRequest } from '../_lib/security'
import { isStaffJwtConfigured } from '../_lib/staffJwt'

/** Indica si el servidor emite/verifica JWT staff (PLOT_LAB_STAFF_JWT_SECRET configurado). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({ enabled: isStaffJwtConfigured() })
}
