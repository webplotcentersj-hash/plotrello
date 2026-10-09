export type AdjuntoProveedor = { url: string; nombre: string }

export function adjuntosDeMovimiento(m: {
  url_adjunto?: string | null
  url_adjuntos?: Array<{ url: string; nombre?: string }> | string[] | null
}): AdjuntoProveedor[] {
  const out: AdjuntoProveedor[] = []
  const seen = new Set<string>()
  const push = (url?: string | null, nombre?: string) => {
    const u = (url || '').trim()
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push({ url: u, nombre: nombre?.trim() || 'Comprobante' })
  }
  if (Array.isArray(m.url_adjuntos)) {
    for (const item of m.url_adjuntos) {
      if (typeof item === 'string') push(item)
      else push(item?.url, item?.nombre)
    }
  }
  push(m.url_adjunto)
  return out
}

export function inicialesProveedor(nombre: string): string {
  const parts = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 && !/^(s\.?h\.?|s\.?a\.?|srl|sa|y|de|del|la|el)$/i.test(p))
  const a = parts[0]?.[0] || nombre[0] || '?'
  const b = parts[1]?.[0] || parts[0]?.[1] || ''
  return (a + b).toUpperCase()
}

export function moneyProveedor(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function saldoCuentaProveedor(f: {
  saldo_cuenta?: number | null
  saldo_movimientos?: number | null
  saldo_listado?: number | null
}): number {
  if (f.saldo_cuenta != null && Number.isFinite(Number(f.saldo_cuenta))) return Number(f.saldo_cuenta)
  if (f.saldo_movimientos != null && Number.isFinite(Number(f.saldo_movimientos))) {
    return Number(f.saldo_movimientos)
  }
  return Number(f.saldo_listado) || 0
}

export function estadoCuentaProveedor(saldo: number): {
  label: string
  detalle: string
  frase: string
  cls: string
} {
  if (Math.abs(saldo) < 0.01) {
    return { label: 'Al día', detalle: 'No le debemos', frase: 'No le debemos nada', cls: 'ok' }
  }
  if (saldo > 0) {
    return {
      label: 'Le debemos',
      detalle: moneyProveedor(saldo),
      frase: `Le debemos ${moneyProveedor(saldo)}`,
      cls: 'deuda'
    }
  }
  return {
    label: 'A favor nuestro',
    detalle: moneyProveedor(Math.abs(saldo)),
    frase: `Nos debe ${moneyProveedor(Math.abs(saldo))} (saldo a favor)`,
    cls: 'favor'
  }
}
