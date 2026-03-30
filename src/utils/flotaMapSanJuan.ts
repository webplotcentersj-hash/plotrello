/** Centro de mapa: San Juan, Argentina (capital). */
export const FLOTA_MAP_CENTER: [number, number] = [-31.5375, -68.5364]

/**
 * Bbox Photon/Nominatim: provincia de San Juan (aprox.) para priorizar resultados locales
 * y evitar homónimos (ej. San Juan, Puerto Rico). Formato minLon,minLat,maxLon,maxLat.
 */
export const FLOTA_SEARCH_BBOX = '-69.9,-32.55,-65.85,-28.25' as const

export const FLOTA_MAP_ZOOM_CIUDAD = 12
export const FLOTA_MAP_ZOOM_CERCA = 14

const EARTH_KM = 6371

/** Distancia en km entre dos puntos WGS84 (para ordenar resultados de geocodificación). */
export function flotaDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r1 = (lat1 * Math.PI) / 180
  const r2 = (lat2 * Math.PI) / 180
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
  return EARTH_KM * c
}
