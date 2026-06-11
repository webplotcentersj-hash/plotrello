import { listEgresoSolicitudes, saveEgresoSolicitudImportado, saveMovimiento } from './cajaRepository'
import { metodoPagoPlotLabAMedios, type MetodoPagoPlotLab } from './plotlabVentaCajaSync'
import { mediosToPlanillaLinea, movimientoDesdeMedios } from './movimientoCaja'

export type PagoPlotLabEgresoInput = {
  pagoId: number
  monto: number
  metodoPago: MetodoPagoPlotLab
  fecha: string
  concepto: string
  cajaSlug: string
  usuarioId?: number
  usuarioNombre?: string
  numeroComprobante?: string | null
}

function refPagoPlotLab(pagoId: number): string {
  return `PL-PAGO-${pagoId}`
}

/** Egreso de caja desde pago a proveedor (tesorería PlotLab), igual que fila EG del PDF. */
export async function syncEgresoDesdePagoPlotLab(input: PagoPlotLabEgresoInput): Promise<boolean> {
  const ref = refPagoPlotLab(input.pagoId)
  const existentes = await listEgresoSolicitudes({ fecha: input.fecha, cajaSlug: input.cajaSlug })
  if (existentes.some((e) => e.observacion?.includes(ref))) return true

  const medios = metodoPagoPlotLabAMedios(input.metodoPago, input.monto, 'Pagado')
  if (!medios) return false

  const linea = mediosToPlanillaLinea(medios)
  const monto_efectivo = linea.efectivo
  const monto_otros =
    linea.tarjetas +
    linea.trans_b +
    linea.cta_cte +
    linea.ch_prop +
    linea.ch_terc +
    linea.docum +
    linea.c_contab +
    linea.otros

  const mov = await saveMovimiento(
    movimientoDesdeMedios(
      {
        fecha: input.fecha,
        hora: new Date().toTimeString().slice(0, 5),
        caja_slug: input.cajaSlug,
        tipo_movimiento: 'egreso',
        categoria: 'Pago proveedor',
        comprobante: input.numeroComprobante ?? null,
        concepto: input.concepto.slice(0, 120),
        medios,
        observacion: `PlotLab pago (${ref})`,
        id_usuario: input.usuarioId ?? null,
        usuario_nombre: input.usuarioNombre ?? null,
        origen_importacion: 'plotlab_venta'
      },
      { origen_slug: input.cajaSlug, destino_slug: 'admin' }
    )
  )

  await saveEgresoSolicitudImportado({
    fecha: input.fecha,
    caja_slug: input.cajaSlug,
    concepto: input.concepto,
    monto_efectivo,
    monto_otros,
    solicitante_id: input.usuarioId ?? null,
    solicitante_nombre: input.usuarioNombre ?? 'Tesorería',
    observacion: `PlotLab tesorería (${ref})`,
    id_movimiento: mov.id,
    aprobador_nombre: 'PlotLab'
  })

  return true
}
