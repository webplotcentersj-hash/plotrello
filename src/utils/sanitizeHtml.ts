/**
 * Sanitiza HTML de salidas IA (marked) antes de dangerouslySetInnerHTML.
 * Fallback sin DOMPurify: strip tags básicos.
 */
export function sanitizeHtml(html: string): string {
  const raw = String(html || '')
  if (!raw) return ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DOMPurify = (globalThis as any).DOMPurify
  if (DOMPurify?.sanitize) {
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
  }
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}
