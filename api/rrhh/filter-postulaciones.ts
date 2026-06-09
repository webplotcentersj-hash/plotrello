import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getGeminiServerKey,
  getSupabaseServerKey,
  getSupabaseServerUrl,
  handleOptions,
  isPlotLabSameOrigin,
  isProduction,
  requireStaffSession,
  setCorsRestricted
} from '../_lib/security'
import { filterPostulacionesWithPlotAI } from './_cvExtract'

type Body = {
  query?: string
  candidatos?: Array<{
    id: number
    nombre: string
    puesto: string
    resumen?: string | null
    habilidades?: string[]
    score_plot?: number | null
  }>
}

/** Filtro inteligente de postulaciones con filosofía Plot (solo staff RRHH). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  setCorsRestricted(req, res, 'POST, OPTIONS')

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return

  const rol = staff.rol
  if (!['recursos-humanos', 'administracion', 'gerencia'].includes(rol)) {
    res.status(403).json({ success: false, error: 'No autorizado' })
    return
  }

  const apiKey = getGeminiServerKey()
  if (!apiKey) {
    res.status(503).json({ success: false, error: 'GEMINI_API_KEY no configurada.' })
    return
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  const query = (body?.query || '').trim()
  if (!query) {
    res.status(400).json({ success: false, error: 'query requerida' })
    return
  }

  let candidatos = body?.candidatos || []

  if (!candidatos.length) {
    const supabaseUrl = getSupabaseServerUrl()
    const supabaseKey = getSupabaseServerKey()
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase.rpc('rrhh_postulaciones_listar', {
        p_usuario_id: staff.sub,
        p_limite: 200
      })
      const rows = Array.isArray(data) ? data : []
      candidatos = rows.map((r: Record<string, unknown>) => {
        const meta = (r.metadata_ia || {}) as Record<string, unknown>
        return {
          id: Number(r.id),
          nombre: String(r.nombre || ''),
          puesto: String(r.puesto || ''),
          resumen: meta.resumen as string | null,
          habilidades: (meta.habilidades as string[]) || [],
          score_plot: meta.score_plot as number | null
        }
      })
    }
  }

  try {
    const resultados = await filterPostulacionesWithPlotAI(apiKey, query, candidatos)
    res.status(200).json({ success: true, data: { resultados } })
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e instanceof Error ? e.message : 'Error en filtro PlotAI'
    })
  }
}
