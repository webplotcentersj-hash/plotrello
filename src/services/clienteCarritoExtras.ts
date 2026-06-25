/** Metadatos por ítem de carrito (diseño propio, brief, archivos) hasta el checkout. */

import type { ClienteBriefFormData } from '../constants/clienteBriefForm'

export type CarritoArchivoRef = {
  nombre: string
  url: string
  tipo: string
  tamano: number
}

export type CarritoBriefProducto = ClienteBriefFormData

export type CarritoItemExtra = {
  tieneDiseno: boolean
  descripcionPersonalizada?: string
  archivos: CarritoArchivoRef[]
  brief?: CarritoBriefProducto
}

const STORAGE_PREFIX = 'plotrello_carrito_extras_v1'

function storageKey(clienteId: number): string {
  return `${STORAGE_PREFIX}_${clienteId}`
}

export function getCarritoExtras(clienteId: number): Record<number, CarritoItemExtra> {
  try {
    const raw = localStorage.getItem(storageKey(clienteId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CarritoItemExtra>
    const out: Record<number, CarritoItemExtra> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k)
      if (Number.isFinite(id) && v) out[id] = v
    }
    return out
  } catch {
    return {}
  }
}

export function getCarritoItemExtra(
  clienteId: number,
  articuloId: number
): CarritoItemExtra | undefined {
  return getCarritoExtras(clienteId)[articuloId]
}

export function setCarritoItemExtra(
  clienteId: number,
  articuloId: number,
  extra: CarritoItemExtra
): void {
  const all = getCarritoExtras(clienteId)
  all[articuloId] = extra
  localStorage.setItem(storageKey(clienteId), JSON.stringify(all))
}

export function removeCarritoItemExtra(clienteId: number, articuloId: number): void {
  const all = getCarritoExtras(clienteId)
  delete all[articuloId]
  localStorage.setItem(storageKey(clienteId), JSON.stringify(all))
}

export function clearCarritoExtras(clienteId: number): void {
  localStorage.removeItem(storageKey(clienteId))
}

const MATERIAL_LABELS: Record<string, string> = {
  si_pdf_eps_ai: 'Sí (PDF, EPS, AI)',
  si_solo_imagen: 'Sí, solo imagen/captura',
  no: 'No',
  necesito_diseno: 'Necesita diseño',
  si_definitivos: 'Textos definitivos',
  necesito_redacten: 'Necesita redacción',
  si_material_propio: 'Material propio',
  usar_banco_imagenes: 'Banco de imágenes'
}

function labelMaterial(value: string): string {
  return MATERIAL_LABELS[value] || value
}

export function buildDescripcionPersonalizada(extra: CarritoItemExtra, nombreArticulo: string): string {
  const lineas: string[] = []

  if (extra.tieneDiseno) {
    lineas.push(`[${nombreArticulo}] Cliente aporta diseño propio.`)
    if (extra.archivos.length) {
      lineas.push(`Archivos adjuntos (${extra.archivos.length}):`)
      for (const a of extra.archivos) {
        lineas.push(`- ${a.nombre}: ${a.url}`)
      }
    }
  } else if (extra.brief) {
    const b = extra.brief
    lineas.push(`[${nombreArticulo}] Solicita diseño — brief del producto:`)

    if (b.tipo_producto_servicio.length) {
      lineas.push(`Tipos: ${b.tipo_producto_servicio.join(', ')}`)
    }
    if (b.tipo_producto_otro.trim()) lineas.push(`Otro tipo: ${b.tipo_producto_otro.trim()}`)
    if (b.necesita_asesoramiento) lineas.push('Necesita asesoramiento')
    if (b.donde_colocados.trim()) lineas.push(`Dónde colocados: ${b.donde_colocados.trim()}`)
    if (b.digital_o_impresion.trim()) {
      lineas.push(`Digital/impresión: ${b.digital_o_impresion.trim()}`)
    }
    if (b.cantidades.trim()) lineas.push(`Cantidades: ${b.cantidades.trim()}`)
    if (b.objetivo_proyecto.trim()) lineas.push(`Objetivo: ${b.objetivo_proyecto.trim()}`)
    if (b.material_logo) lineas.push(`Logo: ${labelMaterial(b.material_logo)}`)
    if (b.material_textos) lineas.push(`Textos: ${labelMaterial(b.material_textos)}`)
    if (b.material_imagenes) {
      lineas.push(`Imágenes: ${labelMaterial(b.material_imagenes)}`)
    }
    if (b.tiene_referencias && b.referencias_links.trim()) {
      lineas.push(`Referencias de estilo: ${b.referencias_links.trim()}`)
    }
    if (b.brief_publico.trim()) lineas.push(`Descripción: ${b.brief_publico.trim()}`)
    if (b.estilo_diseno.trim()) lineas.push(`Estilo deseado: ${b.estilo_diseno.trim()}`)
    if (b.referencias.trim()) lineas.push(`Referencias adicionales: ${b.referencias.trim()}`)
    if (b.fecha_limite_brief.trim()) lineas.push(`Fecha límite: ${b.fecha_limite_brief.trim()}`)
    if (b.es_urgencia) lineas.push('Marcado como URGENCIA')

    if (extra.archivos.length) {
      lineas.push(`Referencias adjuntas (${extra.archivos.length}):`)
      for (const a of extra.archivos) {
        lineas.push(`- ${a.nombre}: ${a.url}`)
      }
    }
  }

  if (extra.descripcionPersonalizada?.trim()) {
    lineas.push(extra.descripcionPersonalizada.trim())
  }

  return lineas.join('\n').trim()
}
