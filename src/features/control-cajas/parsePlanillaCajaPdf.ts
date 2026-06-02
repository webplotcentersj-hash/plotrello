import { extractLinesFromPdfArrayBuffer } from '../../utils/pdfTextLines'
import { parseNum } from './format'
import { validarCuadreMediosPago } from './planillaMediosPago'

/** Monto argentino: 2.485.275,55 o 5305,33 */
const AR_AMOUNT = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g

const COMPROBANTE_PREFIX = /^(FA|FB|IV|IPC|EG|MEC)\s+(\S+)\s+(.+)$/i

/** Columnas de cada línea (orden del PDF Plot Center). */
export const PLANILLA_LINEA_COLUMNAS = [
  { key: 'total', label: 'Total' },
  { key: 'cta_cte', label: 'Cta. Cte.' },
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'ch_prop', label: 'Ch. Prop.' },
  { key: 'ch_terc', label: 'Ch. Terc.' },
  { key: 'tarjetas', label: 'Tarjetas' },
  { key: 'docum', label: 'Docum.' },
  { key: 'c_contab', label: 'C. Contab.' },
  { key: 'trans_b', label: 'Trans. B.' },
  { key: 'otros', label: 'Otros' }
] as const

export type PlanillaColumnaKey = (typeof PLANILLA_LINEA_COLUMNAS)[number]['key']

export type PlanillaMontosLinea = Record<PlanillaColumnaKey, number>

export type PlanillaBloqueId =
  | 'ingresos_varios'
  | 'ingresos_ventas'
  | 'ingresos_pagos_clientes'
  | 'egresos_varios'
  | 'egresos_compras'
  | 'egresos_pagos_proveedores'
  | 'movimientos_mec'
  | 'otro'

export type PlanillaLineaConMontos = PlanillaMontosLinea & {
  comprobante: string
  concepto: string
  bloque: PlanillaBloqueId
  tipo_movimiento: 'ingreso' | 'egreso' | 'traspaso'
  categoria: string
  tercero_nombre?: string
  cuadre_valido: boolean
  cuadre_diferencia: number
}

export type PlanillaLineaVenta = PlanillaLineaConMontos
export type PlanillaLineaEgreso = PlanillaLineaConMontos
export type PlanillaLineaMec = PlanillaLineaConMontos & {
  origen_hint: string
  destino_hint: string
}

export type PlanillaCajaTotales = {
  ingresos_total: number
  egresos_total: number
  neto: number
  ingresos_cta_cte: number
  ingresos_efectivo: number
  ingresos_tarjetas: number
  ingresos_trans_b: number
  ingresos_otros: number
  egresos_cta_cte: number
  egresos_efectivo: number
  egresos_tarjetas: number
  egresos_trans_b: number
  egresos_otros: number
  neto_por_columna?: Partial<PlanillaMontosLinea>
}

export type PlanillaCajaParsed = {
  archivo_nombre: string
  empresa: string
  fecha_desde: string
  fecha_hasta: string
  caja_nombre: string
  cantidad_ventas: number
  totales: PlanillaCajaTotales | null
  ingresos_varios: PlanillaLineaConMontos[]
  ventas: PlanillaLineaVenta[]
  ingresos_pagos_clientes: PlanillaLineaConMontos[]
  egresos: PlanillaLineaEgreso[]
  egresos_compras: PlanillaLineaConMontos[]
  egresos_pagos_proveedores: PlanillaLineaConMontos[]
  movimientos_mec: PlanillaLineaMec[]
  lineas_cuadre_invalido: number
  warnings: string[]
}

const EMPTY_MONTOS = (): PlanillaMontosLinea => ({
  total: 0,
  cta_cte: 0,
  efectivo: 0,
  ch_prop: 0,
  ch_terc: 0,
  tarjetas: 0,
  docum: 0,
  c_contab: 0,
  trans_b: 0,
  otros: 0
})

function parseArAmount(raw: string): number {
  return parseNum(raw.trim())
}

function parseAmountsFromTail(tail: string): number[] {
  const matches = tail.match(AR_AMOUNT)
  if (!matches) return []
  return matches.map(parseArAmount)
}

export function mapMontosPlanillaLinea(amounts: number[]): PlanillaMontosLinea {
  const m = EMPTY_MONTOS()
  const slice =
    amounts.length > PLANILLA_LINEA_COLUMNAS.length
      ? amounts.slice(-PLANILLA_LINEA_COLUMNAS.length)
      : amounts
  PLANILLA_LINEA_COLUMNAS.forEach((col, i) => {
    m[col.key] = slice[i] ?? 0
  })
  if (m.total === 0 && slice.length > 0) {
    m.total = slice[0]
  }
  return m
}

