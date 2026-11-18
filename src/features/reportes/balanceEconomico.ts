/**
 * Balance económico operativo: ventas (incluye CC) vs salidas reales
 * (gastos, gastos fijos, pagos a proveedores, egresos de caja y liquidaciones a empleados).
 * No usa asientos contables; lee la operación.
 */

export type VentaEco = {
  fecha: string
  valor_total: number
  monto_pagado: number
  metodo_pago: string | null
  estado_pago: string | null
  cliente: string
}

export type GastoEco = {
  fecha: string
  total: number
  categoria: string | null
  descripcion: string | null
  id_gasto_fijo: number | null
  origen: string | null
}

export type PagoProveedorEco = {
  fecha: string
  monto: number
  proveedor: string
}

export type EgresoCajaEco = {
  fecha: string
  monto: number
  concepto: string
}

export type LiquidacionEmpleadoEco = {
  fecha: string
  monto: number
  empleado: string
}

const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function esCuentaCorriente(metodo: string | null | undefined): boolean {
  return !!metodo && /cuenta\s*corriente/i.test(metodo)
}

export type BalanceEconomico = {
  ventasTotal: number
  ventasContado: number
  ventasCc: number
  cobrado: number
  pendienteCc: number
  cantidadVentas: number
  cantidadCc: number
  gastosCorrientes: number
  gastosFijos: number
  gastosTotal: number
  pagosProveedores: number
  egresosCaja: number
  liquidacionesEmpleados: number
  salidasTotal: number
  resultado: number
  porMetodo: Array<{ nombre: string; valor: number; cantidad: number }>
  topClientes: Array<{ nombre: string; valor: number }>
  topGastos: Array<{ nombre: string; valor: number }>
  topProveedores: Array<{ nombre: string; valor: number }>
  topEmpleados: Array<{ nombre: string; valor: number }>
  composicionSalidas: Array<{ nombre: string; valor: number }>
  serieDiaria: Array<{ fecha: string; ventas: number; salidas: number; neto: number }>
}

