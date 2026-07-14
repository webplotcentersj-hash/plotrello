import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { getRelojTabletSupabase } from './relojTabletSupabase'

export const maxDuration = 20

/** Kiosco: descarga el índice facial precomputado (sin reindexar fotos). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'GET, OPTIONS')) return

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const supabase = getRelojTabletSupabase()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const [{ data: rows, error: e1 }, { data: meta, error: e2 }] = await Promise.all([
    supabase
      .from('rrhh_facial_descriptores')
      .select('id_usuario, nombre, foto_url, foto_key, descriptor')
      .order('id_usuario'),
    supabase.from('rrhh_facial_indice_meta').select('indexed_count, failed_count, total_fotos, built_at, signature').eq('id', 1).maybeSingle()
  ])

  if (e1 || e2) {
    res.status(500).json({ success: false, error: e1?.message || e2?.message })
    return
  }

  const descriptores = (rows || []).map((row) => {
    const raw = row.descriptor
    const descriptor = Array.isArray(raw)
      ? raw.map(Number)
      : typeof raw === 'string'
        ? (JSON.parse(raw) as number[])
        : []
    return {
      id_usuario: Number(row.id_usuario),
      nombre: String(row.nombre || ''),
      foto_url: String(row.foto_url || ''),
      foto_key: String(row.foto_key || ''),
      descriptor
    }
  }).filter((r) => r.descriptor.length >= 64)

  res.status(200).json({
    success: true,
    meta: meta ?? null,
    descriptores
  })
}
