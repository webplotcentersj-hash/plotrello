import { GoogleGenAI } from '@google/genai'
import { copyPdfBytes, extractTextFromPdfArrayBuffer } from '../../utils/pdfTextLines'
import { parseNum } from './format'
import {
  mapMontosPlanillaLinea,
  parsePlanillaCajaText,
  type PlanillaBloqueId,
  type PlanillaCajaParsed,
  type PlanillaCajaTotales,
  type PlanillaLineaConMontos,
  type PlanillaLineaMec
} from './parsePlanillaCajaPdf'
import { validarCuadreMediosPago } from './planillaMediosPago'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const MODEL = 'gemini-2.5-flash'

let aiClient: GoogleGenAI | null = null
try {
  if (GEMINI_API_KEY) aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
} catch {
  aiClient = null
}

export function isPlanillaAiAvailable(): boolean {
  return Boolean(aiClient && GEMINI_API_KEY)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = copyPdfBytes(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
    throw new Error('PlotAI no devolvió JSON válido para la planilla.')
  }
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return parseNum(v.replace(/\./g, '').replace(',', '.')) || parseNum(v) || 0
  return 0
}

function normalizeMontos(raw: Record<string, unknown>): ReturnType<typeof mapMontosPlanillaLinea> {
  const amounts = [
    num(raw.total),
    num(raw.cta_cte ?? raw.cuenta_corriente),
    num(raw.efectivo),
    num(raw.ch_prop ?? raw.cheque_propio),
    num(raw.ch_terc ?? raw.cheque_tercero),
    num(raw.tarjetas ?? raw.tarjeta),
    num(raw.docum ?? raw.documento),
    num(raw.c_contab ?? raw.cuenta_contable),
    num(raw.trans_b ?? raw.transferencia_bancaria),
    num(raw.otros)
  ]
  return mapMontosPlanillaLinea(amounts)
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

function normalizeLinea(raw: unknown, bloque: PlanillaBloqueId): PlanillaLineaConMontos | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const comprobante = String(o.comprobante ?? o.nro ?? '').trim()
  if (!comprobante) return null
  const montos = normalizeMontos(o)
  if (montos.total === 0 && montos.efectivo === 0 && montos.tarjetas === 0) return null
  const concepto = String(o.concepto ?? o.descripcion ?? comprobante).trim()
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
    ...montos
  }
}

function normalizeTotales(raw: unknown): PlanillaCajaTotales | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  return {
    ingresos_total: num(t.ingresos_total),
    egresos_total: num(t.egresos_total),
    neto: num(t.neto),
    ingresos_cta_cte: num(t.ingresos_cta_cte),
    ingresos_efectivo: num(t.ingresos_efectivo),
    ingresos_tarjetas: num(t.ingresos_tarjetas),
    ingresos_trans_b: num(t.ingresos_trans_b),
    ingresos_otros: num(t.ingresos_otros),
    egresos_cta_cte: num(t.egresos_cta_cte),
    egresos_efectivo: num(t.egresos_efectivo),
    egresos_tarjetas: num(t.egresos_tarjetas),
    egresos_trans_b: num(t.egresos_trans_b),
    egresos_otros: num(t.egresos_otros)
  }
}

function isoDate(s: unknown): string {
  const v = String(s ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return v
}

function linesFromPayload(data: Record<string, unknown>, key: string, bloque: PlanillaBloqueId): PlanillaLineaConMontos[] {
  const arr = data[key]
  if (!Array.isArray(arr)) return []
  return arr.map((row) => normalizeLinea(row, bloque)).filter((l): l is PlanillaLineaConMontos => l != null)
}

function mecFromPayload(data: Record<string, unknown>): PlanillaLineaMec[] {
  const key = ['movimientos_mec', 'mec', 'traspasos'].find((k) => Array.isArray(data[k]))
  if (!key) return []
  const arr = data[key] as unknown[]
  return arr
    .map((row) => {
      const base = normalizeLinea(row, 'movimientos_mec')
      if (!base) return null
      const o = row as Record<string, unknown>
      const origen_hint = String(o.origen_hint ?? o.origen ?? o.caja_origen ?? '').trim()
      const destino_hint = String(o.destino_hint ?? o.destino ?? o.caja_destino ?? '').trim()
      const paren = base.concepto.match(/\(([^)]+)\)/)
      let orig = origen_hint
      let dest = destino_hint
      if (!orig && paren) {
        const parts = paren[1].split(/\s*-\s*/)
        orig = parts[0]?.trim() ?? ''
        dest = parts[1]?.trim() ?? ''
      }
      return { ...base, origen_hint: orig, destino_hint: dest }
    })
    .filter((l): l is PlanillaLineaMec => l != null)
}

