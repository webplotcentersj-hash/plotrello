import { fmtArs, fmtDateAr } from './format'
import type { CajaMovimiento, CajaTransferenciaLote, CajaRegistro } from './types'
import type { PlanillaCajaParsed } from './parsePlanillaCajaPdf'
import type { ComprobanteMedioParsed } from './comprobanteMediosTypes'

export type CierreTurnoDetallePack = {
  exportado_en: string
  lote: CajaTransferenciaLote
  cajas: { origen: string; fondo_destino: string }
  planilla: PlanillaCajaParsed | null
  comprobantes: ComprobanteMedioParsed[]
  movimientos: CajaMovimiento[]
}

export function buildCierreTurnoDetallePack(
  lote: CajaTransferenciaLote,
  cajas: CajaRegistro[],
  planilla: PlanillaCajaParsed | null,
  movimientos: CajaMovimiento[]
): CierreTurnoDetallePack {
  const nombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const det = lote.detalle ?? {}
  const comprobantes = (det.comprobantes as ComprobanteMedioParsed[] | undefined) ?? []

  return {
    exportado_en: new Date().toISOString(),
    lote,
    cajas: { origen: nombre(lote.origen_slug), fondo_destino: nombre(lote.caja_fondo_destino_slug) },
    planilla,
    comprobantes,
    movimientos
  }
}

export function downloadCierreTurnoJson(pack: CierreTurnoDetallePack): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cierre-turno-${pack.lote.fecha}-${pack.lote.id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function resumenCierreTurnoTexto(
  lote: CajaTransferenciaLote,
  cajas: CajaRegistro[],
  planilla: PlanillaCajaParsed | null
): string {
  const nombre = (slug: string) => cajas.find((c) => c.slug === slug)?.nombre ?? slug
  const lines = [
    `CIERRE DE TURNO — ${fmtDateAr(lote.fecha)} ${lote.hora ?? ''}`.trim(),
    `Cajera/o: ${lote.usuario_nombre ?? '—'}`,
    `Origen: ${nombre(lote.origen_slug)} → Fondo a: ${nombre(lote.caja_fondo_destino_slug)}`,
    `Fondo: $ ${fmtArs(lote.fondo_monto)}`,
    `A administración: $ ${fmtArs(lote.resto_efectivo + lote.resto_otros)}`,
    `Arqueo: ef. $ ${fmtArs(lote.arqueo_efectivo)} · otros $ ${fmtArs(lote.arqueo_otros)}`,
    `Egresos aprobados (ef.): $ ${fmtArs(lote.egresos_aprobados_ef)}`
  ]
  if (planilla) {
    lines.push(
      '',
      `PLANILLA: ${planilla.archivo_nombre}`,
      `Ventas FA/FB: ${planilla.ventas.length}`,
      `Ingresos total: $ ${fmtArs(planilla.totales?.ingresos_total ?? 0)}`
    )
  }
  return lines.join('\n')
}

export function downloadCierreTurnoResumenTxt(
  lote: CajaTransferenciaLote,
  cajas: CajaRegistro[],
  planilla: PlanillaCajaParsed | null
): void {
  const blob = new Blob([resumenCierreTurnoTexto(lote, cajas, planilla)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cierre-turno-${lote.fecha}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
