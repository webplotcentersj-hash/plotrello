/**
 * Análisis de comisiones para la pantalla: proyección del mes, comparación con el mes anterior,
 * concentración de ventas y alertas accionables. Todo es cálculo puro sobre lo que ya devuelve
 * la base (comisiones_listar); no cambia ningún monto.
 */
import type { MomentoComision } from './calculoComisiones'

export type ResumenVendedorMes = {
  id_vendedor: number | null
  nombre_vendedor: string
  ventas: number
  base_monto: number
  devengado: number
  liquidado: number
  pendiente: number
}

export type VentaAnalisis = {
  id_vendedor: number | null
  nombre_vendedor?: string | null
  numero_venta?: string | null
  nombre_cliente?: string | null
  fecha_venta: string
  base_monto: number
  monto_pagado?: number | null
  estado_pago?: string | null
  metodo_pago?: string | null
  monto_devengado: number
}

/** porcentaje null = usa el % general. */
export type VendedorConfig = { id_usuario: number; nombre: string; porcentaje: number | null; activo: boolean; ventas: number }

/** % que se le aplica: el propio o, si no tiene, el general. Inactivo = 0. */
export function porcentajeEfectivo(v: Pick<VendedorConfig, 'porcentaje' | 'activo'>, general: number): number {
  if (!v.activo) return 0
  return v.porcentaje === null || v.porcentaje === undefined ? n(general) : n(v.porcentaje)
}

export type Tono = 'ok' | 'info' | 'warn' | 'danger'
export type Insight = { id: string; tono: Tono; titulo: string; detalle: string }

const n = (v: unknown) => Number(v) || 0

