export interface PedidoMensajePiiResult {
  ok: boolean
  reasons: string[]
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const WHATSAPP_RE = /(whatsapp|wsp|wa\.me|api\.whatsapp)/i
const TELEGRAM_RE = /(t\.me\/|telegram\.me\/)/i
const AR_PHONE_RE =
  /(?:\+?54\s?)?(?:9\s?)?(?:11|[2-9]\d{2})[\s.-]?\d{3,4}[\s.-]?\d{4}/
const GENERIC_PHONE_RE = /\b\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{3,4}\b/

function hasLongDigitSequence(text: string, minLen: number): boolean {
  const digits = text.replace(/\D/g, '')
  return new RegExp(`\\d{${minLen},}`).test(digits)
}

export function validatePedidoMensajeSinPii(text: string): PedidoMensajePiiResult {
  const trimmed = text.trim()
  const reasons: string[] = []

  if (!trimmed) {
    return { ok: false, reasons: ['El mensaje está vacío.'] }
  }

  if (EMAIL_RE.test(trimmed)) {
    reasons.push('No podés incluir direcciones de email.')
  }
  if (WHATSAPP_RE.test(trimmed)) {
    reasons.push('No podés compartir enlaces de WhatsApp.')
  }
  if (TELEGRAM_RE.test(trimmed)) {
    reasons.push('No podés compartir enlaces de Telegram.')
  }
  if (hasLongDigitSequence(trimmed, 22)) {
    reasons.push('No podés incluir CBU, CVU u otros datos bancarios.')
  }
  if (AR_PHONE_RE.test(trimmed) || GENERIC_PHONE_RE.test(trimmed)) {
    reasons.push('No podés incluir números de teléfono.')
  }

  return { ok: reasons.length === 0, reasons }
}

export function pedidoMensajePiiErrorMessage(result: PedidoMensajePiiResult): string {
  if (result.ok) return ''
  return result.reasons.join(' ')
}
