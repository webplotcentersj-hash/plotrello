import { plotLabFetch } from './plotLabApiOrigin'

export type TicketExtract = {
  fecha?: string | null
  proveedor?: string | null
  categoria?: string | null
  descripcion?: string | null
  total?: number | null
  iva?: number | null
  neto?: number | null
  moneda?: string | null
  metodo_pago?: string | null
  numero_comprobante?: string | null
  confidence?: number | null
  raw_text_hint?: string | null
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

export async function extraerDatosTicket(file: File): Promise<TicketExtract> {
  const dataUrl = await fileToDataUrl(file)
  const res = await plotLabFetch('/api/erp/extract-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mimeType: file.type || 'image/jpeg',
      dataUrl
    })
  })
  const j = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: TicketExtract
    error?: string
  } | null
  if (!res.ok || !j?.data) {
    throw new Error(j?.error || 'No se pudo extraer el comprobante.')
  }
  return j.data
}
