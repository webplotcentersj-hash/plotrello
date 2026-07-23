import { getArgentinaDateString } from '../../utils/dateUtils'
import { cierresEnFecha } from './cajaRepository'
import { FONDO_CAJA_RECOMENDADO, fondoFijoEfectivo, requiereFondoMinimo } from './fondoCaja'
import type { CajaRegistro } from './types'
import type {
  CajaArqueo,
  CajaCierre,
  CajaConcilBanco,
  CajaConcilMP,
  CajaDiferencia,
  CajaEgresoSolicitud,
  CajaMovimiento,
  CajaTransferenciaLote,
  PlanillaCajaGuardada
} from './types'

export type VentasDiaCanal = {
  ef: number
  tj: number
  mp: number
  tr: number
  cc: number
  tot: number
  planillas: number
  cierres: number
  plotlab: number
}

export type SistemaDiaFuente = 'cierres' | 'planillas' | 'movimientos' | 'plotlab' | 'ninguno'

export function mesArgentina(): string {
  return getArgentinaDateString().slice(0, 7)
}

export function planillaEnFecha(p: PlanillaCajaGuardada, fecha: string): boolean {
  const d = p.fecha_desde || p.fecha_hasta
  const h = p.fecha_hasta || p.fecha_desde
  if (!d && !h) return false
  if (d && h) return fecha >= d && fecha <= h
  return d === fecha || h === fecha
}

