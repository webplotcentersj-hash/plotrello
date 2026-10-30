import { getArgentinaTime } from '../../utils/dateUtils'
import { calcularTotalesCoherentesDia, deduplicarMovimientos } from './cajaCoherencia'
import { esPaseCierreTurno, esTraspasoEntreCajas } from './movimientoCaja'
import { calcularTeoricoFisicoCaja } from './arqueoCalculations'
import { fondoFijoEfectivo, requiereFondoMinimo } from './fondoCaja'
import {
  movimientoPlotlabPerteneceCaja,
  resumenPlotlabVentasCaja,
  type ResumenPlotlabVentasCaja
} from './plotlabVentasCajaData'
import { montoVisibleMovimiento } from './format'
import type { CajaArqueo, CajaMovimiento, CajaRegistro, CajaTransferenciaLote } from './types'

export type ProgresoDiaPaso = {
  id: string
  label: string
  hecho: boolean
}

export type ResumenCajeroAdminDia = {
  slug: string
  nombre: string
  ventasPlotlab: number
  cobrosPlotlab: number
  ingresosTotal: number
  arqueoHecho: boolean
  cierreHecho: boolean
  diferenciaArqueo: number | null
}

/** Turno sugerido: arqueo del día, o heurística por hora Argentina. */
export function inferirTurnoActivo(
  fecha: string,
  cajaSlug: string | null,
  arqueos: CajaArqueo[]
): string {
  if (cajaSlug) {
    const arqueoHoy = arqueos.find((a) => a.fecha === fecha && a.caja_slug === cajaSlug)
    if (arqueoHoy?.turno) return arqueoHoy.turno
  }
  const { hours } = getArgentinaTime()
  if (hours < 14) return 'Mañana'
  if (hours < 20) return 'Tarde'
  return 'Único'
}

export function ultimosMovimientosDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  cajaSlug: string,
  limite = 8
): CajaMovimiento[] {
  return movimientos
    .filter(
      (m) =>
        !m.anulado &&
        m.fecha === fecha &&
        (m.destino_slug === cajaSlug || m.origen_slug === cajaSlug)
    )
    .sort((a, b) => {
      const ta = a.created_at || `${a.fecha}T${a.hora || '00:00'}`
      const tb = b.created_at || `${b.fecha}T${b.hora || '00:00'}`
      return tb.localeCompare(ta)
    })
    .slice(0, limite)
}

export function progresoDiaCaja(input: {
  resumenPlotlabCount: number
  ingresosDia: number
  arqueoHecho: boolean
  cierreTurnoHecho: boolean
}): ProgresoDiaPaso[] {
  const ventasEnCaja = input.resumenPlotlabCount > 0 || input.ingresosDia > 0
  return [
    { id: 'ventas', label: 'Ventas realizadas', hecho: ventasEnCaja },
    { id: 'arqueo', label: 'Arqueo', hecho: input.arqueoHecho },
    { id: 'cierre', label: 'Cierre de turno', hecho: input.cierreTurnoHecho }
  ]
}

export function efectivoTeoricoDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'> | null,
  resumenPlotlab?: ResumenPlotlabVentasCaja | null
): number | null {
  if (!caja) return null
  const fondo = fondoFijoEfectivo(caja)
  const t = calcularTeoricoFisicoCaja(movimientos, caja.slug, fecha, fecha, fondo)
  const ingresosFisicos = Math.max(t.ingresos_fisicos, resumenPlotlab?.efectivo ?? 0)
  // Sin sumar fondo: el fondo sale del contado (de lo vendido).
  return ingresosFisicos - t.egresos_fisicos + t.traspasos_fisicos
}

/** Efectivo a contar según Plot Lab: cobros en efectivo − egresos (el fondo no se suma). */
export function efectivoObjetivoArqueoPlotLab(
  movimientos: CajaMovimiento[],
  fecha: string,
  caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'> | null,
  resumenPlotlab: ResumenPlotlabVentasCaja | null
): number | null {
  if (!caja || !resumenPlotlab || resumenPlotlab.efectivo <= 0) return null
  return efectivoTeoricoDia(movimientos, fecha, caja, resumenPlotlab)
}

