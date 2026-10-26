/** Feriados nacionales (Ley 27.399) y el 13 de junio de San Juan. Sin puentes turísticos. */

const INAMOVIBLES: { md: string; nombre: string }[] = [
  { md: '01-01', nombre: 'Año Nuevo' },
  { md: '03-24', nombre: 'Día de la Memoria' },
  { md: '04-02', nombre: 'Día del Veterano y de los Caídos en Malvinas' },
  { md: '05-01', nombre: 'Día del Trabajador' },
  { md: '05-25', nombre: 'Día de la Revolución de Mayo' },
  { md: '06-13', nombre: 'Fundación de San Juan' },
  { md: '06-20', nombre: 'Paso a la Inmortalidad del General Belgrano' },
  { md: '07-09', nombre: 'Día de la Independencia' },
  { md: '12-08', nombre: 'Inmaculada Concepción' },
  { md: '12-25', nombre: 'Navidad' }
]

const TRASLADABLES: { md: string; nombre: string }[] = [
  { md: '06-17', nombre: 'Paso a la Inmortalidad del General Güemes' },
  { md: '08-17', nombre: 'Paso a la Inmortalidad del General San Martín' },
  { md: '10-12', nombre: 'Día del Respeto a la Diversidad Cultural' },
  { md: '11-20', nombre: 'Día de la Soberanía Nacional' }
]

const EXTRA_POR_ANIO: Record<number, { fecha: string; nombre: string }[]> = {
  2026: [{ fecha: '2026-11-09', nombre: 'Visita del Papa León XIV' }]
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function pascua(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function sumarDias(year: number, month: number, day: number, delta: number): string {
  const dt = new Date(year, month - 1, day)
  dt.setDate(dt.getDate() + delta)
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

/** Martes y miércoles van al lunes anterior; jueves, viernes y domingo al lunes siguiente. */
function trasladar(year: number, md: string): string {
  const [month, day] = md.split('-').map(Number)
  const dt = new Date(year, month - 1, day)
  const dow = dt.getDay()
  if (dow === 2) dt.setDate(dt.getDate() - 1)
  else if (dow === 3) dt.setDate(dt.getDate() - 2)
  else if (dow === 4) dt.setDate(dt.getDate() + 4)
  else if (dow === 5) dt.setDate(dt.getDate() + 3)
  else if (dow === 0) dt.setDate(dt.getDate() + 1)
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

const cache = new Map<number, Map<string, string>>()

function calendario(year: number): Map<string, string> {
  const prev = cache.get(year)
  if (prev) return prev
  const map = new Map<string, string>()
  for (const f of INAMOVIBLES) map.set(`${year}-${f.md}`, f.nombre)
  for (const f of TRASLADABLES) map.set(trasladar(year, f.md), f.nombre)
  const p = pascua(year)
  map.set(sumarDias(year, p.month, p.day, -2), 'Viernes Santo')
  map.set(sumarDias(year, p.month, p.day, -48), 'Carnaval')
  map.set(sumarDias(year, p.month, p.day, -47), 'Carnaval')
  for (const extra of EXTRA_POR_ANIO[year] ?? []) map.set(extra.fecha, extra.nombre)
  cache.set(year, map)
  return map
}

export function nombreFeriado(fecha: string): string | null {
  const year = Number(fecha.slice(0, 4))
  if (!year) return null
  return calendario(year).get(fecha.slice(0, 10)) ?? null
}

export function esFeriado(fecha: string): boolean {
  return nombreFeriado(fecha) != null
}
