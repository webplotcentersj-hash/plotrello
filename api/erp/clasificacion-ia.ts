import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaffSession } from '../_lib/staffAuth'
import { getSupabaseAdmin } from '../../lib/afip/supabaseAdmin'
import { clasificarLote } from '../../lib/clasificacion/clasificar'
import { TIPOS_CLASIFICACION, type TipoClasificacion } from '../../lib/clasificacion/reglas'
import { getTypeSafeApiKey } from '../../lib/typesafe/client'

/**
 * KPIs con clasificación (ventas por rubro, motivos de insatisfacción en entregas).
 *   { accion: 'kpis', desde, hasta }       → KPIs del período + pendientes
 *   { accion: 'clasificar', tipo, limite }  → clasifica un lote de pendientes
 * Solo roles de administración (mismos que ven Estadísticas).
 */

type Body = {
  accion?: 'kpis' | 'clasificar'
  desde?: string
  hasta?: string
  tipo?: TipoClasificacion
  limite?: number
}

const ROLES_ADMIN = ['administracion', 'gerencia']
/** Margen para responder antes del maxDuration de Vercel (60 s). */
const PRESUPUESTO_MS = 40_000

const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const staff = requireStaffSession(req, res)
  if (!staff) return
  if (!ROLES_ADMIN.includes(String(staff.rol))) {
    res.status(403).json({ success: false, error: 'Solo administración y gerencia pueden ver estos KPIs.' })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor.' })
    return
  }

  let body: Body
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body
  } catch {
    res.status(400).json({ success: false, error: 'JSON inválido' })
    return
  }

  try {
    if (body?.accion === 'kpis') {
      if (!esFecha(body.desde) || !esFecha(body.hasta)) {
        res.status(400).json({ success: false, error: 'desde y hasta (yyyy-mm-dd) son requeridos' })
        return
      }
      const [ventas, entregas, pendientes] = await Promise.all([
        supabase.rpc('kpi_ventas_por_rubro', { p_desde: body.desde, p_hasta: body.hasta }),
        supabase.rpc('kpi_fallas_entrega', { p_desde: body.desde, p_hasta: body.hasta }),
        supabase.rpc('clasificacion_ia_contar_pendientes')
      ])
      const err = ventas.error || entregas.error || pendientes.error
      if (err) throw new Error(err.message)
      res.status(200).json({
        success: true,
        data: {
          iaConfigurada: Boolean(getTypeSafeApiKey()),
          pendientes: pendientes.data,
          ventasPorRubro: ventas.data,
          fallasEntrega: entregas.data
        }
      })
      return
    }

    if (body?.accion === 'clasificar') {
      const tipo = body.tipo
      if (!tipo || !TIPOS_CLASIFICACION.includes(tipo)) {
        res.status(400).json({ success: false, error: 'tipo inválido' })
        return
      }
      const limite = Math.min(Math.max(Number(body.limite) || 40, 1), 100)
      const lote = await clasificarLote(supabase, tipo, { limite, deadline: Date.now() + PRESUPUESTO_MS })
      const { data: pendientes } = await supabase.rpc('clasificacion_ia_contar_pendientes')
      res.status(200).json({ success: true, data: { ...lote, pendientes } })
      return
    }

    res.status(400).json({ success: false, error: 'accion inválida' })
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Error en clasificación' })
  }
}
