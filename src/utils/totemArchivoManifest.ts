export type TotemArchivoItem = {
  url: string
  nombre: string
  bytes?: number
}

export type TotemArchivoManifest = {
  files: TotemArchivoItem[]
}

export function isTotemArchivoManifest(raw: string): boolean {
  const s = String(raw || '').trim()
  return s.startsWith('{') && s.includes('"files"')
}

export function parseTotemArchivoManifest(raw: string): TotemArchivoManifest {
  const s = String(raw || '').trim()
  if (!s) return { files: [] }
  if (isTotemArchivoManifest(s)) {
    try {
      const parsed = JSON.parse(s) as { files?: TotemArchivoItem[] }
      const files = Array.isArray(parsed.files)
        ? parsed.files.filter((f) => f?.url && String(f.url).trim())
        : []
      return { files }
    } catch {
      return { files: [] }
    }
  }
  return { files: [{ url: s, nombre: '' }] }
}

export function buildTotemArchivoManifest(files: TotemArchivoItem[]): string {
  if (files.length === 0) return ''
  if (files.length === 1) return files[0].url
  return JSON.stringify({ files })
}

export function summarizeTotemArchivoNombres(files: TotemArchivoItem[]): string {
  if (files.length === 0) return ''
  if (files.length === 1) return files[0].nombre || 'archivo'
  const names = files.map((f) => f.nombre || 'archivo').slice(0, 4)
  const extra = files.length > names.length ? ` (+${files.length - names.length})` : ''
  return `${files.length} archivos: ${names.join(', ')}${extra}`
}
