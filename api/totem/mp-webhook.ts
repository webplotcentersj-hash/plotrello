import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  getMercadoPagoPayment,
  isMercadoPagoConfigured,
  isMpPaymentApproved,
  parseTotemCheckoutExternalRef,
  parseTotemImpresionExternalRef
} from '../../lib/api/mercadopago'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

async function confirmCheckoutPayment(checkoutId: string, paymentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('procesar_pago_totem_checkout_mp', {
    p_checkout_id: checkoutId,
    p_mp_payment_id: paymentId
  })
}

async function confirmSolicitudPayment(solicitudId: number, paymentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('marcar_pago_totem_impresion_mp', {
    p_solicitud_id: solicitudId,
    p_mp_payment_id: paymentId
  })
}

async function processPaymentId(paymentId: string): Promise<void> {
  if (!isMercadoPagoConfigured()) return
  const payment = await getMercadoPagoPayment(paymentId)
  if (!isMpPaymentApproved(payment.status)) return

  const checkoutId = parseTotemCheckoutExternalRef(payment.external_reference)
  if (checkoutId) {
    await confirmCheckoutPayment(checkoutId, String(payment.id))
    return
  }

  const solicitudId = parseTotemImpresionExternalRef(payment.external_reference)
  if (solicitudId) {
    await confirmSolicitudPayment(solicitudId, String(payment.id))
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }

  try {
    if (req.method === 'GET') {
      const topic = String(req.query.topic || req.query.type || '')
      const id = String(req.query.id || req.query['data.id'] || '')
      if (topic === 'payment' && id) {
        await processPaymentId(id)
      }
      res.status(200).send('OK')
      return
    }

    const body = (req.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } }
    const paymentId = body?.data?.id != null ? String(body.data.id) : ''
    if (paymentId && (body.type === 'payment' || String(body.action || '').startsWith('payment.'))) {
      await processPaymentId(paymentId)
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[mp-webhook]', e)
    res.status(200).json({ ok: true })
  }
}
