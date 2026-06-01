import * as XLSX from 'xlsx'
import { getArgentinaDateString } from '../../utils/dateUtils'
import { parseNum } from './format'
import type { CajaMovimiento, CajaRegistro, MovimientoExcelRow } from './types'
import { resolveCajaSlug } from './cajaRepository'

const HEADER_ALIASES: Record<string, keyof MovimientoExcelRow | 'origen_slug' | 'destino_slug'> = {
  fecha: 'fecha',
  date: 'fecha',
  hora: 'hora',
  time: 'hora',
  concepto: 'concepto',
  tipo: 'concepto',
  'tipo movimiento': 'concepto',
  origen: 'origen_slug',
  'caja origen': 'origen_slug',
  destino: 'destino_slug',
  'caja destino': 'destino_slug',
  efectivo: 'efectivo',
  cash: 'efectivo',
  otros: 'otros',
  tarjetas: 'otros',
  cupones: 'otros',
  nro: 'nro_comprobante',
  comprobante: 'nro_comprobante',
  'nº comprobante': 'nro_comprobante',
  observacion: 'observacion',
  observaciones: 'observacion',
  notas: 'observacion',
  usuario: 'usuario_nombre'
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function excelDateToIso(v: unknown): string {
  if (v == null || v === '') return getArgentinaDateString()
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) {
      const y = d.y
      const m = String(d.m).padStart(2, '0')
      const day = String(d.d).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (dm) {
    const y = dm[3].length === 2 ? `20${dm[3]}` : dm[3]
    return `${y}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
  }
  return getArgentinaDateString()
}

export type ExcelParseResult = {
  rows: Omit<CajaMovimiento, 'id' | 'created_at'>[]
  errors: string[]
  skipped: number
}

export function parseMovimientosWorkbook(
  buffer: ArrayBuffer,
  cajas: CajaRegistro[],
  defaultUsuario: string
): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { rows: [], errors: ['El archivo no tiene hojas.'], skipped: 0 }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  if (!raw.length) return { rows: [], errors: ['La hoja está vacía.'], skipped: 0 }

  const errors: string[] = []
  const rows: Omit<CajaMovimiento, 'id' | 'created_at'>[] = []
  let skipped = 0

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i]
    const mapped: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(line)) {
      const alias = HEADER_ALIASES[normalizeHeader(key)]
      if (alias) mapped[alias] = val
    }

    const fecha = excelDateToIso(mapped.fecha)
    const concepto = String(mapped.concepto || 'Otro').trim() || 'Otro'
    const origenNombre = String(mapped.origen_slug || '').trim()
    const destinoNombre = String(mapped.destino_slug || '').trim()
    const origen_slug = resolveCajaSlug(origenNombre, cajas)
    const destino_slug = resolveCajaSlug(destinoNombre, cajas)

    if (!origen_slug || !destino_slug) {
      errors.push(`Fila ${i + 2}: origen/destino no reconocido (${origenNombre} → ${destinoNombre}).`)
      skipped++
      continue
    }

    const efectivo = parseNum(mapped.efectivo)
    const otros = parseNum(mapped.otros)
    if (efectivo === 0 && otros === 0) {
      skipped++
      continue
    }

    rows.push({
      fecha,
      hora: mapped.hora ? String(mapped.hora).slice(0, 5) : null,
      concepto,
      origen_slug,
      destino_slug,
      efectivo,
      otros,
      nro_comprobante: mapped.nro_comprobante ? String(mapped.nro_comprobante) : null,
      observacion: mapped.observacion ? String(mapped.observacion) : null,
      usuario_nombre: mapped.usuario_nombre
        ? String(mapped.usuario_nombre)
        : defaultUsuario,
      origen_importacion: 'excel'
    })
  }

  return { rows, errors, skipped }
}

export function downloadMovimientosPlantilla() {
  const headers = [
    'fecha',
    'hora',
    'concepto',
    'origen',
    'destino',
    'efectivo',
    'otros',
    'nro',
    'observacion'
  ]
  const ejemplo = [
    getArgentinaDateString(),
    '14:30',
    'Pase de caja',
    'Caja Noelia',
    'Caja Administración',
    15000,
    0,
    'MEC-0001',
    'Pase turno tarde'
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, ejemplo])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  XLSX.writeFile(wb, 'plantilla-movimientos-caja.xlsx')
}
