import { lunesDeSemana, inicioMes } from './ingresosAcumulados'
import {
  addDaysIso,
  fechaVentaIso,
  montoVentaCobrada,
  normalizeProducto
} from './proyeccionVentas'
import type { Venta } from '../../types/api'

export type InformePeriodoModo = 'semana' | 'mes'

export type InformeFilaNombre = {
  nombre: string
  monto: number
  cantidad: number
  pct: number
}

export type InformeDiaFila = {
  fecha: string
  cobrado: number
  valorTotal: number
  ventas: number
  pagadas: number
  parciales: number
  pendientes: number
  canceladas: number
  ticketPromedio: number
}

export type InformeVentaLinea = {
  id: number
  numero: string
  fecha: string
  cliente: string
  vendedor: string
  metodo: string
  estado: string
  cobrado: number
  valorTotal: number
  caja: string
}

export type InformeVentasPeriodo = {
  modo: InformePeriodoModo
  desde: string
  hasta: string
  labelPeriodo: string
  /** Periodo anterior de igual duración (comparación). */
  prevDesde: string
  prevHasta: string
  labelPrev: string
  kpis: {
    cobrado: number
    valorTotal: number
    ventasCobradas: number
    ventasTotales: number
    ticketPromedio: number
    parciales: number
    pendientes: number
    canceladas: number
    pctVsPrev: number | null
    cobradoPrev: number
  }
  porDia: InformeDiaFila[]
  porMetodo: InformeFilaNombre[]
  porVendedor: InformeFilaNombre[]
  porCaja: InformeFilaNombre[]
  porEstado: InformeFilaNombre[]
  topProductos: InformeFilaNombre[]
  topClientes: InformeFilaNombre[]
  topVentas: InformeVentaLinea[]
  mejorDia: InformeDiaFila | null
  peorDia: InformeDiaFila | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function finMes(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number)
  if (!y || !m) return fecha
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

function domingoDeSemana(lunes: string): string {
  return addDaysIso(lunes, 6)
}

function labelMesLargo(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const d = new Date(Date.UTC(y, m - 1, 1))
  const mes = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(d)
  const cap = mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : mes
  return `${cap} ${y}`
}

function labelRango(desde: string, hasta: string): string {
  const a = desde.split('-').reverse().join('/')
  const b = hasta.split('-').reverse().join('/')
  return a === b ? a : `${a} – ${b}`
}

export function rangoInformeVentas(
  modo: InformePeriodoModo,
  ancla: string,
  hoy: string
): { desde: string; hasta: string; labelPeriodo: string; prevDesde: string; prevHasta: string; labelPrev: string } {
  if (modo === 'semana') {
    const desde = lunesDeSemana(ancla)
    const hastaIdeal = domingoDeSemana(desde)
    const hasta = hastaIdeal > hoy ? hoy : hastaIdeal
    const prevHasta = addDaysIso(desde, -1)
    const prevDesde = lunesDeSemana(prevHasta)
    return {
      desde,
      hasta,
      labelPeriodo: `Semana ${labelRango(desde, hastaIdeal)}`,
      prevDesde,
      prevHasta,
      labelPrev: `Semana anterior ${labelRango(prevDesde, prevHasta)}`
    }
  }
  const ym = ancla.slice(0, 7)
  const desde = inicioMes(ancla)
  const hastaIdeal = finMes(ancla)
  const hasta = hastaIdeal > hoy ? hoy : hastaIdeal
  const prevMesAncla = addDaysIso(desde, -1)
  const prevDesde = inicioMes(prevMesAncla)
  const prevHasta = finMes(prevMesAncla)
  return {
    desde,
    hasta,
    labelPeriodo: labelMesLargo(ym),
    prevDesde,
    prevHasta,
    labelPrev: labelMesLargo(prevMesAncla.slice(0, 7))
  }
}

function bump(map: Map<string, { monto: number; cantidad: number }>, key: string, monto: number) {
  const k = key.trim() || 'Sin dato'
  const cur = map.get(k) || { monto: 0, cantidad: 0 }
  cur.monto += monto
  cur.cantidad += 1
  map.set(k, cur)
}

function bumpProducto(
  map: Map<string, { monto: number; cantidad: number }>,
  nombre: string,
  monto: number,
  qty: number
) {
  const k = normalizeProducto(nombre)
  const cur = map.get(k) || { monto: 0, cantidad: 0 }
  cur.monto += monto
  cur.cantidad += qty
  map.set(k, cur)
}

function toFilas(map: Map<string, { monto: number; cantidad: number }>, total: number): InformeFilaNombre[] {
  return [...map.entries()]
    .map(([nombre, v]) => ({
      nombre,
      monto: round2(v.monto),
      cantidad: v.cantidad,
      pct: total > 0 ? round2((v.monto / total) * 100) : 0
    }))
    .sort((a, b) => b.monto - a.monto || b.cantidad - a.cantidad)
}

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let cur = desde
  while (cur <= hasta) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return out
}

type DiaAcc = {
  cobrado: number
  valorTotal: number
  ventas: number
  pagadas: number
  parciales: number
  pendientes: number
  canceladas: number
}

function emptyDia(): DiaAcc {
  return {
    cobrado: 0,
    valorTotal: 0,
    ventas: 0,
    pagadas: 0,
    parciales: 0,
    pendientes: 0,
    canceladas: 0
  }
}

/**
 * Arma el informe detallado de ventas para un rango.
 * `ventas` debe incluir el periodo actual y el anterior (para comparación).
 */