function diasDelMes(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T00:00:00`) - Date.parse(`${desde.slice(0, 10)}T00:00:00`)) / 86400000)
}

/** Proyección lineal del mes en curso: lo vendido hasta hoy / días transcurridos × días del mes. */
export function proyeccionMes(baseHastaHoy: number, ym: string, hoy: string): { proyectado: number; avance: number } | null {
  if (hoy.slice(0, 7) !== ym) return null
  const dia = Number(hoy.slice(8, 10))
  const total = diasDelMes(ym)
  if (!dia) return null
  return { proyectado: (baseHastaHoy / dia) * total, avance: dia / total }
}

/** % de cambio; null si no hay base para comparar. */
export function variacionPct(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return ((actual - anterior) / Math.abs(anterior)) * 100
}

export type PorcionTorta = { nombre: string; valor: number; extra?: string }

/** Agrupa en "Otros" lo que quede después de las `max` porciones más grandes. */
export function porcionesTorta(items: PorcionTorta[], max = 6): PorcionTorta[] {
  const ordenadas = items.filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor)
  if (ordenadas.length <= max) return ordenadas
  const resto = ordenadas.slice(max - 1).reduce((s, i) => s + i.valor, 0)
  return [...ordenadas.slice(0, max - 1), { nombre: 'Otros', valor: resto }]
}

export function tortaPorClave(ventas: VentaAnalisis[], clave: (v: VentaAnalisis) => string, valor: (v: VentaAnalisis) => number) {
  const m = new Map<string, number>()
  for (const v of ventas) m.set(clave(v), (m.get(clave(v)) || 0) + valor(v))
  return porcionesTorta([...m.entries()].map(([nombre, v]) => ({ nombre, valor: v })))
}

/** Cobrado vs. pendiente de cobro del mes, sobre el precio de venta. */
export function cobranzaMes(ventas: VentaAnalisis[]): { cobrado: number; pendiente: number; total: number; pct: number } {
  let total = 0
  let cobrado = 0
  for (const v of ventas) {
    if (v.estado_pago === 'Cancelado') continue
    total += n(v.base_monto)
    cobrado += Math.min(n(v.monto_pagado), n(v.base_monto))
  }
  const pendiente = Math.max(total - cobrado, 0)
  return { cobrado, pendiente, total, pct: total > 0 ? (cobrado / total) * 100 : 0 }
}

export type FilaRanking = ResumenVendedorMes & {
  participacion: number
  ticket: number
  variacion: number | null
  cobrado: number
}

export function rankingVendedores(
  actual: ResumenVendedorMes[],
  anterior: ResumenVendedorMes[],
  ventasMes: VentaAnalisis[]
): FilaRanking[] {
  const total = actual.reduce((s, r) => s + n(r.base_monto), 0)
  const cobrado = new Map<string, number>()
  for (const v of ventasMes) {
    const k = String(v.id_vendedor ?? '')
    cobrado.set(k, (cobrado.get(k) || 0) + n(v.monto_pagado))
  }
  return [...actual]
    .map((r) => {
      const prev = anterior.find((p) => p.id_vendedor === r.id_vendedor)
      return {
        ...r,
        participacion: total > 0 ? (n(r.base_monto) / total) * 100 : 0,
        ticket: r.ventas > 0 ? n(r.base_monto) / r.ventas : 0,
        variacion: prev ? variacionPct(n(r.base_monto), n(prev.base_monto)) : null,
        cobrado: cobrado.get(String(r.id_vendedor ?? '')) || 0
      }
    })
    .sort((a, b) => n(b.base_monto) - n(a.base_monto))
}

export type DatosInsights = {
  mes: string
  hoy: string
  momento: MomentoComision
  porcentajeGeneral: number
  ranking: FilaRanking[]
  baseMes: number
  baseMesAnterior: number
  ventasMes: VentaAnalisis[]
  /** Ventas de todo el período cargado (para detectar cobros viejos). */
  ventasPeriodo: VentaAnalisis[]
  vendedores: VendedorConfig[]
  pendienteTotal: number
  liquidacionesSinPagar: Array<{ estado: string; total: number; periodo: string }>
}

const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const pct = (v: number) => `${Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%`

/** Lecturas del mes en lenguaje simple, de lo más urgente a lo informativo. */
export function insightsComisiones(d: DatosInsights): Insight[] {
  const out: Insight[] = []
  const totalMes = d.ranking.reduce((s, r) => s + n(r.base_monto), 0)

  // Configuración que deja comisiones en cero
  const sinPct = d.vendedores.filter((v) => v.activo && v.ventas > 0 && porcentajeEfectivo(v, d.porcentajeGeneral) === 0)
  if (sinPct.length > 0) {
    const nombres = `${sinPct.map((v) => v.nombre).slice(0, 3).join(', ')}${sinPct.length > 3 ? '…' : ''}`
    out.push({
      id: 'sin-porcentaje',
      tono: 'danger',
      titulo: `${sinPct.length} vendedor${sinPct.length > 1 ? 'es' : ''} con 0% de comisión`,
      detalle:
        n(d.porcentajeGeneral) === 0
          ? `${nombres}: el % general está en 0 y no tiene${sinPct.length > 1 ? 'n' : ''} uno propio.`
          : `${nombres}: tiene${sinPct.length > 1 ? 'n' : ''} 0% propio en vez del general (${n(d.porcentajeGeneral)}%). Revisalo en la configuración.`
    })
  }

  // Cobranza: con momento "al cobrar", lo no cobrado es comisión en espera
  const cob = cobranzaMes(d.ventasMes)
  if (cob.total > 0 && cob.pct < 70) {
    out.push({
      id: 'cobranza',
      tono: d.momento === 'cobro' ? 'warn' : 'info',
      titulo: `Cobrado solo el ${pct(cob.pct)} del mes`,
      detalle:
        d.momento === 'cobro'
          ? `Faltan cobrar ${pesos(cob.pendiente)}: esa parte de la comisión recién se gana cuando entre el pago.`
          : `Faltan cobrar ${pesos(cob.pendiente)} de las ventas del mes.`
    })
  }

  // Ventas viejas sin cobrar (más de 30 días)
  const viejas = d.ventasPeriodo.filter(
    (v) => v.estado_pago !== 'Cancelado' && n(v.base_monto) - n(v.monto_pagado) > 0.5 && diasEntre(v.fecha_venta, d.hoy) > 30
  )
  if (viejas.length > 0) {
    const deuda = viejas.reduce((s, v) => s + (n(v.base_monto) - n(v.monto_pagado)), 0)
    out.push({
      id: 'viejas',
      tono: 'warn',
      titulo: `${viejas.length} venta${viejas.length > 1 ? 's' : ''} con más de 30 días sin cobrar`,
      detalle: `Suman ${pesos(deuda)} pendientes${d.momento === 'cobro' ? ' y frenan esas comisiones' : ''}.`
    })
  }

  // Liquidaciones esperando
  const borradores = d.liquidacionesSinPagar.filter((l) => l.estado === 'borrador')
  const aprobadas = d.liquidacionesSinPagar.filter((l) => l.estado === 'aprobada')
  if (aprobadas.length > 0) {
    out.push({
      id: 'aprobadas',
      tono: 'warn',
      titulo: `${aprobadas.length} liquidación${aprobadas.length > 1 ? 'es' : ''} aprobada${aprobadas.length > 1 ? 's' : ''} sin pagar`,
      detalle: `Total ${pesos(aprobadas.reduce((s, l) => s + n(l.total), 0))}. Marcalas como pagadas cuando se transfiera.`
    })
  }
  if (borradores.length > 0) {
    out.push({
      id: 'borradores',
      tono: 'info',
      titulo: `${borradores.length} liquidación${borradores.length > 1 ? 'es' : ''} en borrador`,
      detalle: `Revisalas y aprobalas: ${pesos(borradores.reduce((s, l) => s + n(l.total), 0))}.`
    })
  } else if (d.pendienteTotal > 0 && aprobadas.length === 0) {
    out.push({
      id: 'sin-liquidar',
      tono: 'info',
      titulo: `${pesos(d.pendienteTotal)} de comisiones sin liquidar`,
      detalle: 'Generá la liquidación del mes para pasarlas a pago.'
    })
  }

  // Proyección y comparación
  const proy = proyeccionMes(d.baseMes, d.mes, d.hoy)
  if (proy && proy.avance < 0.97 && d.baseMes > 0) {
    const vsAnterior = variacionPct(proy.proyectado, d.baseMesAnterior)
    out.push({
      id: 'proyeccion',
      tono: vsAnterior !== null && vsAnterior < -10 ? 'warn' : 'info',
      titulo: `Al ritmo actual el mes cerraría en ${pesos(proy.proyectado)}`,
      detalle:
        vsAnterior === null
          ? `Lleva ${pct(proy.avance * 100)} del mes transcurrido.`
          : `${vsAnterior >= 0 ? 'Arriba' : 'Abajo'} ${pct(vsAnterior)} del mes anterior (${pesos(d.baseMesAnterior)}).`
    })
  } else if (!proy) {
    const v = variacionPct(d.baseMes, d.baseMesAnterior)
    if (v !== null && Math.abs(v) >= 10) {
      out.push({
        id: 'variacion',
        tono: v >= 0 ? 'ok' : 'warn',
        titulo: `Ventas ${v >= 0 ? 'arriba' : 'abajo'} ${pct(v)} contra el mes anterior`,
        detalle: `${pesos(d.baseMes)} contra ${pesos(d.baseMesAnterior)}.`
      })
    }
  }

  // Concentración en un vendedor
  const top = d.ranking[0]
  if (top && d.ranking.length > 1 && top.participacion >= 60) {
    out.push({
      id: 'concentracion',
      tono: 'info',
      titulo: `${top.nombre_vendedor} concentra el ${pct(top.participacion)} de las ventas`,
      detalle: 'Mucha dependencia de una sola persona: conviene repartir clientes o reforzar al resto.'
    })
  }

  // Destacados
  const subio = d.ranking
    .filter((r) => r.variacion !== null && r.variacion >= 20 && n(r.base_monto) >= totalMes * 0.1)
    .sort((a, b) => (b.variacion ?? 0) - (a.variacion ?? 0))[0]
  if (subio) {
    out.push({
      id: `subio-${subio.id_vendedor}`,
      tono: 'ok',
      titulo: `${subio.nombre_vendedor} vendió ${pct(subio.variacion ?? 0)} más que el mes pasado`,
      detalle: `${pesos(n(subio.base_monto))} en ${subio.ventas} ventas.`
    })
  }
  const bajo = d.ranking
    .filter((r) => r.variacion !== null && r.variacion <= -30)
    .sort((a, b) => (a.variacion ?? 0) - (b.variacion ?? 0))[0]
  if (bajo) {
    out.push({
      id: `bajo-${bajo.id_vendedor}`,
      tono: 'warn',
      titulo: `${bajo.nombre_vendedor} bajó ${pct(bajo.variacion ?? 0)} contra el mes pasado`,
      detalle: `${pesos(n(bajo.base_monto))} en ${bajo.ventas} ventas.`
    })
  }

  // Ticket más alto (si hay con quién comparar)
  if (d.ranking.length > 1) {
    const ticketGeneral = totalMes / Math.max(d.ranking.reduce((s, r) => s + r.ventas, 0), 1)
    const mejorTicket = [...d.ranking].filter((r) => r.ventas >= 3).sort((a, b) => b.ticket - a.ticket)[0]
    if (mejorTicket && mejorTicket.ticket >= ticketGeneral * 1.3) {
      out.push({
        id: 'ticket',
        tono: 'ok',
        titulo: `${mejorTicket.nombre_vendedor} tiene el ticket más alto`,
        detalle: `${pesos(mejorTicket.ticket)} por venta, contra ${pesos(ticketGeneral)} de promedio.`
      })
    }
  }

  const orden: Record<Tono, number> = { danger: 0, warn: 1, info: 2, ok: 3 }
  return out.sort((a, b) => orden[a.tono] - orden[b.tono])
}

/**
 * Estimación de la comisión del mes con una regla todavía no guardada (vista previa).
 * "Al cobrar" usa lo pagado (tope: el precio); "al registrar" usa el precio. "Al facturar"
 * depende de las facturas autorizadas, que no están acá: devuelve null y se calcula al guardar.
 * `pctPorVendedor` permite probar porcentajes propios sin guardarlos.
 */
export function estimarComisionMes(
  ventasMes: VentaAnalisis[],
  momento: MomentoComision,
  pctPorVendedor: (idVendedor: number | null) => number
): number | null {
  if (momento === 'factura') return null
  let total = 0
  for (const v of ventasMes) {
    if (v.estado_pago === 'Cancelado') continue
    const base = momento === 'cobro' ? Math.min(n(v.monto_pagado), n(v.base_monto)) : n(v.base_monto)
    total += (base * pctPorVendedor(v.id_vendedor)) / 100
  }
  return Math.round(total * 100) / 100
}

/** Cuánto hay que vender para ganar `objetivo` de comisión con `porcentaje`. */
export function ventaNecesaria(objetivo: number, porcentaje: number): number | null {
  if (!(porcentaje > 0) || !(objetivo > 0)) return null
  return objetivo / (porcentaje / 100)
}
