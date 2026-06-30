import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildTotemImpresionExternalRef,
  createCheckoutPreference,
  getMercadoPagoWebhookBaseUrl,
  isMercadoPagoConfigured,
  mpInitPoint
} from '../../lib/api/mercadopago'
import { getPlotLabAllowedOrigins, PLOT_LAB_PRIMARY_ORIGIN } from '../../lib/api/plotLabOrigins'
import { handleOptions, setCorsRestricted } from '../plotai/_http'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

function publicOrigin(req: VercelRequest): string {
  const allowed = getPlotLabAllowedOrigins()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] || PLOT_LAB_PRIMARY_ORIGIN
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

  const body = (req.body ?? {}) as { solicitud_id?: number }
  const solicitudId = Number(body.solicitud_id)
  if (!Number.isFinite(solicitudId) || solicitudId < 1) {
    res.status(400).json({ ok: false, error: 'solicitud_id inválido' })
    return
  }

  const { data: estadoRaw, error: estadoErr } = await supabase.rpc('obtener_estado_pago_totem_impresion', {
    p_solicitud_id: solicitudId
  })
  if (estadoErr) {
    res.status(500).json({ ok: false, error: estadoErr.message })
    return
  }
  const estado = (estadoRaw ?? {}) as {
    ok?: boolean
    error?: string
    estado_pago?: string
    valor_total?: number
    mp_init_point?: string | null
    mp_preference_id?: string | null
    archivo_nombre?: string
    cliente_nombre?: string
  }
  if (!estado.ok) {
    res.status(404).json({ ok: false, error: estado.error || 'Solicitud no encontrada' })
    return
  }
  if (estado.estado_pago === 'pagado') {
    res.status(200).json({
      ok: true,
      already_paid: true,
      solicitud_id: solicitudId,
      init_point: estado.mp_init_point || null
    })
    return
  }

  const amount = Number(estado.valor_total)
  if (!Number.isFinite(amount) || amount < 1) {
    res.status(400).json({
      ok: false,
      error: 'El monto a cobrar debe ser al menos $1. Indicá el valor estimado antes de pagar.'
    })
    return
  }

  if (estado.mp_init_point && estado.mp_preference_id) {
    res.status(200).json({
      ok: true,
      solicitud_id: solicitudId,
      preference_id: estado.mp_preference_id,
      init_point: estado.mp_init_point,
      amount
    })
    return
  }

  const site = publicOrigin(req)
  const webhookBase = getMercadoPagoWebhookBaseUrl()
  const externalRef = buildTotemImpresionExternalRef(solicitudId)
  const title = `Impresión tótem #${solicitudId}`

  try {
    const pref = await createCheckoutPreference({
      items: [
        {
          title: estado.archivo_nombre ? `${title} — ${estado.archivo_nombre}`.slice(0, 120) : title,
          quantity: 1,
          unit_price: Math.round(amount * 100) / 100,
          currency_id: 'ARS'
        }
      ],
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/totem/mp-webhook`,
      back_urls: {
        success: `${site}/totem/autogestion/imprimir?pago=ok&solicitud=${solicitudId}`,
        failure: `${site}/totem/autogestion/imprimir?pago=error&solicitud=${solicitudId}`,
        pending: `${site}/totem/autogestion/imprimir?pago=pending&solicitud=${solicitudId}`
      },
      statement_descriptor: 'PLOT CENTER'
    })

    const initPoint = mpInitPoint(pref)
    const { data: regRaw, error: regErr } = await supabase.rpc('registrar_mp_preference_totem_impresion', {
      p_solicitud_id: solicitudId,
      p_preference_id: pref.id,
      p_init_point: initPoint
    })
    const reg = (regRaw ?? {}) as { ok?: boolean; error?: string }
    if (regErr || reg.ok === false) {
      res.status(500).json({ ok: false, error: regErr?.message || reg.error || 'No se pudo guardar la preferencia' })
      return
    }

    res.status(200).json({
      ok: true,
      solicitud_id: solicitudId,
      preference_id: pref.id,
      init_point: initPoint,
      amount
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Error al crear preferencia MP' })
  }
}
