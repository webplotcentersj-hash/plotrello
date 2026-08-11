export type TotemImpresionCheckoutDraft = {
  cliente_nombre: string
  cliente_dni: string
  cliente_telefono: string
  cantidad_hojas: number
  tipo_impresion: string
  origen_archivo: string
  archivo_url: string
  archivo_nombre: string
  valor_total: number
  formato_impresion?: 'A4' | 'A3' | 'A3E'
  papel_impresion?: string
  faz_impresion?: 'simple' | 'doble'
  modo_color?: 'auto' | 'color' | 'bn'
  color_pages?: number
  bw_pages?: number
  descripcion?: string
    jobs?: Array<{
      url: string
      nombre: string
      formato: 'A4' | 'A3' | 'A3E'
      papel: string
      faz: 'simple' | 'doble'
      modo_color: 'auto' | 'color' | 'bn'
      hojas: number[]
      copias?: number
      page_count: number
      tipo_impresion: string
      color_pages: number
      bw_pages: number
    }>
  }

export type TotemMpCheckoutResponse = {
  ok: boolean
  error?: string
  checkout_id?: string
  preference_id?: string
  init_point?: string
  amount?: number
}

export type TotemMpCheckoutStatusResponse = {
  ok: boolean
  error?: string
  checkout_id?: string
  estado?: string
  amount?: number | null
  mp_preference_id?: string | null
  mp_payment_id?: string | null
  solicitud_id?: number | null
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

export async function crearCheckoutMpTotemImpresion(
  draft: TotemImpresionCheckoutDraft
): Promise<TotemMpCheckoutResponse> {
  const res = await fetch(url('/api/totem/mp-checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft })
  })
  const data = (await res.json().catch(() => ({}))) as TotemMpCheckoutResponse
  if (!res.ok && data.ok !== true) {
    return { ok: false, error: data.error || `HTTP ${res.status}` }
  }
  return data
}

export async function consultarEstadoCheckoutMpTotem(
  checkoutId: string
): Promise<TotemMpCheckoutStatusResponse> {
  const res = await fetch(
    url(`/api/totem/mp-checkout-status?checkout_id=${encodeURIComponent(checkoutId)}`)
  )
  const data = (await res.json().catch(() => ({}))) as TotemMpCheckoutStatusResponse
  if (!res.ok && data.ok !== true) {
    return { ok: false, error: data.error || `HTTP ${res.status}` }
  }
  return data
}
