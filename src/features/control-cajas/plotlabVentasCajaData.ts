import type { CajaMovimiento, PlanillaCajaGuardada } from './types'
import { planillaEnFecha } from './cajaDashboardData'

export type ResumenPlotlabVentasCaja = {
  count: number
  efectivo: number
  tarjetas: number
  transferencia: number
  ctaCte: number
  otros: number
  total: number
}

export function resumenPlotlabVentasCaja(
  movimientos: CajaMovimiento[],
  fecha: string,
  cajaSlug: string
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
    if (m.tipo_movimiento !== 'ingreso' || m.destino_slug !== cajaSlug) continue
    out.count++
    out.efectivo += m.efectivo || 0
    out.tarjetas += m.tarjeta || 0
    out.transferencia += m.transferencia_bancaria || 0
    out.ctaCte += m.cuenta_corriente || 0
    const otrosCols =
      (m.cheque_propio || 0) +
      (m.cheque_tercero || 0) +
      (m.documento || 0) +
      (m.cuenta_contable || 0) +
      (m.otros || 0)
    out.otros += otrosCols
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
