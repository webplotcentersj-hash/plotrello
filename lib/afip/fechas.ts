import { FacturaInvalidaError } from './errors'

/** 1 Productos · 2 Servicios · 3 Productos y Servicios (tabla FEParamGetTiposConcepto). */
export type ConceptoAfip = 1 | 2 | 3

export function normalizarConcepto(value: unknown): ConceptoAfip {
  const n = Number(value)
  return n === 2 || n === 3 ? n : 1
}

export function hoyArgentina(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now)
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function finDeMes(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  return d.toISOString().slice(0, 10)
}

function esFechaIso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
}

/**
 * Fecha del comprobante que acepta AFIP (validación 10016): productos N±5 sin pasar al mes siguiente,
 * servicios N±10. Si la fecha guardada queda afuera, se usa hoy.
 */
export function fechaComprobanteParaAfip(
  fechaGuardada: string | null | undefined,
  concepto: ConceptoAfip,
  hoy: string = hoyArgentina()
): string {
  if (!esFechaIso(fechaGuardada)) return hoy
  const f = fechaGuardada.slice(0, 10)
  const margen = concepto === 1 ? 5 : 10
  const desde = sumarDias(hoy, -margen)
  let hasta = sumarDias(hoy, margen)
  if (concepto === 1 && hasta > finDeMes(hoy)) hasta = finDeMes(hoy)
  return f < desde || f > hasta ? hoy : f
}

export type FechasServicio = { desde: string; hasta: string; vtoPago: string }

/**
 * Servicios (concepto 2/3): período y vencimiento del pago, obligatorios en AFIP.
 * Sin período cargado se usa la fecha del comprobante; el vencimiento nunca antes de esa fecha (validación 10036).
 */
export function resolverFechasServicio(
  factura: {
    fecha_servicio_desde?: string | null
    fecha_servicio_hasta?: string | null
    fecha_vencimiento?: string | null
  },
  fechaComprobante: string
): FechasServicio {
  const desde = esFechaIso(factura.fecha_servicio_desde) ? factura.fecha_servicio_desde.slice(0, 10) : fechaComprobante
  const hasta = esFechaIso(factura.fecha_servicio_hasta) ? factura.fecha_servicio_hasta.slice(0, 10) : desde
  if (desde > hasta) {
    throw new FacturaInvalidaError('El período del servicio es inválido: la fecha "desde" es posterior a la fecha "hasta".')
  }
  const vto = esFechaIso(factura.fecha_vencimiento) ? factura.fecha_vencimiento.slice(0, 10) : fechaComprobante
  return { desde, hasta, vtoPago: vto < fechaComprobante ? fechaComprobante : vto }
}
