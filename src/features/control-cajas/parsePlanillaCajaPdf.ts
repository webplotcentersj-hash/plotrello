import { extractTextFromPdfArrayBuffer } from '../../utils/protocolosPdfText'
import { parseNum } from './format'
import type { CajaMovimiento, CajaRegistro } from './types'
import { resolveCajaSlug } from './cajaRepository'

/** Monto argentino: 2.485.275,55 o 5305,33 */
const AR_AMOUNT = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g

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

export type PlanillaLineaVenta = {
  comprobante: string
  concepto: string
  total: number
  cta_cte: number
  efectivo: number
  tarjetas: number
  trans_b: number
  otros: number
}

export type PlanillaLineaEgreso = {
  comprobante: string
  concepto: string
  total: number
  cta_cte: number
  efectivo: number
  tarjetas: number
}

export type PlanillaLineaMec = {
  comprobante: string
  concepto: string
  cta_cte: number
  efectivo: number
  tarjetas: number
  total: number
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

function parseArAmount(raw: string): number {
  return parseNum(raw.trim())
}

function parseAmountsFromTail(tail: string): number[] {
  const matches = tail.match(AR_AMOUNT)
  if (!matches) return []
  return matches.map(parseArAmount)
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
  const chunk = text.slice(idx, idx + 1200)
  const rows: number[][] = []
  for (const line of chunk.split(/\n/)) {
    const nums = parseAmountsFromTail(line)
    if (nums.length >= 6 && nums[0] > 1000) rows.push(nums)
  }
  if (rows.length < 2) return null

  const ing = rows[0]
  const egr = rows[1]
  const neto = rows[2]?.[0] ?? ing[0] - egr[0]

  let transB = 0
  const transMatch = text.match(/Trans\.\s*B\.?\s*([\d.,]+)/i)
  if (transMatch) transB = parseArAmount(transMatch[1])

  let tarjetasIngreso = ing[5] ?? 0
  const tarjetaBlock = text.match(/Total\s+Tarjeta\s+([\d.,]+)/i)
  if (tarjetaBlock) tarjetasIngreso = parseArAmount(tarjetaBlock[1])

  return {
    ingresos_total: ing[0] ?? 0,
    ingresos_cta_cte: ing[1] ?? 0,
    ingresos_efectivo: ing[2] ?? 0,
    ingresos_tarjetas: tarjetasIngreso,
    ingresos_trans_b: transB,
    ingresos_otros: 0,
    egresos_total: egr[0] ?? 0,
    egresos_cta_cte: egr[1] ?? 0,
    egresos_efectivo: egr[2] ?? 0,
    egresos_tarjetas: egr[5] ?? 0,
    egresos_trans_b: 0,
    egresos_otros: 0,
    neto
  }
}

function parseVentasLine(line: string): PlanillaLineaVenta | null {
  const m = line.match(/^(FA|FB)\s+(\S+)\s+(.+)$/i)
  if (!m) return null
  const amounts = parseAmountsFromTail(m[3])
  if (!amounts.length) return null
  const concepto =
    line
      .replace(/^(FA|FB)\s+\S+\s+/i, '')
      .replace(AR_AMOUNT, '|')
      .split('|')[0]
      ?.trim() ?? 'Venta'

  return {
    comprobante: `${m[1]} ${m[2]}`,
    concepto,
    total: amounts[0] ?? 0,
    cta_cte: amounts[1] ?? 0,
    efectivo: amounts[2] ?? 0,
    tarjetas: amounts[5] ?? 0,
    trans_b: amounts[7] ?? 0,
    otros: amounts[amounts.length - 1] ?? 0
  }
}

function parseEgresoLine(line: string): PlanillaLineaEgreso | null {
  const m = line.match(/^(EG|MEC)\s+(\S+)\s+(.+)$/i)
  if (!m || m[1].toUpperCase() === 'MEC') return null
  const amounts = parseAmountsFromTail(m[3])
  if (!amounts.length) return null
  const cleanConcept = m[3]
    .replace(AR_AMOUNT, '|')
    .split('|')[0]
    ?.trim() ?? 'Egreso'
  return {
    comprobante: `${m[1]} ${m[2]}`,
    concepto: cleanConcept,
    total: amounts[amounts.length - 1] ?? amounts[0] ?? 0,
    cta_cte: amounts[0] ?? 0,
    efectivo: amounts[3] ?? amounts[1] ?? 0,
    tarjetas: amounts[5] ?? 0
  }
}

function parseMecLine(line: string): PlanillaLineaMec | null {
  const m = line.match(/^MEC\s+(\S+)\s+(.+)$/i)
  if (!m) return null
  const amounts = parseAmountsFromTail(m[2])
  if (!amounts.length) return null
  const conceptRaw = m[2].replace(AR_AMOUNT, '|').split('|')[0]?.trim() ?? ''
  const paren = conceptRaw.match(/\(([^)]+)\)/)
  let origen_hint = ''
  let destino_hint = ''
  if (paren) {
    const parts = paren[1].split(/\s*-\s*/)
    origen_hint = parts[0]?.trim() ?? ''
    destino_hint = parts[1]?.trim() ?? ''
  }
  const total = amounts[amounts.length - 1] ?? 0
  const efectivo = amounts[3] ?? amounts[1] ?? 0
  return {
    comprobante: `MEC ${m[1]}`,
    concepto: conceptRaw,
    cta_cte: amounts[0] ?? 0,
    efectivo,
    tarjetas: amounts[5] ?? 0,
    total,
    origen_hint,
    destino_hint
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
      if (e) egresos.push(e)
    } else if (/^MEC\s+/i.test(trimmed)) {
      const mec = parseMecLine(trimmed)
      if (mec) movimientos_mec.push(mec)
    }
  }

  if (!header.caja_nombre) warnings.push('No se detectó el nombre de caja en el encabezado.')
  if (!totales) warnings.push('No se encontró el bloque TOTALES DE CAJA; revisá que sea el PDF completo.')
  if (!ventas.length && !movimientos_mec.length) {
    warnings.push('No se detectaron líneas de ventas (FA/FB) ni movimientos MEC.')
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
    return {
      fecha,
      hora: null,
      concepto: 'Pase de caja',
      origen_slug: origen,
      destino_slug: destino,
      efectivo: mec.efectivo || mec.total,
      otros: mec.cta_cte + mec.tarjetas,
      nro_comprobante: mec.comprobante,
      observacion: mec.concepto,
      id_usuario: usuarioId ?? null,
      usuario_nombre: usuarioNombre,
      origen_importacion: 'planilla_pdf'
    }
  })
}
