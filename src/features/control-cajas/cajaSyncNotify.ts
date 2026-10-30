export type CajaSyncToastDetail = {
  ok: boolean
  message: string
  /** Título grande (p. ej. venta realizada). */
  title?: string
  /** Más visible / más tiempo en pantalla. */
  notorio?: boolean
  /** Saldo pendiente (parcial): se muestra en color distinto. */
  saldoFalta?: number
}

export function notifyCajaSync(detail: CajaSyncToastDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('caja-sync-toast', { detail }))
}

/** Cartel global cuando una venta cobrada entra al circuito de caja. */
export function notifyVentaRealizadaCaja(opts: {
  numeroVenta?: string | null
  monto: number
  metodo: string
  cajaSlug: string
  /** Si > 0, es cobro parcial: el monto es lo cobrado y esto es lo que falta. */
  saldoFalta?: number | null
}): void {
  const nro = (opts.numeroVenta || '').trim()
  const money = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const falta = Number(opts.saldoFalta) || 0
  const esParcial = falta > 0.009
  notifyCajaSync({
    ok: true,
    notorio: true,
    title: esParcial ? 'Cobro parcial en caja' : 'Venta realizada',
    message: [
      nro ? `Nº ${nro}` : null,
      esParcial
        ? `Cobrado ${opts.metodo} $ ${money(opts.monto)} · Falta $ ${money(falta)}`
        : `${opts.metodo} $ ${money(opts.monto)}`,
      `Caja ${opts.cajaSlug}`
    ]
      .filter(Boolean)
      .join(' · '),
    saldoFalta: esParcial ? falta : undefined
  })
}

export function notifyArqueoCompletado(cajaNombre: string, total: number): void {
  notifyCajaSync({
    ok: true,
    message: `Arqueo guardado en ${cajaNombre} — $ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Listo para cierre de turno.`
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('caja-datos-actualizados'))
  }
}
