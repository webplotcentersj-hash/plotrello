import type { VercelRequest, VercelResponse } from '@vercel/node'
import { assertRelojTabletAuth, getSupabaseService } from './_shared'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const supabase = getSupabaseService()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const { data, error } = await supabase.rpc('listar_empleados_reloj_tablet')
  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  const empleados = (data as Array<Record<string, unknown>> || []).map((row) => ({
    id_usuario: Number(row.id_usuario),
    nombre: String(row.nombre ?? ''),
    apellido: String(row.apellido ?? ''),
    sector: String(row.sector ?? ''),
    foto_url: row.foto_url ? String(row.foto_url) : null,
    login: String(row.login ?? ''),
    nombre_completo: [row.apellido, row.nombre].filter(Boolean).join(', ') || String(row.login ?? '')
  }))

  res.status(200).json({ success: true, empleados })
}
