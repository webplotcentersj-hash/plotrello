import * as XLSX from 'xlsx'
import { inferirAlicuotaIva } from './gastoIvaLibro'

export type CompraExcelRow = {
  fecha: string
  tipo_comprobante: string
  letra: string | null
  punto_venta: number
  numero: number
  numero_hasta: number | null
  cae: string | null
  proveedor_cuit: string | null
  proveedor: string
  moneda: string
  neto_gravado: number
  no_gravado: number
  exento: number
  iva: number
  total: number
  iva_porcentaje: number
  esNc: boolean
  numero_comprobante: string
}

export type CompraExcelParseResult = {
  rows: CompraExcelRow[]
  errors: string[]
  skipped: number
  titulo: string | null
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

export function labelMesYm(ym: string): string {
  const [y, m] = ym.split('-')
  const mi = Number(m) - 1
  if (!y || mi < 0 || mi > 11) return ym
  return `${MESES_ES[mi]} ${y}`
}

export function gastoImportKey(r: {
  fecha: string
  proveedor_cuit?: string | null
  punto_venta?: number | null
  numero?: number | null
  numero_comprobante?: string | null
  letra?: string | null
}): string {
  const nroRaw =
    r.numero != null && r.numero > 0
      ? String(r.numero)
      : String(r.numero_comprobante || '').replace(/\D/g, '').slice(-8)
  const nro = nroRaw.replace(/^0+/, '') || '0'
  const pv = String(r.punto_venta || '')
  return [
    String(r.fecha || '').slice(0, 10),
    String(r.proveedor_cuit || '').replace(/\D/g, ''),
    pv,
    nro,
    String(r.letra || '').toUpperCase()
  ].join('|')
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normHeader(h: unknown): string {
  return stripAccents(String(h ?? ''))
    .toLowerCase()
    .replace(/[º°]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseArNumber(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim()
  if (!s || s === '-' || s === '$') return 0
  const neg = s.startsWith('-') || /^\(.*\)$/.test(s)
  const cleaned = s.replace(/[()\s$]/g, '')
  let n: number
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    n =
      lastComma > lastDot
        ? Number(cleaned.replace(/\./g, '').replace(',', '.'))
        : Number(cleaned.replace(/,/g, ''))
  } else if (cleaned.includes(',')) {
    n = Number(cleaned.replace(/\./g, '').replace(',', '.'))
  } else {
    n = Number(cleaned)
  }
  if (!Number.isFinite(n)) return 0
  return neg && n > 0 ? -n : n
}

export function excelFechaToIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const parsed = XLSX.SSF?.parse_date_code?.(v)
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (dm) {
    const y = dm[3].length === 2 ? `20${dm[3]}` : dm[3]
    return `${y}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
  }
  return null
}

export function parseTipoComprobanteAfip(raw: unknown): {
  tipo: string
  letra: string | null
  codigo: number | null
  esNc: boolean
} {
  const s = String(raw || '').trim()
  const codigo = (() => {
    const m = s.match(/^(\d+)\s*[-\s]/)
    return m ? Number(m[1]) : null
  })()
  const letraM = s.match(/\b([A-EM])\b\s*$/i) || s.match(/\b([A-EM])\b/i)
  const letra = letraM ? letraM[1].toUpperCase() : null
  const low = stripAccents(s).toLowerCase()
  const esNc = /nota\s*de\s*credito|\bncr?\b/.test(low)
  const esNd = /nota\s*de\s*debito|\bnd\b/.test(low)
  const tipo = esNc ? 'Nota de Crédito' : esNd ? 'Nota de Débito' : /recibo/.test(low) ? 'Recibo' : /ticket|tique/.test(low) ? 'Ticket' : 'Factura'
  return { tipo, letra, codigo, esNc }
}

type ColKey =
  | 'fecha'
  | 'tipo'
  | 'punto_venta'
  | 'numero_desde'
  | 'numero_hasta'
  | 'cae'
  | 'cuit'
  | 'proveedor'
  | 'moneda'
  | 'neto_gravado'
  | 'no_gravado'
  | 'exento'
  | 'iva'
  | 'total'

const HEADER_MAP: Array<{ key: ColKey; match: (h: string) => boolean }> = [
  { key: 'fecha', match: (h) => h === 'fecha' || h.startsWith('fecha') },
  {
    key: 'punto_venta',
    match: (h) => h.includes('punto de venta') || h === 'pv' || h.includes('pto vta') || h === 'punto venta'
  },
  { key: 'numero_desde', match: (h) => h.includes('numero desde') || h === 'nro desde' || h === 'numero' || h === 'nro' },
  { key: 'numero_hasta', match: (h) => h.includes('numero hasta') || h === 'nro hasta' },
  {
    key: 'cae',
    match: (h) => h.includes('cod autoriz') || h === 'cae' || h === 'caea' || h.includes('codigo autoriz')
  },
  {
    key: 'cuit',
    match: (h) =>
      !h.includes('tipo') &&
      (h.includes('nro doc') ||
        h.includes('numero doc') ||
        h === 'cuit' ||
        h.includes('cuit vendedor') ||
        h.includes('cuit emisor') ||
        h.includes('doc vendedor') ||
        h.includes('doc emisor'))
  },
  {
    key: 'proveedor',
    match: (h) =>
      h.includes('denominacion') ||
      h.includes('razon social') ||
      h === 'vendedor' ||
      h === 'emisor' ||
      h === 'proveedor'
  },
  { key: 'moneda', match: (h) => h === 'moneda' },
  {
    key: 'neto_gravado',
    match: (h) => h.includes('neto gravado') || h === 'neto' || h.includes('imp neto gravado')
  },
  {
    key: 'no_gravado',
    match: (h) => h.includes('no gravado') || h.includes('neto no gravado')
  },
  { key: 'exento', match: (h) => h.includes('exent') },
  {
    key: 'iva',
    match: (h) => h === 'iva' || h.startsWith('iva ') || h.includes('credito fiscal')
  },
  { key: 'total', match: (h) => h === 'total' || h.includes('imp total') || h.includes('importe total') },
  { key: 'tipo', match: (h) => h === 'tipo' || h.includes('tipo comprob') || h === 'tipo cbte' }
]

function mapHeaders(headerRow: unknown[]): Partial<Record<ColKey, number>> {
  const map: Partial<Record<ColKey, number>> = {}
  headerRow.forEach((cell, idx) => {
    const h = normHeader(cell)
    if (!h) return
    for (const rule of HEADER_MAP) {
      if (map[rule.key] != null) continue
      if (rule.match(h)) {
        map[rule.key] = idx
        break
      }
    }
  })
  return map
}

function headerScore(row: unknown[]): number {
  const mapped = mapHeaders(row)
  let score = 0
  if (mapped.fecha != null) score += 4
  if (mapped.tipo != null) score += 2
  if (mapped.punto_venta != null) score += 3
  if (mapped.proveedor != null) score += 3
  if (mapped.cuit != null) score += 2
  if (mapped.total != null) score += 3
  if (mapped.iva != null) score += 2
  if (mapped.neto_gravado != null) score += 2
  return score
}

function cell(row: unknown[], idx: number | undefined): unknown {
  if (idx == null) return ''
  return row[idx]
}

export function parseComprobantesComprasAoa(aoa: unknown[][]): CompraExcelParseResult {
  const errors: string[] = []
  const rows: CompraExcelRow[] = []
  let skipped = 0
  let titulo: string | null = null

  if (!aoa.length) return { rows, errors: ['La hoja está vacía.'], skipped, titulo }

  const first = String(aoa[0]?.[0] ?? '').trim()
  if (/comprobantes de compras/i.test(first) || /mis comprobantes/i.test(first)) titulo = first

  let headerIdx = -1
  let best = 8
  const scan = Math.min(25, aoa.length)
  for (let i = 0; i < scan; i++) {
    const s = headerScore(aoa[i] || [])
    if (s > best) {
      best = s
      headerIdx = i
    }
  }
  if (headerIdx < 0) {
    return { rows, errors: ['No encontré el encabezado (Fecha, Tipo, Punto de Venta, Denominación, Neto, IVA, Total).'], skipped, titulo }
  }

  const cols = mapHeaders(aoa[headerIdx] || [])
  if (cols.fecha == null || (cols.proveedor == null && cols.cuit == null && cols.total == null)) {
    return { rows, errors: ['Faltan columnas de Fecha / proveedor / total.'], skipped, titulo }
  }

  const seen = new Set<string>()
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || []
    if (row.every((c) => c === '' || c == null)) continue
    const fecha = excelFechaToIso(cell(row, cols.fecha))
    if (!fecha) {
      skipped++
      continue
    }
    const tipoRaw = cell(row, cols.tipo)
    const parsedTipo = parseTipoComprobanteAfip(tipoRaw)
    const pv = Math.round(Math.abs(parseArNumber(cell(row, cols.punto_venta))))
    const numero = Math.round(Math.abs(parseArNumber(cell(row, cols.numero_desde))))
    const numeroHasta = cols.numero_hasta != null ? Math.round(Math.abs(parseArNumber(cell(row, cols.numero_hasta)))) : numero
    const total = parseArNumber(cell(row, cols.total))
    const iva = parseArNumber(cell(row, cols.iva))
    const netoGravado = parseArNumber(cell(row, cols.neto_gravado))
    const noGravado = parseArNumber(cell(row, cols.no_gravado))
    const exento = parseArNumber(cell(row, cols.exento))
    const proveedor = String(cell(row, cols.proveedor) ?? '').trim()
    const cuit = String(cell(row, cols.cuit) ?? '').replace(/\D/g, '') || null
    if (!proveedor && !cuit && Math.abs(total) < 0.01) {
      skipped++
      continue
    }
    if (Math.abs(total) < 0.01 && Math.abs(iva) < 0.01 && Math.abs(netoGravado) < 0.01) {
      skipped++
      continue
    }
    const nro = numero > 0 ? numero : numeroHasta
    const numero_comprobante = `${String(pv || 0).padStart(4, '0')}-${String(nro || 0).padStart(8, '0')}`
    const neto = netoGravado + noGravado + exento
    const alic = inferirAlicuotaIva(neto || Math.max(0, Math.abs(total) - Math.abs(iva)), iva)
    const item: CompraExcelRow = {
      fecha,
      tipo_comprobante: parsedTipo.tipo,
      letra: parsedTipo.letra,
      punto_venta: pv,
      numero: nro,
      numero_hasta: numeroHasta || null,
      cae: String(cell(row, cols.cae) ?? '').trim() || null,
      proveedor_cuit: cuit,
      proveedor: proveedor || 'Proveedor',
      moneda: String(cell(row, cols.moneda) ?? '').trim() || 'ARS',
      neto_gravado: netoGravado,
      no_gravado: noGravado,
      exento,
      iva,
      total,
      iva_porcentaje: alic,
      esNc: parsedTipo.esNc,
      numero_comprobante
    }
    const key = gastoImportKey(item)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    rows.push(item)
  }

  if (!rows.length && !errors.length) {
    errors.push('No hay filas de comprobantes para importar.')
  }
  return { rows, errors, skipped, titulo }
}

export function parseComprobantesComprasBuffer(buffer: ArrayBuffer): CompraExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) return { rows: [], errors: ['El archivo no tiene hojas.'], skipped: 0, titulo: null }
  const ws = wb.Sheets[name]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false }) as unknown[][]
  return parseComprobantesComprasAoa(aoa)
}

export function payloadGastoDesdeExcel(r: CompraExcelRow): Record<string, unknown> {
  const sign = r.esNc ? -1 : 1
  const netoBase = r.neto_gravado + r.no_gravado + r.exento
  const neto = (netoBase > 0.009 ? netoBase : Math.max(0, Math.abs(r.total) - Math.abs(r.iva))) * sign
  const iva = r.iva * sign
  const total = r.total * sign
  return {
    fecha_gasto: r.fecha,
    proveedor: r.proveedor || null,
    proveedor_cuit: r.proveedor_cuit,
    categoria: 'Compras AFIP',
    descripcion: `${r.tipo_comprobante}${r.letra ? ` ${r.letra}` : ''} ${r.numero_comprobante}`.trim(),
    total,
    iva,
    neto,
    iva_porcentaje: r.iva_porcentaje || null,
    moneda: r.moneda === '$' || !r.moneda ? 'ARS' : r.moneda,
    metodo_pago: null,
    tipo_comprobante: r.tipo_comprobante,
    letra: r.letra,
    punto_venta: r.punto_venta || null,
    numero_comprobante: r.numero_comprobante,
    cae: r.cae,
    observaciones: r.esNc ? 'Importado Excel AFIP · Nota de crédito' : 'Importado Excel AFIP · Comprobantes de Compras',
    ticket_url: null,
    ticket_raw: r as unknown as Record<string, unknown>,
    origen: 'excel_afip'
  }
}
