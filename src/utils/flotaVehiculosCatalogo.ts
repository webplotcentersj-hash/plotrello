import type { Vehiculo, VehiculoEstadoParque } from '../types/api'

/**
 * Orden fijo del parque (debe coincidir con seeds SQL en `vehiculos`).
 * Si un nombre no está en la API, igual se muestra la tarjeta (deshabilitada).
 */
export const FLOTA_VEHICULOS_CATALOGO: readonly string[] = [
  'Amarok',
  'Berlingo',
  'Lifán',
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

export type ItemParqueFlota = {
  id: number | null
  nombre: string
  activo: boolean
  enBase: boolean
  estado_parque: VehiculoEstadoParque
  estado_parque_detalle?: string | null
}

/** True si se puede iniciar una nueva solicitud de salida con este vehículo. */
export function vehiculoPuedeSolicitarSalida(v: {
  activo?: boolean
  estado_parque?: VehiculoEstadoParque | string | null
}): boolean {
  if (v.activo === false) return false
  const e = (v.estado_parque ?? 'disponible') as VehiculoEstadoParque
  return e === 'disponible'
}

export function etiquetaEstadoParque(
  estado: VehiculoEstadoParque | string | null | undefined,
  detalle?: string | null
): string {
  const e = (estado ?? 'disponible') as VehiculoEstadoParque
  const d = detalle?.trim()
  switch (e) {
    case 'disponible':
      return 'Disponible'
    case 'fuera_servicio':
      return 'Fuera de servicio'
    case 'en_taller':
      return 'En taller / mantenimiento'
    case 'otro':
      return d ? `Otro: ${d}` : 'Otro'
    default:
      return String(estado ?? '—')
  }
}

/** Une catálogo fijo con filas de API (por nombre). */
export function vehiculosParqueDesdeApi(api: Vehiculo[]): ItemParqueFlota[] {
  const map = new Map<string, Vehiculo>()
  for (const v of api) {
    map.set(normalizeNombre(v.nombre), v)
  }
  return FLOTA_VEHICULOS_CATALOGO.map((nombre) => {
    const hit = map.get(normalizeNombre(nombre))
    if (hit) {
      const ep = (hit.estado_parque ?? 'disponible') as VehiculoEstadoParque
      return {
        id: hit.id,
        nombre: hit.nombre,
        activo: hit.activo,
        enBase: true,
        estado_parque: ep,
        estado_parque_detalle: hit.estado_parque_detalle ?? null
      }
    }
    return {
      id: null,
      nombre,
      activo: true,
      enBase: false,
      estado_parque: 'disponible',
      estado_parque_detalle: null
    }
  })
}
