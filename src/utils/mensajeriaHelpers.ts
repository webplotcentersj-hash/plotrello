export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function avatarHue(userId: number): number {
  return (userId * 47) % 360
}

export function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split('?')[0]
    const parts = clean.split('/')
    return decodeURIComponent(parts[parts.length - 1] || 'archivo')
  } catch {
    return 'archivo'
  }
}

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url.split('?')[0])
}

export function formatDayDivider(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, yesterday)) return 'Ayer'
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo descargar el archivo')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export function downloadProofJson(
  proof: {
    proof_token: string
    message_id: number
    room_id: number
    id_usuario: number
    nombre_usuario: string
    mensaje: string
    msg_timestamp: string
    archivos_urls: string[]
    token_created_at: string
    verify_url: string
    sistema: string
  }
): void {
  const payload = {
  ...proof,
    generado_en: new Date().toISOString(),
    nota: 'Documento de prueba verificable. Consultá verify_url para validar el token en el sistema.'
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = `prueba-mensaje-${proof.message_id}-${proof.proof_token.slice(0, 8)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
