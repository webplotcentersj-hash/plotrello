import {
  getCierreFechaCaja,
  listCierres,
  listEgresoSolicitudes,
  listMovimientos,
  mismoCajaSlug
} from './cajaRepository'
import { calcularPaseTrazabilidad } from './paseCaja'
import { fondoFijoEfectivo } from './fondoCaja'
import type { CajaCierre, CajaEgresoSolicitud, CajaMovimiento, CajaRegistro, CajaTransferenciaLote } from './types'

export type CierreTurnoInput = {
  arqueo_efectivo: number
  arqueo_otros: number
  fondo_monto: number
  egresos_aprobados_ef: number
  egresos_aprobados_ot: number
}

export type CierreTurnoCalculado = CierreTurnoInput & {
  resto_efectivo: number
  resto_otros: number
  total_sale_origen: number
}

/** Rosa transfiere fondo a Noelia y el resto a Administración. */
export function calcularCierreTurnoMontos(input: CierreTurnoInput): CierreTurnoCalculado {
  const arqueo_efectivo = input.arqueo_efectivo || 0
  const arqueo_otros = input.arqueo_otros || 0
  const fondo = input.fondo_monto || 0
  const egrEf = input.egresos_aprobados_ef || 0
  const egrOt = input.egresos_aprobados_ot || 0

  const efectivoDisponible = Math.max(0, arqueo_efectivo - egrEf)
  const otrosDisponible = Math.max(0, arqueo_otros - egrOt)
  const resto_efectivo = Math.max(0, efectivoDisponible - fondo)
  const resto_otros = otrosDisponible

  return {
    ...input,
    arqueo_efectivo,
    arqueo_otros,
    fondo_monto: fondo,
    resto_efectivo,
    resto_otros,
    total_sale_origen: fondo + resto_efectivo + egrEf
  }
}

export function fondoMontoParaCaja(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  return fondoFijoEfectivo(caja)
}

export type ConciliacionCierreTurno = {
  ok: boolean
  alertas: string[]
  avisos: string[]
}

export function conciliarCierreTurno(input: {
  calc: CierreTurnoCalculado
  cierre?: CajaCierre | null
  arqueoTotal?: number | null
  tolerancia?: number
}): ConciliacionCierreTurno {
  const { calc, cierre, arqueoTotal, tolerancia = 0 } = input
  const alertas: string[] = []
  const avisos: string[] = []
  const fmt = (n: number) => n.toLocaleString('es-AR')

  const arqueoEsperado = calc.arqueo_efectivo + calc.arqueo_otros
  if (arqueoTotal != null && Math.abs(arqueoTotal - arqueoEsperado) > tolerancia + 1) {
    alertas.push(
      `Arqueo registrado ($${fmt(arqueoTotal)}) no coincide con montos del cierre de turno ($${fmt(arqueoEsperado)}).`
    )
  }

  const repartoEf =
    calc.fondo_monto + calc.resto_efectivo + calc.egresos_aprobados_ef
  const difEf = calc.arqueo_efectivo - repartoEf
  if (Math.abs(difEf) > tolerancia + 0.02) {
    if (difEf < 0) {
      alertas.push(
        `Efectivo insuficiente: arqueo $${fmt(calc.arqueo_efectivo)} no alcanza para fondo $${fmt(calc.fondo_monto)} + egresos $${fmt(calc.egresos_aprobados_ef)} + resto admin $${fmt(calc.resto_efectivo)}.`
      )
    } else {
      alertas.push(
        `Efectivo sin asignar: arqueo $${fmt(calc.arqueo_efectivo)} supera fondo + egresos + resto ($${fmt(repartoEf)}).`
      )
    }
  }

  if (cierre) {
    if (Math.abs((cierre.ef_contado || 0) - calc.arqueo_efectivo) > tolerancia + 1) {
      alertas.push(
        `Cierre del día: efectivo contado ($${fmt(cierre.ef_contado || 0)}) ≠ arqueo ($${fmt(calc.arqueo_efectivo)}).`
      )
    }
    if (Math.abs((cierre.egr_ef || 0) - calc.egresos_aprobados_ef) > tolerancia + 1) {
      alertas.push(
        `Cierre: egresos efectivo ($${fmt(cierre.egr_ef || 0)}) ≠ egresos aprobados ($${fmt(calc.egresos_aprobados_ef)}).`
      )
    }
  } else {
    avisos.push(
      'No hay cierre de caja cargado para esta fecha/caja; conviene registrarlo para conciliar.'
    )
  }

  return { ok: alertas.length === 0, alertas, avisos }
}

