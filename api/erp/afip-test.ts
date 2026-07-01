import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../lib/staffAuth'
import { testAfipConexion } from '../../lib/afip/autorizar'
import { getAfipAccessToken } from '../../lib/afip/client'
import { getSupabaseAdmin, loadAfipConfigResumen } from '../../lib/afip/supabaseAdmin'
import type { AfipConfigResumen } from '../../lib/afip/types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  if (!getAfipAccessToken()) {
    res.status(500).json({
      success: false,
      error: 'AFIP_ACCESS_TOKEN no configurado en el servidor (Vercel / .env.local).'
    })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  try {
    const supabase = getSupabaseAdmin()
    let config: AfipConfigResumen | null = null
    if (supabase) {
      const row = await loadAfipConfigResumen(supabase)
      config = row as AfipConfigResumen
    }

    const result = await testAfipConexion(config)
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error probando conexión AFIP'
    })
  }
}
