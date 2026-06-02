import { extractTextFromPdfArrayBuffer } from '../../utils/protocolosPdfText'
import { parseNum } from './format'
import { validarCuadreMediosPago } from './planillaMediosPago'

/** Monto argentino: 2.485.275,55 o 5305,33 */
const AR_AMOUNT = /(\d{1,3}(?:\.\d{3})*,\d{2,3}|\d+,\d{2})/g

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
  /** Fila Ingresos − Egresos por columna (si se detecta en PDF). */
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
  PLANILLA_LINEA_COLUMNAS.forEach((col, i) => {
    m[col.key] = amounts[i] ?? 0
  })
  return m
}

function dmYToIso(dmY: string): string {
  const m = dmY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return dmY
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseHeader(text: string): Pick<PlanillaCajaParsed, 'fecha_desde' | 'fecha_hasta' | 'caja_nombre' | 'empresa'> {
  const periodo = text.match(
    /Desde\s+(\d{2}\/\d{2}\/\d{4})\s+hasta\s+(\d{2}\/\d{2}\/\d{4})\s+CAJA\s+([A-ZÁÉÍÓÚÑ0-9\s]+?)(?:\s+Ingresos|\s+EGRESOS|$)/im
  )
  const empresa = text.includes('PLOT CENTER') ? 'PLOT CENTER' : 'Plot Lab'
  return {
    empresa,
    fecha_desde: periodo ? dmYToIso(periodo[1]) : '',
    fecha_hasta: periodo ? dmYToIso(periodo[2]) : '',
    caja_nombre: periodo ? periodo[3].trim() : ''
  }
}

function detectBloqueFromHeader(line: string): PlanillaBloqueId | null {
  const u = line.toUpperCase()
  if (u.includes('INGRESOS VARIOS')) return 'ingresos_varios'
  if (u.includes('INGRESOS VENTAS')) return 'ingresos_ventas'
  if (u.includes('INGRESOS PAGOS CLIENTES') || u.includes('PAGOS CLIENTES')) return 'ingresos_pagos_clientes'
  if (u.includes('EGRESOS COMPRAS')) return 'egresos_compras'
  if (u.includes('EGRESOS PAGOS PROVEEDORES') || u.includes('PAGOS PROVEEDORES')) return 'egresos_pagos_proveedores'
  if (u.includes('EGRESOS VARIOS')) return 'egresos_varios'
  if (u.includes('MOVIMIENTO ENTRE CAJAS') || u.includes('ENTRE CAJAS')) return 'movimientos_mec'
  return null
}

function conceptoSinMontos(rest: string): string {
  return (
    rest
      .replace(AR_AMOUNT, '|')
      .split('|')[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? ''
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

function parseLineaComprobante(
  line: string,
  prefix: string,
  bloque: PlanillaBloqueId
): PlanillaLineaConMontos | null {
  const m = line.match(new RegExp(`^${prefix}\\s+(\\S+)\\s+(.+)$`, 'i'))
  if (!m) return null
  const amounts = parseAmountsFromTail(m[2])
  if (!amounts.length) return null
  let montos = mapMontosPlanillaLinea(amounts)
  const concepto = conceptoSinMontos(m[2]) || bloque
  if (montos.total === 0 && montos.efectivo === 0 && amounts.length >= 1) {
    const max = Math.max(...amounts)
    if (max > 0 && bloque.startsWith('egreso')) montos.efectivo = max
  }
  return wrapLinea(bloque, `${prefix.toUpperCase()} ${m[1]}`, concepto, montos)
}

function parseMecLine(line: string): PlanillaLineaMec | null {
  const base = parseLineaComprobante(line, 'MEC', 'movimientos_mec')
  if (!base) return null
  const conceptRaw = base.concepto
  const paren = conceptRaw.match(/\(([^)]+)\)/)
  let origen_hint = ''
  let destino_hint = ''
  if (paren) {
    const parts = paren[1].split(/\s*-\s*/)
    origen_hint = parts[0]?.trim() ?? ''
    destino_hint = parts[1]?.trim() ?? ''
  }
  const montos = { ...base }
  if (montos.total === 0) {
    const amounts = parseAmountsFromTail(line)
    if (amounts.length >= 6) {
      montos.cta_cte = amounts[0] ?? 0
      montos.efectivo = amounts[3] ?? 0
      montos.total = amounts[5] ?? amounts[amounts.length - 1] ?? 0
      const v = validarCuadreMediosPago(montos)
      montos.cuadre_valido = v.valido
      montos.cuadre_diferencia = v.diferencia
    }
  }
  return { ...montos, origen_hint, destino_hint }
}

function parseTotalesDeCaja(text: string): PlanillaCajaTotales | null {
  const idx = text.indexOf('TOTALES DE CAJA')
  if (idx < 0) return null
  const chunk = text.slice(idx, idx + 1200)
  const rows: number[][] = []
  for (const line of chunk.split(/\n/)) {
    const trimmed = line.trim()
    if (!/^\d/.test(trimmed) && !/^Ingresos/i.test(trimmed)) continue
    const nums = parseAmountsFromTail(trimmed.replace(/^Ingresos\s*-\s*Egresos\s*/i, ''))
    if (nums.length >= 6 && (nums[0] > 500 || trimmed.includes('Ingresos'))) rows.push(nums)
  }
  if (rows.length < 2) return null

  const ing = rows[0]
  const egr = rows[1]
  const netoRow = rows[2]
  const neto_por_columna = netoRow?.length >= 6 ? mapMontosPlanillaLinea(netoRow) : undefined
  const neto = neto_por_columna?.total ?? netoRow?.[0] ?? (ing[0] ?? 0) - (egr[0] ?? 0)

  let transB = ing[8] ?? 0
  const transGlobal = text.match(/Trans\.\s*B\.?\s*\n\s*([\d.,]+)/i)
  if (transGlobal) transB = parseArAmount(transGlobal[1])

  let tarjetasIngreso = ing[5] ?? 0
  const tarjetaBlock = text.match(/Total\s+Tarjeta\s+([\d.,]+)/i)
  if (tarjetaBlock) tarjetasIngreso = parseArAmount(tarjetaBlock[1])

  return {
    ingresos_total: ing[0] ?? 0,
    ingresos_cta_cte: ing[1] ?? 0,
    ingresos_efectivo: ing[2] ?? 0,
    ingresos_tarjetas: tarjetasIngreso,
    ingresos_trans_b: transB,
    ingresos_otros: ing[9] ?? ing[ing.length - 1] ?? 0,
    egresos_total: egr[0] ?? 0,
    egresos_cta_cte: egr[1] ?? 0,
    egresos_efectivo: egr[2] ?? 0,
    egresos_tarjetas: egr[5] ?? 0,
    egresos_trans_b: egr[8] ?? 0,
    egresos_otros: egr[9] ?? egr[egr.length - 1] ?? 0,
    neto,
    neto_por_columna
  }
}

export function parsePlanillaCajaText(text: string, archivoNombre: string): PlanillaCajaParsed {
  const warnings: string[] = []
  const normalized = text.replace(/\r\n/g, '\n')
  const header = parseHeader(normalized)
  const totales = parseTotalesDeCaja(normalized)

  const ingresos_varios: PlanillaLineaConMontos[] = []
  const ventas: PlanillaLineaVenta[] = []
  const ingresos_pagos_clientes: PlanillaLineaConMontos[] = []
  const egresos: PlanillaLineaEgreso[] = []
  const egresos_compras: PlanillaLineaConMontos[] = []
  const egresos_pagos_proveedores: PlanillaLineaConMontos[] = []
  const movimientos_mec: PlanillaLineaMec[] = []

  let bloque: PlanillaBloqueId = 'ingresos_ventas'

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const hdr = detectBloqueFromHeader(trimmed)
    if (hdr) {
      bloque = hdr
      continue
    }

    if (/^FB\s+/i.test(trimmed)) {
      const v = parseLineaComprobante(trimmed, 'FB', 'ingresos_ventas')
      if (v && v.total > 0) ventas.push(v as PlanillaLineaVenta)
    } else if (/^FA\s+/i.test(trimmed)) {
      const v = parseLineaComprobante(trimmed, 'FA', 'ingresos_ventas')
      if (v && v.total > 0) ventas.push(v as PlanillaLineaVenta)
    } else if (/^IV\s+/i.test(trimmed)) {
      const v = parseLineaComprobante(trimmed, 'IV', 'ingresos_varios')
      if (v && v.total > 0) ingresos_varios.push(v)
    } else if (/^IPC\s+/i.test(trimmed)) {
      const v = parseLineaComprobante(trimmed, 'IPC', 'ingresos_pagos_clientes')
      if (v && v.total > 0) ingresos_pagos_clientes.push(v)
    } else if (/^EG\s+/i.test(trimmed)) {
      const v = parseLineaComprobante(trimmed, 'EG', bloque.startsWith('egreso') ? bloque : 'egresos_varios')
      if (v && (v.total > 0 || v.efectivo > 0)) {
        if (bloque === 'egresos_compras') egresos_compras.push(v)
        else if (bloque === 'egresos_pagos_proveedores') egresos_pagos_proveedores.push(v)
        else egresos.push(v)
      }
    } else if (/^MEC\s+/i.test(trimmed)) {
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
    warnings.push(
      `${lineas_cuadre_invalido} línea(s) donde Total ≠ suma de medios de pago (revisar PDF).`
    )
  }

  if (!header.caja_nombre) warnings.push('No se detectó el nombre de caja en el encabezado.')
  if (!totales) warnings.push('No se encontró el bloque TOTALES DE CAJA; revisá que sea el PDF completo.')
  if (!ventas.length && !egresos.length && !movimientos_mec.length) {
    warnings.push('No se detectaron líneas FA/FB, EG ni MEC.')
  }

  if (totales && lineas_cuadre_invalido === 0) {
    const calcIng = ingresos_varios.reduce((s, l) => s + l.total, 0) + ventas.reduce((s, l) => s + l.total, 0) + ingresos_pagos_clientes.reduce((s, l) => s + l.total, 0)
    if (calcIng > 0 && Math.abs(calcIng - totales.ingresos_total) > totales.ingresos_total * 0.05) {
      warnings.push('La suma de líneas de ingreso difiere >5% del total de caja del PDF.')
    }
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
  const text = await extractTextFromPdfArrayBuffer(buffer)
  return parsePlanillaCajaText(text, archivoNombre)
}
