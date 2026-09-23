import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from './staffSession'

export type TipoClasificacion = 'rubro_venta_item' | 'motivo_falla_entrega'

export type PendientesClasificacion = Record<TipoClasificacion, number>

export type KpisClasificacion = {
  /** Hay TYPESAFE_API_KEY en el servidor (sin clave solo se clasifica por catálogo / reglas). */
  iaConfigurada: boolean
  pendientes: PendientesClasificacion
  ventasPorRubro: {
    monto_total: number
    items: number
    por_rubro: Array<{ rubro: string; monto: number; items: number; items_ia: number }>
  }
  fallasEntrega: {
    encuestas: number
    insatisfechas: number
    rating_promedio: number | null
    por_motivo: Array<{ motivo: string; cantidad: number }>
    por_sector: Array<{ sector: string; motivo: string; cantidad: number }>
  }
}

export type LoteClasificacion = {
  tipo: TipoClasificacion
  clasificados: { catalogo: number; regla: number; ia: number; revisar: number }
  sinClave: boolean
  error?: string
  pendientes: PendientesClasificacion
}

async function post<T>(body: Record<string, unknown>): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const token = getStaffAuthToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await plotLabFetch('/api/erp/clasificacion-ia', { method: 'POST', headers, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null
    if (!res.ok || !json?.success) return { success: false, error: json?.error || `HTTP ${res.status}` }
    return { success: true, data: json.data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}

export function getKpisClasificacion(desde: string, hasta: string) {
  return post<KpisClasificacion>({ accion: 'kpis', desde, hasta })
}

export function clasificarPendientes(tipo: TipoClasificacion, limite = 40) {
  return post<LoteClasificacion>({ accion: 'clasificar', tipo, limite })
}
