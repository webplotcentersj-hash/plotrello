/** Payload impreso en tarjetas QR del reloj tablet. */
const PREFIX = 'PLOTLAB:RELOJ:'
const VERSION = '1'

export function buildRelojTabletQrPayload(idUsuario: number): string {
  if (!idUsuario || Number.isNaN(idUsuario)) return ''
  return `${PREFIX}${VERSION}:${idUsuario}`
}

export function parseRelojTabletQrPayload(raw: string): number | null {
  const t = String(raw || '').trim()
  const m = t.match(/^PLOTLAB:RELOJ:1:(\d+)$/i)
  if (!m) return null
  const id = Number(m[1])
  return id > 0 && Number.isFinite(id) ? id : null
}
