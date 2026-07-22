import type { CajaMovimiento, PlanillaCajaGuardada } from './types'
import { planillaEnFecha } from './cajaDashboardData'
import { esCajaSlugUsuario } from './cajaPorUsuario'

export type ResumenPlotlabVentasCaja = {
  count: number
  efectivo: number
  tarjetas: number
  transferencia: number
  ctaCte: number
  otros: number
  total: number
}

/** Titular de la caja operativa (slug u-{id} o id_usuario del registro). */
function idTitularDesdeCajaSlug(
  cajaSlug: string,
  idUsuarioCaja?: number | null
): number | null {
  if (idUsuarioCaja != null && idUsuarioCaja > 0) return idUsuarioCaja
  if (!esCajaSlugUsuario(cajaSlug)) return null
  const n = Number(cajaSlug.slice(2))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Venta PlotLab pertenece a la caja del titular.
 * Si destino_slug está mal pero id_usuario es el del cajero, igual cuenta acá (no en la caja ajena).
 */
export function movimientoPlotlabPerteneceCaja(
  m: Pick<CajaMovimiento, 'destino_slug' | 'id_usuario'>,
  cajaSlug: string,
  idUsuarioCaja?: number | null
): boolean {
  const titular = idTitularDesdeCajaSlug(cajaSlug, idUsuarioCaja)
  if (m.id_usuario != null && titular != null) {
    return m.id_usuario === titular
  }
  return m.destino_slug === cajaSlug
}

export function resumenPlotlabVentasCaja(
  movimientos: CajaMovimiento[],
  fecha: string,
  cajaSlug: string,
  idUsuarioCaja?: number | null
): ResumenPlotlabVentasCaja {
  const out: ResumenPlotlabVentasCaja = {
    count: 0,
    efectivo: 0,
    tarjetas: 0,
    transferencia: 0,
    ctaCte: 0,
    otros: 0,
    total: 0
  }

  for (const m of movimientos) {
    if (m.anulado || m.fecha !== fecha || m.origen_importacion !== 'plotlab_venta') continue
    if (m.tipo_movimiento !== 'ingreso') continue
    if (!movimientoPlotlabPerteneceCaja(m, cajaSlug, idUsuarioCaja)) continue
    out.count++
    out.efectivo += m.efectivo || 0
    out.tarjetas += m.tarjeta || 0
    out.transferencia += m.transferencia_bancaria || 0
    out.ctaCte += m.cuenta_corriente || 0
    out.otros += (m.cheque_propio || 0) + (m.cheque_tercero || 0)
    out.total += m.monto_total || 0
  }

  return out
}

export type AlertaDobleFuenteCaja = {
  activa: boolean
  plotlabIngresos: number
  planillaIngresos: number
  mensaje: string
}

export function alertaDobleFuenteCaja(
  fecha: string,
  cajaSlug: string,
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): AlertaDobleFuenteCaja {
  const resumen = resumenPlotlabVentasCaja(movimientos, fecha, cajaSlug)
  const planillasDia = planillas.filter((p) => planillaEnFecha(p, fecha) && p.caja_slug === cajaSlug)
  const planillaIngresos = planillasDia.reduce(
    (s, p) => s + (Number(p.totales?.ingresos_total) || 0),
    0
  )

  const activa = resumen.total > 0 && planillaIngresos > 0
  return {
    activa,
    plotlabIngresos: resumen.total,
    planillaIngresos,
    mensaje: activa
      ? `Hay ventas PlotLab ($ ${resumen.total.toFixed(2)}) y planilla PDF ($ ${planillaIngresos.toFixed(2)}) el mismo día en esta caja. Revisá antes del cierre para no duplicar.`
      : ''
  }
}
