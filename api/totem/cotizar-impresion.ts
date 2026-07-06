import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  cotizarTotemImpresionLista1,
  type TotemPrintFormato
} from '../_lib/totemPrintLista1'
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

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  const body = (req.body ?? {}) as {
    formato?: string
    tipo_impresion?: string
    cantidad_hojas?: number
    color_pages?: number
    bw_pages?: number
  }

  const formatoRaw = String(body.formato || 'A4').toUpperCase()
  const formato: TotemPrintFormato = formatoRaw === 'A3' ? 'A3' : 'A4'

  const quote = await cotizarTotemImpresionLista1(supabase, {
    formato,
    tipo_impresion: String(body.tipo_impresion || '').trim(),
    cantidad_hojas: Math.max(1, Math.floor(Number(body.cantidad_hojas) || 1)),
    color_pages: body.color_pages != null ? Number(body.color_pages) : undefined,
    bw_pages: body.bw_pages != null ? Number(body.bw_pages) : undefined
  })

  if (!quote.ok) {
    res.status(200).json({ ok: false, error: quote.error, total: 0, items: [] })
    return
  }

  res.status(200).json({
    ok: true,
    total: quote.total,
    items: quote.items,
    lista: 'lista_1',
    origin: getPlotLabAllowedOrigins()[0] || PLOT_LAB_PRIMARY_ORIGIN
  })
}