export function buildMovimientosCierreTurno(opts: {
  lote: Pick<CajaTransferenciaLote, 'id' | 'fecha' | 'hora' | 'origen_slug' | 'caja_fondo_destino_slug'>
  calc: CierreTurnoCalculado
  montosAntes: {
    origen_efectivo: number
    origen_otros: number
    fondo_dest_efectivo: number
    fondo_dest_otros: number
    admin_dest_efectivo: number
    admin_dest_otros: number
  }
  adminSlug: string
  planillaNombre?: string
  usuarioNombre: string
  usuarioId?: number
}): Array<Omit<import('./types').CajaMovimiento, 'id' | 'created_at'>> {
  const { lote, calc, montosAntes, adminSlug, planillaNombre, usuarioNombre, usuarioId } = opts
  const base = {
    fecha: lote.fecha,
    hora: lote.hora ?? null,
    id_usuario: usuarioId ?? null,
    usuario_nombre: usuarioNombre,
    origen_importacion: 'manual' as const,
    id_lote: lote.id
  }

  const movs: Array<Omit<import('./types').CajaMovimiento, 'id' | 'created_at'>> = []

  if (calc.fondo_monto > 0) {
    const paseFondo = calcularPaseTrazabilidad({
      origen_efectivo_antes: montosAntes.origen_efectivo,
      origen_otros_antes: montosAntes.origen_otros,
      destino_efectivo_antes: montosAntes.fondo_dest_efectivo,
      destino_otros_antes: montosAntes.fondo_dest_otros,
      pase_efectivo: calc.fondo_monto,
      pase_otros: 0
    })
    movs.push({
      ...base,
      concepto: 'Pase de caja',
      subtipo_pase: 'fondo',
      origen_slug: lote.origen_slug,
      destino_slug: lote.caja_fondo_destino_slug,
      efectivo: calc.fondo_monto,
      otros: 0,
      observacion: `Cierre de turno — traspaso de fondo de caja ($${calc.fondo_monto.toLocaleString('es-AR')})`,
      ...spreadTrazabilidad(paseFondo)
    })
  }

  if (calc.resto_efectivo > 0 || calc.resto_otros > 0) {
    const paseAdmin = calcularPaseTrazabilidad({
      origen_efectivo_antes: montosAntes.origen_efectivo - calc.fondo_monto,
      origen_otros_antes: montosAntes.origen_otros,
      destino_efectivo_antes: montosAntes.admin_dest_efectivo,
      destino_otros_antes: montosAntes.admin_dest_otros,
      pase_efectivo: calc.resto_efectivo,
      pase_otros: calc.resto_otros
    })
    movs.push({
      ...base,
      concepto: 'Pase de caja',
      subtipo_pase: 'resto_admin',
      origen_slug: lote.origen_slug,
      destino_slug: adminSlug,
      efectivo: calc.resto_efectivo,
      otros: calc.resto_otros,
      observacion: planillaNombre
        ? `Cierre de turno — resto a administración. Planilla: ${planillaNombre}`
        : 'Cierre de turno — resto a administración',
      ...spreadTrazabilidad(paseAdmin)
    })
  }

  return movs
}

function spreadTrazabilidad(c: ReturnType<typeof calcularPaseTrazabilidad>) {
  return {
    origen_efectivo_antes: c.origen_efectivo_antes,
    origen_otros_antes: c.origen_otros_antes,
    destino_efectivo_antes: c.destino_efectivo_antes,
    destino_otros_antes: c.destino_otros_antes,
    origen_efectivo_despues: c.origen_efectivo_despues,
    origen_otros_despues: c.origen_otros_despues,
    destino_efectivo_despues: c.destino_efectivo_despues,
    destino_otros_despues: c.destino_otros_despues
  }
}

