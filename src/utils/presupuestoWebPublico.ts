import { apiService } from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { PresupuestoVentaRecord } from '../types/api'
import { uploadAttachmentAndGetUrl } from './storage'

export type ItemPresupuestoWeb = {
  id_articulo_stock?: number
  codigo_articulo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  observaciones?: string
}

export type CrearPresupuestoWebParams = {
  origen: 'manual' | 'ai'
  cliente_nombre: string
  cliente_telefono: string
  cliente_email?: string | null
  items: ItemPresupuestoWeb[]
  observaciones_cliente?: string | null
  /** URLs públicas de fotos que mandó el cliente. */
  fotosUrls?: string[]
  /** Descripción PlotAI de las referencias. */
  descripcionFotos?: string | null
  /** URL de la imagen propuesta generada. */
  imagenPropuestaUrl?: string | null
  /** Días de validez; default 15. */
  diasValidez?: number
}

export function whatsappHrefDesdeTelefono(tel: string | null | undefined): string | null {
  if (!tel?.trim()) return null
  let d = tel.replace(/\D/g, '')
  if (d.length < 8) return null
  if (d.startsWith('0')) d = d.slice(1)
  if (!d.startsWith('54')) d = `54${d}`
  return `https://wa.me/${d}`
}

function fechaVencimientoISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildObservacionesInternasWeb(params: {
  origenLabel: string
  telefono?: string | null
  fotosUrls?: string[]
  descripcionFotos?: string | null
  imagenPropuestaUrl?: string | null
}): string {
  const lineas: string[] = [
    `Origen web pública · ${params.origenLabel}. Revisar y confirmar en /ventas → Presupuestos.`
  ]
  const wa = whatsappHrefDesdeTelefono(params.telefono)
  if (wa) lineas.push(`WhatsApp: ${wa}`)
  if (params.descripcionFotos?.trim()) {
    lineas.push('', 'Descripción PlotAI de referencias:', params.descripcionFotos.trim())
  }
  if (params.fotosUrls?.length) {
    lineas.push('', 'Fotos del cliente:')
    for (const url of params.fotosUrls) lineas.push(`- ${url}`)
  }
  if (params.imagenPropuestaUrl) {
    lineas.push('', 'Imagen propuesta PlotAI:')
    lineas.push(`- ${params.imagenPropuestaUrl}`)
  }
  return lineas.join('\n')
}

/** Extrae URLs http(s) de un bloque de observaciones (fotos / imagen propuesta). */
export function extraerUrlsDeObservaciones(texto: string | null | undefined): string[] {
  if (!texto) return []
  const matches = texto.match(/https?:\/\/[^\s<>"')\]]+/g) || []
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, '')))]
}

export function extraerWhatsappDeObservaciones(texto: string | null | undefined): string | null {
  if (!texto) return null
  const m = texto.match(/WhatsApp:\s*(https?:\/\/wa\.me\/[^\s]+)/i)
  return m?.[1] || null
}

export async function dataUrlToUploadedUrl(
  dataUrl: string,
  folder = 'presupuesto-web'
): Promise<string | null> {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const file = new File([blob], `ref-${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' })
    return await uploadAttachmentAndGetUrl(file, folder)
  } catch (e) {
    console.warn('No se pudo subir imagen de presupuesto web:', e)
    return null
  }
}

/**
 * Crea un presupuesto en `presupuestos_ventas` (visible en /ventas → Presupuestos).
 * Pensado para la página pública /presupuesto (anon).
 */
export async function crearPresupuestoWebPublico(
  params: CrearPresupuestoWebParams
): Promise<{ success: true; data: PresupuestoVentaRecord } | { success: false; error: string }> {
  const nombre = params.cliente_nombre.trim()
  const telefono = params.cliente_telefono.trim()
  if (nombre.length < 3) return { success: false, error: 'Necesitamos tu nombre.' }
  if (telefono.length < 6) return { success: false, error: 'Necesitamos un WhatsApp o teléfono.' }

  const items =
    params.items.length > 0
      ? params.items
      : [
          {
            descripcion: (params.observaciones_cliente || 'Consulta de presupuesto web').slice(0, 240),
            cantidad: 1,
            precio_unitario: 0,
            precio_total: 0,
            observaciones: params.observaciones_cliente || undefined
          }
        ]

  const origenLabel = params.origen === 'ai' ? 'PlotAI (/presupuesto)' : 'Manual (/presupuesto)'
  const internas = buildObservacionesInternasWeb({
    origenLabel,
    telefono,
    fotosUrls: params.fotosUrls,
    descripcionFotos: params.descripcionFotos,
    imagenPropuestaUrl: params.imagenPropuestaUrl
  })

  const res = await apiService.crearPresupuestoVenta({
    cliente_nombre: nombre,
    cliente_telefono: telefono,
    cliente_email: params.cliente_email?.trim() || undefined,
    nombre_vendedor: origenLabel,
    items: items.map((it) => ({
      id_articulo_stock: it.id_articulo_stock,
      codigo_articulo: it.codigo_articulo || undefined,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      descuento: 0,
      precio_total: it.precio_total,
      observaciones: it.observaciones
    })),
    fecha_vencimiento: fechaVencimientoISO(params.diasValidez ?? 15),
    observaciones_cliente: params.observaciones_cliente || undefined,
    observaciones_internas: internas,
    estado: 'enviado',
    tipo_lista_precio: 'lista_1'
  })

  if (!res.success || !res.data) {
    return { success: false, error: res.error || 'No se pudo crear el presupuesto en Ventas.' }
  }
  return { success: true, data: res.data }
}

/** Anexa la imagen propuesta al presupuesto ya creado (para el panel de Ventas). */
export async function anexarImagenPropuestaPresupuesto(
  id: number,
  imagenUrl: string,
  telefono?: string | null
): Promise<void> {
  if (!supabase) return
  const { data } = await supabase
    .from('presupuestos_ventas')
    .select('observaciones_internas, nombre_vendedor, cliente_telefono')
    .eq('id', id)
    .maybeSingle()

  const actuales = (data?.observaciones_internas as string | null) || ''
  if (actuales.includes(imagenUrl)) return

  const internas = buildObservacionesInternasWeb({
    origenLabel: (data?.nombre_vendedor as string) || 'PlotAI (/presupuesto)',
    telefono: telefono || (data?.cliente_telefono as string | null),
    fotosUrls: extraerUrlsDeObservaciones(actuales).filter(
      (u) => u.includes('/presupuesto-web/') || u.includes('/storage/')
    ),
    descripcionFotos: actuales.includes('Descripción PlotAI')
      ? actuales.split('Descripción PlotAI de referencias:')[1]?.split('Fotos del cliente:')[0]?.trim()
      : null,
    imagenPropuestaUrl: imagenUrl
  })

  // Conservar texto previo si había más contexto, y asegurar WhatsApp + imagen.
  const merged = actuales.includes('Imagen propuesta PlotAI:')
    ? actuales
    : `${actuales.trim()}\n\nImagen propuesta PlotAI:\n- ${imagenUrl}`.trim()

  await supabase
    .from('presupuestos_ventas')
    .update({ observaciones_internas: internas.includes(imagenUrl) ? internas : merged })
    .eq('id', id)
}
