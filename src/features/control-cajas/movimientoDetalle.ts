import {
  planillaEnFecha,
  totalesEgresosPlanilla,
  totalesIngresosPlanilla,
  type ResumenAdminHoy
} from './cajaDashboardData'
import { fmtArs, montoVisibleMovimiento } from './format'
import { paseTieneTrazabilidad } from './paseCaja'
import type {
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaRegistro,
  PlanillaCajaGuardada
} from './types'

export function labelOrigenImportacion(origen: CajaMovimiento['origen_importacion']): string {
  switch (origen) {
    case 'plotlab_venta':
      return 'Venta PlotLab'
    case 'planilla_pdf':
      return 'Planilla PDF'
    case 'comprobante':
      return 'Comprobante MP/POS'
    case 'excel':
      return 'Excel'
    default:
      return 'Manual'
  }
}

export function parseRefPlotLab(m: CajaMovimiento): string | null {
  const obs = m.observacion || ''
  const match = obs.match(/PL-(?:VENTA|COBRO)-\d+/i)
  if (match) return match[0].toUpperCase()
  const nro = (m.nro_comprobante || '').trim()
  if (/^PL-/i.test(nro)) return nro.toUpperCase()
  return null
}

export function parseVentaIdFromRef(ref: string | null): number | null {
  if (!ref) return null
  const m = ref.match(/PL-VENTA-(\d+)/i)
  return m ? Number(m[1]) : null
}

export type MedioPagoLinea = { label: string; monto: number }

export function mediosPagoMovimiento(m: CajaMovimiento): MedioPagoLinea[] {
  const lines: MedioPagoLinea[] = []
  const push = (label: string, monto: number | null | undefined) => {
    const v = Number(monto) || 0
    if (v > 0) lines.push({ label, monto: v })
  }
  push('Efectivo', m.efectivo)
  push('Tarjeta', m.tarjeta)
  push('Transferencia bancaria', m.transferencia_bancaria)
  push('Cuenta corriente', m.cuenta_corriente)
  push('Cheque propio', m.cheque_propio)
  push('Cheque tercero', m.cheque_tercero)
  push('Documento', m.documento)
  push('Cuenta contable', m.cuenta_contable)
  push('Otros', m.otros)
  if (m.medios && typeof m.medios === 'object') {
    for (const [k, v] of Object.entries(m.medios)) {
      const n = Number(v) || 0
      if (n > 0 && !lines.some((l) => l.label === k)) {
        lines.push({ label: k, monto: n })
      }
    }
  }
  return lines
}

export type DiaResumenLinea = {
  id: string
  titulo: string
  detalle: string
  monto: number
  movimiento?: CajaMovimiento
}

export function lineasIngresoDia(
  fecha: string,
  resumen: ResumenAdminHoy,
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): DiaResumenLinea[] {
  if (resumen.ingresoFuente === 'cierre_turno') {
    return resumen.cierresTurnoHoy.map((l) => ({
      id: l.id,
      titulo: `Cierre de turno — ${l.hora ?? 'sin hora'}`,
      detalle: `Fondo a otra caja · resto a administración`,
      monto: (l.resto_efectivo || 0) + (l.resto_otros || 0)
    }))
  }
  if (resumen.ingresoFuente === 'planilla') {
    return planillas
      .filter((p) => planillaEnFecha(p, fecha))
      .map((p) => ({
        id: p.id,
        titulo: p.archivo_nombre || 'Planilla PDF',
        detalle: `${p.resumen?.cantidad_ventas ?? 0} ventas en planilla`,
        monto: totalesIngresosPlanilla(p)
      }))
  }
  if (resumen.ingresoFuente === 'plotlab') {
    return movimientos
      .filter(
        (m) =>
          m.fecha === fecha &&
          !m.anulado &&
          m.tipo_movimiento === 'ingreso' &&
          m.origen_importacion === 'plotlab_venta'
      )
      .map((m) => ({
        id: m.id,
        titulo: m.concepto,
        detalle: [
          m.tercero_nombre,
          parseRefPlotLab(m),
          m.observacion?.split('—').pop()?.trim()
        ]
          .filter(Boolean)
          .join(' · '),
        monto: montoVisibleMovimiento(m),
        movimiento: m
      }))
  }
  return []
}

