import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beginPlotAiRequest } from './plotaiHttp'
import { assertRelojTabletAuth } from './relojTabletAuth'
import { getRelojTabletSupabase } from './relojTabletSupabase'
import { fetchImageAsBase64Cached } from './reloj-tablet-identify-shared'

export const maxDuration = 60

/** Precarga miniaturas de legajo en memoria (misma instancia serverless). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (beginPlotAiRequest(req, res, 'POST, OPTIONS')) return

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }
  if (!assertRelojTabletAuth(req, res)) return

  const supabase = getRelojTabletSupabase()
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase no configurado' })
    return
  }

  const { data: rows, error } = await supabase.rpc('listar_empleados_reloj_tablet')
  if (error) {
    res.status(500).json({ success: false, error: error.message })
    return
  }

  const urls = (rows as Array<{ foto_url?: string | null }>)
    .map((r) => String(r.foto_url || '').trim())
    .filter(Boolean)

  const results = await Promise.allSettled(urls.map((u) => fetchImageAsBase64Cached(u)))
  const ok = results.filter((r) => r.status === 'fulfilled' && r.value).length

  res.status(200).json({ success: true, total: urls.length, cached: ok })
}