function dmYToIso(dmY: string): string {
  const m = dmY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return dmY
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseHeader(text: string): Pick<PlanillaCajaParsed, 'fecha_desde' | 'fecha_hasta' | 'caja_nombre' | 'empresa'> {
  const periodo = text.match(
    /Desde\s+(\d{2}\/\d{2}\/\d{4})\s+hasta\s+(\d{2}\/\d{2}\/\d{4})\s+CAJA\s+([A-ZÁÉÍÓÚÑ0-9\s]+?)(?:\s+Ingresos|\s+EGRESOS|\s+TOTALES|$)/im
  )
  const cajaAlt = text.match(/CAJA\s+(NOELIA|ROSA|ADMIN[A-ZÁÉÍÓÚÑ\s]*)/i)
  return {
    empresa: text.includes('PLOT CENTER') ? 'PLOT CENTER' : 'Plot Lab',
    fecha_desde: periodo ? dmYToIso(periodo[1]) : '',
    fecha_hasta: periodo ? dmYToIso(periodo[2]) : '',
    caja_nombre: periodo ? periodo[3].trim() : cajaAlt ? `CAJA ${cajaAlt[1].trim()}` : ''
  }
}

function detectBloqueFromHeader(line: string): PlanillaBloqueId | null {
  const u = line.toUpperCase()
  if (/INGRESOS\s+VARIOS/.test(u)) return 'ingresos_varios'
  if (/INGRESOS\s+VENTAS/.test(u)) return 'ingresos_ventas'
  if (/INGRESOS\s+PAGOS\s+CLIENTES|PAGOS\s+CLIENTES/.test(u)) return 'ingresos_pagos_clientes'
  if (/EGRESOS\s+COMPRAS/.test(u)) return 'egresos_compras'
  if (/EGRESOS\s+PAGOS\s+PROVEEDORES|PAGOS\s+PROVEEDORES/.test(u)) return 'egresos_pagos_proveedores'
  if (/EGRESOS\s+VARIOS|^EGRESOS\s*$/i.test(u)) return 'egresos_varios'
  if (/MOVIMIENTO\s+ENTRE\s+CAJAS|ENTRE\s+CAJAS/.test(u)) return 'movimientos_mec'
  return null
}

function isJunkLine(line: string): boolean {
  const u = line.toUpperCase()
  if (line.length < 4) return true
  if (/^PLOT\s+CENTER|^LISTADO|^PLANILLA|^PÁGINA|^PAGE\s+\d/i.test(line)) return true
  if (/^TOTAL\s+CTA\.?\s*CTE|^TOTAL\s+EFECTIVO|^CH\.\s+PROPIOS|^TRANS\.\s*B/i.test(line)) return true
  if (/^COMPROBANTE\s+CONCEPTO/i.test(u)) return true
  if (/^INGRESOS\s*-\s*EGRESOS\s*$/i.test(line)) return true
  if (/^TOTALES\s+DE\s+CAJA/i.test(u)) return true
  return false
}

function conceptoSinMontos(rest: string): string {
  return (
    rest
      .replace(AR_AMOUNT, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || ''
  )
}

function categoriaDesdeBloque(bloque: PlanillaBloqueId): string {
  const map: Record<PlanillaBloqueId, string> = {
    ingresos_varios: 'gasto_vario',
    ingresos_ventas: 'venta',
    ingresos_pagos_clientes: 'pago_cliente',
    egresos_varios: 'gasto_vario',
    egresos_compras: 'compra',
    egresos_pagos_proveedores: 'pago_proveedor',
    movimientos_mec: 'movimiento_entre_cajas',
    otro: 'otro'
  }
  return map[bloque] ?? 'otro'
}

function wrapLinea(
  bloque: PlanillaBloqueId,
  comprobante: string,
  concepto: string,
  montos: PlanillaMontosLinea,
  extra?: Partial<PlanillaLineaConMontos>
): PlanillaLineaConMontos {
  const v = validarCuadreMediosPago(montos)
  const tipo_movimiento: PlanillaLineaConMontos['tipo_movimiento'] =
    bloque === 'movimientos_mec' ? 'traspaso' : bloque.startsWith('ingreso') ? 'ingreso' : 'egreso'

  return {
    comprobante,
    concepto,
    bloque,
    tipo_movimiento,
    categoria: categoriaDesdeBloque(bloque),
    cuadre_valido: v.valido,
    cuadre_diferencia: v.diferencia,
    ...montos,
    ...extra
  }
}

function parseLineaComprobante(line: string, bloque: PlanillaBloqueId): PlanillaLineaConMontos | null {
  const m = line.match(COMPROBANTE_PREFIX)
  if (!m) return null
  const prefix = m[1].toUpperCase()
  const num = m[2]
  const rest = m[3]
  const amounts = parseAmountsFromTail(rest)
  if (!amounts.length) return null

  let montos = mapMontosPlanillaLinea(amounts)
  const concepto = conceptoSinMontos(rest) || `${prefix} ${num}`

  if (montos.total === 0) {
    const max = Math.max(...amounts)
    if (max > 0) montos.total = max
  }

  return wrapLinea(bloque, `${prefix} ${num}`, concepto, montos)
}

function parseMecLine(line: string): PlanillaLineaMec | null {
  const base = parseLineaComprobante(line, 'movimientos_mec')
  if (!base) return null
  const paren = base.concepto.match(/\(([^)]+)\)/)
  let origen_hint = ''
  let destino_hint = ''
  if (paren) {
    const parts = paren[1].split(/\s*-\s*/)
    origen_hint = parts[0]?.trim() ?? ''
    destino_hint = parts[1]?.trim() ?? ''
  }
  return { ...base, origen_hint, destino_hint }
}

function bloqueDesdePrefijo(prefix: string, current: PlanillaBloqueId): PlanillaBloqueId {
  const p = prefix.toUpperCase()
  if (p === 'FA' || p === 'FB') return 'ingresos_ventas'
  if (p === 'IV') return 'ingresos_varios'
  if (p === 'IPC') return 'ingresos_pagos_clientes'
  if (p === 'MEC') return 'movimientos_mec'
  if (p === 'EG') return current.startsWith('egreso') ? current : 'egresos_varios'
  return current
}

function parseTotalesDeCaja(lines: string[]): PlanillaCajaTotales | null {
  const idx = lines.findIndex((l) => /TOTALES\s+DE\s+CAJA/i.test(l))
  if (idx < 0) return null

  const chunk = lines.slice(idx, idx + 8)
  const rows: number[][] = []
  for (const line of chunk) {
    const trimmed = line.trim()
    if (/^Ingresos\s*-\s*Egresos/i.test(trimmed)) {
      const nums = parseAmountsFromTail(trimmed.replace(/^Ingresos\s*-\s*Egresos\s*/i, ''))
      if (nums.length >= 6) rows.push(nums)
      continue
    }
    if (/^Ingresos/i.test(trimmed) && !/^Ingresos\s+Varios/i.test(trimmed)) {
      const nums = parseAmountsFromTail(trimmed.replace(/^Ingresos\s*/i, ''))
      if (nums.length >= 6) rows.push(nums)
      continue
    }
    if (/^Egresos/i.test(trimmed) && !/^Egresos\s+Varios/i.test(trimmed)) {
      const nums = parseAmountsFromTail(trimmed.replace(/^Egresos\s*/i, ''))
      if (nums.length >= 6) rows.push(nums)
    }
  }

  if (rows.length < 2) return null

  const ing = mapMontosPlanillaLinea(rows[0])
  const egr = mapMontosPlanillaLinea(rows[1])
  const netoRow = rows[2] ? mapMontosPlanillaLinea(rows[2]) : undefined

  return {
    ingresos_total: ing.total,
    ingresos_cta_cte: ing.cta_cte,
    ingresos_efectivo: ing.efectivo,
    ingresos_tarjetas: ing.tarjetas,
    ingresos_trans_b: ing.trans_b,
    ingresos_otros: ing.otros,
    egresos_total: egr.total,
    egresos_cta_cte: egr.cta_cte,
    egresos_efectivo: egr.efectivo,
    egresos_tarjetas: egr.tarjetas,
    egresos_trans_b: egr.trans_b,
    egresos_otros: egr.otros,
    neto: netoRow?.total ?? ing.total - egr.total,
    neto_por_columna: netoRow
  }
}

/** Si el extractor falló, partir por prefijos de comprobante. */
function splitFallbackLines(text: string): string[] {
  return text
    .split(/(?=\b(?:FA|FB|IV|IPC|EG|MEC)\s+\S+)/i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 8)
}

export function parsePlanillaCajaText(rawText: string, archivoNombre: string): PlanillaCajaParsed {
  const warnings: string[] = []
  const normalized = rawText.replace(/\r\n/g, '\n')
  const header = parseHeader(normalized)

  let physicalLines = normalized.split('\n').map((l) => l.trim()).filter(Boolean)
  if (physicalLines.length <= 3 && normalized.length > 500) {
    physicalLines = splitFallbackLines(normalized)
  }

  const totales = parseTotalesDeCaja(physicalLines)

  const ingresos_varios: PlanillaLineaConMontos[] = []
  const ventas: PlanillaLineaVenta[] = []
  const ingresos_pagos_clientes: PlanillaLineaConMontos[] = []
  const egresos: PlanillaLineaEgreso[] = []
  const egresos_compras: PlanillaLineaConMontos[] = []
  const egresos_pagos_proveedores: PlanillaLineaConMontos[] = []
  const movimientos_mec: PlanillaLineaMec[] = []

  let bloque: PlanillaBloqueId = 'ingresos_ventas'

  for (const trimmed of physicalLines) {
    if (isJunkLine(trimmed)) continue

    const hdr = detectBloqueFromHeader(trimmed)
    if (hdr) {
      bloque = hdr
      continue
    }

    const comp = trimmed.match(COMPROBANTE_PREFIX)
    if (!comp) continue

    const prefix = comp[1].toUpperCase()
    const bl = bloqueDesdePrefijo(prefix, bloque)
    bloque = bl

    if (prefix === 'FA' || prefix === 'FB') {
      const v = parseLineaComprobante(trimmed, 'ingresos_ventas')
      if (v && v.total > 0) ventas.push(v as PlanillaLineaVenta)
    } else if (prefix === 'IV') {
      const v = parseLineaComprobante(trimmed, 'ingresos_varios')
      if (v && v.total > 0) ingresos_varios.push(v)
    } else if (prefix === 'IPC') {
      const v = parseLineaComprobante(trimmed, 'ingresos_pagos_clientes')
      if (v && v.total > 0) ingresos_pagos_clientes.push(v)
    } else if (prefix === 'EG') {
      const v = parseLineaComprobante(trimmed, bl.startsWith('egreso') ? bl : 'egresos_varios')
      if (v && (v.total > 0 || v.efectivo > 0)) {
        if (bl === 'egresos_compras') egresos_compras.push(v)
        else if (bl === 'egresos_pagos_proveedores') egresos_pagos_proveedores.push(v)
        else egresos.push(v)
      }
    } else if (prefix === 'MEC') {
      const mec = parseMecLine(trimmed)
      if (mec && mec.total > 0) movimientos_mec.push(mec)
    }
  }

  const todas = [
    ...ingresos_varios,
    ...ventas,
    ...ingresos_pagos_clientes,
    ...egresos,
    ...egresos_compras,
    ...egresos_pagos_proveedores,
    ...movimientos_mec
  ]
  const lineas_cuadre_invalido = todas.filter((l) => !l.cuadre_valido).length

  if (lineas_cuadre_invalido > 0) {
    warnings.push(`${lineas_cuadre_invalido} línea(s) sin cuadrar (Total ≠ medios).`)
  }
  if (!header.caja_nombre) warnings.push('No se detectó la caja en el encabezado.')
  if (!totales) warnings.push('No se encontró «TOTALES DE CAJA». Verificá que sea el PDF completo.')
  if (!ventas.length && !egresos.length && !movimientos_mec.length) {
    warnings.push('No se detectaron comprobantes FA/FB, EG ni MEC. Probá exportar de nuevo desde PLOT CENTER.')
  }

  return {
    archivo_nombre: archivoNombre,
    ...header,
    cantidad_ventas: ventas.length,
    totales,
    ingresos_varios,
    ventas,
    ingresos_pagos_clientes,
    egresos,
    egresos_compras,
    egresos_pagos_proveedores,
    movimientos_mec,
    lineas_cuadre_invalido,
    warnings
  }
}

export async function parsePlanillaCajaPdf(
  buffer: ArrayBuffer,
  archivoNombre: string
): Promise<PlanillaCajaParsed> {
  const lines = await extractLinesFromPdfArrayBuffer(buffer)
  const text = lines.join('\n')
  const parsed = parsePlanillaCajaText(text, archivoNombre)

  if (!parsed.ventas.length && !parsed.egresos.length && lines.length > 5) {
    const fallback = parsePlanillaCajaText(lines.join('\n\n'), archivoNombre)
    if (
      fallback.ventas.length + fallback.egresos.length >
      parsed.ventas.length + parsed.egresos.length
    ) {
      return {
        ...fallback,
        warnings: [...fallback.warnings, 'Lectura mejorada con modo alternativo de filas.']
      }
    }
  }

  return parsed
}
