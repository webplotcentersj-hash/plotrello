export const ALICUOTAS_IVA = [21, 10.5, 27, 5, 2.5, 0] as const

export function parseComprobanteAfip(raw: string | null | undefined): {
  punto_venta: number
  numero: number
} | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const m = s.match(/(\d{1,5})\s*[-/]\s*(\d{1,8})/)
  if (m) {
    const pv = Number(m[1])
    const nro = Number(m[2])
    if (pv > 0 && nro > 0) return { punto_venta: pv, numero: nro }
  }
  const only = s.replace(/\D/g, '')
  if (only.length >= 1 && only.length <= 8) {
    const nro = Number(only)
    if (nro > 0) return { punto_venta: 1, numero: nro }
  }
  if (only.length > 8) {
    const pv = Number(only.slice(0, only.length - 8))
    const nro = Number(only.slice(-8))
    if (pv > 0 && nro > 0) return { punto_venta: pv, numero: nro }
  }
  return null
}

export function inferirAlicuotaIva(neto: number | null, iva: number | null): number {
  const n = Number(neto) || 0
  const i = Number(iva) || 0
  if (i <= 0 || n <= 0) return 0
  const ratio = (i / n) * 100
  let best: number = ALICUOTAS_IVA[0]
  let dist = Math.abs(ratio - best)
  for (const a of ALICUOTAS_IVA) {
    const d = Math.abs(ratio - a)
    if (d < dist) {
      best = a
      dist = d
    }
  }
  return dist <= 1.5 ? best : Math.round(ratio * 10) / 10
}

export function netoEIvaDesdeTotal(total: number, iva: number | null, neto: number | null): {
  neto: number
  iva: number
} {
  const t = Number(total) || 0
  const i = iva != null && Number.isFinite(Number(iva)) ? Number(iva) : null
  const n = neto != null && Number.isFinite(Number(neto)) ? Number(neto) : null
  if (i != null && i >= 0 && n != null && n >= 0) return { neto: n, iva: i }
  if (i != null && i >= 0) return { neto: Math.max(0, t - i), iva: i }
  if (n != null && n >= 0) return { neto: n, iva: Math.max(0, t - n) }
  return { neto: t, iva: 0 }
}

export function gastoPuedeIrALibroIva(iva: number | null | undefined): boolean {
  return Math.abs(Number(iva) || 0) > 0.009
}

export function letraDesdeAlicuota(alic: number): 'A' | 'B' | 'C' {
  return alic > 0 ? 'A' : 'C'
}
