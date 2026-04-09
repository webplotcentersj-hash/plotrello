import type { Task, TaskStatus } from '../types/board'

/** Sectores donde hace falta evidencia fotográfica del lugar (armado de OP o columna destino). */
export const SECTORES_ETIQUETA_FOTOS_LUGAR = ['Instalaciones', 'Metalúrgica'] as const

/** Columnas del tablero principal que exigen foto del lugar al entrar. */
export const TASK_STATUS_DESTINO_FOTOS_LUGAR: TaskStatus[] = ['instalaciones', 'metalurgica']

export function sectorNombreRequiereFotosLugar(nombre: string): boolean {
  return (SECTORES_ETIQUETA_FOTOS_LUGAR as readonly string[]).includes(nombre)
}

export function taskStatusDestinoRequiereFotosLugar(status: TaskStatus): boolean {
  return TASK_STATUS_DESTINO_FOTOS_LUGAR.includes(status)
}

/** La OP tiene Instalaciones o Metalúrgica entre sectores requeridos. */
export function opSectoresRequierenFotosLugar(sectores: string[] | null | undefined): boolean {
  if (!sectores?.length) return false
  return sectores.some((s) => sectorNombreRequiereFotosLugar(s))
}

/** Esta ficha está en columna Instalaciones o Metalúrgica (por status o sector asignado a la tarjeta). */
export function taskEstaEnColumnaInstalacionOMetalurgica(
  task: Pick<Task, 'status' | 'assignedSector'>
): boolean {
  if (taskStatusDestinoRequiereFotosLugar(task.status)) return true
  if (task.assignedSector && sectorNombreRequiereFotosLugar(task.assignedSector)) return true
  return false
}

export function isLikelyImageFile(name: string, mime?: string | null): boolean {
  if (mime?.startsWith('image/')) return true
  const base = name.split('/').pop()?.split('?')[0] || name
  return /\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(base)
}

export type SitePhotoAttachmentLike = {
  remoteUrl?: string
  uploading?: boolean
  type?: string
  name: string
}

export function attachmentListHasReadySitePhoto(attachments: SitePhotoAttachmentLike[]): boolean {
  return attachments.some(
    (a) => Boolean(a.remoteUrl && !a.uploading) && isLikelyImageFile(a.name, a.type)
  )
}

/** Portada / URL que parezca imagen. */
export function taskPhotoUrlCountAsSitePhoto(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  const last = url.split('/').pop() || ''
  const base = last.split('?')[0] || ''
  return isLikelyImageFile(base)
}

/** Filas tipo enlaces_adjuntos (titulo + url). */
export function archivosRowsHaveImage(
  rows: Array<{ titulo?: string | null; url?: string | null }>
): boolean {
  for (const r of rows) {
    const url = r.url?.trim()
    if (!url) continue
    const name =
      (r.titulo && String(r.titulo).trim()) || url.split('/').pop()?.split('?')[0] || ''
    if (isLikelyImageFile(name)) return true
  }
  return false
}
