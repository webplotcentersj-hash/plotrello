import { extractTextFromPdfArrayBuffer } from '../../utils/protocolosPdfText'
import { parseNum } from './format'
import type { CajaMovimiento, CajaRegistro } from './types'
import { resolveCajaSlug } from './cajaRepository'

/** Monto argentino: 2.485.275,55 o 5305,33 */
const AR_AMOUNT = /(\d{1,3}(?:\.\d{3})*,\d{2,3}|\d+,\d{2})/g

/** Columnas de cada línea FA/FB/EG (orden del PDF «Ingresos Ventas» / «Egresos Varios»). */
export const PLANILLA_LINEA_COLUMNAS = [
  { key: 'total', label: 'Total' },
  { key: 'cta_cte', label: 'Cta. cte.' },
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'ch_prop', label: 'Ch. prop.' },
  { key: 'ch_terc', label: 'Ch. terc.' },
  { key: 'tarjetas', label: 'Tarjetas' },
  { key: 'docum', label: 'Docum.' },
  { key: 'c_contab', label: 'C. contab.' },
  { key: 'trans_b', label: 'Trans. B.' },
  { key: 'otros', label: 'Otros' }
] as const

export type PlanillaColumnaKey = (typeof PLANILLA_LINEA_COLUMNAS)[number]['key']

export type PlanillaMontosLinea = Record<PlanillaColumnaKey, number>

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
}

export type PlanillaLineaVenta = PlanillaMontosLinea & {
  comprobante: string
  concepto: string
}

export type PlanillaLineaEgreso = PlanillaMontosLinea & {
  comprobante: string
  concepto: string
}

export type PlanillaLineaMec = PlanillaMontosLinea & {
  comprobante: string
  concepto: string
  origen_hint: string
  destino_hint: string
}

export type PlanillaCajaParsed = {
  archivo_nombre: string
  empresa: string
  fecha_desde: string
  fecha_hasta: string
  caja_nombre: string
  cantidad_ventas: number
  totales: PlanillaCajaTotales | null
  ventas: PlanillaLineaVenta[]
  egresos: PlanillaLineaEgreso[]
  movimientos_mec: PlanillaLineaMec[]
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

/** Mapea los montos del final de línea al orden de columnas del PDF. */
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

function parseTotalesDeCaja(text: string): PlanillaCajaTotales | null {
  const idx = text.indexOf('TOTALES DE CAJA')
  if (idx < 0) return null
  const chunk = text.slice(idx, idx + 900)
  const rows: number[][] = []
  for (const line of chunk.split(/\n/)) {
    const trimmed = line.trim()
    if (!/^\d/.test(trimmed)) continue
    const nums = parseAmountsFromTail(trimmed)
    if (nums.length >= 6 && nums[0] > 1000) rows.push(nums)
  }
  if (rows.length < 2) return null

  const ing = rows[0]
  const egr = rows[1]
  const netoRow = rows[2]
  const neto = netoRow?.[0] > 1000 ? netoRow[0] : (ing[0] ?? 0) - (egr[0] ?? 0)

  let transB = 0
  const transLines = chunk.match(/Trans\.\s*B\.?\s*([\d.,]+)/gi)
  if (transLines?.length) {
    const last = transLines[transLines.length - 1].match(/([\d.,]+)/)
    if (last) transB = parseArAmount(last[1])
  }
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
    neto
  }
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

function parseVentasLine(line: string): PlanillaLineaVenta | null {
  const m = line.match(/^(FA|FB)\s+(\S+)\s+(.+)$/i)
  if (!m) return null
  const amounts = parseAmountsFromTail(m[3])
  if (amounts.length < 1) return null
  const concepto = conceptoSinMontos(m[3]) || 'Venta'
  return {
    comprobante: `${m[1].toUpperCase()} ${m[2]}`,
    concepto,
    ...mapMontosPlanillaLinea(amounts)
  }
}

function parseEgresoLine(line: string): PlanillaLineaEgreso | null {
  const m = line.match(/^EG\s+(\S+)\s+(.+)$/i)
  if (!m) return null
  const amounts = parseAmountsFromTail(m[2])
  if (!amounts.length) return null
  const concepto = conceptoSinMontos(m[2]) || 'Egreso'
  const montos = mapMontosPlanillaLinea(amounts)
  if (montos.total === 0 && montos.efectivo === 0 && montos.cta_cte === 0) {
    const max = Math.max(...amounts)
    if (max > 0) montos.efectivo = max
  }
  return {
    comprobante: `EG ${m[1]}`,
    concepto,
    ...montos
  }
}

function parseMecLine(line: string): PlanillaLineaMec | null {
  const m = line.match(/^MEC\s+(\S+)\s+(.+)$/i)
  if (!m) return null
  const amounts = parseAmountsFromTail(m[2])
  if (!amounts.length) return null
  const conceptRaw = conceptoSinMontos(m[2]) || ''
  const paren = conceptRaw.match(/\(([^)]+)\)/)
  let origen_hint = ''
  let destino_hint = ''
  if (paren) {
    const parts = paren[1].split(/\s*-\s*/)
    origen_hint = parts[0]?.trim() ?? ''
    destino_hint = parts[1]?.trim() ?? ''
  }

  const montos = mapMontosPlanillaLinea(amounts)
  if (montos.total === 0 && amounts.length >= 6) {
    montos.cta_cte = amounts[0] ?? 0
    montos.efectivo = amounts[3] ?? 0
    montos.total = amounts[5] ?? amounts[amounts.length - 1] ?? 0
  }

  return {
    comprobante: `MEC ${m[1]}`,
    concepto: conceptRaw,
    origen_hint,
    destino_hint,
    ...montos
  }
}

