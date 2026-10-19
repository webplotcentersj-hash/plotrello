export type VentaProyInput = {
  fecha: string
  total: number
  metodo?: string | null
  vendedor?: string | null
  items?: Array<{ descripcion?: string | null; cantidad?: number | null; precio_total?: number | null }>
}

export type MixSlice = { name: string; value: number }

export type DiaPunto = {
  fecha: string
  real: number | null
  proyectado: number | null
  label: string
}

export type TopProductoPred = {
  name: string
  qtySemana: number
  montoSemana: number
}

export type ProyeccionVentas = {
  diasConDatos: number
  totalHistorico: number
  promedioDiario: number
  tendenciaPct: number
  prox7: number
  prox14: number
  prox30: number
  serie: DiaPunto[]
  mixProductos: MixSlice[]
  mixPagos: MixSlice[]
  mixVendedores: MixSlice[]
  topProductosPrediccion: TopProductoPred[]
  mejorDia: string
  peorDia: string
  narrativa: string
  confianza: 'alta' | 'media' | 'baja'
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const PIE_OTROS = 'Otros'
/** Local cerrado: no entra al promedio ni a la predicción. */
export const DOW_CERRADO = 0
/** Ventana de promedios: un mes calendario de días. */
export const LOOKBACK_PROYECCION = 30

export function addDaysIso(fecha: string, delta: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  if (!y || !m || !d) return fecha
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return dt.toISOString().slice(0, 10)
}

export function dowIso(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
}

export function estaAbierto(fecha: string): boolean {
  return dowIso(fecha) !== DOW_CERRADO
}

export function labelDiaCorto(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}/${m}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function fechaVentaIso(v: { fecha_venta?: string | null }): string {
  return String(v.fecha_venta || '').slice(0, 10)
}

export function montoVentaCobrada(v: {
  estado_pago?: string | null
  valor_total?: number | null
  monto_pagado?: number | null
}): number | null {
  const estado = String(v.estado_pago || '')
  if (estado === 'Cancelado' || estado === 'Pendiente') return null
  if (estado === 'Parcial') {
    const p = Number(v.monto_pagado)
    if (Number.isFinite(p) && p > 0) return p
  }
  const t = Number(v.valor_total) || 0
  return t > 0 ? t : null
}

export function normalizeProducto(raw: string | null | undefined): string {
  const t = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!t) return 'Sin descripción'
  return t.length > 42 ? `${t.slice(0, 40)}…` : t
}

function topMix(acc: Map<string, number>, limit = 7): MixSlice[] {
  const sorted = [...acc.entries()].sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce((s, [, v]) => s + v, 0)
  const out = head.map(([name, value]) => ({ name, value: round2(value) }))
  if (rest > 0.009) out.push({ name: PIE_OTROS, value: round2(rest) })
  return out
}

