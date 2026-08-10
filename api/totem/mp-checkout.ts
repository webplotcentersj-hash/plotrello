import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildTotemCheckoutExternalRef,
  createCheckoutPreference,
  getMercadoPagoWebhookBaseUrl,
  isMercadoPagoConfigured,
  mpInitPoint
} from '../_lib/mercadopago'
import { getPlotLabAllowedOrigins, PLOT_LAB_PRIMARY_ORIGIN } from '../_lib/plotLabOrigins'
import { handleOptions, setCorsRestricted } from '../plotai/plotaiHttp'
import { cotizarTotemImpresionLista1, normalizeTotemPrintPapel } from '../_lib/totemPrintLista1'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

function publicOrigin(req: VercelRequest): string {
  const allowed = getPlotLabAllowedOrigins()
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] || PLOT_LAB_PRIMARY_ORIGIN
}

type Draft = {
  cliente_nombre?: string
  cliente_dni?: string
  cliente_telefono?: string
  cantidad_hojas?: number
  tipo_impresion?: string
  origen_archivo?: string
  archivo_url?: string
  archivo_nombre?: string
  valor_total?: number
  formato_impresion?: 'A4' | 'A3'
  papel_impresion?: string
  color_pages?: number
  bw_pages?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsRestricted(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  if (!isMercadoPagoConfigured()) {
    res.status(503).json({ ok: false, error: 'Mercado Pago no configurado en el servidor' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  const body = (req.body ?? {}) as { draft?: Draft }
  const draft = body.draft
  if (!draft || typeof draft !== 'object') {
    res.status(400).json({ ok: false, error: 'Falta draft de la solicitud' })
    return
  }

  const payload = {
    cliente_nombre: String(draft.cliente_nombre || '').trim(),
    cliente_dni: String(draft.cliente_dni || '').trim(),
    cliente_telefono: String(draft.cliente_telefono || '').trim(),
    cantidad_hojas: Math.max(1, Math.floor(Number(draft.cantidad_hojas) || 1)),
    tipo_impresion: String(draft.tipo_impresion || '').trim(),
    origen_archivo: String(draft.origen_archivo || '').trim(),
    archivo_url: String(draft.archivo_url || '').trim(),
    archivo_nombre: String(draft.archivo_nombre || '').trim()
  }

  const tipoLower = payload.tipo_impresion.toLowerCase()
  const formato =
    String(draft.formato_impresion || '').toUpperCase() === 'A3' || tipoLower.includes('a3') ? 'A3' : 'A4'
  const papel = normalizeTotemPrintPapel(draft.papel_impresion || payload.tipo_impresion)

  const quote = await cotizarTotemImpresionLista1(supabase, {
    formato,
    tipo_impresion: payload.tipo_impresion,
    cantidad_hojas: payload.cantidad_hojas,
    color_pages: draft.color_pages != null ? Number(draft.color_pages) : undefined,
    bw_pages: draft.bw_pages != null ? Number(draft.bw_pages) : undefined,
    papel
  })

  if (!quote.ok || quote.total < 1) {
    res.status(400).json({
      ok: false,
      error: quote.error || 'No se pudo calcular el precio de Lista 1 para esta impresión.'
    })
    return
  }

  const amount = quote.total
  const payloadWithAmount = { ...payload, valor_total: amount }

  const { data: chkRaw, error: chkErr } = await supabase.rpc('crear_totem_impresion_checkout', {
    p_payload: payloadWithAmount
  })
  if (chkErr) {
    res.status(500).json({ ok: false, error: chkErr.message })
    return
  }
  const chk = (chkRaw ?? {}) as { ok?: boolean; error?: string; checkout_id?: string; amount?: number }
  if (!chk.ok || !chk.checkout_id) {
    res.status(400).json({ ok: false, error: chk.error || 'No se pudo crear checkout' })
    return
  }

  const checkoutId = String(chk.checkout_id)
  const site = publicOrigin(req)
  const webhookBase = getMercadoPagoWebhookBaseUrl()
  const externalRef = buildTotemCheckoutExternalRef(checkoutId)
  const title = `Impresión tótem`
  const itemTitle = payload.archivo_nombre
    ? `${title} — ${payload.archivo_nombre}`.slice(0, 120)
    : title

  try {
    const pref = await createCheckoutPreference({
      items: [
        {
          title: itemTitle,
          quantity: 1,
          unit_price: Math.round(amount * 100) / 100,
          currency_id: 'ARS'
        }
      ],
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/mp/webhook`,
      back_urls: {
        success: `${site}/totem/autogestion/imprimir?pago=ok&checkout=${checkoutId}`,
        failure: `${site}/totem/autogestion/imprimir?pago=error&checkout=${checkoutId}`,
        pending: `${site}/totem/autogestion/imprimir?pago=pending&checkout=${checkoutId}`
      },
      statement_descriptor: 'PLOT CENTER'
    })

    const initPoint = mpInitPoint(pref)
    const { data: regRaw, error: regErr } = await supabase.rpc('registrar_mp_checkout_totem', {
      p_checkout_id: checkoutId,
      p_preference_id: pref.id,
      p_init_point: initPoint
    })
    const reg = (regRaw ?? {}) as { ok?: boolean; error?: string }
    if (regErr || reg.ok === false) {
      res.status(500).json({ ok: false, error: regErr?.message || reg.error || 'No se pudo guardar preferencia' })
      return
    }

    res.status(200).json({
      ok: true,
      checkout_id: checkoutId,
      preference_id: pref.id,
      init_point: initPoint,
      amount: chk.amount ?? amount
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Error al crear checkout MP' })
  }
}
