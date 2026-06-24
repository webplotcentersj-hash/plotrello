export type MpCheckoutTipo = 'venta' | 'pedido_portal'

export type MpCheckoutCreateResponse = {
  ok: boolean
  error?: string
  checkout_id?: string
  tipo?: MpCheckoutTipo
  preference_id?: string
  init_point?: string
  amount?: number
}

export type MpCheckoutStatusResponse = {
  ok: boolean
  error?: string
  checkout_id?: string
  tipo?: MpCheckoutTipo
  estado?: string
  amount?: number | null
  mp_preference_id?: string | null
  mp_payment_id?: string | null
  mp_init_point?: string | null
  resultado_id?: number | null
  venta_id?: number | null
  pedido_id?: number | null
  numero_venta?: string | null
  listo?: boolean
}

function apiBase(): string {
  const env = (import.meta as { env?: { VITE_PLOTLAB_API_ORIGIN?: string } }).env
  return String(env?.VITE_PLOTLAB_API_ORIGIN || '').replace(/\/$/, '')
}

function url(path: string): string {
  const base = apiBase()
  return base ? `${base}${path}` : path
}

export async function crearMpCheckout(
  tipo: MpCheckoutTipo,
  payload: Record<string, unknown>
): Promise<MpCheckoutCreateResponse> {
  const res = await fetch(url('/api/mp/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, payload })
  })
  const data = (await res.json().catch(() => ({}))) as MpCheckoutCreateResponse
  if (!res.ok && data.ok !== true) {
    return { ok: false, error: data.error || `HTTP ${res.status}` }
  }
  return data
}

export async function consultarEstadoMpCheckout(checkoutId: string): Promise<MpCheckoutStatusResponse> {
  const res = await fetch(
    url(`/api/mp/checkout-status?checkout_id=${encodeURIComponent(checkoutId)}`)
  )
  const data = (await res.json().catch(() => ({}))) as MpCheckoutStatusResponse
  if (!res.ok && data.ok !== true) {
    return { ok: false, error: data.error || `HTTP ${res.status}` }
  }
  return data
}
