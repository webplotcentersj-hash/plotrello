import type { OportunidadVenta } from '../types/api'
import { getArgentinaDateString } from './dateUtils'

/** Valor esperado del pipeline (solo oportunidades activas no cerradas/perdidas). */
export function valorPonderadoPipeline(opps: OportunidadVenta[]): number {
  return opps
    .filter((o) => o.activo && o.etapa !== 'Cerrado' && o.etapa !== 'Perdido')
    .reduce((sum, o) => {
      const v = o.valor_estimado ?? 0
      const p = (o.probabilidad_cierre ?? 0) / 100
      return sum + v * p
    }, 0)
}

/** Fecha YYYY-MM-DD más temprana entre próximas acciones de los seguimientos. */
export function fechaProximaAccionMasTemprana(op: OportunidadVenta): string | null {
  const dates = (op.seguimientos || [])
    .map((s) => s.fecha_proxima_accion)
    .filter((d): d is string => !!d)
    .map((d) => d.split('T')[0])
  if (!dates.length) return null
  return dates.reduce((a, b) => (a <= b ? a : b))
}

/** Días desde hoy AR hasta fecha YYYY-MM-DD (positivo = futuro). */
function diasDesdeHoyArgentina(isoDate: string): number {
  const today = getArgentinaDateString()
  const t = new Date(`${today}T12:00:00`).getTime()
  const x = new Date(`${isoDate}T12:00:00`).getTime()
  return Math.round((x - t) / (86400000))
}

export type UrgenciaProximaAccion = 'vencida' | 'hoy' | 'semana' | null

/** Clasificación para badges y filtros (solo para oportunidades con fecha próxima cargada). */
export function urgenciaProximaAccion(op: OportunidadVenta): UrgenciaProximaAccion {
  const d = fechaProximaAccionMasTemprana(op)
  if (!d) return null
  const diff = diasDesdeHoyArgentina(d)
  if (diff < 0) return 'vencida'
  if (diff === 0) return 'hoy'
  if (diff <= 7) return 'semana'
  return null
}

/** Prioridad alta: acción vencida o para hoy (pipeline activo). */
export function oportunidadRequiereAtencionInmediata(op: OportunidadVenta): boolean {
  if (!op.activo || op.etapa === 'Cerrado' || op.etapa === 'Perdido') return false
  const u = urgenciaProximaAccion(op)
  return u === 'vencida' || u === 'hoy'
}
