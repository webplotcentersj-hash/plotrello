/** Metadatos por ítem de carrito (diseño propio, brief, archivos) hasta el checkout. */

export type CarritoArchivoRef = {
  nombre: string
  url: string
  tipo: string
  tamano: number
}

export type CarritoBriefProducto = {
  objetivo: string
  estilo: string
  cantidades: string
  referencias: string
  notas: string
}

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
    lineas.push(`[${nombreArticulo}] Solicita diseño — brief del producto:`)
    if (extra.brief.objetivo.trim()) lineas.push(`Objetivo: ${extra.brief.objetivo.trim()}`)
    if (extra.brief.estilo.trim()) lineas.push(`Estilo: ${extra.brief.estilo.trim()}`)
    if (extra.brief.cantidades.trim()) lineas.push(`Cantidades/medidas: ${extra.brief.cantidades.trim()}`)
    if (extra.brief.referencias.trim()) lineas.push(`Referencias: ${extra.brief.referencias.trim()}`)
    if (extra.brief.notas.trim()) lineas.push(`Notas: ${extra.brief.notas.trim()}`)
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
