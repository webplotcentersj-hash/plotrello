/** Extrae número de OP / ref desde el texto de un QR (URL op-public o texto libre). */
export function parseOpRefFromQrPayload(raw: string): string | null {
  const text = String(raw ?? '').trim()
  if (!text) return null

  try {
    const asUrl = text.includes('://') || text.startsWith('/') ? new URL(text, window.location.origin) : null
    if (asUrl) {
      const pathMatch = asUrl.pathname.match(/\/op-public\/([^/]+)/i)
      if (pathMatch?.[1]) {
        return decodeURIComponent(pathMatch[1]).trim() || null
      }
      const q =
        asUrl.searchParams.get('op') ||
        asUrl.searchParams.get('numero_op') ||
        asUrl.searchParams.get('opNumber')
      if (q?.trim()) return q.trim()
    }
  } catch {
    /* no es URL */
  }

  const pathOnly = text.match(/op-public\/([^/?#\s]+)/i)
  if (pathOnly?.[1]) {
    try {
      return decodeURIComponent(pathOnly[1]).trim() || null
    } catch {
      return pathOnly[1].trim() || null
    }
  }

  const opPrefixed = text.match(/\bOP[\s\-_:#]*([A-Za-z0-9\-_.]+)\b/i)
  if (opPrefixed?.[1]) return opPrefixed[1].trim()

  const ficha = text.match(/\bFICHA[\s\-_:#]*([A-Za-z0-9\-_.]+)\b/i)
  if (ficha?.[1]) return `FICHA-${ficha[1].trim()}`

  // Solo dígitos / código corto (p. ej. 104132)
  if (/^[A-Za-z0-9\-_.]{2,40}$/.test(text) && !text.includes(' ')) {
    return text
  }

  return null
}