export function planillaFromAiJson(data: unknown, archivoNombre: string): PlanillaCajaParsed {
  if (!data || typeof data !== 'object') throw new Error('Respuesta IA vacía')
  const d = data as Record<string, unknown>

  const ingresos_varios = linesFromPayload(d, 'ingresos_varios', 'ingresos_varios')
  const ventas = linesFromPayload(d, 'ventas', 'ingresos_ventas')
  const ingresos_pagos_clientes = linesFromPayload(d, 'ingresos_pagos_clientes', 'ingresos_pagos_clientes')
  const egresos = linesFromPayload(d, 'egresos', 'egresos_varios')
  const egresos_compras = linesFromPayload(d, 'egresos_compras', 'egresos_compras')
  const egresos_pagos_proveedores = linesFromPayload(d, 'egresos_pagos_proveedores', 'egresos_pagos_proveedores')
  const movimientos_mec = mecFromPayload(d)

  const todas = [
    ...ingresos_varios,
    ...ventas,
    ...ingresos_pagos_clientes,
    ...egresos,
    ...egresos_compras,
    ...egresos_pagos_proveedores,
    ...movimientos_mec
  ]

  const warnings: string[] = []
  if (d.warnings && Array.isArray(d.warnings)) {
    for (const w of d.warnings) warnings.push(String(w))
  }
  warnings.push('Planilla leída con PlotAI (Gemini).')

  const lineas_cuadre_invalido = todas.filter((l) => !l.cuadre_valido).length

  return {
    archivo_nombre: archivoNombre,
    empresa: String(d.empresa ?? 'PLOT CENTER'),
    fecha_desde: isoDate(d.fecha_desde),
    fecha_hasta: isoDate(d.fecha_hasta ?? d.fecha_desde),
    caja_nombre: String(d.caja_nombre ?? ''),
    cantidad_ventas: ventas.length,
    totales: normalizeTotales(d.totales),
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

const PLANILLA_AI_SCHEMA = `Sos un extractor experto de planillas de caja de PLOT CENTER (Argentina).
Leés el PDF de "Listado de caja" / planilla diaria y devolvés SOLO JSON válido (sin markdown).

REGLAS:
- Montos en pesos argentinos: podés usar número con coma decimal (5305,33) o punto miles (2.485.275,55).
- Cada línea de comprobante tiene 10 columnas de medios + Total: total, cta_cte, efectivo, ch_prop, ch_terc, tarjetas, docum, c_contab, trans_b, otros.
- Prefijos: FA/FB=ventas, IV=ingresos varios, IPC=pagos clientes, EG=egresos, MEC=movimiento entre cajas.
- En MEC incluí origen_hint y destino_hint (ej. "CAJA NOELIA" - "CAJA CENTRAL").
- Bloques del PDF: Ingresos varios, Ingresos ventas, Ingresos pagos clientes, Egresos varios, Egresos compras, Egresos pagos proveedores, Movimiento entre cajas.
- Extraé TODAS las líneas visibles, no omitas comprobantes.
- totales: bloque "TOTALES DE CAJA" si aparece (ingresos_total, egresos_total, neto y desglose por medio).
- fechas formato ISO YYYY-MM-DD.

JSON (mantené estas claves exactas):
{
  "empresa": "PLOT CENTER",
  "fecha_desde": "YYYY-MM-DD",
  "fecha_hasta": "YYYY-MM-DD",
  "caja_nombre": "CAJA NOELIA",
  "totales": {
    "ingresos_total": 0, "egresos_total": 0, "neto": 0,
    "ingresos_efectivo": 0, "ingresos_tarjetas": 0, "ingresos_trans_b": 0, "ingresos_cta_cte": 0, "ingresos_otros": 0,
    "egresos_efectivo": 0, "egresos_tarjetas": 0, "egresos_trans_b": 0, "egresos_cta_cte": 0, "egresos_otros": 0
  },
  "ingresos_varios": [{ "comprobante": "IV 1", "concepto": "...", "total": 0, "cta_cte": 0, "efectivo": 0, "ch_prop": 0, "ch_terc": 0, "tarjetas": 0, "docum": 0, "c_contab": 0, "trans_b": 0, "otros": 0 }],
  "ventas": [],
  "ingresos_pagos_clientes": [],
  "egresos": [],
  "egresos_compras": [],
  "egresos_pagos_proveedores": [],
  "movimientos_mec": [{ "comprobante": "MEC 1", "concepto": "...", "origen_hint": "", "destino_hint": "", "total": 0, "efectivo": 0, ... }],
  "warnings": []
}`

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        window.clearTimeout(id)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(id)
        reject(e)
      }
    )
  })
}

