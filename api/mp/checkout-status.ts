import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildMpCheckoutExternalRef,
  isMercadoPagoConfigured,
  isMpPaymentApproved,
  parseMpCheckoutExternalRef
} from '../../lib/api/mercadopago'
import { tryFulfillGeneralCheckout } from '../../lib/api/mpPaymentRouter'
import { handleOptions, setCorsRestricted } from '../plotai/_http'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function tryProcessPayment(checkoutId: string, paymentId: string) {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('procesar_pago_mp_checkout', {
    p_checkout_id: checkoutId,
    p_mp_payment_id: paymentId
  })
  await tryFulfillGeneralCheckout(checkoutId)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsRestricted(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  const checkoutId = String(req.query.checkout_id || '').trim()
  if (!UUID_RE.test(checkoutId)) {
    res.status(400).json({ ok: false, error: 'checkout_id inválido' })
    return
  }

  const { data: estadoRaw, error } = await supabase.rpc('obtener_estado_mp_checkout', {
    p_checkout_id: checkoutId
  })
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  let estado = (estadoRaw ?? {}) as {
    ok?: boolean
    error?: string
    tipo?: string
    estado?: string
    amount?: number
    mp_preference_id?: string | null
    mp_payment_id?: string | null
    mp_init_point?: string | null
    resultado_id?: number | null
    resultado_extra?: Record<string, unknown> | null
  }

  if (!estado.ok) {
    res.status(404).json({ ok: false, error: estado.error || 'Checkout no encontrado' })
    return
  }

  if (estado.estado !== 'procesado' && isMercadoPagoConfigured()) {
    try {
      const search = await fetch(
        `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(buildMpCheckoutExternalRef(checkoutId))}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || ''}`
          }
        }
      )
      if (search.ok) {
        const json = (await search.json()) as {
          results?: Array<{ id: number | string; status: string; external_reference?: string }>
        }
        const hit = (json.results || []).find(
          (p) =>
            isMpPaymentApproved(p.status) &&
            parseMpCheckoutExternalRef(p.external_reference) === checkoutId
        )
        if (hit) {
          await tryProcessPayment(checkoutId, String(hit.id))
          const { data: refreshed } = await supabase.rpc('obtener_estado_mp_checkout', {
            p_checkout_id: checkoutId
          })
          estado = (refreshed ?? estado) as typeof estado
        }
      }
    } catch {
      // ignore poll errors
    }
  }

  if (estado.estado === 'procesado') {
    await tryFulfillGeneralCheckout(checkoutId)
  }

  const extra = estado.resultado_extra || {}
  res.status(200).json({
    ok: true,
    checkout_id: checkoutId,
    tipo: estado.tipo,
    estado: estado.estado,
    amount: estado.amount ?? null,
    mp_preference_id: estado.mp_preference_id ?? null,
    mp_payment_id: estado.mp_payment_id ?? null,
    mp_init_point: estado.mp_init_point ?? null,
    resultado_id: estado.resultado_id ?? null,
    venta_id: extra.venta_id ?? (estado.tipo === 'venta' ? estado.resultado_id : null),
    pedido_id: extra.pedido_id ?? (estado.tipo === 'pedido_portal' ? estado.resultado_id : null),
    numero_venta: extra.numero_venta ?? null,
    listo: estado.estado === 'procesado'
  })
}