export function calcularBalanceEconomico(
  ventas: VentaEco[],
  gastos: GastoEco[],
  pagosProv: PagoProveedorEco[],
  egresos: EgresoCajaEco[],
  liquidaciones: LiquidacionEmpleadoEco[],
  desde: string,
  hasta: string
): BalanceEconomico {
  const enRango = (f: string) => {
    const d = String(f || '').slice(0, 10)
    return d >= desde && d <= hasta
  }

  const vs = ventas.filter((v) => enRango(v.fecha))
  const gs = gastos.filter((g) => enRango(g.fecha))
  const ps = pagosProv.filter((p) => enRango(p.fecha))
  const es = egresos.filter((e) => enRango(e.fecha))
  const ls = liquidaciones.filter((l) => enRango(l.fecha))

  let ventasTotal = 0
  let ventasContado = 0
  let ventasCc = 0
  let cobrado = 0
  let pendienteCc = 0
  let cantidadCc = 0
  const porMetodo = new Map<string, { valor: number; cantidad: number }>()
  const porCliente = new Map<string, number>()

  for (const v of vs) {
    const total = n(v.valor_total)
    const pagado = Math.min(Math.max(0, n(v.monto_pagado)), total)
    const cc = esCuentaCorriente(v.metodo_pago)
    ventasTotal += total
    cobrado += pagado
    if (cc) {
      ventasCc += total
      cantidadCc++
      pendienteCc += Math.max(0, total - pagado)
    } else {
      ventasContado += total
    }
    const metodo = (v.metodo_pago || 'Sin medio').trim() || 'Sin medio'
    const m = porMetodo.get(metodo) ?? { valor: 0, cantidad: 0 }
    m.valor += total
    m.cantidad++
    porMetodo.set(metodo, m)
    const cli = (v.cliente || 'Sin nombre').trim() || 'Sin nombre'
    porCliente.set(cli, (porCliente.get(cli) ?? 0) + total)
  }

  let gastosCorrientes = 0
  let gastosFijos = 0
  const porGasto = new Map<string, number>()
  for (const g of gs) {
    const t = n(g.total)
    if (g.id_gasto_fijo != null) gastosFijos += t
    else gastosCorrientes += t
    const nombre = (g.descripcion || g.categoria || 'Gasto').trim() || 'Gasto'
    porGasto.set(nombre, (porGasto.get(nombre) ?? 0) + t)
  }

  let pagosProveedores = 0
  const porProv = new Map<string, number>()
  for (const p of ps) {
    const t = n(p.monto)
    pagosProveedores += t
    const nombre = (p.proveedor || 'Proveedor').trim() || 'Proveedor'
    porProv.set(nombre, (porProv.get(nombre) ?? 0) + t)
  }

  let egresosCaja = 0
  for (const e of es) egresosCaja += n(e.monto)

  let liquidacionesEmpleados = 0
  const porEmpleado = new Map<string, number>()
  for (const l of ls) {
    const t = n(l.monto)
    liquidacionesEmpleados += t
    const nombre = (l.empleado || 'Empleado').trim() || 'Empleado'
    porEmpleado.set(nombre, (porEmpleado.get(nombre) ?? 0) + t)
  }

  const gastosTotal = gastosCorrientes + gastosFijos
  const salidasTotal = gastosTotal + pagosProveedores + egresosCaja + liquidacionesEmpleados
  const resultado = ventasTotal - salidasTotal

  const dias = new Map<string, { ventas: number; salidas: number }>()
  const mark = (fecha: string) => {
    const f = fecha.slice(0, 10)
    if (!dias.has(f)) dias.set(f, { ventas: 0, salidas: 0 })
    return dias.get(f)!
  }
  for (const v of vs) mark(v.fecha).ventas += n(v.valor_total)
  for (const g of gs) mark(g.fecha).salidas += n(g.total)
  for (const p of ps) mark(p.fecha).salidas += n(p.monto)
  for (const e of es) mark(e.fecha).salidas += n(e.monto)
  for (const l of ls) mark(l.fecha).salidas += n(l.monto)

  const serieDiaria = [...dias.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, x]) => ({
      fecha,
      ventas: r2(x.ventas),
      salidas: r2(x.salidas),
      neto: r2(x.ventas - x.salidas)
    }))

  const top = <T extends { valor: number }>(arr: T[], lim = 8) =>
    [...arr].sort((a, b) => b.valor - a.valor).slice(0, lim)

  const composicionSalidas = [
    { nombre: 'Gastos corrientes', valor: r2(gastosCorrientes) },
    { nombre: 'Gastos fijos', valor: r2(gastosFijos) },
    { nombre: 'Pagos a proveedores', valor: r2(pagosProveedores) },
    { nombre: 'Egresos de caja', valor: r2(egresosCaja) },
    { nombre: 'Liquidaciones empleados', valor: r2(liquidacionesEmpleados) }
  ].filter((x) => x.valor > 0.009)

  return {
    ventasTotal: r2(ventasTotal),
    ventasContado: r2(ventasContado),
    ventasCc: r2(ventasCc),
    cobrado: r2(cobrado),
    pendienteCc: r2(pendienteCc),
    cantidadVentas: vs.length,
    cantidadCc,
    gastosCorrientes: r2(gastosCorrientes),
    gastosFijos: r2(gastosFijos),
    gastosTotal: r2(gastosTotal),
    pagosProveedores: r2(pagosProveedores),
    egresosCaja: r2(egresosCaja),
    liquidacionesEmpleados: r2(liquidacionesEmpleados),
    salidasTotal: r2(salidasTotal),
    resultado: r2(resultado),
    porMetodo: top(
      [...porMetodo.entries()].map(([nombre, v]) => ({ nombre, valor: r2(v.valor), cantidad: v.cantidad }))
    ),
    topClientes: top([...porCliente.entries()].map(([nombre, valor]) => ({ nombre, valor: r2(valor) }))),
    topGastos: top([...porGasto.entries()].map(([nombre, valor]) => ({ nombre, valor: r2(valor) }))),
    topProveedores: top([...porProv.entries()].map(([nombre, valor]) => ({ nombre, valor: r2(valor) }))),
    topEmpleados: top([...porEmpleado.entries()].map(([nombre, valor]) => ({ nombre, valor: r2(valor) }))),
    composicionSalidas,
    serieDiaria
  }
}
