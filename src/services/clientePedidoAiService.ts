import { plotLabFetch } from '../utils/plotLabApiOrigin'

export type PedidoEspecificacionIaResult = {
  descripcion_articulo: string
  brief_publico: string
  estilo_diseno: string
}

export async function generarPedidoDesdeEspecificacion(input: {
  especificacion: string
  articulos: string[]
  donde_colocados?: string
  digital_o_impresion?: string
  cantidades?: string
}): Promise<PedidoEspecificacionIaResult> {
  const resp = await plotLabFetch('/api/plotai/pedido-especificacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  const json = (await resp.json().catch(() => ({}))) as PedidoEspecificacionIaResult & { error?: string }
  if (!resp.ok) {
    throw new Error(json.error || 'No se pudo generar la descripción con IA.')
  }
  return {
    descripcion_articulo: json.descripcion_articulo || '',
    brief_publico: json.brief_publico || '',
    estilo_diseno: json.estilo_diseno || ''
  }
}

export async function generarMockupImagenIa(prompt: string): Promise<string> {
  const resp = await plotLabFetch('/api/plotai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio: '16:9' })
  })
  const json = (await resp.json().catch(() => ({}))) as {
    dataUrl?: string
    error?: string
    success?: boolean
    debugText?: string
  }
  if (!resp.ok || !json.dataUrl) {
    const detail = json.error || (resp.status === 500 ? 'Error del servidor al generar la imagen.' : '')
    throw new Error(detail || 'No se pudo generar la vista previa con IA.')
  }
  return json.dataUrl
}