function promedio(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function coefVar(nums: number[]): number {
  if (nums.length < 2) return 1
  const avg = promedio(nums)
  if (avg <= 0) return 1
  const var_ = promedio(nums.map((n) => (n - avg) ** 2))
  return Math.sqrt(var_) / avg
}

export function construirProyeccionVentas(
  ventas: VentaProyInput[],
  hoy: string,
  lookbackDays = LOOKBACK_PROYECCION
): ProyeccionVentas {
  const desde = addDaysIso(hoy, -(lookbackDays - 1))
  const porDia = new Map<string, number>()
  const mixProd = new Map<string, number>()
  const mixQty = new Map<string, number>()
  const mixPago = new Map<string, number>()
  const mixVend = new Map<string, number>()

  for (const v of ventas) {
    const f = String(v.fecha || '').slice(0, 10)
    if (!f || f < desde || f > hoy) continue
    if (!estaAbierto(f)) continue
    const total = Number(v.total) || 0
    if (total <= 0) continue
    porDia.set(f, (porDia.get(f) || 0) + total)
    const pago = String(v.metodo || 'Otro').trim() || 'Otro'
    mixPago.set(pago, (mixPago.get(pago) || 0) + total)
    const vend = String(v.vendedor || 'Sin vendedor').trim() || 'Sin vendedor'
    mixVend.set(vend, (mixVend.get(vend) || 0) + total)
    if (v.items && v.items.length) {
      for (const it of v.items) {
        const name = normalizeProducto(it.descripcion)
        const monto = Number(it.precio_total) || 0
        const qty = Number(it.cantidad) || 0
        if (monto > 0) mixProd.set(name, (mixProd.get(name) || 0) + monto)
        if (qty > 0) mixQty.set(name, (mixQty.get(name) || 0) + qty)
      }
    }
  }

  const histAbiertos: number[] = []
  const fechasLookback: string[] = []
  for (let i = 0; i < lookbackDays; i++) {
    const f = addDaysIso(desde, i)
    fechasLookback.push(f)
    if (!estaAbierto(f)) continue
    histAbiertos.push(porDia.get(f) || 0)
  }
  const diasAbiertos = histAbiertos.length
  const diasConDatos = histAbiertos.filter((n) => n > 0).length
  const totalHistorico = round2(histAbiertos.reduce((s, n) => s + n, 0))
  const promedioDiario = diasAbiertos ? round2(totalHistorico / diasAbiertos) : 0

  const lastAbiertos = histAbiertos.slice(-12)
  const prevAbiertos = histAbiertos.slice(-24, -12)
  const avgLast = promedio(lastAbiertos)
  const avgPrev = promedio(prevAbiertos)
  const tendencia = avgPrev > 0.01 ? clamp(avgLast / avgPrev, 0.65, 1.5) : 1
  const tendenciaPct = round2((tendencia - 1) * 100)

  const weekdaySum = [0, 0, 0, 0, 0, 0, 0]
  const weekdayN = [0, 0, 0, 0, 0, 0, 0]
  for (const f of fechasLookback) {
    if (!estaAbierto(f)) continue
    const dow = dowIso(f)
    weekdaySum[dow] += porDia.get(f) || 0
    weekdayN[dow] += 1
  }
  const weekdayAvg = weekdaySum.map((s, i) => {
    if (i === DOW_CERRADO) return 0
    return weekdayN[i] ? s / weekdayN[i] : promedioDiario
  })
  let mejor = 1
  let peor = 1
  for (let i = 1; i <= 6; i++) {
    if (weekdayAvg[i] > weekdayAvg[mejor]) mejor = i
    if (weekdayAvg[i] < weekdayAvg[peor]) peor = i
  }

  const proyectarDia = (fecha: string): number => {
    if (!estaAbierto(fecha)) return 0
    const base = weekdayAvg[dowIso(fecha)] || promedioDiario
    return round2(Math.max(0, base * tendencia))
  }

  let prox7 = 0
  let prox14 = 0
  let prox30 = 0
  for (let i = 1; i <= 30; i++) {
    const p = proyectarDia(addDaysIso(hoy, i))
    if (i <= 7) prox7 += p
    if (i <= 14) prox14 += p
    prox30 += p
  }
  prox7 = round2(prox7)
  prox14 = round2(prox14)
  prox30 = round2(prox30)

  const serie: DiaPunto[] = []
  const histSerie = Math.min(29, lookbackDays - 1)
  for (let i = histSerie; i >= 0; i--) {
    const f = addDaysIso(hoy, -i)
    serie.push({
      fecha: f,
      real: estaAbierto(f) ? round2(porDia.get(f) || 0) : 0,
      proyectado: null,
      label: labelDiaCorto(f)
    })
  }
  const lastReal = serie[serie.length - 1]
  if (lastReal) lastReal.proyectado = lastReal.real
  for (let i = 1; i <= 14; i++) {
    const f = addDaysIso(hoy, i)
    serie.push({
      fecha: f,
      real: null,
      proyectado: proyectarDia(f),
      label: labelDiaCorto(f)
    })
  }

  const cv = coefVar(histAbiertos.filter((n) => n > 0))
  const confianza: ProyeccionVentas['confianza'] =
    diasConDatos >= 18 && cv < 0.7 ? 'alta' : diasConDatos >= 8 ? 'media' : 'baja'

  const mixProductos = mixProd.size ? topMix(mixProd) : []
  const topProductosPrediccion: TopProductoPred[] = [...mixProd.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, monto]) => {
      const qty = mixQty.get(name) || 0
      const weeks = Math.max(1, diasAbiertos / 6)
      return {
        name,
        qtySemana: round2((qty / weeks) * tendencia),
        montoSemana: round2((monto / weeks) * tendencia)
      }
    })

  const narrativa = armarNarrativa({
    diasConDatos,
    promedioDiario,
    tendenciaPct,
    prox7,
    prox14,
    mejorDia: DIAS[mejor],
    peorDia: DIAS[peor],
    top: topProductosPrediccion[0]?.name ?? null,
    confianza
  })

  return {
    diasConDatos,
    totalHistorico,
    promedioDiario,
    tendenciaPct,
    prox7,
    prox14,
    prox30,
    serie,
    mixProductos,
    mixPagos: topMix(mixPago, 6),
    mixVendedores: topMix(mixVend, 6),
    topProductosPrediccion,
    mejorDia: DIAS[mejor],
    peorDia: DIAS[peor],
    narrativa,
    confianza
  }
}

function armarNarrativa(p: {
  diasConDatos: number
  promedioDiario: number
  tendenciaPct: number
  prox7: number
  prox14: number
  mejorDia: string
  peorDia: string
  top: string | null
  confianza: ProyeccionVentas['confianza']
}): string {
  if (p.diasConDatos < 3) {
    return 'Todavía hay pocas ventas para proyectar. Con un mes de días abiertos (lunes a sábado) se arma la predicción por día y por producto.'
  }
  const t =
    p.tendenciaPct > 4 ? `va ${p.tendenciaPct.toFixed(0)}% arriba` : p.tendenciaPct < -4 ? `va ${Math.abs(p.tendenciaPct).toFixed(0)}% abajo` : 'está estable'
  const top = p.top ? ` Lo que más se está vendiendo: ${p.top}.` : ''
  return `Promedio del último mes (días abiertos, local cerrado los domingo): $${p.promedioDiario.toLocaleString('es-AR', { maximumFractionDigits: 0 })} por día. Los ${p.mejorDia} suelen ser los más fuertes y los ${p.peorDia} los más flojos. La tendencia ${t} respecto de las dos semanas hábiles anteriores. Predicción a 7 días: $${p.prox7.toLocaleString('es-AR', { maximumFractionDigits: 0 })} (domingo en 0); a 14 días: $${p.prox14.toLocaleString('es-AR', { maximumFractionDigits: 0 })}. Confianza ${p.confianza}.${top}`
}
