/** Link wa.me normalizado para Argentina. */
export function buildWhatsappLink(phone?: string | null, message?: string): string | undefined {
  if (!phone) return undefined
  let digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!digits.startsWith('54')) digits = `54${digits}`
  const base = `https://wa.me/${digits}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}