/** Fechas cubiertas por una planilla (rango inclusive). */
export function fechasEnRangoPlanilla(p: Pick<PlanillaCajaGuardada, 'fecha_desde' | 'fecha_hasta'>): string[] {
  const d = (p.fecha_desde || p.fecha_hasta || '').slice(0, 10)
  const h = (p.fecha_hasta || p.fecha_desde || d).slice(0, 10)
  if (!d) return []
  if (d === h) return [d]
  const out: string[] = []
  const cur = new Date(`${d}T12:00:00`)
  const end = new Date(`${h}T12:00:00`)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function totalesEgresosPlanilla(p: PlanillaCajaGuardada): number {
  const t = p.totales ?? {}
  return Number(t.egresos_total) || 0
}

export function totalesIngresosPlanilla(p: PlanillaCajaGuardada): number {
  const t = p.totales ?? {}
  return Number(t.ingresos_total) || 0
}

function totalesPlanilla(p: PlanillaCajaGuardada) {
  const t = p.totales ?? {}
  return {
    ef: Number(t.ingresos_efectivo) || 0,
    tj: Number(t.ingresos_tarjetas) || 0,
    tr: Number(t.ingresos_trans_b) || 0,
    cc: Number(t.ingresos_cta_cte) || 0,
    tot: Number(t.ingresos_total) || 0
  }
}

function movimientosPlotLabDelDia(
  movimientos: CajaMovimiento[],
  fecha: string,
  pick: (m: CajaMovimiento) => number
): number {
  return movimientos
    .filter(
      (m) =>
        m.fecha === fecha &&
        !m.anulado &&
        m.origen_importacion === 'plotlab_venta' &&
        m.tipo_movimiento === 'ingreso'
    )
    .reduce((s, m) => s + pick(m), 0)
}

export function sistemaMpParaFecha(
  fecha: string,
  cierres: CajaCierre[],
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): { valor: number; fuente: SistemaDiaFuente } {
  const delCierre = cierresEnFecha(cierres, fecha).reduce(
    (s, c) => s + (c.tarj_sist || 0) + (c.mp_qr || 0),
    0
  )
  if (delCierre > 0) return { valor: delCierre, fuente: 'cierres' }

  const delPlanilla = planillas
    .filter((p) => planillaEnFecha(p, fecha))
    .reduce((s, p) => s + totalesPlanilla(p).tj, 0)
  if (delPlanilla > 0) return { valor: delPlanilla, fuente: 'planillas' }

  const delMov = movimientos
    .filter((m) => m.fecha === fecha && !m.anulado && m.tipo_movimiento === 'ingreso')
    .reduce((s, m) => s + (m.tarjeta ?? 0), 0)
  if (delMov > 0) {
    const delPlotlab = movimientosPlotLabDelDia(movimientos, fecha, (m) => m.tarjeta ?? 0)
    const fuente =
      delPlotlab > 0 && Math.abs(delPlotlab - delMov) <= 0.02 ? 'plotlab' : 'movimientos'
    return { valor: delMov, fuente }
  }

  return { valor: 0, fuente: 'ninguno' }
}

export function sistemaBancoParaFecha(
  fecha: string,
  cierres: CajaCierre[],
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[]
): { valor: number; fuente: SistemaDiaFuente } {
  const delCierre = cierresEnFecha(cierres, fecha).reduce((s, c) => s + (c.trans || 0), 0)
  if (delCierre > 0) return { valor: delCierre, fuente: 'cierres' }

  const delPlanilla = planillas
    .filter((p) => planillaEnFecha(p, fecha))
    .reduce((s, p) => s + totalesPlanilla(p).tr, 0)
  if (delPlanilla > 0) return { valor: delPlanilla, fuente: 'planillas' }

  const delMov = movimientos
    .filter((m) => m.fecha === fecha && !m.anulado && m.tipo_movimiento === 'ingreso')
    .reduce((s, m) => s + (m.transferencia_bancaria ?? 0), 0)
  if (delMov > 0) {
    const delPlotlab = movimientosPlotLabDelDia(
      movimientos,
      fecha,
      (m) => m.transferencia_bancaria ?? 0
    )
    const fuente =
      delPlotlab > 0 && Math.abs(delPlotlab - delMov) <= 0.02 ? 'plotlab' : 'movimientos'
    return { valor: delMov, fuente }
  }

  return { valor: 0, fuente: 'ninguno' }
}

function ingresosPlotLabDelDia(movimientos: CajaMovimiento[], fecha: string): VentasDiaCanal {
  const row: VentasDiaCanal = {
    ef: 0,
    tj: 0,
    mp: 0,
    tr: 0,
    cc: 0,
    tot: 0,
    planillas: 0,
    cierres: 0,
    plotlab: 0
  }
  for (const mov of movimientos) {
    if (mov.fecha !== fecha || mov.anulado || mov.tipo_movimiento !== 'ingreso') continue
    if (mov.origen_importacion !== 'plotlab_venta') continue
    row.ef += mov.efectivo || 0
    row.tj += mov.tarjeta || 0
    row.mp += mov.tarjeta || 0
    row.tr += mov.transferencia_bancaria || 0
    row.cc += mov.cuenta_corriente || 0
    row.tot += mov.monto_total || 0
    row.plotlab += 1
  }
  return row
}

export function totalesIngresosPlotLab(
  movimientos: CajaMovimiento[],
  fecha: string
): number {
  return ingresosPlotLabDelDia(movimientos, fecha).tot
}

/** Ventas por día: planillas (principal) + PlotLab en vivo + cierres en días sin planilla. */
export function ventasDiariasAgregadas(
  cierres: CajaCierre[],
  planillas: PlanillaCajaGuardada[],
  movimientos: CajaMovimiento[] = []
): Record<string, VentasDiaCanal> {
  const m: Record<string, VentasDiaCanal> = {}

  const ensure = (fecha: string): VentasDiaCanal => {
    if (!m[fecha]) {
      m[fecha] = { ef: 0, tj: 0, mp: 0, tr: 0, cc: 0, tot: 0, planillas: 0, cierres: 0, plotlab: 0 }
    }
    return m[fecha]
  }

  for (const p of planillas) {
    const fecha = p.fecha_hasta || p.fecha_desde
    if (!fecha) continue
    const t = totalesPlanilla(p)
    const row = ensure(fecha)
    row.ef += t.ef
    row.tj += t.tj
    row.mp += t.tj
    row.tr += t.tr
    row.cc += t.cc
    row.tot += t.tot
    row.planillas += 1
  }

  const fechasPlotLab = new Set<string>()
  for (const mov of movimientos) {
    if (
      mov.origen_importacion === 'plotlab_venta' &&
      mov.tipo_movimiento === 'ingreso' &&
      !mov.anulado &&
      mov.fecha
    ) {
      fechasPlotLab.add(mov.fecha)
    }
  }

  for (const fecha of fechasPlotLab) {
    const row = ensure(fecha)
    if (row.planillas > 0) continue
    const pl = ingresosPlotLabDelDia(movimientos, fecha)
    if (pl.plotlab <= 0) continue
    row.ef += pl.ef
    row.tj += pl.tj
    row.mp += pl.mp
    row.tr += pl.tr
    row.cc += pl.cc
    row.tot += pl.tot
    row.plotlab += pl.plotlab
  }

  for (const c of cierres) {
    const row = ensure(c.fecha)
    if (row.planillas > 0 || row.plotlab > 0) continue
    row.ef += c.ing_ef
    row.tj += c.tarj_sist
    row.mp += c.mp_qr
    row.tr += c.trans
    row.cc += c.cta_cte
    row.tot += c.total_ventas || c.ing_ef + c.tarj_sist + c.mp_qr + c.trans + c.cta_cte
    row.cierres += 1
  }

  return m
}

export type KpisTablero = {
  mes: string
  cierresMes: number
  planillasMes: number
  ok: number
  revisar: number
  difNeta: number
  ventasMes: number
  tieneCierres: boolean
  tienePlanillas: boolean
}

export function kpisTableroMes(
  mes: string,
  cierres: CajaCierre[],
  planillas: PlanillaCajaGuardada[],
  arqueos: CajaArqueo[],
  concilMp: CajaConcilMP[],
  concilBanco: CajaConcilBanco[]
): KpisTablero {
  const mc = cierres.filter((c) => c.fecha.startsWith(mes))
  const pm = planillas.filter((p) => {
    const f = p.fecha_hasta || p.fecha_desde
    return f?.startsWith(mes)
  })

  const ventasPlanilla = pm.reduce((s, p) => s + (Number(p.totales?.ingresos_total) || 0), 0)
  const ventasCierres = mc.reduce((s, c) => s + (c.total_ventas || 0), 0)
  const ventasMes = ventasPlanilla > 0 ? ventasPlanilla : ventasCierres

  const difCierres = mc.reduce((s, c) => s + (c.dif_total || 0), 0)
  const difArqueos = arqueos
    .filter((a) => a.fecha.startsWith(mes) && a.diferencia && Math.abs(a.diferencia) > 0.01)
    .reduce((s, a) => s + (a.diferencia || 0), 0)
  const ok =
    mc.filter((c) => c.estado === 'OK').length +
    concilMp.filter((c) => c.fecha.startsWith(mes) && c.estado === 'OK').length +
    concilBanco.filter((c) => c.fecha.startsWith(mes) && c.estado === 'OK').length

  const revisar =
    mc.filter((c) => c.estado === 'REVISAR').length +
    concilMp.filter((c) => c.fecha.startsWith(mes) && c.estado === 'REVISAR').length +
    concilBanco.filter((c) => c.fecha.startsWith(mes) && c.estado === 'REVISAR').length +
    arqueos.filter(
      (a) =>
        a.fecha.startsWith(mes) &&
        (a.estado_arqueo === 'sobrante' || a.estado_arqueo === 'faltante')
    ).length

  return {
    mes,
    cierresMes: mc.length,
    planillasMes: pm.length,
    ok,
    revisar,
    difNeta: difCierres + difArqueos,
    ventasMes,
    tieneCierres: mc.length > 0,
    tienePlanillas: pm.length > 0
  }
}

export function recolectarDiferencias(
  cierres: CajaCierre[],
  manual: CajaDiferencia[],
  arqueos: CajaArqueo[],
  concilMp: CajaConcilMP[],
  concilBanco: CajaConcilBanco[],
  movimientos: CajaMovimiento[],
  tolerancia: number
): CajaDiferencia[] {
  const out: CajaDiferencia[] = []
  const seen = new Set<string>()

  const push = (d: CajaDiferencia) => {
    const key = `${d.fecha}|${d.caja_slug}|${d.tipo}|${d.monto}|${d.motivo}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(d)
  }

  for (const c of cierres.filter((x) => x.estado === 'REVISAR' || Math.abs(x.dif_total || 0) > tolerancia)) {
    push({
      id: `auto_cierre_${c.id}`,
      fecha: c.fecha,
      caja_slug: c.caja_slug,
      tipo: (c.dif_total ?? 0) >= 0 ? 'Sobrante' : 'Faltante',
      monto: Math.abs(c.dif_total ?? 0),
      motivo: 'Cierre con diferencia',
      responsable: c.cajera,
      estado: 'Pendiente',
      id_cierre: c.id,
      auto_desde_cierre: true
    })
  }

  for (const a of arqueos) {
    const dif = a.diferencia ?? 0
    if (Math.abs(dif) <= tolerancia && a.estado_arqueo !== 'sobrante' && a.estado_arqueo !== 'faltante') {
      continue
    }
    const monto = Math.abs(dif) || Math.abs((a.total || 0) - (a.teorico_fisico || 0))
    if (monto <= tolerancia) continue
    push({
      id: `auto_arqueo_${a.id}`,
      fecha: a.fecha,
      caja_slug: a.caja_slug,
      tipo: dif >= 0 || a.estado_arqueo === 'sobrante' ? 'Sobrante' : 'Faltante',
      monto,
      motivo: `Arqueo ${a.estado_arqueo ?? 'con diferencia'}`,
      responsable: a.usuario_nombre,
      estado: 'Pendiente',
      auto_desde_cierre: true
    })
  }

  for (const r of concilMp.filter((c) => c.estado === 'REVISAR')) {
    push({
      id: `auto_mp_${r.id}`,
      fecha: r.fecha,
      tipo: (r.diferencia ?? 0) >= 0 ? 'Sobrante' : 'Faltante',
      monto: Math.abs(r.diferencia ?? 0),
      motivo: 'Conciliación Mercado Pago',
      responsable: null,
      estado: 'Pendiente',
      auto_desde_cierre: true
    })
  }

  for (const r of concilBanco.filter((c) => c.estado === 'REVISAR')) {
    push({
      id: `auto_banco_${r.id}`,
      fecha: r.fecha,
      tipo: (r.diferencia ?? 0) >= 0 ? 'Sobrante' : 'Faltante',
      monto: Math.abs(r.diferencia ?? 0),
      motivo: 'Conciliación bancaria',
      responsable: null,
      estado: 'Pendiente',
      auto_desde_cierre: true
    })
  }

  for (const m of movimientos.filter((x) => !x.anulado).slice(0, 200)) {
    const v = validarCuadreMovimiento(m)
    if (!v) continue
    push({
      id: `auto_mov_${m.id}`,
      fecha: m.fecha,
      caja_slug: m.destino_slug,
      tipo: 'Faltante',
      monto: v,
      motivo: 'Movimiento: total ≠ medios de pago',
      responsable: m.usuario_nombre,
      estado: 'Pendiente',
      auto_desde_cierre: true
    })
  }

  for (const d of manual.filter((x) => x.estado === 'Pendiente')) {
    push({ ...d, auto_desde_cierre: false })
  }

  return out.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

function validarCuadreMovimiento(m: CajaMovimiento): number | null {
  const total = m.monto_total ?? 0
  if (total <= 0) return null
  const breakdown =
    (m.tarjeta ?? 0) +
    (m.cuenta_corriente ?? 0) +
    (m.transferencia_bancaria ?? 0) +
    (m.cheque_propio ?? 0) +
    (m.cheque_tercero ?? 0) +
    (m.documento ?? 0) +
    (m.cuenta_contable ?? 0)
  const med = m.medios as { otros?: number } | null | undefined
  const otrosResidual =
    med && typeof med.otros === 'number'
      ? Number(med.otros) || 0
      : breakdown > 0.02
        ? Math.abs((m.otros ?? 0) - breakdown) <= 0.02
          ? 0
          : Math.max(0, (m.otros ?? 0) - breakdown)
        : m.otros ?? 0
  const suma = (m.efectivo ?? 0) + breakdown + otrosResidual
  const delta = Math.abs(total - suma)
  return delta > 0.02 ? delta : null
}

export type ResumenAdminHoy = {
  fecha: string
  ingresoHoy: number
  ingresoFuente: 'cierre_turno' | 'planilla' | 'plotlab' | 'ninguno'
  egresosHoy: number
  egresosPendientes: number
  fondoFijo: number
  fondoRecomendado: number
  fondosOperativas: { slug: string; nombre: string; monto: number }[]
  cierresTurnoHoy: CajaTransferenciaLote[]
}

/** Ingreso hoy = resto que pasó a administración; egresos = aprobados del día (todas las cajas). */
export function resumenAdminHoy(
  fecha: string,
  lotes: CajaTransferenciaLote[],
  planillas: PlanillaCajaGuardada[],
  egresos: CajaEgresoSolicitud[],
  cajas: CajaRegistro[] = [],
  movimientos: CajaMovimiento[] = []
): ResumenAdminHoy {
  const cierresTurnoHoy = lotes.filter((l) => l.fecha === fecha)
  const ingresoLotes = cierresTurnoHoy.reduce(
    (s, l) => s + (l.resto_efectivo || 0) + (l.resto_otros || 0),
    0
  )

  let ingresoPlanilla = 0
  if (ingresoLotes <= 0) {
    for (const p of planillas) {
      if (planillaEnFecha(p, fecha)) {
        ingresoPlanilla += totalesIngresosPlanilla(p)
      }
    }
  }

  let ingresoPlotLab = 0
  if (ingresoLotes <= 0 && ingresoPlanilla <= 0) {
    ingresoPlotLab = totalesIngresosPlotLab(movimientos, fecha)
  }

  const ingresoHoy =
    ingresoLotes > 0 ? ingresoLotes : ingresoPlanilla > 0 ? ingresoPlanilla : ingresoPlotLab
  const ingresoFuente: ResumenAdminHoy['ingresoFuente'] =
    ingresoLotes > 0
      ? 'cierre_turno'
      : ingresoPlanilla > 0
        ? 'planilla'
        : ingresoPlotLab > 0
          ? 'plotlab'
          : 'ninguno'

  const delDia = egresos.filter((e) => e.fecha === fecha)
  const aprobados = delDia.filter((e) => e.estado === 'aprobado' && !!e.url_ticket)
  let egresosHoy = aprobados.reduce(
    (s, e) => s + (e.monto_efectivo || 0) + (e.monto_otros || 0),
    0
  )
  if (egresosHoy <= 0) {
    for (const p of planillas) {
      if (planillaEnFecha(p, fecha)) {
        egresosHoy += totalesEgresosPlanilla(p)
      }
    }
  }
  const egresosPendientes = delDia.filter(
    (e) => e.estado === 'pendiente' || (e.estado === 'aprobado' && !e.url_ticket)
  ).length

  // Solo listar fondos que el operador/admin configuró (> 0). Nunca inventar $100.000.
  const fondosOperativas = cajas
    .filter((c) => c.activa && requiereFondoMinimo(c.slug) && fondoFijoEfectivo(c) > 0)
    .map((c) => ({ slug: c.slug, nombre: c.nombre, monto: fondoFijoEfectivo(c) }))

  return {
    fecha,
    ingresoHoy,
    ingresoFuente,
    egresosHoy,
    egresosPendientes,
    fondoFijo: fondosOperativas[0]?.monto ?? 0,
    fondoRecomendado: FONDO_CAJA_RECOMENDADO,
    fondosOperativas,
    cierresTurnoHoy
  }
}

export function labelFuenteSistema(fuente: SistemaDiaFuente): string {
  switch (fuente) {
    case 'cierres':
      return 'cierres del día'
    case 'planillas':
      return 'planillas PDF importadas'
    case 'plotlab':
      return 'ventas PlotLab en vivo'
    case 'movimientos':
      return 'movimientos volcados'
    default:
      return 'sin datos — cargá planilla o cierre'
  }
}
