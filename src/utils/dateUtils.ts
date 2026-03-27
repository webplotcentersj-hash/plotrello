/**
 * Utilidades para manejo de fechas y horas en zona horaria de Argentina
 * Zona horaria: America/Argentina/Buenos_Aires (UTC-3)
 */

/**
 * Obtiene la fecha actual en zona horaria de Argentina
 */
export function getArgentinaDate(): Date {
  const now = new Date()
  // Convertir a string en formato ISO con zona horaria de Argentina
  const argentinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  return argentinaTime
}

/**
 * Obtiene la fecha actual como string en formato YYYY-MM-DD en zona horaria de Argentina
 */
export function getArgentinaDateString(): string {
  const date = getArgentinaDate()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formatea cualquier Date a YYYY-MM-DD en zona horaria Argentina.
 * (Evita corrimientos por UTC al editar/mostrar fechas)
 */
export function formatArgentinaDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

/**
 * Formatea cualquier Date a HH:mm en zona horaria Argentina.
 */
export function formatArgentinaTimeOnly(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

/**
 * Dado un ISO/timestamptz, devuelve la fecha YYYY-MM-DD en Argentina.
 * Si recibe YYYY-MM-DD, lo devuelve tal cual.
 */
export function isoToArgentinaDateKey(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  // Si viene sin zona (ej: "2026-01-29 10:00:00" o "2026-01-29T10:00:00"),
  // asumir horario Argentina para evitar corrimientos al parsear.
  const normalized =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
      ? value.replace(' ', 'T') + '-03:00'
      : value
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ''
  return formatArgentinaDateOnly(d)
}

/**
 * Fecha de calendario para legajo (alta, nacimiento): sin corrimiento por UTC.
 * Postgres suele devolver `2026-03-25` o `2026-03-25T00:00:00+00:00`; si usamos
 * isoToArgentinaDateKey sobre medianoche UTC, en Argentina puede quedar el día anterior
 * y no coincide “hoy” con el aniversario/cumple.
 */
export function legajoCalendarDateKey(value: string | undefined | null): string {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  return isoToArgentinaDateKey(s)
}

/**
 * Dado un ISO/timestamptz, devuelve la hora HH:mm en Argentina.
 */
export function isoToArgentinaTime(value: string): string {
  if (!value) return ''
  const normalized =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
      ? value.replace(' ', 'T') + '-03:00'
      : value
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ''
  return formatArgentinaTimeOnly(d)
}

/**
 * Obtiene la hora actual en zona horaria de Argentina
 */
export function getArgentinaTime(): { hours: number; minutes: number; seconds: number } {
  const date = getArgentinaDate()
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds()
  }
}

/**
 * Formatea una fecha a string en formato argentino (DD/MM/YYYY por defecto)
 * @param date Fecha a formatear
 * @param formatStr Formato opcional (por defecto 'dd/MM/yyyy')
 */
export function formatArgentinaDate(date: Date | string, formatStr: string = 'dd/MM/yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Si no se especifica formato o es el formato por defecto, usar toLocaleDateString
  if (formatStr === 'dd/MM/yyyy' || !formatStr) {
    return d.toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }
  
  // Para otros formatos, usar una implementación simple
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return formatStr
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', String(year))
    .replace('HH', hours)
    .replace('mm', minutes)
}

/**
 * Formatea una hora a string en formato argentino (HH:MM)
 */
export function formatArgentinaTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formatea una fecha y hora a string en formato argentino
 */
export function formatArgentinaDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Convierte una fecha string a Date considerando zona horaria de Argentina
 */
export function parseArgentinaDate(dateString: string): Date {
  // Si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00 en Argentina
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Crear fecha en UTC pero interpretada como Argentina
    const [year, month, day] = dateString.split('-').map(Number)
    // Crear fecha en zona horaria local pero ajustada para Argentina
    const date = new Date(year, month - 1, day)
    return date
  }
  return new Date(dateString)
}

/**
 * Verifica si la hora actual en Argentina es antes de una hora específica
 * @param targetHour Hora objetivo (0-23)
 * @param targetMinute Minuto objetivo (0-59)
 */
export function isBeforeArgentinaTime(targetHour: number, targetMinute: number = 0): boolean {
  const time = getArgentinaTime()
  if (time.hours < targetHour) return true
  if (time.hours === targetHour && time.minutes <= targetMinute) return true
  return false
}

/**
 * Compara dos fechas ignorando la hora (solo fecha)
 */
export function compareDates(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? parseArgentinaDate(date1) : date1
  const d2 = typeof date2 === 'string' ? parseArgentinaDate(date2) : date2
  
  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)
  
  return d1.getTime() - d2.getTime()
}

/**
 * Verifica si una fecha es hoy en zona horaria de Argentina
 */
export function isTodayArgentina(date: Date | string): boolean {
  const today = getArgentinaDateString()
  const dateStr = typeof date === 'string' 
    ? date.split('T')[0] 
    : getArgentinaDateString()
  return today === dateStr
}

