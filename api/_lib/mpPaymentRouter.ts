import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  getMercadoPagoPayment,
  isMercadoPagoConfigured,
  isMpPaymentApproved,
  parseMpCheckoutExternalRef,
  parseTotemCheckoutExternalRef,
  parseTotemImpresionExternalRef
} from './mercadopago'
import { fulfillPortalPedidoMp } from './mpPortalFulfillment'

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function confirmTotemCheckout(checkoutId: string, paymentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('procesar_pago_totem_checkout_mp', {
    p_checkout_id: checkoutId,
    p_mp_payment_id: paymentId
  })
}

async function confirmTotemSolicitud(solicitudId: number, paymentId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  await supabase.rpc('marcar_pago_totem_impresion_mp', {
    p_solicitud_id: solicitudId,
    p_mp_payment_id: paymentId
  })
}

async function confirmGeneralCheckout(checkoutId: string, paymentId: string, preferenceId?: string | null) {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data } = await supabase.rpc('procesar_pago_mp_checkout', {
    p_checkout_id: checkoutId,
    p_mp_payment_id: paymentId,
    p_mp_preference_id: preferenceId ?? null
  })

  const result = (data ?? {}) as {
    ok?: boolean
    tipo?: string
    pedido_id?: number
    id_cliente?: number
    already_processed?: boolean
  }

  if (result.ok && result.tipo === 'pedido_portal' && result.pedido_id && result.id_cliente) {
    await fulfillPortalPedidoMp({
      pedidoId: result.pedido_id,
      idCliente: result.id_cliente,
      checkoutId
    })
  }

  return result
}

export async function processMercadoPagoPaymentId(paymentId: string): Promise<void> {
  if (!isMercadoPagoConfigured()) return
  const payment = await getMercadoPagoPayment(paymentId)
  if (!isMpPaymentApproved(payment.status)) return

  const ref = payment.external_reference
  const mpPayId = String(payment.id)

  const totemCheckoutId = parseTotemCheckoutExternalRef(ref)
  if (totemCheckoutId) {
    await confirmTotemCheckout(totemCheckoutId, mpPayId)
    return
  }

  const generalCheckoutId = parseMpCheckoutExternalRef(ref)
  if (generalCheckoutId) {
    await confirmGeneralCheckout(generalCheckoutId, mpPayId, null)
    return
  }

  const solicitudId = parseTotemImpresionExternalRef(ref)
  if (solicitudId) {
    await confirmTotemSolicitud(solicitudId, mpPayId)
  }
}

export async function tryFulfillGeneralCheckout(checkoutId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  const { data: estadoRaw } = await supabase.rpc('obtener_estado_mp_checkout', {
    p_checkout_id: checkoutId
  })
  const estado = (estadoRaw ?? {}) as {
    ok?: boolean
    tipo?: string
    estado?: string
    resultado_extra?: { pedido_id?: number; id_cliente?: number } | null
    fulfillment_at?: string | null
  }
  if (!estado.ok || estado.estado !== 'procesado' || estado.tipo !== 'pedido_portal') return
  if (estado.fulfillment_at) return

  const extra = estado.resultado_extra
  if (!extra?.pedido_id || !extra?.id_cliente) return

  await fulfillPortalPedidoMp({
    pedidoId: extra.pedido_id,
    idCliente: extra.id_cliente,
    checkoutId
  })
}
