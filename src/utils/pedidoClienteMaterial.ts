import type { PedidoClienteArchivoRecord, PedidoClienteRecord } from '../types/api'
import { isPedidoMockupArchivo } from './capturePedidoMockup'
import { labelFormatoPedido } from './clientePedidoMockup'

export function splitPedidoArchivos(archivos: PedidoClienteArchivoRecord[]) {
  const mockup = archivos.find((a) => isPedidoMockupArchivo(a)) ?? null
  const otros = archivos.filter((a) => !isPedidoMockupArchivo(a))
  return { mockup, otros }
}

export function buildPedidoEspecificacionTexto(pedido: PedidoClienteRecord): string {
  const bloques: string[] = []

  if (pedido.tipo_producto_otro?.trim()) {
    bloques.push(`Especificación del cliente:\n${pedido.tipo_producto_otro.trim()}`)
  }
  if (pedido.objetivo_proyecto?.trim()) {
    bloques.push(`Objetivo:\n${pedido.objetivo_proyecto.trim()}`)
  }
  if (pedido.brief_publico?.trim()) {
    bloques.push(`Brief:\n${pedido.brief_publico.trim()}`)
  }
  if (pedido.donde_colocados?.trim()) {
    bloques.push(`Ubicación / uso:\n${pedido.donde_colocados.trim()}`)
  }
  const formato = labelFormatoPedido(pedido.digital_o_impresion || '')
  if (formato) bloques.push(`Formato: ${formato}`)
  if (pedido.cantidades?.trim()) bloques.push(`Cantidades: ${pedido.cantidades.trim()}`)
  if (pedido.estilo_diseno?.trim()) bloques.push(`Estilo: ${pedido.estilo_diseno.trim()}`)
  if (pedido.referencias?.trim()) bloques.push(`Referencias:\n${pedido.referencias.trim()}`)
  if (pedido.referencias_links?.trim()) {
    bloques.push(`Links:\n${pedido.referencias_links.trim()}`)
  }

  return bloques.join('\n\n')
}

export function isImageArchivo(archivo: PedidoClienteArchivoRecord): boolean {
  const tipo = (archivo.tipo || '').toLowerCase()
  const nombre = archivo.nombre_archivo.toLowerCase()
  return (
    tipo.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(nombre)
  )
}

export async function downloadArchivo(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo descargar el archivo')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