export function totalEgresosAprobados(solicitudes: CajaEgresoSolicitud[]): {
  efectivo: number
  otros: number
} {
  // Solo egresos con ticket (movimiento ejecutado).
  const aprob = solicitudes.filter((s) => s.estado === 'aprobado' && !!s.url_ticket)
  return {
    efectivo: aprob.reduce((s, x) => s + (x.monto_efectivo || 0), 0),
    otros: aprob.reduce((s, x) => s + (x.monto_otros || 0), 0)
  }
}

export function hayEgresosPendientes(solicitudes: CajaEgresoSolicitud[]): boolean {
  return solicitudes.some(
    (s) =>
      s.estado === 'pendiente' || (s.estado === 'aprobado' && !s.url_ticket)
  )
}

export type EgresosDelDiaFuente = 'solicitudes' | 'movimientos' | 'cierre' | 'ninguno'

export type EgresosDelDiaResumen = {
  solicitudes: CajaEgresoSolicitud[]
  totales: { efectivo: number; otros: number }
  fuente: EgresosDelDiaFuente
  movimientosEgreso: CajaMovimiento[]
  cierreDia: CajaCierre | null
}

/** Totales de egresos del día: solicitudes aprobadas, o movimientos/cierre si no hay solicitudes. */
export async function egresosDelDiaParaCierreTurno(
  fecha: string,
  cajaSlug: string
): Promise<EgresosDelDiaResumen> {
  const solicitudes = await listEgresoSolicitudes({ fecha, cajaSlug })
  const fromSol = totalEgresosAprobados(solicitudes)
  const hayAprobados = solicitudes.some((s) => s.estado === 'aprobado' && !!s.url_ticket)
  if (hayAprobados) {
    return {
      solicitudes,
      totales: fromSol,
      fuente: 'solicitudes',
      movimientosEgreso: [],
      cierreDia: null
    }
  }

  const movs = await listMovimientos()
  const movimientosEgreso = movs.filter((m) => {
    if (m.fecha.slice(0, 10) !== fecha) return false
    if (!mismoCajaSlug(m.origen_slug, cajaSlug)) return false
    if (m.tipo_movimiento === 'egreso') return true
    if (/egreso/i.test(m.concepto)) return true
    if (
      mismoCajaSlug(m.destino_slug, 'admin') &&
      (m.efectivo > 0 || m.otros > 0)
    ) {
      return !/pase de caja|cierre de turno/i.test(m.concepto)
    }
    return false
  })
  const fromMov = {
    efectivo: movimientosEgreso.reduce((s, m) => s + (m.efectivo || 0), 0),
    otros: movimientosEgreso.reduce((s, m) => s + (m.otros || 0), 0)
  }
  if (fromMov.efectivo > 0 || fromMov.otros > 0) {
    return {
      solicitudes,
      totales: fromMov,
      fuente: 'movimientos',
      movimientosEgreso,
      cierreDia: null
    }
  }

  const cierres = await listCierres()
  const cierreDia = getCierreFechaCaja(cierres, fecha, cajaSlug)
  if (cierreDia && cierreDia.egr_ef > 0) {
    return {
      solicitudes,
      totales: {
        efectivo: cierreDia.egr_ef || 0,
        otros: 0
      },
      fuente: 'cierre',
      movimientosEgreso: [],
      cierreDia
    }
  }

  return {
    solicitudes,
    totales: fromSol,
    fuente: 'ninguno',
    movimientosEgreso: [],
    cierreDia: cierreDia ?? null
  }
}

/** Otra caja operativa que recibe el fondo (distinta al origen). */
export function cajaFondoDestinoPorDefecto(
  origenSlug: string,
  cajas: CajaRegistro[]
): string {
  const op = cajas.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto' && c.slug !== origenSlug)
  return op[0]?.slug ?? ''
}
