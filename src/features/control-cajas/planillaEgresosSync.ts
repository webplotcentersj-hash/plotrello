import { listEgresoSolicitudes, saveEgresoSolicitudImportado } from './cajaRepository'
import type { PlanillaCajaParsed, PlanillaLineaConMontos } from './parsePlanillaCajaPdf'
import type { CajaMovimiento } from './types'

function otrosMediosLinea(linea: PlanillaLineaConMontos): number {
  return (
    (linea.tarjetas || 0) +
    (linea.cta_cte || 0) +
    (linea.trans_b || 0) +
    (linea.ch_prop || 0) +
    (linea.ch_terc || 0) +
    (linea.docum || 0) +
    (linea.c_contab || 0) +
    (linea.otros || 0)
  )
}

function lineaTieneMonto(linea: PlanillaLineaConMontos): boolean {
  return (
    (linea.total || 0) > 0 ||
    (linea.efectivo || 0) > 0 ||
    otrosMediosLinea(linea) > 0
  )
}

/** Registra egresos del PDF como solicitudes ya aprobadas (efectivo + tarjetas/otros), vinculados al movimiento importado. */
export async function syncEgresosSolicitudesDesdePlanilla(opts: {
  planilla: PlanillaCajaParsed
  cajaSlug: string
  fecha: string
  usuarioNombre: string
  usuarioId?: number
  movimientos: CajaMovimiento[]
}): Promise<number> {
  const { planilla, cajaSlug, fecha, usuarioNombre, usuarioId, movimientos } = opts
  const existentes = await listEgresoSolicitudes({ fecha, cajaSlug })
  const yaImportados = new Set(
    existentes
      .filter((s) => s.observacion?.includes('planilla PDF'))
      .map((s) => s.concepto)
  )

  const lineas = [
    ...planilla.egresos,
    ...planilla.egresos_compras,
    ...planilla.egresos_pagos_proveedores
  ].filter(lineaTieneMonto)

  const egresoMovs = movimientos.filter((m) => m.tipo_movimiento === 'egreso')
  let creados = 0

  for (const linea of lineas) {
    const concepto = linea.concepto || linea.comprobante || 'Egreso planilla'
    if (yaImportados.has(concepto)) continue

    const mov =
      egresoMovs.find((m) => m.nro_comprobante === linea.comprobante) ??
      egresoMovs.find((m) => m.concepto === concepto)

    const monto_efectivo = linea.efectivo || 0
    const monto_otros = otrosMediosLinea(linea)
    if (monto_efectivo <= 0 && monto_otros <= 0) continue

    await saveEgresoSolicitudImportado({
      fecha,
      caja_slug: cajaSlug,
      concepto,
      monto_efectivo,
      monto_otros,
      solicitante_id: usuarioId ?? null,
      solicitante_nombre: usuarioNombre,
      observacion: `Importado desde planilla PDF (${linea.comprobante || 'sin comprobante'})`,
      id_movimiento: mov?.id ?? null
    })
    yaImportados.add(concepto)
    creados++
  }

  return creados
}
