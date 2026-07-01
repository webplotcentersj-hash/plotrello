import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  buildTotemImpresionExternalRef,
  getMercadoPagoPayment,
  isMercadoPagoConfigured,
  isMpPaymentApproved,
  parseTotemImpresionExternalRef
} from '../lib/mercadopago'
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

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  const supabase = getSupabase()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  const solicitudId = Number(req.query.solicitud_id)
  if (!Number.isFinite(solicitudId) || solicitudId < 1) {
    res.status(400).json({ ok: false, error: 'solicitud_id inválido' })
    return
  }

  const { data: estadoRaw, error } = await supabase.rpc('obtener_estado_pago_totem_impresion', {
    p_solicitud_id: solicitudId
  })
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  const estado = (estadoRaw ?? {}) as {
    ok?: boolean
    error?: string
    estado_pago?: string
    pagado_at?: string | null
    valor_total?: number
    mp_preference_id?: string | null
    mp_payment_id?: string | null
    mp_init_point?: string | null
  }

  if (!estado.ok) {
    res.status(404).json({ ok: false, error: estado.error || 'Solicitud no encontrada' })
    return
  }

  if (estado.estado_pago !== 'pagado' && estado.mp_payment_id && isMercadoPagoConfigured()) {
    try {
      const payment = await getMercadoPagoPayment(String(estado.mp_payment_id))
      if (isMpPaymentApproved(payment.status)) {
        await supabase.rpc('marcar_pago_totem_impresion_mp', {
          p_solicitud_id: solicitudId,
          p_mp_payment_id: String(payment.id)
        })
        estado.estado_pago = 'pagado'
      }
    } catch {
      // ignore poll errors
    }
  }

  if (estado.estado_pago !== 'pagado' && estado.mp_preference_id && isMercadoPagoConfigured()) {
    try {
      const search = await fetch(
        `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&external_reference=${encodeURIComponent(buildTotemImpresionExternalRef(solicitudId))}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || ''}`
          }
        }
      )
      if (search.ok) {
        const json = (await search.json()) as { results?: Array<{ id: number | string; status: string; external_reference?: string }> }
        const hit = (json.results || []).find(
          (p) =>
            isMpPaymentApproved(p.status) &&
            parseTotemImpresionExternalRef(p.external_reference) === solicitudId
        )
        if (hit) {
          await supabase.rpc('marcar_pago_totem_impresion_mp', {
            p_solicitud_id: solicitudId,
            p_mp_payment_id: String(hit.id)
          })
          estado.estado_pago = 'pagado'
          estado.mp_payment_id = String(hit.id)
        }
      }
    } catch {
      // ignore
    }
  }

  const { data: refreshed } = await supabase.rpc('obtener_estado_pago_totem_impresion', {
    p_solicitud_id: solicitudId
  })
  const out = (refreshed ?? estado) as typeof estado

  res.status(200).json({
    ok: true,
    solicitud_id: solicitudId,
    estado_pago: out.estado_pago,
    pagado_at: out.pagado_at ?? null,
    valor_total: out.valor_total ?? null,
    mp_init_point: out.mp_init_point ?? null,
    mp_payment_id: out.mp_payment_id ?? null
  })
}
