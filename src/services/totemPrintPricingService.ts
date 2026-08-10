import { plotLabApiUrl } from '../utils/plotLabApiOrigin'
import type { PrintFormat } from '../utils/totemPrintDocument'
import type { TotemPrintPapelId } from '../utils/totemPrintPapel'

export type TotemPrintQuoteLine = {
  codigo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type TotemPrintQuote = {
  total: number
  items: TotemPrintQuoteLine[]
  lista: string
}

export async function cotizarImpresionTotem(params: {
  formato: PrintFormat
  tipo_impresion: string
  cantidad_hojas: number
  color_pages?: number
  bw_pages?: number
  papel?: TotemPrintPapelId
}): Promise<{ ok: boolean; quote?: TotemPrintQuote; error?: string }> {
  try {
    const res = await fetch(plotLabApiUrl('/api/totem/cotizar-impresion'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formato: params.formato,
        tipo_impresion: params.tipo_impresion,
        cantidad_hojas: params.cantidad_hojas,
        color_pages: params.color_pages,
        bw_pages: params.bw_pages,
        papel: params.papel
      })
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      total?: number
      items?: TotemPrintQuoteLine[]
      lista?: string
    }
    if (!data.ok || data.total == null || !Array.isArray(data.items)) {
      return { ok: false, error: data.error || 'No se pudo calcular el precio.' }
    }
    return {
      ok: true,
      quote: {
        total: Number(data.total),
        items: data.items,
        lista: data.lista || 'lista_1'
      }
    }
  } catch {
    return { ok: false, error: 'Error de conexión al calcular el precio.' }
  }
}

export function formatTotemPrintArs(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}
