import { PLOT_LAB_PRIMARY_ORIGIN } from './plotLabOrigins'

const MP_API = 'https://api.mercadopago.com'

export function getMercadoPagoAccessToken(): string {
  return (
    process.env.MERCADOPAGO_ACCESS_TOKEN ||
    process.env.MP_ACCESS_TOKEN ||
    process.env.VITE_MERCADOPAGO_ACCESS_TOKEN ||
    ''
  )
}

export function isMercadoPagoConfigured(): boolean {
  return getMercadoPagoAccessToken().length > 10
}

export function getMercadoPagoWebhookBaseUrl(): string {
  const explicit = process.env.MERCADOPAGO_WEBHOOK_URL || process.env.PLOT_LAB_PUBLIC_URL
  if (explicit) return explicit.replace(/\/$/, '')
  return PLOT_LAB_PRIMARY_ORIGIN
}

export type MpPreferenceItem = {
  title: string
  quantity: number
  unit_price: number
  currency_id?: string
}

export type MpPreferenceResponse = {
  id: string
  init_point: string
  sandbox_init_point?: string
}

export type MpPaymentResponse = {
  id: number | string
  status: string
  status_detail?: string
  external_reference?: string
  transaction_amount?: number
}

export async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getMercadoPagoAccessToken()
  if (!token) throw new Error('Mercado Pago no configurado (MERCADOPAGO_ACCESS_TOKEN)')
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string }
  if (!res.ok) {
    const msg =
      (body as { message?: string }).message ||
      (body as { error?: string }).error ||
      `Mercado Pago HTTP ${res.status}`
    throw new Error(msg)
  }
  return body
}

export async function createCheckoutPreference(input: {
  items: MpPreferenceItem[]
  external_reference: string
  notification_url: string
  back_urls?: { success?: string; failure?: string; pending?: string }
  statement_descriptor?: string
}): Promise<MpPreferenceResponse> {
  return mpFetch<MpPreferenceResponse>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: input.items.map((it) => ({ ...it, currency_id: it.currency_id || 'ARS' })),
      external_reference: input.external_reference,
      notification_url: input.notification_url,
      back_urls: input.back_urls,
      auto_return: 'approved',
      statement_descriptor: input.statement_descriptor || 'PLOT CENTER',
      binary_mode: false
    })
  })
}

export async function getMercadoPagoPayment(paymentId: string): Promise<MpPaymentResponse> {
  return mpFetch<MpPaymentResponse>(`/v1/payments/${encodeURIComponent(paymentId)}`)
}

export function buildTotemImpresionExternalRef(solicitudId: number): string {
  return `totem_impresion:${solicitudId}`
}

export function buildTotemCheckoutExternalRef(checkoutId: string): string {
  return `totem_checkout:${checkoutId}`
}

export function buildMpCheckoutExternalRef(checkoutId: string): string {
  return `mp_checkout:${checkoutId}`
}

export function parseTotemImpresionExternalRef(ref: string | null | undefined): number | null {
  const s = String(ref || '').trim()
  const m = s.match(/^totem_impresion:(\d+)$/i)
  if (!m) return null
  const id = Number(m[1])
  return Number.isFinite(id) ? id : null
}

export function parseTotemCheckoutExternalRef(ref: string | null | undefined): string | null {
  const s = String(ref || '').trim()
  const m = s.match(/^totem_checkout:([0-9a-f-]{36})$/i)
  return m ? m[1] : null
}

export function parseMpCheckoutExternalRef(ref: string | null | undefined): string | null {
  const s = String(ref || '').trim()
  const m = s.match(/^mp_checkout:([0-9a-f-]{36})$/i)
  return m ? m[1] : null
}

export function mpInitPoint(pref: MpPreferenceResponse): string {
  const useSandbox = process.env.MERCADOPAGO_SANDBOX === '1' || process.env.MERCADOPAGO_SANDBOX === 'true'
  if (useSandbox && pref.sandbox_init_point) return pref.sandbox_init_point
  return pref.init_point
}

export function isMpPaymentApproved(status: string): boolean {
  return status === 'approved'
}
