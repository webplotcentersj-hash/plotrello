/**
 * Aguinaldo (SAC, art. 121–122 LCT) y plus vacacional (art. 155 LCT), sobre lo declarado
 * en el Libro de sueldos (sólo lo registrado: no se agrega lo no declarado).
 *
 * - SAC = 50% de la mayor remuneración mensual devengada en el semestre
 *   (sin contar el propio SAC), proporcional al tiempo trabajado si ingresó dentro del semestre.
 * - Plus vacacional: el día de vacaciones se paga sueldo ÷ 25 en lugar de ÷ 30;
 *   la diferencia es días × (sueldo/25 − sueldo/30).
 */
import type { RrhhNovedad, SolicitudPermiso } from '../types/api'
import { round2, type ReciboExtra } from './rrhhLibroSueldos'

export const CODIGO_SAC = 'SAC'
export const CODIGO_PLUS_VAC = 'PLUSVAC'

export type Semestre = { anio: number; numero: 1 | 2; desde: string; hasta: string; meses: string[] }

/** Semestre al que pertenece el período (YYYY-MM). */
export function semestreDe(periodo: string): Semestre {
  const anio = Number(periodo.slice(0, 4))
  const mes = Number(periodo.slice(5, 7))
  const numero: 1 | 2 = mes <= 6 ? 1 : 2
  const m0 = numero === 1 ? 1 : 7
  const meses = Array.from({ length: 6 }, (_, i) => `${anio}-${String(m0 + i).padStart(2, '0')}`)
  return { anio, numero, desde: `${anio}-${numero === 1 ? '01-01' : '07-01'}`, hasta: `${anio}-${numero === 1 ? '06-30' : '12-31'}`, meses }
}

/** El SAC se liquida con los sueldos de junio y diciembre. */
export function esMesDeSac(periodo: string): boolean {
  const m = periodo.slice(5, 7)
  return m === '06' || m === '12'
}

function diasInclusive(desde: string, hasta: string): number {
  const a = desde.split('-').map(Number)
  const b = hasta.split('-').map(Number)
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) + 1
}

export type ResultadoSac = {
  mejorRemuneracion: number
  mejorPeriodo: string | null
  diasSemestre: number
  diasTrabajados: number
  proporcion: number
  sac: number
}

/**
 * @param remuneraciones bruto remunerativo de cada mes del semestre (sin el SAC).
 * @param fechaIngreso si ingresó dentro del semestre, se proporciona por días.
 */
export function calcularSac(params: {
  semestre: Semestre
  remuneraciones: Record<string, number>
  fechaIngreso?: string | null
  fechaEgreso?: string | null
}): ResultadoSac {
  const { semestre } = params
  let mejor = 0
  let mejorPeriodo: string | null = null
  for (const p of semestre.meses) {
    const r = Number(params.remuneraciones[p]) || 0
    if (r > mejor) {
      mejor = r
      mejorPeriodo = p
    }
  }
  const diasSemestre = diasInclusive(semestre.desde, semestre.hasta)
  const ini = params.fechaIngreso && params.fechaIngreso.slice(0, 10) > semestre.desde ? params.fechaIngreso.slice(0, 10) : semestre.desde
  const fin = params.fechaEgreso && params.fechaEgreso.slice(0, 10) < semestre.hasta ? params.fechaEgreso.slice(0, 10) : semestre.hasta
  const diasTrabajados = ini > fin ? 0 : diasInclusive(ini, fin)
  const proporcion = Math.min(1, diasTrabajados / diasSemestre)
  return {
    mejorRemuneracion: round2(mejor),
    mejorPeriodo,
    diasSemestre,
    diasTrabajados,
    proporcion,
    sac: round2((mejor / 2) * proporcion)
  }
}

/** Días de vacaciones (corridos) que caen dentro del mes, por empleado. */
export function diasVacacionesEnMes(params: {
  periodo: string
  solicitudes: SolicitudPermiso[]
  novedades: RrhhNovedad[]
}): Map<number, number> {
  const [y, m] = params.periodo.split('-').map(Number)
  const desdeMes = `${params.periodo}-01`
  const hastaMes = `${params.periodo}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  const out = new Map<number, number>()
  const sumar = (id: number, desde: string, hasta: string) => {
    const d = desde.slice(0, 10) > desdeMes ? desde.slice(0, 10) : desdeMes
    const h = hasta.slice(0, 10) < hastaMes ? hasta.slice(0, 10) : hastaMes
    if (d > h) return
    out.set(id, (out.get(id) ?? 0) + diasInclusive(d, h))
  }
  const solicitudesUsadas = new Set<number>()
  for (const s of params.solicitudes) {
    if (s.tipo_solicitud !== 'vacaciones' || s.estado !== 'aprobado' || !s.fecha_inicio) continue
    solicitudesUsadas.add(s.id)
    sumar(s.id_usuario, s.fecha_inicio, s.fecha_fin || s.fecha_inicio)
  }
  for (const n of params.novedades) {
    if (n.codigo !== 'licencia_vacaciones') continue
    if (n.id_solicitud_permiso != null && solicitudesUsadas.has(n.id_solicitud_permiso)) continue
    sumar(n.id_usuario, n.fecha_desde, n.fecha_hasta)
  }
  return out
}

/** Diferencia por pagar el día de vacaciones a sueldo/25 en vez de sueldo/30. */
export function plusVacacional(sueldoMensual: number, diasVacaciones: number): number {
  const s = Math.max(0, Number(sueldoMensual) || 0)
  const d = Math.max(0, Number(diasVacaciones) || 0)
  if (!s || !d) return 0
  return round2(d * (s / 25 - s / 30))
}

/** Reemplaza (o quita si el monto es 0) un concepto calculado del recibo, conservando el resto. */
export function conExtraCalculado(extras: ReciboExtra[], extra: Omit<ReciboExtra, 'origen'>): ReciboExtra[] {
  const otros = (extras || []).filter((x) => x.codigo_lsd !== extra.codigo_lsd)
  return extra.monto > 0 ? [...otros, { ...extra, origen: 'calc' }] : otros
}
