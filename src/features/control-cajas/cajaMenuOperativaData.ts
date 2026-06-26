import { getArgentinaTime } from '../../utils/dateUtils'
import { calcularTotalesCoherentesDia } from './cajaCoherencia'
import { calcularTeoricoFisicoCaja } from './arqueoCalculations'
import { fondoFijoEfectivo, requiereFondoMinimo } from './fondoCaja'
import { resumenPlotlabVentasCaja } from './plotlabVentasCajaData'
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
    { id: 'ventas', label: 'Ventas en caja', hecho: ventasEnCaja },
    { id: 'arqueo', label: 'Arqueo', hecho: input.arqueoHecho },
    { id: 'cierre', label: 'Cierre de turno', hecho: input.cierreTurnoHecho }
  ]
}

export function efectivoTeoricoDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'> | null
): number | null {
  if (!caja) return null
  const t = calcularTeoricoFisicoCaja(
    movimientos,
    caja.slug,
    fecha,
    fecha,
    fondoFijoEfectivo(caja)
  )
  return t.teorico
}

export function etiquetaMedioMovimiento(m: CajaMovimiento): string {
  if ((m.efectivo ?? 0) > 0) return 'Efectivo'
  if ((m.tarjeta ?? 0) > 0) return 'Tarjeta'
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
    .filter((c) => c.activa && requiereFondoMinimo(c.slug))
    .map((c) => {
      const plot = resumenPlotlabVentasCaja(movimientos, fecha, c.slug)
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

export function montoMovimientoLista(m: CajaMovimiento): number {
  return montoVisibleMovimiento(m)
}
