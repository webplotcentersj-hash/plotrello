/**
 * Estados contables a partir de los movimientos de los asientos contabilizados y del plan de cuentas.
 * Formato de exposición de la RT 9 FACPCE (estado de resultados y de situación patrimonial) y
 * los índices habituales (liquidez, prueba ácida, endeudamiento, márgenes). Cálculo puro.
 *
 * Clasificación por código (estructura de 2026-11-17_plan_cuentas_estructura.sql), con respaldo
 * por tipo de cuenta si el plan es otro.
 */

export type TipoCuenta = 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingreso' | 'Costo' | 'Gasto' | 'Cuenta de Orden'

export type Movimiento = {
  fecha: string
  codigo: string
  nombre: string
  tipo: TipoCuenta
  debe: number
  haber: number
}

export type CuentaPlan = { codigo: string; nombre: string; tipo: TipoCuenta }

const n = (v: unknown) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100

export function variacionPct(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

export function prefijo(codigo: string, segmentos: number): string {
  return codigo.split('.').slice(0, segmentos).join('.')
}

// ── Estado de resultados ────────────────────────────────────────────────

export type LineaER = 'ventas' | 'costo' | 'administracion' | 'comercializacion' | 'financieros' | 'otros' | 'ganancias'

export function lineaResultado(codigo: string, tipo: TipoCuenta): LineaER | null {
  if (tipo === 'Ingreso') return codigo.startsWith('4.1') ? 'ventas' : 'otros'
  if (tipo === 'Costo') return 'costo'
  if (tipo === 'Gasto') {
    if (codigo.startsWith('6.2')) return 'comercializacion'
    if (codigo.startsWith('6.3')) return 'financieros'
    if (codigo.startsWith('6.4')) return 'ganancias'
    return 'administracion'
  }
  return null
}

export const ETIQUETA_LINEA: Record<LineaER, string> = {
  ventas: 'Ventas netas',
  costo: 'Costo de ventas',
  administracion: 'Gastos de administración',
  comercializacion: 'Gastos de comercialización',
  financieros: 'Resultados financieros',
  otros: 'Otros ingresos y egresos',
  ganancias: 'Impuesto a las ganancias'
}

export type DetalleCuenta = { codigo: string; nombre: string; importe: number }

export type EstadoResultados = {
  ventas: number
  costo: number
  bruto: number
  administracion: number
  comercializacion: number
  financieros: number
  otros: number
  antesImpuesto: number
  ganancias: number
  neto: number
  margenBruto: number | null
  margenNeto: number | null
  /** Importe por cuenta de cada línea (positivo = suma al resultado). */
  detalle: Record<LineaER, DetalleCuenta[]>
}

/**
 * Importes con signo "resultado": ingresos positivos (haber − debe), costos y gastos negativos.
 * Así el resultado es simplemente la suma.
 */
export function estadoResultados(movs: Movimiento[], desde: string, hasta: string): EstadoResultados {
  const det: Record<LineaER, Map<string, DetalleCuenta>> = {
    ventas: new Map(),
    costo: new Map(),
    administracion: new Map(),
    comercializacion: new Map(),
    financieros: new Map(),
    otros: new Map(),
    ganancias: new Map()
  }
  for (const m of movs) {
    if (m.fecha < desde || m.fecha > hasta) continue
    const linea = lineaResultado(m.codigo, m.tipo)
    if (!linea) continue
    const actual = det[linea].get(m.codigo) ?? { codigo: m.codigo, nombre: m.nombre, importe: 0 }
    actual.importe = r2(actual.importe + n(m.haber) - n(m.debe))
    det[linea].set(m.codigo, actual)
  }
  const suma = (l: LineaER) => r2([...det[l].values()].reduce((s, d) => s + d.importe, 0))
  const ventas = suma('ventas')
  const costo = suma('costo')
  const administracion = suma('administracion')
  const comercializacion = suma('comercializacion')
  const financieros = suma('financieros')
  const otros = suma('otros')
  const ganancias = suma('ganancias')
  const bruto = r2(ventas + costo)
  const antesImpuesto = r2(bruto + administracion + comercializacion + financieros + otros)
  const neto = r2(antesImpuesto + ganancias)
  const detalle = Object.fromEntries(
    Object.entries(det).map(([k, m]) => [k, [...m.values()].filter((d) => Math.abs(d.importe) >= 0.01).sort((a, b) => a.codigo.localeCompare(b.codigo))])
  ) as Record<LineaER, DetalleCuenta[]>
  return {
    ventas,
    costo,
    bruto,
    administracion,
    comercializacion,
    financieros,
    otros,
    antesImpuesto,
    ganancias,
    neto,
    margenBruto: ventas ? (bruto / ventas) * 100 : null,
    margenNeto: ventas ? (neto / ventas) * 100 : null,
    detalle
  }
}

// ── Situación patrimonial ───────────────────────────────────────────────

export type SaldoCuenta = { codigo: string; nombre: string; tipo: TipoCuenta; debe: number; haber: number }

export type RubroSP = { codigo: string; nombre: string; importe: number }

export type BloqueSP = { rubros: RubroSP[]; total: number }

export type SituacionPatrimonial = {
  activoCorriente: BloqueSP
  activoNoCorriente: BloqueSP
  activo: number
  pasivoCorriente: BloqueSP
  pasivoNoCorriente: BloqueSP
  pasivo: number
  patrimonio: BloqueSP
  /** Resultado de las cuentas de resultado todavía no cerradas (va dentro del PN). */
  resultadoNoCerrado: number
  patrimonioNeto: number
  diferencia: number
  indices: {
    liquidezCorriente: number | null
    pruebaAcida: number | null
    endeudamiento: number | null
    solvencia: number | null
    capitalTrabajo: number
  }
  disponibilidades: number
  bienesDeCambio: number
}

function bloque(saldos: SaldoCuenta[], filtro: (c: SaldoCuenta) => boolean, signo: 1 | -1, nombres: Map<string, string>): BloqueSP {
  const m = new Map<string, RubroSP>()
  for (const c of saldos.filter(filtro)) {
    const k = prefijo(c.codigo, 3)
    const r = m.get(k) ?? { codigo: k, nombre: nombres.get(k) ?? c.nombre, importe: 0 }
    r.importe = r2(r.importe + signo * (n(c.debe) - n(c.haber)))
    m.set(k, r)
  }
  const rubros = [...m.values()].filter((r) => Math.abs(r.importe) >= 0.01).sort((a, b) => a.codigo.localeCompare(b.codigo))
  return { rubros, total: r2(rubros.reduce((s, r) => s + r.importe, 0)) }
}

const ratio = (a: number, b: number) => (Math.abs(b) < 0.01 ? null : a / b)

export function situacionPatrimonial(saldos: SaldoCuenta[], plan: CuentaPlan[] = []): SituacionPatrimonial {
  const nombres = new Map(plan.map((c) => [c.codigo, c.nombre]))
  const esNoCorriente = (c: SaldoCuenta, raiz: string) => c.codigo.startsWith(`${raiz}.2`)
  const activoCorriente = bloque(saldos, (c) => c.tipo === 'Activo' && !esNoCorriente(c, '1'), 1, nombres)
  const activoNoCorriente = bloque(saldos, (c) => c.tipo === 'Activo' && esNoCorriente(c, '1'), 1, nombres)
  const pasivoCorriente = bloque(saldos, (c) => c.tipo === 'Pasivo' && !esNoCorriente(c, '2'), -1, nombres)
  const pasivoNoCorriente = bloque(saldos, (c) => c.tipo === 'Pasivo' && esNoCorriente(c, '2'), -1, nombres)
  const patrimonio = bloque(saldos, (c) => c.tipo === 'Patrimonio', -1, nombres)
  const resultadoNoCerrado = r2(
    saldos
      .filter((c) => c.tipo === 'Ingreso' || c.tipo === 'Costo' || c.tipo === 'Gasto')
      .reduce((s, c) => s + n(c.haber) - n(c.debe), 0)
  )
  const activo = r2(activoCorriente.total + activoNoCorriente.total)
  const pasivo = r2(pasivoCorriente.total + pasivoNoCorriente.total)
  const patrimonioNeto = r2(patrimonio.total + resultadoNoCerrado)
  const sumaPrefijo = (p: string) =>
    r2(saldos.filter((c) => c.codigo === p || c.codigo.startsWith(`${p}.`)).reduce((s, c) => s + n(c.debe) - n(c.haber), 0))
  const disponibilidades = sumaPrefijo('1.1.1')
  const bienesDeCambio = sumaPrefijo('1.1.5')
  return {
    activoCorriente,
    activoNoCorriente,
    activo,
    pasivoCorriente,
    pasivoNoCorriente,
    pasivo,
    patrimonio,
    resultadoNoCerrado,
    patrimonioNeto,
    diferencia: r2(activo - pasivo - patrimonioNeto),
    indices: {
      liquidezCorriente: ratio(activoCorriente.total, pasivoCorriente.total),
      pruebaAcida: ratio(activoCorriente.total - bienesDeCambio, pasivoCorriente.total),
      endeudamiento: ratio(pasivo, patrimonioNeto),
      solvencia: ratio(activo, pasivo),
      capitalTrabajo: r2(activoCorriente.total - pasivoCorriente.total)
    },
    disponibilidades,
    bienesDeCambio
  }
}

// ── Series mensuales ────────────────────────────────────────────────────

export function mesesEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  let [y, m] = desde.slice(0, 7).split('-').map(Number)
  const [yh, mh] = hasta.slice(0, 7).split('-').map(Number)
  while (y < yh || (y === yh && m <= mh)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export type PuntoEvolucion = { mes: string; ingresos: number; egresos: number; resultado: number }

/** Ingresos (ventas + otros) contra costos y gastos, mes a mes. */
export function evolucionMensual(movs: Movimiento[], desde: string, hasta: string): PuntoEvolucion[] {
  const base = new Map(mesesEntre(desde, hasta).map((m) => [m, { mes: m, ingresos: 0, egresos: 0, resultado: 0 }]))
  for (const m of movs) {
    const p = base.get(m.fecha.slice(0, 7))
    if (!p) continue
    const importe = n(m.haber) - n(m.debe)
    if (m.tipo === 'Ingreso') p.ingresos += importe
    else if (m.tipo === 'Costo' || m.tipo === 'Gasto') p.egresos -= importe
  }
  return [...base.values()].map((p) => ({ mes: p.mes, ingresos: r2(p.ingresos), egresos: r2(p.egresos), resultado: r2(p.ingresos - p.egresos) }))
}

export type PuntoFlujo = { mes: string; entradas: number; salidas: number; neto: number; saldo: number }

/**
 * Flujo de fondos de las disponibilidades (cuentas 1.1.1.*): entradas (debe) y salidas (haber) por mes.
 * `saldoInicial` es el saldo de caja y bancos al día anterior a `desde`.
 */
export function flujoFondos(movs: Movimiento[], desde: string, hasta: string, saldoInicial = 0, prefijoDisponible = '1.1.1'): PuntoFlujo[] {
  const base = new Map(mesesEntre(desde, hasta).map((m) => [m, { entradas: 0, salidas: 0 }]))
  for (const m of movs) {
    if (m.fecha < desde || m.fecha > hasta) continue
    if (!(m.codigo === prefijoDisponible || m.codigo.startsWith(`${prefijoDisponible}.`))) continue
    const p = base.get(m.fecha.slice(0, 7))
    if (!p) continue
    p.entradas += n(m.debe)
    p.salidas += n(m.haber)
  }
  let saldo = saldoInicial
  return [...base.entries()].map(([mes, p]) => {
    saldo += p.entradas - p.salidas
    return { mes, entradas: r2(p.entradas), salidas: r2(p.salidas), neto: r2(p.entradas - p.salidas), saldo: r2(saldo) }
  })
}

/** Gastos y costos del período agrupados por rubro (nivel 3), de mayor a menor. */
export function composicionEgresos(movs: Movimiento[], desde: string, hasta: string, plan: CuentaPlan[] = []): Array<{ nombre: string; valor: number }> {
  const nombres = new Map(plan.map((c) => [c.codigo, c.nombre]))
  const m = new Map<string, number>()
  for (const x of movs) {
    if (x.fecha < desde || x.fecha > hasta) continue
    if (x.tipo !== 'Gasto' && x.tipo !== 'Costo') continue
    const k = prefijo(x.codigo, 3)
    m.set(k, (m.get(k) ?? 0) + n(x.debe) - n(x.haber))
  }
  return [...m.entries()]
    .map(([k, v]) => ({ nombre: nombres.get(k) ?? k, valor: r2(v) }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
}

// ── Antigüedad de saldos (aging) ────────────────────────────────────────

export type Pendiente = { nombre: string; pendiente: number; vencimiento: string | null; emision: string }

export const TRAMOS = ['A vencer', '1–30 días', '31–60 días', '61–90 días', 'Más de 90'] as const
export type Tramo = (typeof TRAMOS)[number]

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T00:00:00`) - Date.parse(`${desde.slice(0, 10)}T00:00:00`)) / 86400000)
}

export function tramoDe(p: Pendiente, hoy: string): Tramo {
  // Sin vencimiento cargado se toma 30 días desde la emisión.
  const vto = p.vencimiento ?? new Date(Date.parse(`${p.emision.slice(0, 10)}T00:00:00`) + 30 * 86400000).toISOString().slice(0, 10)
  const atraso = diasEntre(vto, hoy)
  if (atraso <= 0) return 'A vencer'
  if (atraso <= 30) return '1–30 días'
  if (atraso <= 60) return '31–60 días'
  if (atraso <= 90) return '61–90 días'
  return 'Más de 90'
}

export function antiguedad(pendientes: Pendiente[], hoy: string) {
  const tramos = TRAMOS.map((t) => ({ tramo: t, importe: 0, cantidad: 0 }))
  const porNombre = new Map<string, number>()
  for (const p of pendientes) {
    if (n(p.pendiente) <= 0.009) continue
    const t = tramos.find((x) => x.tramo === tramoDe(p, hoy))!
    t.importe = r2(t.importe + n(p.pendiente))
    t.cantidad++
    porNombre.set(p.nombre, r2((porNombre.get(p.nombre) ?? 0) + n(p.pendiente)))
  }
  const total = r2(tramos.reduce((s, t) => s + t.importe, 0))
  const vencido = r2(tramos.filter((t) => t.tramo !== 'A vencer').reduce((s, t) => s + t.importe, 0))
  const principales = [...porNombre.entries()].map(([nombre, importe]) => ({ nombre, importe })).sort((a, b) => b.importe - a.importe).slice(0, 8)
  return { tramos, total, vencido, principales }
}

// ── Períodos ────────────────────────────────────────────────────────────

/** Período anterior de la misma duración (para comparar). */
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = Date.parse(`${desde}T00:00:00`)
  const h = Date.parse(`${hasta}T00:00:00`)
  const dias = Math.round((h - d) / 86400000) + 1
  // Si el período son meses completos, comparar contra los mismos meses previos.
  const [yd, md, dd] = desde.split('-').map(Number)
  const [yh, mh] = hasta.split('-').map(Number)
  const finDeMes = new Date(yh, mh, 0).getDate() === Number(hasta.slice(8, 10))
  const isoL = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const meses = (yh - yd) * 12 + (mh - md) + 1
  if (dd === 1 && finDeMes) {
    // Meses completos: los mismos meses inmediatamente anteriores.
    return { desde: isoL(new Date(yd, md - 1 - meses, 1)), hasta: isoL(new Date(yd, md - 1, 0)) }
  }
  if (dd === 1) {
    // Mes en curso: mismos días del mes anterior. Varios meses en curso: mismo período del año anterior.
    const atras = meses === 1 ? 1 : 12
    const dh = Number(hasta.slice(8, 10))
    const finAnt = new Date(yh, mh - 1 - atras, 1)
    const ultimo = new Date(finAnt.getFullYear(), finAnt.getMonth() + 1, 0).getDate()
    return {
      desde: isoL(new Date(yd, md - 1 - atras, 1)),
      hasta: isoL(new Date(finAnt.getFullYear(), finAnt.getMonth(), Math.min(dh, ultimo)))
    }
  }
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  return { desde: iso(d - dias * 86400000), hasta: iso(d - 86400000) }
}
