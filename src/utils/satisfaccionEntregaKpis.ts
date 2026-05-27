export type SatisfaccionEntregaRow = {
  id: number
  numero_op: string
  orden_id: number | null
  cliente_nombre: string | null
  rating: number
  comentario: string | null
  created_at: string
}

export type FirmasEntregaStats = {
  firmas7d: number
  firmas30d: number
  entregas7d: number
  entregas30d: number
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

function isOnOrAfter(iso: string, since: Date): boolean {
  return new Date(iso).getTime() >= since.getTime()
}

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

function avgRating(rows: SatisfaccionEntregaRow[]): number | null {
  if (rows.length === 0) return null
  return rows.reduce((s, r) => s + r.rating, 0) / rows.length
}

function pct(part: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((part / total) * 1000) / 10
}

export type SatisfaccionEntregaKpis = {
  total: number
  hoy: number
  semana7d: number
  mes30d: number
  promedioGlobal: number | null
  promedio7d: number | null
  promedio30d: number | null
  pctPromotores: number | null
  pctDetractores: number | null
  pctConComentario: number | null
  tasaRespuesta7d: number | null
  tasaRespuesta30d: number | null
  firmas7d: number
  firmas30d: number
  entregas7d: number
  entregas30d: number
  criticasSemana: SatisfaccionEntregaRow[]
  bajasSinComentario: SatisfaccionEntregaRow[]
  tendencia7d: Array<{ dia: string; label: string; promedio: number | null; cantidad: number }>
}

export function computeSatisfaccionEntregaKpis(
  rows: SatisfaccionEntregaRow[],
  stats: FirmasEntregaStats
): SatisfaccionEntregaKpis {
  const since7 = daysAgo(6)
  const since30 = daysAgo(29)

  const rows7 = rows.filter((r) => isOnOrAfter(r.created_at, since7))
  const rows30 = rows.filter((r) => isOnOrAfter(r.created_at, since30))

  const promotores = rows.filter((r) => r.rating >= 4).length
  const detractores = rows.filter((r) => r.rating <= 2).length
  const conComentario = rows.filter((r) => r.comentario && r.comentario.trim().length > 0).length

  const encuestas7d = rows7.length
  const encuestas30d = rows30.length

  const denominador7d = Math.max(stats.firmas7d, stats.entregas7d, encuestas7d)
  const denominador30d = Math.max(stats.firmas30d, stats.entregas30d, encuestas30d)

  const tendencia7d: SatisfaccionEntregaKpis['tendencia7d'] = []
  for (let i = 6; i >= 0; i--) {
    const start = daysAgo(i)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    const dayRows = rows.filter((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= start.getTime() && t <= end.getTime()
    })
    const dia = start.toISOString().slice(0, 10)
    tendencia7d.push({
      dia,
      label: start.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
      promedio: avgRating(dayRows),
      cantidad: dayRows.length
    })
  }

  const criticasSemana = [...rows7]
    .filter((r) => r.rating <= 2)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const bajasSinComentario = [...rows]
    .filter((r) => r.rating <= 3 && (!r.comentario || !r.comentario.trim()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  return {
    total: rows.length,
    hoy: rows.filter((r) => isToday(r.created_at)).length,
    semana7d: encuestas7d,
    mes30d: encuestas30d,
    promedioGlobal: avgRating(rows),
    promedio7d: avgRating(rows7),
    promedio30d: avgRating(rows30),
    pctPromotores: pct(promotores, rows.length),
    pctDetractores: pct(detractores, rows.length),
    pctConComentario: pct(conComentario, rows.length),
    tasaRespuesta7d: pct(encuestas7d, denominador7d),
    tasaRespuesta30d: pct(encuestas30d, denominador30d),
    firmas7d: stats.firmas7d,
    firmas30d: stats.firmas30d,
    entregas7d: stats.entregas7d,
    entregas30d: stats.entregas30d,
    criticasSemana,
    bajasSinComentario,
    tendencia7d
  }
}

export function formatPromedio(n: number | null, digits = 1): string {
  if (n == null) return '—'
  return n.toFixed(digits)
}

export function formatPct(n: number | null): string {
  if (n == null) return '—'
  return `${n}%`
}
