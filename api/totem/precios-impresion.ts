import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { catalogoPreciosUnitariosTotemLista1 } from '../_lib/totemPrintLista1'
import { getPlotLabAllowedOrigins, PLOT_LAB_PRIMARY_ORIGIN } from '../_lib/plotLabOrigins'
import { handleOptions, setCorsRestricted } from '../plotai/plotaiHttp'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsRestricted(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  try {
    const precios = await catalogoPreciosUnitariosTotemLista1(supabase)
    res.status(200).json({
      ok: true,
      lista: 'lista_1',
      precios,
      origin: getPlotLabAllowedOrigins()[0] || PLOT_LAB_PRIMARY_ORIGIN
    })
  } catch {
    res.status(500).json({ ok: false, error: 'No se pudo cargar el catálogo de precios.' })
  }
}
