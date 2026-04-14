/**
 * Núcleo compartido para leer XLSX/CSV (misma idea que ConciliacionBancariaPage).
 */
import * as XLSX from 'xlsx'

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function pickFirstKey(obj: Record<string, any>, keys: string[]): any {
  const lowerMap = new Map<string, string>()
  for (const k of Object.keys(obj)) lowerMap.set(k.toLowerCase().trim(), k)
  for (const key of keys) {
    const real = lowerMap.get(key.toLowerCase())
    if (real) return obj[real]
  }
  return undefined
}

export function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value).trim()
  if (!s) return null
  const normalized = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function safeParseDateToISO(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF?.parse_date_code?.(value)
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 12, 0, 0))
      return Number.isNaN(d.getTime()) ? null : d.toISOString()
    }
    const ms = (value - 25569) * 86400 * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00`).toISOString()
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function sheetToObjectsWithHeaderDetection(ws: XLSX.WorkSheet, maxScanRows = 40): Record<string, any>[] {
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' }) as any[][]
  if (!aoa.length) return []

  const headerKeywords = [
    'fecha',
    'importe',
    'debe',
    'haber',
    'credito',
    'crédito',
    'debito',
    'débito',
    'tipo',
    'numero',
    'número',
    'movimiento',
    'detalle',
    'concepto',
    'saldo',
    'referencia',
    'tercero'
  ]

  let bestIdx = 0
  let bestScore = -1
  const scan = Math.min(maxScanRows, aoa.length)
  for (let i = 0; i < scan; i++) {
    const row = aoa[i] || []
    const flat = stripAccents(row.map((c) => String(c ?? '').toLowerCase()).join(' '))
    let score = 0
    for (const kw of headerKeywords) {
      if (flat.includes(stripAccents(kw))) score += 1
    }
    if (flat.includes('fecha') && (flat.includes('importe') || flat.includes('debe') || flat.includes('haber'))) {
      score += 5
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  if (bestScore < 4) {
    return XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' })
  }

  const headerRow = aoa[bestIdx] || []
  const headers = headerRow.map((h, j) => {
    const name = String(h ?? '').trim()
    return name || `__EMPTY_${j}`
  })

  const out: Record<string, any>[] = []
  for (let r = bestIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || []
    if (row.every((c) => c === '' || c == null)) continue
    const obj: Record<string, any> = {}
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c]
      if (key.startsWith('__EMPTY_') && row[c] === '') continue
      obj[key] = row[c]
    }
    out.push(obj)
  }
  return out
}

export function listWorkbookSheetNames(ab: ArrayBuffer): string[] {
  const wb = XLSX.read(ab, { type: 'array' })
  return wb.SheetNames || []
}

export function readSheetRows(ab: ArrayBuffer, sheetName: string): Record<string, any>[] {
  const wb = XLSX.read(ab, { type: 'array' })
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  return sheetToObjectsWithHeaderDetection(ws)
}