export function etiquetaMedioMovimiento(m: CajaMovimiento): string {
  if ((m.efectivo ?? 0) > 0) return 'Efectivo'
  if ((m.tarjeta ?? 0) > 0) {
    const txt = `${m.observacion || ''} ${m.concepto || ''}`.toLowerCase()
    const med = m.medios as { mercado_pago?: number } | null | undefined
    if ((med && Number(med.mercado_pago) > 0) || /mercado\s*pago/.test(txt)) return 'MP'
    return 'Tarjeta'
  }
  if ((m.transferencia_bancaria ?? 0) > 0) return 'Transfer.'
  if ((m.cuenta_corriente ?? 0) > 0) return 'Cta. cte.'
  if ((m.cheque_tercero ?? 0) > 0 || (m.cheque_propio ?? 0) > 0) return 'Cheque'
  return m.tipo_movimiento === 'egreso' ? 'Egreso' : 'Otro'
}

export function horaMovimiento(m: CajaMovimiento): string {
  if (m.hora) return m.hora.slice(0, 5)
  if (m.created_at) {
    try {
      return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      }).format(new Date(m.created_at))
    } catch {
      return '—'
    }
  }
  return '—'
}

export function resumenPorCajeroAdminDia(
  fecha: string,
  cajas: CajaRegistro[],
  movimientos: CajaMovimiento[],
  arqueos: CajaArqueo[],
  lotes: CajaTransferenciaLote[]
): ResumenCajeroAdminDia[] {
  return cajas
    .filter((c) => c.activa && (c.slug === 'admin' || requiereFondoMinimo(c.slug)))
    .map((c) => {
      const plot = resumenPlotlabVentasCaja(movimientos, fecha, c.slug, c.id_usuario)
      const totales = calcularTotalesCoherentesDia(movimientos, fecha, c.slug)
      const arq = arqueos.find((a) => a.fecha === fecha && a.caja_slug === c.slug)
      const cierre = lotes.some((l) => l.fecha === fecha && l.origen_slug === c.slug)
      return {
        slug: c.slug,
        nombre: c.nombre,
        ventasPlotlab: plot.total,
        cobrosPlotlab: plot.count,
        ingresosTotal: totales.ingresos,
        arqueoHecho: !!arq,
        cierreHecho: cierre,
        diferenciaArqueo: arq?.diferencia ?? null
      }
    })
    .filter(
      (r) =>
        r.ventasPlotlab > 0 ||
        r.ingresosTotal > 0 ||
        r.arqueoHecho ||
        r.cierreHecho ||
        r.cobrosPlotlab > 0
    )
    .sort((a, b) => b.ventasPlotlab - a.ventasPlotlab || a.nombre.localeCompare(b.nombre, 'es'))
}

export type ConteoCajaResumen = {
  slug: string
  nombre: string
  ventasCount: number
  ventasTotal: number
  egresosCount: number
  egresosTotal: number
  arqueosCount: number
  cierresTurnoCount: number
  cierresFormalesCount: number
}

function matchFecha(fechaRegistro: string, fechaFiltro?: string | null): boolean {
  if (!fechaFiltro) return true
  return fechaRegistro === fechaFiltro
}

