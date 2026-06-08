import { parseISO, startOfMonth, subMonths } from 'date-fns'
import type { UsuarioBajaLog } from '../types/api'

export type IndicadoresPersonalRrhh = {
  totalColaboradores: number
  activos: number
  desvinculados: number
  bajasMes: number
  bajasAnio: number
  rotacionMensual: number
  rotacionAnual: number
}

export function calcularIndicadoresPersonal(
  activos: number,
  bajas: UsuarioBajaLog[]
): IndicadoresPersonalRrhh {
  const now = new Date()
  const inicioMes = startOfMonth(now)
  const hace12Meses = subMonths(now, 12)

  const fechaBaja = (b: UsuarioBajaLog) =>
    b.fecha_desvinculacion ? parseISO(b.fecha_desvinculacion) : parseISO(b.created_at)

  const bajasMes = bajas.filter((b) => fechaBaja(b) >= inicioMes).length
  const bajasAnio = bajas.filter((b) => fechaBaja(b) >= hace12Meses).length
  const desvinculados = bajas.length

  const rotacionMensual = activos > 0 ? (bajasMes / activos) * 100 : 0
  const rotacionAnual = activos > 0 ? (bajasAnio / activos) * 100 : 0

  return {
    totalColaboradores: activos + desvinculados,
    activos,
    desvinculados,
    bajasMes,
    bajasAnio,
    rotacionMensual,
    rotacionAnual
  }
}

export function fmtRotacion(pct: number) {
  return `${pct.toFixed(1).replace('.', ',')}%`
}
