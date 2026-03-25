/**
 * Intenta extraer lat/lng de enlaces típicos de Google Maps / coordenadas en query.
 */
export function parseLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null
  const u = url.trim()

  const at = u.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|\?|\/|$)/)
  if (at) {
    const lat = parseFloat(at[1])
    const lng = parseFloat(at[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  const q = u.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (q) {
    const lat = parseFloat(q[1])
    const lng = parseFloat(q[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  const ll = u.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (ll) {
    const lat = parseFloat(ll[1])
    const lng = parseFloat(ll[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  return null
}