export function lineasEgresoDia(
  fecha: string,
  egresos: CajaEgresoSolicitud[],
  planillas: PlanillaCajaGuardada[]
): DiaResumenLinea[] {
  const aprobados = egresos.filter((e) => e.fecha === fecha && e.estado === 'aprobado')
  const lineas: DiaResumenLinea[] = aprobados.map((e) => ({
    id: e.id,
    titulo: e.concepto,
    detalle: [e.solicitante_nombre, e.observacion].filter(Boolean).join(' · '),
    monto: (e.monto_efectivo || 0) + (e.monto_otros || 0)
  }))
  if (lineas.length > 0) return lineas
  return planillas
    .filter((p) => planillaEnFecha(p, fecha))
    .map((p) => ({
      id: `planilla-eg-${p.id}`,
      titulo: `Egresos planilla — ${p.archivo_nombre || 'PDF'}`,
      detalle: 'Egresos registrados en planilla del día',
      monto: totalesEgresosPlanilla(p)
    }))
    .filter((l) => l.monto > 0)
}

export function cajaNombreFromSlug(slug: string, cajas: CajaRegistro[]): string {
  return cajas.find((c) => c.slug === slug)?.nombre ?? slug
}

/**
 * Ruta visible del movimiento.
 * Ventas PlotLab: solo la caja del titular (no “Admin → …”).
 */
export function etiquetaRutaCajasMovimiento(
  m: Pick<CajaMovimiento, 'origen_slug' | 'destino_slug' | 'origen_importacion' | 'tipo_movimiento'>,
  cajas: CajaRegistro[]
): string {
  const dest = cajaNombreFromSlug(m.destino_slug, cajas)
  const orig = cajaNombreFromSlug(m.origen_slug, cajas)
  if (
    m.origen_importacion === 'plotlab_venta' &&
    (m.origen_slug === 'admin' || m.tipo_movimiento === 'ingreso')
  ) {
    return dest
  }
  if (m.origen_slug === m.destino_slug) return dest
  return `${orig} → ${dest}`
}

export function trazabilidadFilas(m: CajaMovimiento): { label: string; antes: string; despues: string }[] {
  if (!paseTieneTrazabilidad(m)) return []
  const fila = (label: string, a: number | null | undefined, d: number | null | undefined) => ({
    label,
    antes: `$ ${fmtArs(a ?? 0)}`,
    despues: `$ ${fmtArs(d ?? 0)}`
  })
  const out = [
    fila('Origen efectivo', m.origen_efectivo_antes, m.origen_efectivo_despues),
    fila('Destino efectivo', m.destino_efectivo_antes, m.destino_efectivo_despues)
  ]
  if (m.origen_otros_antes != null || m.destino_otros_antes != null) {
    out.push(
      fila('Origen otros', m.origen_otros_antes, m.origen_otros_despues),
      fila('Destino otros', m.destino_otros_antes, m.destino_otros_despues)
    )
  }
  return out
}

export function tituloIngresoDia(_resumen: ResumenAdminHoy, esHoy: boolean): string {
  return esHoy ? 'Ingreso hoy' : 'Ingreso del día'
}

export function subtituloIngresoDia(resumen: ResumenAdminHoy): string {
  switch (resumen.ingresoFuente) {
    case 'cierre_turno':
      return 'Resto enviado a administración (cierres de turno)'
    case 'planilla':
      return 'Ingresos en planillas PDF (aún sin cierre de turno)'
    case 'plotlab':
      return 'Ingresos desde ventas PlotLab (mostrador / CRM)'
    default:
      return 'Sin ingresos registrados este día'
  }
}
