/**
 * Orden fijo del parque (debe coincidir con seeds SQL en `vehiculos`).
 * Si un nombre no está en la API, igual se muestra la tarjeta (deshabilitada).
 */
export const FLOTA_VEHICULOS_CATALOGO: readonly string[] = [
  'Amarok',
  'Berlingo',
  'Camión MB',
  'Lifán',
  'Máster',
  'Ránger',
  'Camión LED'
] as const

function normalizeNombre(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

/** Une catálogo fijo con filas de API (por nombre). */
export function vehiculosParqueDesdeApi(api: { id: number; nombre: string; activo: boolean }[]): Array<{
  id: number | null
  nombre: string
  activo: boolean
  enBase: boolean
}> {
  const map = new Map<string, { id: number; nombre: string; activo: boolean }>()
  for (const v of api) {
    map.set(normalizeNombre(v.nombre), v)
  }
  return FLOTA_VEHICULOS_CATALOGO.map((nombre) => {
    const hit = map.get(normalizeNombre(nombre))
    if (hit) {
      return { id: hit.id, nombre: hit.nombre, activo: hit.activo, enBase: true }
    }
    return { id: null, nombre, activo: true, enBase: false }
  })
}