/** Cuenta líneas con monto en una planilla. */
export function countPlanillaLineas(p: PlanillaCajaParsed): number {
  return (
    p.ventas.length +
    p.ingresos_varios.length +
    p.ingresos_pagos_clientes.length +
    p.egresos.length +
    p.egresos_compras.length +
    p.egresos_pagos_proveedores.length +
    p.movimientos_mec.length
  )
}

/** Elige la planilla con más líneas detectadas. */
export function mergePlanillaPreferComplete(
  primary: PlanillaCajaParsed,
  secondary: PlanillaCajaParsed
): PlanillaCajaParsed {
  const c1 = countPlanillaLineas(primary)
  const c2 = countPlanillaLineas(secondary)
  if (c2 > c1) {
    return {
      ...secondary,
      warnings: [...secondary.warnings, `Se complementó con lectura local (${c1} vs ${c2} líneas IA).`]
    }
  }
  if (c1 > c2 && c2 > 0) {
    return {
      ...primary,
      warnings: [...primary.warnings, `Lectura local tenía ${c2} líneas extra como respaldo.`]
    }
  }
  return primary
}

/**
 * Lee la planilla con Gemini (PDF nativo + texto extraído) y devuelve estructura PlotLab.
 */
export async function parsePlanillaCajaPdfWithGemini(
  buffer: ArrayBuffer,
  archivoNombre: string
): Promise<PlanillaCajaParsed> {
  if (!aiClient) {
    throw new Error('PlotAI no configurado. Agregá VITE_GEMINI_API_KEY en .env')
  }

  const textoExtraido = await extractTextFromPdfArrayBuffer(buffer)
  const textoLocal = parsePlanillaCajaText(textoExtraido, archivoNombre)
  const base64 = arrayBufferToBase64(buffer.slice(0))

  const userText = `${PLANILLA_AI_SCHEMA}

Archivo: ${archivoNombre}

TEXTO EXTRAÍDO (referencia, puede tener errores de columnas):
---
${textoExtraido.slice(0, 100_000)}
---

También tenés el PDF adjunto: usalo como fuente principal para tablas y columnas alineadas.
Devolvé el JSON completo con todas las líneas.`

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: userText },
    { inlineData: { mimeType: 'application/pdf', data: base64 } }
  ]

  let responseText = ''
  try {
    const response = await withTimeout(
      aiClient.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }]
      }),
      120_000,
      'PlotAI tardó demasiado leyendo el PDF (máx. 2 min).'
    )
    responseText = response.text || ''
  } catch (pdfErr) {
    console.warn('Planilla IA con PDF adjunto falló, reintento solo texto:', pdfErr)
    const response = await withTimeout(
      aiClient.models.generateContent({
        model: MODEL,
        contents: userText
      }),
      90_000,
      'PlotAI tardó demasiado.'
    )
    responseText = response.text || ''
  }

  if (!responseText.trim()) throw new Error('PlotAI no devolvió contenido.')

  const json = parseJsonResponse(responseText)
  const fromAi = planillaFromAiJson(json, archivoNombre)

  if (countPlanillaLineas(fromAi) === 0) {
    throw new Error('PlotAI no detectó comprobantes en el PDF.')
  }

  return mergePlanillaPreferComplete(fromAi, textoLocal)
}
