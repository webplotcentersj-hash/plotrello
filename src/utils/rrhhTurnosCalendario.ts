import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import type { SolicitudPermiso } from '../types/api'
import { permisoEnDia } from './rrhhNovedadDates'
import { horarioSabadoEfectivo, HORARIO_SABADO } from '../services/relojBiometricoService'
import {
  resolverRotacionUsuario,
  type RotacionAsignacion,
  type RotacionPlantilla
} from './rrhhTurnosRotativos'
import { getISOWeek } from 'date-fns'

export type HorarioFijoCal = {
  entrada: string
  salida: string
  trabajaSabado: boolean
  sabadoEntrada?: string | null
  sabadoSalida?: string | null
}

export type OverrideCal = {
  entrada: string
  salida: string
}

export type SabadoModo = 'todos' | 'par' | 'impar'

export type DiaCalendarioTurnos = {
  fecha: string
  trabajando: number
  rotativos: number
  permisos: number
}

function semanaPar(fechaIso: string): boolean {
  return getISOWeek(parseISO(fechaIso)) % 2 === 0
}

function correspondeSabado(modo: SabadoModo, fechaIso: string): boolean {
  if (modo === 'todos') return true
  const par = semanaPar(fechaIso)
  return modo === 'par' ? par : !par
}

type BuildOpts = {
  mesIso: string
  idsUsuarios: number[]
  fijos: Record<number, HorarioFijoCal>
  overridesByFecha: Record<string, Record<number, OverrideCal>>
  sabadoMedio: Record<number, SabadoModo>
  permisos: SolicitudPermiso[]
  plantillas: RotacionPlantilla[]
  asignaciones: RotacionAsignacion[]
}

/** Resumen por día del mes para el calendario de turnos. */
export function buildDiasCalendarioTurnos(opts: BuildOpts): DiaCalendarioTurnos[] {
  const monthStart = startOfMonth(parseISO(`${opts.mesIso}-01`))
  const monthEnd = endOfMonth(monthStart)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const out: DiaCalendarioTurnos[] = []

  for (const day of days) {
    const fecha = format(day, 'yyyy-MM-dd')
    const dow = day.getDay()
    let trabajando = 0
    let rotativos = 0
    let permisos = 0
    const overridesDia = opts.overridesByFecha[fecha] || {}

    for (const id of opts.idsUsuarios) {
      const tienePermiso = opts.permisos.some(
        (p) => p.estado === 'aprobado' && p.id_usuario === id && permisoEnDia(p, fecha)
      )
      if (tienePermiso) {
        permisos += 1
        continue
      }

      const ov = overridesDia[id]
      if (ov?.entrada && ov?.salida) {
        trabajando += 1
        continue
      }

      const rot = resolverRotacionUsuario(opts.plantillas, opts.asignaciones, id, fecha)
      if (rot) {
        if (!rot.esFranco && rot.entrada && rot.salida) {
          trabajando += 1
          rotativos += 1
        }
        continue
      }

      const fijo = opts.fijos[id]
      if (!fijo) continue

      if (dow === 0) continue
      if (dow === 6) {
        const modo = opts.sabadoMedio[id] || 'todos'
        if (!fijo.trabajaSabado) continue
        if (!correspondeSabado(modo, fecha)) continue
        const sab = horarioSabadoEfectivo(fijo) || HORARIO_SABADO
        if (sab.entrada && sab.salida) trabajando += 1
        continue
      }

      if (fijo.entrada && fijo.salida) trabajando += 1
    }

    out.push({ fecha, trabajando, rotativos, permisos })
  }

  return out
}
