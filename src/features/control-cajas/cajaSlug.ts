/** Comparación flexible de slug/nombre de caja. */
export function mismoCajaSlug(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = a.toLowerCase().replace(/[^a-z0-9ñáéíóú]/g, '')
  const nb = b.toLowerCase().replace(/[^a-z0-9ñáéíóú]/g, '')
  if (!na || !nb) return false
  if (na === nb) return true
  // Slugs por usuario (u-3, u-31…): solo igualdad exacta, si no «u-3» matchea «u-31».
  if (/\d/.test(na) || /\d/.test(nb)) return false
  return na.includes(nb) || nb.includes(na)
}
