import type { PlanillaColumnaKey, PlanillaMontosLinea } from './parsePlanillaCajaPdf'

/** Medios que representan dinero físico en caja (arqueo). */
export const MEDIOS_FISICOS: PlanillaColumnaKey[] = ['efectivo', 'ch_prop', 'ch_terc', 'docum']

/** Medios electrónicos / bancarios (concilian aparte: MP, banco). */
export const MEDIOS_ELECTRONICOS: PlanillaColumnaKey[] = ['tarjetas', 'trans_b']

/** Valor contable / no físico en caja. */
export const MEDIOS_CONTABLES: PlanillaColumnaKey[] = ['cta_cte', 'c_contab', 'otros']

export type ClasificacionMedio = 'fisico' | 'electronico' | 'contable'

export function clasificarMedioColumna(key: PlanillaColumnaKey): ClasificacionMedio {
  if (MEDIOS_FISICOS.includes(key)) return 'fisico'
  if (MEDIOS_ELECTRONICOS.includes(key)) return 'electronico'
  return 'contable'
}

/** Suma de columnas de medio de pago (sin incluir Total). */
export function sumaMediosPago(m: PlanillaMontosLinea): number {
  return (
    m.cta_cte +
    m.efectivo +
    m.ch_prop +
    m.ch_terc +
    m.tarjetas +
    m.docum +
    m.c_contab +
    m.trans_b +
    m.otros
  )
}

export type ValidacionMediosPago = {
  valido: boolean
  suma_medios: number
  total_declarado: number
  diferencia: number
}

/** total = suma de medios (tolerancia 0,02). */
export function validarCuadreMediosPago(
  m: PlanillaMontosLinea,
  tolerancia = 0.02
): ValidacionMediosPago {
  const suma_medios = sumaMediosPago(m)
  const total_declarado = m.total || 0
  const diferencia = total_declarado - suma_medios
  const valido = Math.abs(diferencia) <= tolerancia
  return { valido, suma_medios, total_declarado, diferencia }
}

export function totalPorClasificacion(m: PlanillaMontosLinea): Record<ClasificacionMedio, number> {
  const out: Record<ClasificacionMedio, number> = { fisico: 0, electronico: 0, contable: 0 }
  const keys: PlanillaColumnaKey[] = [
    'cta_cte',
    'efectivo',
    'ch_prop',
    'ch_terc',
    'tarjetas',
    'docum',
    'c_contab',
    'trans_b',
    'otros'
  ]
  for (const k of keys) {
    out[clasificarMedioColumna(k)] += m[k] || 0
  }
  return out
}

export function sumarMontosLineas(lineas: PlanillaMontosLinea[]): PlanillaMontosLinea {
  const base: PlanillaMontosLinea = {
    total: 0,
    cta_cte: 0,
    efectivo: 0,
    ch_prop: 0,
    ch_terc: 0,
    tarjetas: 0,
    docum: 0,
    c_contab: 0,
    trans_b: 0,
    otros: 0
  }
  for (const l of lineas) {
    base.total += l.total
    base.cta_cte += l.cta_cte
    base.efectivo += l.efectivo
    base.ch_prop += l.ch_prop
    base.ch_terc += l.ch_terc
    base.tarjetas += l.tarjetas
    base.docum += l.docum
    base.c_contab += l.c_contab
    base.trans_b += l.trans_b
    base.otros += l.otros
  }
  return base
}

export type CajaMovimientoMedios = PlanillaMontosLinea & {
  tercero_nombre?: string | null
  tipo_movimiento?: 'ingreso' | 'egreso' | 'traspaso' | 'ajuste'
  categoria?: string
  bloque_planilla?: string
}
