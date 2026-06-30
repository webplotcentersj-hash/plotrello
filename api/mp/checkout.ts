import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildMpCheckoutExternalRef,
  createCheckoutPreference,
  getMercadoPagoWebhookBaseUrl,
  isMercadoPagoConfigured,
  mpInitPoint
} from '../../lib/api/mercadopago'
import { PLOT_LAB_ORIGINS_CSV, PLOT_LAB_PRIMARY_ORIGIN } from '../../lib/api/plotLabOrigins'
import { handleOptions, setCorsRestricted } from '../plotai/_http'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

function publicOrigin(req: VercelRequest): string {
  const allowed = (process.env.PLOT_LAB_ALLOWED_ORIGINS || PLOT_LAB_ORIGINS_CSV)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = String(req.headers.origin || '')
  if (origin && allowed.includes(origin)) return origin
  return allowed[0] || PLOT_LAB_PRIMARY_ORIGIN
}

type CheckoutTipo = 'venta' | 'pedido_portal'

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

  const body = (req.body ?? {}) as { tipo?: CheckoutTipo; payload?: Record<string, unknown> }
  const tipo = body.tipo
  const payload = body.payload
  if (!tipo || !payload || typeof payload !== 'object') {
    res.status(400).json({ ok: false, error: 'Faltan tipo y payload' })
    return
  }

  const { data: chkRaw, error: chkErr } = await supabase.rpc('crear_mp_checkout', {
    p_tipo: tipo,
    p_payload: payload
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
  const amount = Number(chk.amount) || 0
  const site = publicOrigin(req)
  const webhookBase = getMercadoPagoWebhookBaseUrl()
  const externalRef = buildMpCheckoutExternalRef(checkoutId)

  let title = 'Plot Center'
  if (tipo === 'venta') {
    title = `Venta Plot Center`
  } else if (tipo === 'pedido_portal') {
    title = `Compra portal Plot Center`
  }

  try {
    const pref = await createCheckoutPreference({
      items: [
        {
          title: title.slice(0, 120),
          quantity: 1,
          unit_price: Math.round(amount * 100) / 100,
          currency_id: 'ARS'
        }
      ],
      external_reference: externalRef,
      notification_url: `${webhookBase}/api/mp/webhook`,
      back_urls: {
        success: `${site}/?mp_pago=ok&checkout=${checkoutId}`,
        failure: `${site}/?mp_pago=error&checkout=${checkoutId}`,
        pending: `${site}/?mp_pago=pending&checkout=${checkoutId}`
      },
      statement_descriptor: 'PLOT CENTER'
    })

    const initPoint = mpInitPoint(pref)
    const { data: regRaw, error: regErr } = await supabase.rpc('registrar_mp_checkout_preference', {
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
      tipo,
      preference_id: pref.id,
      init_point: initPoint,
      amount
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Error al crear checkout MP' })
  }
}
