import type { SatisfaccionEntregaKpis } from './satisfaccionEntregaKpis'
import type { SatisfaccionEntregaRow } from './satisfaccionEntregaKpis'

export type PeriodoAnalisisIA = '7d' | '30d' | '90d' | 'todo'

export type OrdenContextoSatisfaccion = {
  id: number
  numero_op: string
  cliente: string | null
  sector: string | null
  estado: string | null
  descripcion: string | null
  fecha_entrega_efectiva: string | null
  entregado_a: string | null
  observaciones_entrega: string | null
  en_reclamo: boolean | null
  operario_asignado: string | null
  sectores: string[] | null
  prioridad: string | null
  complejidad: string | null
}

export type SatisfaccionEntregaAnalisisPayload = {
  generado_en: string
  periodo: PeriodoAnalisisIA
  resumen_encuestas: {
    total_periodo: number
    promedio: number | null
    pct_promotores: number | null
    pct_detractores: number | null
    tasa_respuesta_30d: number | null
  }
  agregados: {
    por_sector: Array<{ sector: string; cantidad: number; promedio: number }>
    por_estado: Array<{ estado: string; cantidad: number; promedio: number }>
    por_nota: Array<{ nota: number; cantidad: number }>
  }
  op_fallas: Array<{
    numero_op: string
    orden_id: number | null
    rating: number
    comentario: string | null
    cliente_encuesta: string | null
    fecha: string
    orden: OrdenContextoSatisfaccion | null
  }>
  op_criticas: Array<{
    numero_op: string
    rating: number
    comentario: string | null
    sector: string | null
    estado: string | null
  }>
  comentarios_texto: string[]
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function filterByPeriodo(rows: SatisfaccionEntregaRow[], periodo: PeriodoAnalisisIA): SatisfaccionEntregaRow[] {
  if (periodo === 'todo') return rows
  const days = periodo === '7d' ? 6 : periodo === '30d' ? 29 : 89
  const since = daysAgo(days)
  return rows.filter((r) => new Date(r.created_at).getTime() >= since.getTime())
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
}

function aggregateByKey(
  items: Array<{ key: string; rating: number }>
): Array<{ key: string; cantidad: number; promedio: number }> {
  const map = new Map<string, number[]>()
  for (const it of items) {
    const k = it.key || 'Sin dato'
    const arr = map.get(k) || []
    arr.push(it.rating)
    map.set(k, arr)
  }
  return Array.from(map.entries())
    .map(([key, ratings]) => ({
      key,
      cantidad: ratings.length,
      promedio: avg(ratings) ?? 0
    }))
    .sort((a, b) => a.promedio - b.promedio || b.cantidad - a.cantidad)
}

export function buildSatisfaccionEntregaAnalisisPayload(
  allRows: SatisfaccionEntregaRow[],
  ordenes: OrdenContextoSatisfaccion[],
  periodo: PeriodoAnalisisIA,
  kpis: SatisfaccionEntregaKpis
): SatisfaccionEntregaAnalisisPayload {
  const rows = filterByPeriodo(allRows, periodo)
  const opMap = new Map(ordenes.map((o) => [String(o.numero_op).trim(), o]))

  const fallas = rows.filter((r) => r.rating <= 3)
  const criticas = rows.filter((r) => r.rating <= 2)

  const ratings = rows.map((r) => r.rating)
  const promotores = rows.filter((r) => r.rating >= 4).length
  const detractores = rows.filter((r) => r.rating <= 2).length

  const withOrden = rows.map((r) => {
    const orden = opMap.get(String(r.numero_op).trim()) ?? null
    return { row: r, orden, sector: orden?.sector || orden?.sectores?.[0] || 'Sin sector' }
  })

  const porSector = aggregateByKey(withOrden.map((x) => ({ key: x.sector, rating: x.row.rating }))).map(
    (x) => ({ sector: x.key, cantidad: x.cantidad, promedio: x.promedio })
  )

  const porEstado = aggregateByKey(
    withOrden.map((x) => ({ key: x.orden?.estado || 'Sin estado', rating: x.row.rating }))
  ).map((x) => ({ estado: x.key, cantidad: x.cantidad, promedio: x.promedio }))

  const porNota = [1, 2, 3, 4, 5].map((nota) => ({
    nota,
    cantidad: rows.filter((r) => r.rating === nota).length
  }))

  const op_fallas = fallas
    .sort((a, b) => a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 35)
    .map((r) => ({
      numero_op: r.numero_op,
      orden_id: r.orden_id,
      rating: r.rating,
      comentario: r.comentario,
      cliente_encuesta: r.cliente_nombre,
      fecha: r.created_at,
      orden: opMap.get(String(r.numero_op).trim()) ?? null
    }))

  const op_criticas = criticas.slice(0, 15).map((r) => {
    const orden = opMap.get(String(r.numero_op).trim())
    return {
      numero_op: r.numero_op,
      rating: r.rating,
      comentario: r.comentario,
      sector: orden?.sector ?? null,
      estado: orden?.estado ?? null
    }
  })

  const comentarios_texto = rows
    .filter((r) => r.comentario && r.comentario.trim())
    .map((r) => `OP ${r.numero_op} (${r.rating}/5): ${r.comentario!.trim()}`)
    .slice(0, 25)

  return {
    generado_en: new Date().toISOString(),
    periodo,
    resumen_encuestas: {
      total_periodo: rows.length,
      promedio: avg(ratings),
      pct_promotores: rows.length ? Math.round((promotores / rows.length) * 1000) / 10 : null,
      pct_detractores: rows.length ? Math.round((detractores / rows.length) * 1000) / 10 : null,
      tasa_respuesta_30d: kpis.tasaRespuesta30d
    },
    agregados: { por_sector: porSector, por_estado: porEstado, por_nota: porNota },
    op_fallas,
    op_criticas,
    comentarios_texto
  }
}

export function numeroOpsParaAnalisis(rows: SatisfaccionEntregaRow[], periodo: PeriodoAnalisisIA): string[] {
  const filtered = filterByPeriodo(rows, periodo)
  const ops = new Set<string>()
  for (const r of filtered) {
    if (r.rating <= 3) ops.add(String(r.numero_op).trim())
  }
  if (ops.size < 8) {
    for (const r of filtered) {
      ops.add(String(r.numero_op).trim())
    }
  }
  return Array.from(ops).filter(Boolean).slice(0, 45)
}
