export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y || new Date().getFullYear(), month: m || 1 }
}

export function yearMonthFromDate(fecha: string): string {
  return fecha.slice(0, 7)
}

export function daysInYearMonth(ym: string): number {
  const { year, month } = parseYearMonth(ym)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Mantiene el día del mes al cambiar de mes (31 → 28/30 si hace falta). */
export function clampFechaToYearMonth(fecha: string, ym: string): string {
  const raw = Number(fecha.slice(8, 10))
  const day = Number.isFinite(raw) && raw > 0 ? raw : 1
  const last = daysInYearMonth(ym)
  const d = Math.min(day, last)
  return `${ym}-${String(d).padStart(2, '0')}`
}

/** Celdas del mes (null = padding). Semana empieza lunes. Siempre 6 filas para que no salte el layout. */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const padStart = (firstDow + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < padStart; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    cells.push(`${year}-${mm}-${dd}`)
  }
  while (cells.length < 42) cells.push(null)
  return cells
}

const MESES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]

export function labelMesAnio(year: number, month: number): string {
  return `${MESES_ES[month - 1] ?? ''} ${year}`
}

export function shiftYearMonth(ym: string, delta: number): string {
  const { year, month } = parseYearMonth(ym)
  const d = new Date(Date.UTC(year, month - 1 + delta, 1))
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
