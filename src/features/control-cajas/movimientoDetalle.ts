import {
  planillaEnFecha,
  totalesEgresosPlanilla,
  totalesIngresosPlanilla,
  type ResumenAdminHoy
} from './cajaDashboardData'
import { fmtArs, montoCuentaCorriente, montoVisibleMovimiento } from './format'
import { esPaseCierreTurno, esTraspasoEntreCajas } from './movimientoCaja'
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
  {
    const tarj = Number(m.tarjeta) || 0
    if (tarj > 0) {
      const med = m.medios as { mercado_pago?: number } | null | undefined
      const txt = `${m.observacion || ''} ${m.concepto || ''}`.toLowerCase()
      const esMp = (med && Number(med.mercado_pago) > 0) || /mercado\s*pago/.test(txt)
      push(esMp ? 'Mercado Pago' : 'Tarjeta', tarj)
    }
  }
  push('Transferencia bancaria', m.transferencia_bancaria)
  push('Cuenta corriente', m.cuenta_corriente)
  push('Cheque propio', m.cheque_propio)
  push('Cheque tercero', m.cheque_tercero)
  push('Documento', m.documento)
  push('Cuenta contable', m.cuenta_contable)
  {
    const med = m.medios as { otros?: number } | null | undefined
    const residual =
      med && typeof med.otros === 'number'
        ? Number(med.otros) || 0
        : (m.tarjeta ?? 0) +
              (m.transferencia_bancaria ?? 0) +
              (m.cuenta_corriente ?? 0) +
              (m.cheque_propio ?? 0) +
              (m.cheque_tercero ?? 0) +
              (m.documento ?? 0) +
              (m.cuenta_contable ?? 0) >
            0.02
          ? 0
          : m.otros ?? 0
    push('Otros', residual)
  }
  if (m.medios && typeof m.medios === 'object') {
    const meta = new Set([
      'mp_payment_id',
      'mp_preference_id',
      'mp_aprobado',
      'mercado_pago',
      'efectivo',
      'tarjeta',
      'transferencia',
      'transferencia_bancaria',
      'cuenta_corriente',
      'cheque_propio',
      'cheque_tercero',
      'documento',
      'cuenta_contable',
      'otros'
    ])
    for (const [k, v] of Object.entries(m.medios)) {
      if (meta.has(k)) continue
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
  medio?: string
  caja?: string
  hora?: string | null
  esCc?: boolean
}

export function medioVisibleIngreso(m: CajaMovimiento): string {
  const medios = mediosPagoMovimiento(m)
  if (medios.length === 1) return medios[0].label
  if (medios.length > 1) return medios.map((x) => x.label).join(' + ')
  return m.observacion?.split('—').pop()?.trim() || 'Otro'
}

export function resumenLineasIngreso(lineas: DiaResumenLinea[]): {
  total: number
  cobrado: number
  cc: number
  count: number
  porMedio: { label: string; monto: number }[]
} {
  let total = 0
  let cc = 0
  const porMedio = new Map<string, number>()
  for (const l of lineas) {
    total += l.monto
    if (l.esCc) cc += l.monto
    const med = l.medio || 'Otro'
    porMedio.set(med, (porMedio.get(med) || 0) + l.monto)
  }
  return {
    total,
    cobrado: Math.max(0, total - cc),
    cc,
    count: lineas.length,
    porMedio: [...porMedio.entries()]
      .map(([label, monto]) => ({ label, monto }))
      .sort((a, b) => b.monto - a.monto)
  }
}

export function lineasIngresoDia(
  fecha: string,
  resumen: ResumenAdminHoy,
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[],
  cajas: CajaRegistro[] = []
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
          m.origen_importacion === 'plotlab_venta' &&
          !esPaseCierreTurno(m) &&
          !esTraspasoEntreCajas(m)
      )
      .map((m) => {
        const medio = medioVisibleIngreso(m)
        const cc = montoCuentaCorriente(m)
        const cliente = (m.tercero_nombre || m.concepto.replace(/^Venta\s+/i, '')).trim()
        return {
          id: m.id,
          titulo: cliente,
          detalle: [parseRefPlotLab(m), m.usuario_nombre].filter(Boolean).join(' · '),
          monto: montoVisibleMovimiento(m),
          movimiento: m,
          medio,
          caja: etiquetaRutaCajasMovimiento(m, cajas),
          hora: m.hora || null,
          esCc: cc > 0.02 && cc >= montoVisibleMovimiento(m) - 0.02
        }
      })
      .sort((a, b) => {
        const ha = a.hora || ''
        const hb = b.hora || ''
        if (ha && hb && ha !== hb) return hb.localeCompare(ha)
        return b.monto - a.monto
      })
  }
  return []
}

export function lineasEgresoDia(
  fecha: string,
  egresos: CajaEgresoSolicitud[],
  planillas: PlanillaCajaGuardada[]
): DiaResumenLinea[] {
  const aprobados = egresos.filter((e) => e.fecha === fecha && e.estado === 'aprobado' && !!e.url_ticket)
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

export function tituloIngresoDia(resumen: ResumenAdminHoy, esHoy: boolean): string {
  if (resumen.ingresoFuente === 'cierre_turno') {
    return esHoy ? 'Administración hoy' : 'Administración del día'
  }
  return esHoy ? 'Ingreso hoy' : 'Ingreso del día'
}

export function subtituloIngresoDia(resumen: ResumenAdminHoy): string {
  switch (resumen.ingresoFuente) {
    case 'cierre_turno':
      return 'Administración: resto de cierres (contado − fondo − egresos)'
    case 'planilla':
      return 'Ingresos en planillas PDF (aún sin cierre de turno)'
    case 'plotlab':
      return 'Ingresos desde ventas PlotLab (mostrador / CRM)'
    default:
      return 'Sin ingresos registrados este día'
  }
}

/** Monto a mostrar en el hero de ingreso/admin del tablero. */
export function montoIngresoHeroDia(
  resumen: ResumenAdminHoy,
  totalCobradoMedios: number
): number {
  if (resumen.ingresoFuente === 'cierre_turno') return resumen.ingresoHoy
  if (totalCobradoMedios > 0) return totalCobradoMedios
  return resumen.ingresoHoy
}
