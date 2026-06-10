import type { PlanillaCajaParsed, PlanillaMontosLinea } from './parsePlanillaCajaPdf'
import { sumarMontosLineas, totalPorClasificacion, validarCuadreMediosPago } from './planillaMediosPago'
import type { CajaCierre, CajaMovimiento } from './types'

export type TotalesPorMedio = PlanillaMontosLinea & {
  ingresos_menos_egresos: number
  fisico_neto: number
  electronico_neto: number
  contable_neto: number
}

export type ResumenTotalesCaja = {
  ingresos: PlanillaMontosLinea
  egresos: PlanillaMontosLinea
  neto: TotalesPorMedio
  lineas_invalidas: number
  detalle_bloques: Record<string, number>
}

function todasLineasIngreso(p: PlanillaCajaParsed): PlanillaMontosLinea[] {
  return [
    ...p.ingresos_varios,
    ...p.ingresos_pagos_clientes,
    ...p.ventas
  ]
}

function todasLineasEgreso(p: PlanillaCajaParsed): PlanillaMontosLinea[] {
  return [...p.egresos, ...p.egresos_compras, ...p.egresos_pagos_proveedores]
}

/** Réplica lógica «Totales de caja» de la planilla PDF. */
export function calcularTotalesDesdePlanilla(planilla: PlanillaCajaParsed): ResumenTotalesCaja {
  const ingresos = sumarMontosLineas(todasLineasIngreso(planilla))
  const egresos = sumarMontosLineas(todasLineasEgreso(planilla))

  const netoRow: PlanillaMontosLinea = {
    total: ingresos.total - egresos.total,
    cta_cte: ingresos.cta_cte - egresos.cta_cte,
    efectivo: ingresos.efectivo - egresos.efectivo,
    ch_prop: ingresos.ch_prop - egresos.ch_prop,
    ch_terc: ingresos.ch_terc - egresos.ch_terc,
    tarjetas: ingresos.tarjetas - egresos.tarjetas,
    docum: ingresos.docum - egresos.docum,
    c_contab: ingresos.c_contab - egresos.c_contab,
    trans_b: ingresos.trans_b - egresos.trans_b,
    otros: ingresos.otros - egresos.otros
  }

  const ingFis = totalPorClasificacion(ingresos)
  const egrFis = totalPorClasificacion(egresos)

  let lineas_invalidas = 0
  for (const l of [...todasLineasIngreso(planilla), ...todasLineasEgreso(planilla)]) {
    if (!validarCuadreMediosPago(l).valido) lineas_invalidas++
  }

  return {
    ingresos,
    egresos,
    neto: {
      ...netoRow,
      ingresos_menos_egresos: netoRow.total,
      fisico_neto: ingFis.fisico - egrFis.fisico,
      electronico_neto: ingFis.electronico - egrFis.electronico,
      contable_neto: ingFis.contable - egrFis.contable
    },
    lineas_invalidas,
    detalle_bloques: {
      ingresos_varios: planilla.ingresos_varios.length,
      ingresos_ventas: planilla.ventas.length,
      ingresos_pagos_clientes: planilla.ingresos_pagos_clientes.length,
      egresos: planilla.egresos.length,
      egresos_compras: planilla.egresos_compras.length,
      mec: planilla.movimientos_mec.length
    }
  }
}

/** Precarga campos del formulario de cierre desde totales de planilla. */
export function cierrePrecargaDesdePlanilla(planilla: PlanillaCajaParsed): Partial<CajaCierre> {
  const t = planilla.totales
  const calc = calcularTotalesDesdePlanilla(planilla)
  const ing = t
    ? {
        total: t.ingresos_total,
        efectivo: t.ingresos_efectivo,
        tarjetas: t.ingresos_tarjetas,
        trans_b: t.ingresos_trans_b,
        cta_cte: t.ingresos_cta_cte
      }
    : calc.ingresos
  const egr = t
    ? {
        efectivo: t.egresos_efectivo,
        tarjetas: t.egresos_tarjetas,
        trans_b: t.egresos_trans_b,
        cta_cte: t.egresos_cta_cte
      }
    : calc.egresos

  return {
    ing_ef: ing.efectivo ?? 0,
    egr_ef: egr.efectivo ?? 0,
    tarj_sist: ing.tarjetas ?? 0,
    trans: ing.trans_b ?? 0,
    cta_cte: ing.cta_cte ?? 0,
    total_ventas: ing.total ?? 0
  }
}

/** Neto del día solo en columna Efectivo (ingresos − egresos en efectivo). */
export function netoEfectivoDesdePlanilla(planilla: PlanillaCajaParsed): number {
  return calcularTotalesDesdePlanilla(planilla).neto.efectivo
}

/**
 * Efectivo que queda en caja según el PDF: fondo configurado + movimiento neto en efectivo del día.
 * El arqueo de billetes debe cuadrar con este monto (no tarjetas, MP ni cheques).
 */
export function efectivoQuedaEnCajaDesdePlanilla(
  planilla: PlanillaCajaParsed,
  fondoFijo = 0
): number {
  return fondoFijo + netoEfectivoDesdePlanilla(planilla)
}

/** @deprecated Usar efectivoQuedaEnCajaDesdePlanilla — el arqueo es solo efectivo, no cheques/doc. */
export function arqueoTeoricoFisicoDesdePlanilla(planilla: PlanillaCajaParsed): number {
  return netoEfectivoDesdePlanilla(planilla)
}

export function contarLineasInvalidasPlanilla(planilla: PlanillaCajaParsed): number {
  return calcularTotalesDesdePlanilla(planilla).lineas_invalidas
}

/** Totales desde movimientos guardados (desglose en medios JSON si existe). */
export function calcularTotalesDesdeMovimientos(
  movs: CajaMovimiento[],
  cajaSlug: string,
  fecha: string
): { ingresos_ef: number; egresos_ef: number } {
  const delDia = movs.filter((m) => m.fecha === fecha && (m.origen_slug === cajaSlug || m.destino_slug === cajaSlug))
  let ingresos_ef = 0
  let egresos_ef = 0
  for (const m of delDia) {
    if (m.destino_slug === cajaSlug) ingresos_ef += m.efectivo
    if (m.origen_slug === cajaSlug) egresos_ef += m.efectivo
  }
  return { ingresos_ef, egresos_ef }
}
