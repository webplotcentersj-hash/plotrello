import { getISOWeek, parseISO } from 'date-fns'
import { horarioSabadoEfectivo, HORARIO_SABADO } from '../services/relojBiometricoService'
import {
  resolverRotacionUsuario,
  type RotacionAsignacion,
  type RotacionPlantilla
} from './rrhhTurnosRotativos'

export type HorarioFijoEsperado = {
  entrada: string
  salida: string
  trabajaSabado?: boolean
  sabadoEntrada?: string | null
  sabadoSalida?: string | null
  horas?: number | null
}

export type OverrideDiaEsperado = {
  entrada: string
  salida: string
}

export type SabadoModoEsperado = 'todos' | 'par' | 'impar'

export type HorarioEsperadoDia = {
  entrada: string | null
  salida: string | null
  origen: 'override' | 'rotativo' | 'fijo' | 'ninguno'
  esFranco: boolean
  etiqueta?: string
}

function correspondeSabado(modo: SabadoModoEsperado, fechaIso: string): boolean {
  if (modo === 'todos') return true
  const par = getISOWeek(parseISO(fechaIso.slice(0, 10))) % 2 === 0
  return modo === 'par' ? par : !par
}

/**
 * Misma prioridad que `obtener_hora_entrada_fijo_vigente` en Postgres:
 * override del día → rotativo → horario fijo (sábado / sábados por medio).
 */
export function resolverHorarioEsperadoDia(opts: {
  fechaIso: string
  fijo?: HorarioFijoEsperado | null
  override?: OverrideDiaEsperado | null
  plantillas?: RotacionPlantilla[]
  asignaciones?: RotacionAsignacion[]
  idUsuario: number
  sabadoModo?: SabadoModoEsperado
}): HorarioEsperadoDia {
  const fecha = opts.fechaIso.slice(0, 10)
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()

  if (opts.override?.entrada && opts.override?.salida) {
    return {
      entrada: opts.override.entrada.slice(0, 5),
      salida: opts.override.salida.slice(0, 5),
      origen: 'override',
      esFranco: false,
      etiqueta: 'Ajuste del día'
    }
  }

  const rot = resolverRotacionUsuario(
    opts.plantillas || [],
    opts.asignaciones || [],
    opts.idUsuario,
    fecha
  )
  if (rot) {
    if (rot.esFranco || !rot.entrada || !rot.salida) {
      return {
        entrada: null,
        salida: null,
        origen: 'rotativo',
        esFranco: true,
        etiqueta: rot.etiqueta
      }
    }
    return {
      entrada: rot.entrada,
      salida: rot.salida,
      origen: 'rotativo',
      esFranco: false,
      etiqueta: `${rot.rotacionNombre} · ${rot.etiqueta}`
    }
  }

  const fijo = opts.fijo
  if (!fijo) {
    return { entrada: null, salida: null, origen: 'ninguno', esFranco: dow === 0 }
  }

  if (dow === 0) {
    return { entrada: null, salida: null, origen: 'fijo', esFranco: true, etiqueta: 'Domingo' }
  }

  if (dow === 6) {
    const modo = opts.sabadoModo || 'todos'
    if (fijo.trabajaSabado === false) {
      return { entrada: null, salida: null, origen: 'fijo', esFranco: true, etiqueta: 'No trabaja sábados' }
    }
    if (!correspondeSabado(modo, fecha)) {
      return {
        entrada: null,
        salida: null,
        origen: 'fijo',
        esFranco: true,
        etiqueta: 'Sábado por medio'
      }
    }
    const sab = horarioSabadoEfectivo(fijo) || HORARIO_SABADO
    return {
      entrada: sab.entrada,
      salida: sab.salida,
      origen: 'fijo',
      esFranco: false,
      etiqueta: 'Horario sábado'
    }
  }

  return {
    entrada: (fijo.entrada || '').slice(0, 5) || null,
    salida: (fijo.salida || '').slice(0, 5) || null,
    origen: 'fijo',
    esFranco: false,
    etiqueta: 'Horario fijo'
  }
}