export function parsePlanillaCajaText(text: string, archivoNombre: string): PlanillaCajaParsed {
  const warnings: string[] = []
  const normalized = text.replace(/\r\n/g, '\n')
  const header = parseHeader(normalized)
  const totales = parseTotalesDeCaja(normalized)

  const ventas: PlanillaLineaVenta[] = []
  const egresos: PlanillaLineaEgreso[] = []
  const movimientos_mec: PlanillaLineaMec[] = []

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (/^(FA|FB)\s+/i.test(trimmed)) {
      const v = parseVentasLine(trimmed)
      if (v && v.total > 0) ventas.push(v)
    } else if (/^EG\s+/i.test(trimmed)) {
      const e = parseEgresoLine(trimmed)
      if (e && (e.total > 0 || e.efectivo > 0 || e.cta_cte > 0)) egresos.push(e)
    } else if (/^MEC\s+/i.test(trimmed)) {
      const mec = parseMecLine(trimmed)
      if (mec && mec.total > 0) movimientos_mec.push(mec)
    }
  }

  if (!header.caja_nombre) warnings.push('No se detectó el nombre de caja en el encabezado.')
  if (!totales) warnings.push('No se encontró el bloque TOTALES DE CAJA; revisá que sea el PDF completo.')
  if (!ventas.length && !egresos.length && !movimientos_mec.length) {
    warnings.push('No se detectaron líneas FA/FB, EG ni MEC.')
  }

  return {
    archivo_nombre: archivoNombre,
    ...header,
    cantidad_ventas: ventas.length,
    totales,
    ventas,
    egresos,
    movimientos_mec,
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

function hintToSlug(hint: string, cajas: CajaRegistro[], cajaPlanilla: string): string | null {
  const h = hint.trim().toLowerCase()
  if (!h) return null
  if (h.includes('central') || h.includes('admin')) return resolveCajaSlug('admin', cajas) ?? 'admin'
  if (h.includes('mostrador')) return resolveCajaSlug('mostrador', cajas) ?? resolveCajaSlug(cajaPlanilla, cajas)
  return resolveCajaSlug(hint, cajas)
}

/** Convierte líneas MEC de la planilla a movimientos guardables. */
export function planillaMecToMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const cajaSlug =
    resolveCajaSlug(planilla.caja_nombre, cajas) ??
    cajas.find((c) => c.slug !== 'admin')?.slug ??
    'noelia'
  const fecha = planilla.fecha_hasta || planilla.fecha_desde

  return planilla.movimientos_mec.map((mec) => {
    const origen =
      hintToSlug(mec.origen_hint, cajas, planilla.caja_nombre) ?? cajaSlug
    const destino =
      hintToSlug(mec.destino_hint, cajas, planilla.caja_nombre) ??
      resolveCajaSlug('admin', cajas) ??
      'admin'
    const efectivo = mec.efectivo > 0 ? mec.efectivo : mec.total
    const otros = mec.cta_cte + mec.tarjetas + mec.trans_b + mec.otros
    return {
      fecha,
      hora: null,
      concepto: 'Pase de caja',
      origen_slug: origen,
      destino_slug: destino,
      efectivo,
      otros,
      nro_comprobante: mec.comprobante,
      observacion: mec.concepto,
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre,
      origen_importacion: 'planilla_pdf'
    }
  })
}

/** Egresos EG como salidas de caja (opcional al importar). */
export function planillaEgresosToMovimientos(
  planilla: PlanillaCajaParsed,
  cajas: CajaRegistro[],
  cajaSlug: string | null,
  usuarioNombre: string,
  usuarioId?: number
): Omit<CajaMovimiento, 'id' | 'created_at'>[] {
  const slug =
    cajaSlug ??
    resolveCajaSlug(planilla.caja_nombre, cajas) ??
    cajas.find((c) => c.slug !== 'admin')?.slug ??
    'noelia'
  const fecha = planilla.fecha_hasta || planilla.fecha_desde
  const destino =
    resolveCajaSlug('admin', cajas) ?? cajas.find((c) => c.slug === 'admin')?.slug ?? slug

  return planilla.egresos.map((eg) => ({
    fecha,
    hora: null,
    concepto: eg.concepto || 'Egreso',
    origen_slug: slug,
    destino_slug: destino,
    efectivo: eg.efectivo || eg.total,
    otros: eg.cta_cte + eg.tarjetas + eg.trans_b + eg.ch_prop + eg.ch_terc + eg.otros,
    nro_comprobante: eg.comprobante,
    observacion: `Importado planilla PDF — ${eg.concepto}`,
    id_usuario: usuarioId ?? null,
    usuario_nombre: usuarioNombre,
    origen_importacion: 'planilla_pdf'
  }))
}
