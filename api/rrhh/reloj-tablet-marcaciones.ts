import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginCorsRequest, getSupabaseServerKey, getSupabaseServerUrl } from '../_lib/security'
import { requireStaffSession } from '../_lib/staffAuth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 20

/** Auditoría de marcaciones tablet (solo staff RRHH). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginCorsRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  if (!['recursos-humanos', 'administracion', 'gerencia', 'admin'].includes(staff.rol)) {
    res.status(403).json({ success: false, error: 'No autorizado' })
    return
  }

  const url = getSupabaseServerUrl()
  const key = getSupabaseServerKey()
  if (!url || !key) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const desde = String(req.query.desde || hoy).slice(0, 10)
  const hasta = String(req.query.hasta || hoy).slice(0, 10)

  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('listar_marcaciones_tablet_rango', {
    p_desde: desde,
    p_hasta: hasta
  })

  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  res.status(200).json({ success: true, data: data ?? [], desde, hasta })
}
