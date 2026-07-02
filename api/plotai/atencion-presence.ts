import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { beginPlotAiRequest } from './plotaiHttp'
import { requireStaffSession } from '../_lib/staffAuth'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

/** POST /api/plotai/atencion-presence — heartbeat del panel de atención al público. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  if (!supabase) {
    res.status(503).json({ error: 'Servicio no disponible' })
    return
  }

  try {
    const { error } = await supabase.from('atencion_staff_presence').upsert(
      {
        user_id: staff.sub,
        user_nombre: staff.nombre || 'Staff',
        last_seen: new Date().toISOString()
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('atencion-presence upsert:', error.message)
      res.status(500).json({ error: 'No se pudo registrar presencia' })
      return
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('atencion-presence:', e)
    res.status(500).json({ error: 'Error interno' })
  }
}
