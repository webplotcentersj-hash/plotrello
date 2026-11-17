/**
 * Estadísticas de gastos para el tablero: resumen del mes, cuadro por categoría (contra el mes
 * anterior y el promedio de los últimos 6 meses), evolución de 12 meses, acumulado diario y alertas.
 * Cálculo puro sobre las filas de erp_gastos.
 */

export type GastoStat = {
  id: number
  fecha_gasto: string
  total: number
  iva?: number | null
  neto?: number | null
  categoria?: string | null
  proveedor?: string | null
  metodo_pago?: string | null
  descripcion?: string | null
  id_factura_compra?: number | null
  origen?: string | null
}

export const SIN_CATEGORIA = 'Sin categoría'

const n = (v: unknown) => Number(v) || 0
const r2 = (v: number) => Math.round(v * 100) / 100
const mesDe = (g: Pick<GastoStat, 'fecha_gasto'>) => String(g.fecha_gasto || '').slice(0, 7)
const diaDe = (g: Pick<GastoStat, 'fecha_gasto'>) => Number(String(g.fecha_gasto || '').slice(8, 10)) || 0
export const categoriaDe = (g: Pick<GastoStat, 'categoria'>) => (g.categoria || '').trim() || SIN_CATEGORIA

export function sumarMeses(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function diasDelMes(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function variacionPct(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

// ── Resumen del mes ─────────────────────────────────────────────────────

export type ResumenMes = {
  total: number
  neto: number
  iva: number
  cantidad: number
  /** Mes anterior completo. */
  totalMesAnterior: number
  /** Mes anterior hasta el mismo día (comparación justa con un mes en curso). */
  totalMesAnteriorMismoDia: number
  variacion: number | null
  promedioDiario: number
  /** Solo si el mes está en curso. */
  proyeccion: number | null
  ivaPendienteLibro: number
  gastosConIvaSinLibro: number
  sinCategoria: { cantidad: number; total: number }
  fijos: number
  mayor: GastoStat | null
  proveedores: number
}

export function resumenMes(rows: GastoStat[], ym: string, hoy: string): ResumenMes {
  const delMes = rows.filter((g) => mesDe(g) === ym)
  const prev = sumarMeses(ym, -1)
  const enCurso = hoy.slice(0, 7) === ym
  const diaHoy = Number(hoy.slice(8, 10))
  const total = r2(delMes.reduce((s, g) => s + n(g.total), 0))
  const delPrev = rows.filter((g) => mesDe(g) === prev)
  const totalMesAnterior = r2(delPrev.reduce((s, g) => s + n(g.total), 0))
  const totalMesAnteriorMismoDia = enCurso
    ? r2(delPrev.filter((g) => diaDe(g) <= diaHoy).reduce((s, g) => s + n(g.total), 0))
    : totalMesAnterior
  const dias = enCurso ? Math.max(diaHoy, 1) : diasDelMes(ym)
  const conIvaSinLibro = delMes.filter((g) => n(g.iva) > 0 && !g.id_factura_compra)
  // Proyección: los gastos fijos (pagos de una vez por mes) se suman tal cual; solo se extrapola lo variable.
  const fijosMes = delMes.filter((g) => g.origen === 'gasto_fijo').reduce((s, g) => s + n(g.total), 0)
  const variable = total - fijosMes
  const sinCat = delMes.filter((g) => categoriaDe(g) === SIN_CATEGORIA)
  return {
    total,
    neto: r2(delMes.reduce((s, g) => s + n(g.neto), 0)),
    iva: r2(delMes.reduce((s, g) => s + n(g.iva), 0)),
    cantidad: delMes.length,
    totalMesAnterior,
    totalMesAnteriorMismoDia,
    variacion: variacionPct(total, totalMesAnteriorMismoDia),
    promedioDiario: r2(total / dias),
    proyeccion: enCurso ? r2(fijosMes + (variable / Math.max(diaHoy, 1)) * diasDelMes(ym)) : null,
    ivaPendienteLibro: r2(conIvaSinLibro.reduce((s, g) => s + n(g.iva), 0)),
    gastosConIvaSinLibro: conIvaSinLibro.length,
    sinCategoria: { cantidad: sinCat.length, total: r2(sinCat.reduce((s, g) => s + n(g.total), 0)) },
    fijos: r2(delMes.filter((g) => g.origen === 'gasto_fijo').reduce((s, g) => s + n(g.total), 0)),
    mayor: delMes.reduce<GastoStat | null>((max, g) => (!max || n(g.total) > n(max.total) ? g : max), null),
    proveedores: new Set(delMes.map((g) => (g.proveedor || '').trim()).filter(Boolean)).size
  }
}

// ── Cuadro de categorías ────────────────────────────────────────────────

export type FilaCategoria = {
  categoria: string
  cantidad: number
  total: number
  participacion: number
  mesAnterior: number
  variacion: number | null
  /** Promedio mensual de los 6 meses previos (los meses sin gasto cuentan como 0). */
  promedio6: number
  vsPromedio: number | null
  ultimo: string | null
  proveedorPrincipal: string | null
  /** Total de cada uno de los últimos 6 meses (incluido el actual), para la mini serie. */
  serie: number[]
}

export function cuadroCategorias(rows: GastoStat[], ym: string): FilaCategoria[] {
  const meses6 = Array.from({ length: 6 }, (_, i) => sumarMeses(ym, i - 6)) // 6 previos
  const ventana = new Set([...meses6, ym])
  const porCat = new Map<string, GastoStat[]>()
  for (const g of rows) {
    if (!ventana.has(mesDe(g))) continue
    const k = categoriaDe(g)
    porCat.set(k, [...(porCat.get(k) ?? []), g])
  }
  const totalMes = rows.filter((g) => mesDe(g) === ym).reduce((s, g) => s + n(g.total), 0)
  const prev = sumarMeses(ym, -1)
  const filas: FilaCategoria[] = []
  for (const [categoria, lista] of porCat) {
    const delMes = lista.filter((g) => mesDe(g) === ym)
    const total = r2(delMes.reduce((s, g) => s + n(g.total), 0))
    const mesAnterior = r2(lista.filter((g) => mesDe(g) === prev).reduce((s, g) => s + n(g.total), 0))
    const promedio6 = r2(lista.filter((g) => meses6.includes(mesDe(g))).reduce((s, g) => s + n(g.total), 0) / 6)
    const provs = new Map<string, number>()
    for (const g of delMes) {
      const p = (g.proveedor || '').trim()
      if (p) provs.set(p, (provs.get(p) ?? 0) + n(g.total))
    }
    const ultimo = delMes.map((g) => String(g.fecha_gasto).slice(0, 10)).sort().at(-1) ?? null
    filas.push({
      categoria,
      cantidad: delMes.length,
      total,
      participacion: totalMes ? (total / totalMes) * 100 : 0,
      mesAnterior,
      variacion: variacionPct(total, mesAnterior),
      promedio6,
      vsPromedio: variacionPct(total, promedio6),
      ultimo,
      proveedorPrincipal: [...provs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      serie: [...meses6.slice(1), ym].map((m) => r2(lista.filter((g) => mesDe(g) === m).reduce((s, g) => s + n(g.total), 0)))
    })
  }
  return filas.sort((a, b) => b.total - a.total || b.promedio6 - a.promedio6 || a.categoria.localeCompare(b.categoria))
}

// ── Series ──────────────────────────────────────────────────────────────

/** 12 meses hasta `ym`, apilado por las `top` categorías más grandes del período y "Otras". */
export function evolucionPorCategoria(rows: GastoStat[], ym: string, top = 5) {
  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(ym, i - 11))
  const enRango = rows.filter((g) => meses.includes(mesDe(g)))
  const totales = new Map<string, number>()
  for (const g of enRango) totales.set(categoriaDe(g), (totales.get(categoriaDe(g)) ?? 0) + n(g.total))
  const principales = [...totales.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([c]) => c)
  const claves = totales.size > principales.length ? [...principales, 'Otras'] : principales
  const datos = meses.map((mes) => {
    const fila: Record<string, number | string> = { mes }
    for (const c of claves) fila[c] = 0
    let total = 0
    for (const g of enRango.filter((x) => mesDe(x) === mes)) {
      const c = principales.includes(categoriaDe(g)) ? categoriaDe(g) : 'Otras'
      fila[c] = r2(n(fila[c]) + n(g.total))
      total += n(g.total)
    }
    fila.total = r2(total)
    return fila
  })
  return { claves, datos }
}

/** Gasto acumulado día a día del mes contra el mes anterior. */
export function acumuladoDiario(rows: GastoStat[], ym: string, hoy: string) {
  const prev = sumarMeses(ym, -1)
  const dias = Math.max(diasDelMes(ym), diasDelMes(prev))
  const enCurso = hoy.slice(0, 7) === ym
  const tope = enCurso ? Number(hoy.slice(8, 10)) : diasDelMes(ym)
  const porDia = (mes: string) => {
    const arr = new Array(dias + 1).fill(0)
    for (const g of rows) if (mesDe(g) === mes) arr[diaDe(g)] += n(g.total)
    return arr
  }
  const act = porDia(ym)
  const ant = porDia(prev)
  let sa = 0
  let sp = 0
  const out: Array<{ dia: number; actual: number | null; anterior: number | null }> = []
  for (let d = 1; d <= dias; d++) {
    sa += act[d]
    sp += ant[d]
    out.push({ dia: d, actual: d <= tope && d <= diasDelMes(ym) ? r2(sa) : null, anterior: d <= diasDelMes(prev) ? r2(sp) : null })
  }
  return out
}

export function agrupar(rows: GastoStat[], ym: string, clave: (g: GastoStat) => string, max = 8) {
  const m = new Map<string, { nombre: string; total: number; cantidad: number }>()
  for (const g of rows) {
    if (mesDe(g) !== ym) continue
    const k = clave(g) || 'Sin dato'
    const x = m.get(k) ?? { nombre: k, total: 0, cantidad: 0 }
    x.total = r2(x.total + n(g.total))
    x.cantidad++
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, max)
}

// ── Alertas ─────────────────────────────────────────────────────────────

export type AlertaGasto = { tono: 'danger' | 'warn' | 'info' | 'ok'; texto: string; categoria?: string }

const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pct = (v: number) => `${Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%`

export function alertasGastos(rows: GastoStat[], ym: string, hoy: string): AlertaGasto[] {
  const out: AlertaGasto[] = []
  const r = resumenMes(rows, ym, hoy)
  const cuadro = cuadroCategorias(rows, ym)
  const enCurso = hoy.slice(0, 7) === ym

  // Categorías que YA superan su promedio mensual (no se proyecta: muchos gastos son de una vez por mes).
  for (const f of cuadro) {
    if (f.promedio6 <= 0) continue
    const v = variacionPct(f.total, f.promedio6)
    if (v !== null && v >= 40 && f.total - f.promedio6 >= Math.max(r.total * 0.05, 1)) {
      out.push({
        tono: 'warn',
        categoria: f.categoria,
        texto: `${f.categoria}: ${pesos(f.total)}${enCurso ? ' en lo que va del mes' : ''}, ${pct(v)} más que su promedio (${pesos(f.promedio6)}/mes).`
      })
    }
  }
  if (r.gastosConIvaSinLibro) {
    out.push({
      tono: 'warn',
      texto: `${r.gastosConIvaSinLibro} gasto(s) con IVA todavía no están en el libro de compras: ${pesos(r.ivaPendienteLibro)} de crédito fiscal sin computar.`
    })
  }
  if (r.sinCategoria.cantidad) {
    out.push({
      tono: 'info',
      categoria: SIN_CATEGORIA,
      texto: `${r.sinCategoria.cantidad} gasto(s) sin categoría (${pesos(r.sinCategoria.total)}): categorizalos para que las estadísticas sean exactas.`
    })
  }
  if (r.mayor && r.cantidad >= 4 && n(r.mayor.total) >= r.total * 0.35) {
    out.push({
      tono: 'info',
      texto: `Un solo gasto es el ${pct((n(r.mayor.total) / r.total) * 100)} del mes: ${r.mayor.descripcion || r.mayor.proveedor || categoriaDe(r.mayor)} (${pesos(n(r.mayor.total))}).`
    })
  }
  if (r.variacion !== null && r.variacion <= -15) {
    out.push({ tono: 'ok', texto: `Venís gastando ${pct(r.variacion)} menos que el mes anterior a esta altura.` })
  } else if (r.variacion !== null && r.variacion >= 25) {
    out.push({ tono: 'warn', texto: `Venís gastando ${pct(r.variacion)} más que el mes anterior a esta altura.` })
  }
  const orden = { danger: 0, warn: 1, info: 2, ok: 3 }
  return out.sort((a, b) => orden[a.tono] - orden[b.tono])
}