/** Conteos por caja operativa (hoy o histórico si no pasás fecha). */
export function conteosPorCajaOperativa(input: {
  cajas: CajaRegistro[]
  movimientos: CajaMovimiento[]
  arqueos: CajaArqueo[]
  egresos: Array<{ fecha: string; caja_slug: string; monto_efectivo: number; monto_otros: number; estado?: string }>
  lotes: CajaTransferenciaLote[]
  cierres: Array<{ fecha: string; caja_slug: string }>
  /** Si se omite, cuenta todo el historial. */
  fecha?: string | null
}): ConteoCajaResumen[] {
  const { cajas, movimientos, arqueos, egresos, lotes, cierres, fecha = null } = input

  return cajas
    .filter((c) => c.activa && (c.slug === 'admin' || requiereFondoMinimo(c.slug)))
    .map((c) => {
      let ventasCount = 0
      let ventasTotal = 0
      for (const m of movimientos) {
        if (m.anulado || m.origen_importacion !== 'plotlab_venta') continue
        if (m.tipo_movimiento !== 'ingreso') continue
        if (!movimientoPlotlabPerteneceCaja(m, c.slug, c.id_usuario)) continue
        if (!matchFecha(m.fecha, fecha)) continue
        ventasCount += 1
        ventasTotal += m.monto_total || 0
      }

      let egresosCount = 0
      let egresosTotal = 0
      for (const e of egresos) {
        if (e.caja_slug !== c.slug) continue
        if (!matchFecha(e.fecha, fecha)) continue
        if (e.estado === 'rechazado') continue
        egresosCount += 1
        egresosTotal += (e.monto_efectivo || 0) + (e.monto_otros || 0)
      }

      const arqueosCount = arqueos.filter(
        (a) => a.caja_slug === c.slug && matchFecha(a.fecha, fecha)
      ).length
      const cierresTurnoCount = lotes.filter(
        (l) => l.origen_slug === c.slug && matchFecha(l.fecha, fecha)
      ).length
      const cierresFormalesCount = cierres.filter(
        (x) => x.caja_slug === c.slug && matchFecha(x.fecha, fecha)
      ).length

      return {
        slug: c.slug,
        nombre: c.nombre,
        ventasCount,
        ventasTotal,
        egresosCount,
        egresosTotal,
        arqueosCount,
        cierresTurnoCount,
        cierresFormalesCount
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export type ConteoMovimientosCaja = {
  total: number
  ingresos: number
  ingresosMonto: number
  egresos: number
  egresosMonto: number
  traspasos: number
  ajustes: number
  otros: number
}

export const CONTEO_MOVIMIENTOS_VACIO: ConteoMovimientosCaja = {
  total: 0,
  ingresos: 0,
  ingresosMonto: 0,
  egresos: 0,
  egresosMonto: 0,
  traspasos: 0,
  ajustes: 0,
  otros: 0
}

/** Cuenta todos los movimientos de la caja. Sin fecha, incluye el histórico. */
export function contarMovimientosCaja(
  movimientos: CajaMovimiento[],
  cajaSlug: string,
  fecha?: string | null
): ConteoMovimientosCaja {
  if (!cajaSlug) return { ...CONTEO_MOVIMIENTOS_VACIO }
  const delCaja = movimientos.filter((m) => {
    if (m.anulado) return false
    if (fecha && m.fecha !== fecha) return false
    return m.destino_slug === cajaSlug || m.origen_slug === cajaSlug
  })
  const unicos = deduplicarMovimientos(delCaja)
  const conteo = { ...CONTEO_MOVIMIENTOS_VACIO, total: unicos.length }

  for (const m of unicos) {
    const monto = m.monto_total ?? (m.efectivo || 0) + (m.otros || 0)
    if (esPaseCierreTurno(m) || esTraspasoEntreCajas(m)) {
      conteo.traspasos += 1
      continue
    }
    if (m.tipo_movimiento === 'ajuste') {
      conteo.ajustes += 1
      continue
    }
    const tipo = m.tipo_movimiento ?? (m.destino_slug === cajaSlug ? 'ingreso' : 'egreso')
    if (tipo === 'ingreso' && m.destino_slug === cajaSlug) {
      conteo.ingresos += 1
      conteo.ingresosMonto += monto
    } else if (tipo === 'egreso' && m.origen_slug === cajaSlug) {
      conteo.egresos += 1
      conteo.egresosMonto += monto
    } else {
      conteo.otros += 1
    }
  }

  return conteo
}

export function montoMovimientoLista(m: CajaMovimiento): number {
  return montoVisibleMovimiento(m)
}

/** Plata que sale de la caja (egreso / traspaso salida). Se muestra con −. */
export function esSalidaDeCaja(
  m: Pick<CajaMovimiento, 'tipo_movimiento' | 'origen_slug' | 'destino_slug'>,
  cajaSlug: string
): boolean {
  if (!cajaSlug) return m.tipo_movimiento === 'egreso'
  if (m.tipo_movimiento === 'egreso') return true
  if (m.tipo_movimiento === 'ingreso') return false
  if (m.tipo_movimiento === 'traspaso') return m.origen_slug === cajaSlug
  return m.origen_slug === cajaSlug && m.destino_slug !== cajaSlug
}
