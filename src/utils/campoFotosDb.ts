/** Blob (p. ej. grabación de audio) a data URL para guardar en BD. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer el audio'))
    r.readAsDataURL(blob)
  })
}

/** Convierte un archivo a data URL (guardado en BD en `enlaces_adjuntos.url`, sin Storage). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer el archivo'))
    r.readAsDataURL(file)
  })
}

/**
 * Reduce tamaño para filas grandes en Postgres; si falla (HEIC, etc.), devuelve data URL original.
 */
export async function compressImageFileToJpegDataUrl(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return fileToDataUrl(file)
  }
  try {
    const bitmap = await createImageBitmap(file)
    const ratio = Math.min(1, maxWidth / bitmap.width)
    const w = Math.max(1, Math.round(bitmap.width * ratio))
    const h = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return fileToDataUrl(file)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return fileToDataUrl(file)
  }
}
