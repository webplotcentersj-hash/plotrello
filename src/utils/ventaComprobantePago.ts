import type { ComprobanteMedioParsed } from '../features/control-cajas/comprobanteMediosTypes'
import { parseComprobanteArchivoGemini } from '../features/control-cajas/parseComprobanteImagenGemini'

export function urlEsImagenComprobante(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)
}

export function urlEsPdfComprobante(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url)
}

export function nombreArchivoDesdeUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const base = path.split('/').pop() || 'comprobante'
    return decodeURIComponent(base)
  } catch {
    return 'comprobante'
  }
}

export async function archivoDesdeUrlComprobante(url: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo descargar el comprobante')
  const blob = await res.blob()
  const nombre = nombreArchivoDesdeUrl(url)
  const type =
    blob.type ||
    (urlEsPdfComprobante(url)
      ? 'application/pdf'
      : urlEsImagenComprobante(url)
        ? 'image/jpeg'
        : 'application/octet-stream')
  return new File([blob], nombre, { type })
}

export async function extraerComprobantePagoDesdeArchivo(
  file: File
): Promise<{ parsed: ComprobanteMedioParsed; texto: string }> {
  const parsed = await parseComprobanteArchivoGemini(file)
  return { parsed, texto: resumenTextoComprobanteParsed(parsed) }
}

export async function extraerComprobantePagoDesdeUrl(url: string): Promise<ComprobanteMedioParsed> {
  const file = await archivoDesdeUrlComprobante(url)
  return parseComprobanteArchivoGemini(file)
}

export function resumenTextoComprobanteParsed(c: ComprobanteMedioParsed): string {
  const lines: string[] = []
  if (c.comercio) lines.push(`Comercio: ${c.comercio}`)
  if (c.fecha) lines.push(`Fecha: ${c.fecha}${c.hora ? ` ${c.hora}` : ''}`)
  if (c.operacion_numero) lines.push(`N° operación: ${c.operacion_numero}`)
  if (c.medio && c.medio !== 'otro') lines.push(`Medio: ${c.medio}`)
  if (c.metodo_pago) lines.push(`Método: ${c.metodo_pago}`)
  if (c.marca_tarjeta) lines.push(`Tarjeta: ${c.marca_tarjeta}`)
  if (c.ultimos_digitos) lines.push(`Últimos dígitos: ${c.ultimos_digitos}`)
  if (c.monto > 0) {
    lines.push(
      `Monto: $${c.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    )
  }
  if (c.estado) lines.push(`Estado: ${c.estado}`)
  if (c.lineas_resumen.length > 0) {
    lines.push('Detalle:')
    for (const l of c.lineas_resumen) {
      lines.push(
        `· ${l.concepto}: $${l.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      )
    }
  }
  if (c.total_resumen != null && c.total_resumen > 0) {
    lines.push(
      `Total resumen: $${c.total_resumen.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    )
  }
  if (c.warnings.length) {
    lines.push('', ...c.warnings.map((w) => `⚠ ${w}`))
  }
  return lines.join('\n').trim()
}
