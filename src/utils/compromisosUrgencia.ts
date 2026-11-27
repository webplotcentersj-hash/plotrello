/** Semáforo de vencimientos de compromisos financieros (pantalla, tablero ERP y alertas). */

export type Urgencia = 'vencido' | 'hoy' | 'urgente' | 'proximo' | 'tranquilo' | 'cumplido'

/** Dentro de estos días (y antes de los días de aviso) se marca naranja. */
export const DIAS_URGENTE = 3

export const URGENCIA_INFO: Record<Urgencia, { label: string; descripcion: string }> = {
  vencido: { label: 'Vencido', descripcion: 'La fecha ya pasó y sigue pendiente' },
  hoy: { label: 'Vence hoy', descripcion: 'Vence hoy' },
  urgente: { label: 'Urgente', descripcion: `Vence en ${DIAS_URGENTE} días o menos` },
  proximo: { label: 'Por vencer', descripcion: 'Dentro de los días de aviso del compromiso' },
  tranquilo: { label: 'En plazo', descripcion: 'Falta más que los días de aviso' },
  cumplido: { label: 'Cumplido', descripcion: 'Ya cobrado / pagado o anulado' }
}

function aUtc(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, (m || 1) - 1, d || 1)
}

/** Días desde `hoy` hasta `fecha` (negativo = ya pasó). Fechas YYYY-MM-DD. */
export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((aUtc(fecha) - aUtc(hoy)) / 86400000)
}

export function urgenciaDe(fecha: string, hoy: string, diasAviso: number, pendiente: boolean): Urgencia {
  if (!pendiente) return 'cumplido'
  const d = diasHasta(fecha, hoy)
  if (d < 0) return 'vencido'
  if (d === 0) return 'hoy'
  if (d <= DIAS_URGENTE) return 'urgente'
  if (d <= diasAviso) return 'proximo'
  return 'tranquilo'
}

export function textoDias(fecha: string, hoy: string): string {
  const d = diasHasta(fecha, hoy)
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d === -1) return 'ayer'
  return d > 0 ? `en ${d} días` : `hace ${-d} días`
}