export function construirInformeVentasPeriodo(
  ventas: Venta[],
  opts: {
    modo: InformePeriodoModo
    desde: string
    hasta: string
    labelPeriodo: string
    prevDesde: string
    prevHasta: string
    labelPrev: string
  }
): InformeVentasPeriodo {
  const {
    modo,
    desde,
    hasta,
    labelPeriodo,
    prevDesde,
    prevHasta,
    labelPrev
  } = opts

  const porDiaMap = new Map<string, DiaAcc>()
  for (const f of diasEntre(desde, hasta)) porDiaMap.set(f, emptyDia())

  const porMetodo = new Map<string, { monto: number; cantidad: number }>()
  const porVendedor = new Map<string, { monto: number; cantidad: number }>()
  const porCaja = new Map<string, { monto: number; cantidad: number }>()
  const porEstado = new Map<string, { monto: number; cantidad: number }>()
  const porProducto = new Map<string, { monto: number; cantidad: number }>()
  const porCliente = new Map<string, { monto: number; cantidad: number }>()
  const lineas: InformeVentaLinea[] = []

  let cobrado = 0
  let valorTotal = 0
  let ventasCobradas = 0
  let ventasTotales = 0
  let parciales = 0
  let pendientes = 0
  let canceladas = 0
  let cobradoPrev = 0

  for (const v of ventas) {
    const fecha = fechaVentaIso(v)
    if (!fecha) continue

    const enPrev = fecha >= prevDesde && fecha <= prevHasta
    const enActual = fecha >= desde && fecha <= hasta
    if (!enPrev && !enActual) continue

    const montoCobrado = montoVentaCobrada(v)
    const total = Number(v.valor_total) || 0
    const cobradoVenta = montoCobrado ?? 0

    if (enPrev && montoCobrado != null) {
      cobradoPrev += cobradoVenta
    }

    if (!enActual) continue

    ventasTotales += 1
    valorTotal += total
    const estado = String(v.estado_pago || '—')
    if (estado === 'Cancelado') canceladas += 1
    else if (estado === 'Pendiente') pendientes += 1
    else if (estado === 'Parcial') parciales += 1

    const dia = porDiaMap.get(fecha) || emptyDia()
    dia.ventas += 1
    dia.valorTotal += total
    if (estado === 'Pagado') dia.pagadas += 1
    else if (estado === 'Parcial') dia.parciales += 1
    else if (estado === 'Pendiente') dia.pendientes += 1
    else if (estado === 'Cancelado') dia.canceladas += 1

    if (montoCobrado != null) {
      cobrado += cobradoVenta
      ventasCobradas += 1
      dia.cobrado += cobradoVenta
      bump(porMetodo, String(v.metodo_pago || 'Sin medio'), cobradoVenta)
      bump(porVendedor, String(v.nombre_vendedor || 'Sin vendedor'), cobradoVenta)
      bump(porCaja, String(v.caja_slug_cobro || 'sin caja'), cobradoVenta)
      bump(porCliente, String(v.cliente_nombre || 'Sin cliente'), cobradoVenta)
      for (const it of v.items || []) {
        bumpProducto(
          porProducto,
          it.descripcion,
          Number(it.precio_total) || 0,
          Number(it.cantidad) || 0
        )
      }
      lineas.push({
        id: v.id,
        numero: v.numero_venta,
        fecha,
        cliente: v.cliente_nombre || '—',
        vendedor: v.nombre_vendedor || '—',
        metodo: String(v.metodo_pago || '—'),
        estado,
        cobrado: round2(cobradoVenta),
        valorTotal: round2(total),
        caja: v.caja_slug_cobro || '—'
      })
    }
    bump(porEstado, estado, montoCobrado != null ? cobradoVenta : total)
    porDiaMap.set(fecha, dia)
  }

  const porDia: InformeDiaFila[] = [...porDiaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, d]) => ({
      fecha,
      cobrado: round2(d.cobrado),
      valorTotal: round2(d.valorTotal),
      ventas: d.ventas,
      pagadas: d.pagadas,
      parciales: d.parciales,
      pendientes: d.pendientes,
      canceladas: d.canceladas,
      ticketPromedio: d.pagadas + d.parciales > 0 ? round2(d.cobrado / (d.pagadas + d.parciales)) : 0
    }))

  const diasConCobro = porDia.filter((d) => d.cobrado > 0)
  let mejorDia: InformeDiaFila | null = null
  let peorDia: InformeDiaFila | null = null
  for (const d of diasConCobro) {
    if (!mejorDia || d.cobrado > mejorDia.cobrado) mejorDia = d
    if (!peorDia || d.cobrado < peorDia.cobrado) peorDia = d
  }

  const cobradoR = round2(cobrado)
  const cobradoPrevR = round2(cobradoPrev)
  const pctVsPrev =
    cobradoPrevR > 0.009 ? round2(((cobradoR - cobradoPrevR) / cobradoPrevR) * 100) : null

  return {
    modo,
    desde,
    hasta,
    labelPeriodo,
    prevDesde,
    prevHasta,
    labelPrev,
    kpis: {
      cobrado: cobradoR,
      valorTotal: round2(valorTotal),
      ventasCobradas,
      ventasTotales,
      ticketPromedio: ventasCobradas > 0 ? round2(cobradoR / ventasCobradas) : 0,
      parciales,
      pendientes,
      canceladas,
      pctVsPrev,
      cobradoPrev: cobradoPrevR
    },
    porDia,
    porMetodo: toFilas(porMetodo, cobradoR),
    porVendedor: toFilas(porVendedor, cobradoR),
    porCaja: toFilas(porCaja, cobradoR),
    porEstado: toFilas(porEstado, valorTotal || cobradoR),
    topProductos: toFilas(porProducto, cobradoR).slice(0, 20),
    topClientes: toFilas(porCliente, cobradoR).slice(0, 15),
    topVentas: lineas.sort((a, b) => b.cobrado - a.cobrado).slice(0, 40),
    mejorDia,
    peorDia
  }
}
