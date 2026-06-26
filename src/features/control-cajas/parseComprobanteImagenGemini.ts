import { callGeminiGenerateContent, isGeminiApiAvailable } from '../../services/geminiApiClient'
import { parseNum } from './format'
import type { ComprobanteLoteParsed, ComprobanteMedioParsed } from './comprobanteMediosTypes'

const MODEL = 'gemini-2.5-flash-lite'

export function isComprobanteAiAvailable(): boolean {
  return isGeminiApiAvailable()
}

const SCHEMA = `Sos un extractor de comprobantes de cobro con tarjeta en Argentina (Mercado Pago Point, POSnet, tickets de vendedor).
Leés la foto del ticket o resumen impreso y devolvés SOLO JSON válido (sin markdown).

TIPOS:
- resumen_mp: "RESUMEN DE VENTAS" de Mercado Pago Point (totales por débito, prepaga, visa, master).
- ticket_mp: ticket individual Mercado Pago (Operación #, DÉBITO/PREPAGA, monto en recuadro, APROBADO).
- ticket_posnet / ticket_tarjeta: otros POS de tarjetas.

REGLAS:
- Montos argentinos: 35.738,98 o 10738.02 → número 35738.98
- Fecha DD/MM/YY o DD/MM/YYYY → ISO YYYY-MM-DD (año 26 = 2026)
- operacion_numero: número después de "Operación #" si existe
- es_resumen: true si es resumen del período (no un solo cobro)
- Si es resumen: llená lineas_resumen[] y total_resumen; monto puede ser el TOTAL
- Si es ticket individual: es_resumen false, monto = total del cobro aprobado
- medio: mercado_pago si dice mercado pago / Point; posnet si POSNET; tarjeta si otro
- metodo_pago: debito, credito, prepaga, qr, transferencia
- marca_tarjeta: visa, mastercard, amex, naranja, etc.

JSON:
{
  "tipo": "ticket_mp",
  "fecha": "2026-05-30",
  "hora": "13:31",
  "comercio": "PLOT CENTER SRL",
  "operacion_numero": "161707633214",
  "medio": "mercado_pago",
  "metodo_pago": "prepaga",
  "marca_tarjeta": "mastercard",
  "ultimos_digitos": "7645",
  "monto": 35738.98,
  "estado": "aprobado",
  "es_resumen": false,
  "lineas_resumen": [],
  "total_resumen": null,
  "warnings": []
}`

function parseJson(text: string): unknown {
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
    throw new Error('PlotAI no devolvió JSON válido para el comprobante.')
  }
}

function isoDate(s: unknown): string {
  const v = String(s ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2]}-${m[1]}`
  }
  return v
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return parseNum(v.replace(/\./g, '').replace(',', '.')) || parseNum(v) || 0
  return 0
}

function normalizeTipo(raw: string): ComprobanteMedioParsed['tipo'] {
  const t = raw.toLowerCase()
  if (t.includes('resumen')) return 'resumen_mp'
  if (t.includes('posnet')) return 'ticket_posnet'
  if (t.includes('ticket') && t.includes('mp')) return 'ticket_mp'
  if (t.includes('mp') || t.includes('mercado')) return 'ticket_mp'
  if (t.includes('tarjeta')) return 'ticket_tarjeta'
  if (t.includes('egreso')) return 'egreso'
  return 'desconocido'
}

function normalizeMedio(raw: string): ComprobanteMedioParsed['medio'] {
  const t = raw.toLowerCase()
  if (t.includes('mercado') || t.includes('point')) return 'mercado_pago'
  if (t.includes('posnet')) return 'posnet'
  if (t.includes('tarjeta')) return 'tarjeta'
  return 'otro'
}

export function comprobanteFromAiJson(data: unknown, archivoNombre: string): ComprobanteMedioParsed {
  if (!data || typeof data !== 'object') throw new Error('Respuesta vacía')
  const d = data as Record<string, unknown>
  const lineas = Array.isArray(d.lineas_resumen)
    ? d.lineas_resumen.map((row) => {
        const o = row as Record<string, unknown>
        return {
          concepto: String(o.concepto ?? ''),
          cantidad: num(o.cantidad) || 1,
          monto: num(o.monto),
          marca_tarjeta: o.marca_tarjeta != null ? String(o.marca_tarjeta) : null,
          metodo_pago: o.metodo_pago != null ? String(o.metodo_pago) : null
        }
      })
    : []

  const esResumen = Boolean(d.es_resumen) || lineas.length > 0

  return {
    archivo_nombre: archivoNombre,
    tipo: normalizeTipo(String(d.tipo ?? '')),
    fecha: isoDate(d.fecha),
    hora: d.hora != null ? String(d.hora).slice(0, 5) : null,
    comercio: d.comercio != null ? String(d.comercio) : null,
    operacion_numero: d.operacion_numero != null ? String(d.operacion_numero) : null,
    medio: normalizeMedio(String(d.medio ?? 'mercado_pago')),
    metodo_pago: d.metodo_pago != null ? String(d.metodo_pago) : null,
    marca_tarjeta: d.marca_tarjeta != null ? String(d.marca_tarjeta) : null,
    ultimos_digitos: d.ultimos_digitos != null ? String(d.ultimos_digitos) : null,
    monto: num(d.monto),
    estado: d.estado != null ? String(d.estado) : null,
    es_resumen: esResumen,
    lineas_resumen: lineas,
    total_resumen: d.total_resumen != null ? num(d.total_resumen) : null,
    warnings: Array.isArray(d.warnings) ? d.warnings.map(String) : []
  }
}

async function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const mimeType = mimeFromFile(file)
  return { mimeType, data: btoa(binary) }
}

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

export async function parseComprobanteImagenGemini(
  file: File
): Promise<ComprobanteMedioParsed> {
  return parseComprobanteArchivoGemini(file)
}

function mimeFromFile(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const n = file.name.toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.gif')) return 'image/gif'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/jpeg'
}

export async function parseComprobanteArchivoGemini(
  file: File
): Promise<ComprobanteMedioParsed> {
  const { mimeType, data } = await fileToBase64(file)
  const prompt = `${SCHEMA}\n\nArchivo: ${file.name}\nTranscribí el comprobante del archivo adjunto.`

  const text = await withTimeout(
    callGeminiGenerateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data } }
          ]
        }
      ]
    }),
    45_000,
    'PlotAI tardó demasiado leyendo el comprobante.'
  )
  if (!text.trim()) throw new Error('PlotAI no devolvió datos del comprobante.')
  const parsed = comprobanteFromAiJson(parseJson(text), file.name)
  parsed.warnings.push('Leído con PlotAI.')
  if (!parsed.monto && !parsed.lineas_resumen.length) {
    throw new Error('No se detectó monto en el comprobante. Probá otra foto más nítida.')
  }
  return parsed
}

export async function parseComprobantesImagenes(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<ComprobanteLoteParsed> {
  const comprobantes: ComprobanteMedioParsed[] = []
  const warnings: string[] = []
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const p = await parseComprobanteImagenGemini(file)
      comprobantes.push(p)
    } catch (e) {
      warnings.push(
        `${file.name}: ${e instanceof Error ? e.message : 'error al leer'}`
      )
    }
    onProgress?.(i + 1, total)
  }

  const total_monto_operaciones = comprobantes.reduce((s, c) => {
    if (c.es_resumen) return s
    return s + c.monto
  }, 0)

  return { comprobantes, total_monto_operaciones, warnings }
}
