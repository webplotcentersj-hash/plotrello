import { differenceInCalendarDays, parseISO } from 'date-fns'

export type RotacionSlot = {
  id?: number
  id_rotacion?: number
  dia_offset: number
  etiqueta: string
  hora_entrada: string | null
  hora_salida: string | null
  es_franco: boolean
}

export type RotacionPlantilla = {
  id: number
  nombre: string
  ciclo_dias: number
  fecha_ancla: string
  color: string
  activo: boolean
  notas?: string | null
  slots: RotacionSlot[]
}

export type RotacionAsignacion = {
  id: number
  id_rotacion: number
  id_usuario: number
  fase_offset: number
  fecha_desde: string
  fecha_hasta: string | null
  activo: boolean
}

export type SlotResuelto = {
  etiqueta: string
  entrada: string | null
  salida: string | null
  esFranco: boolean
  diaOffset: number
  rotacionId: number
  rotacionNombre: string
  color: string
}

function normalizeTime(t: string | null | undefined): string | null {
  if (!t) return null
  return String(t).slice(0, 5)
}

/** Índice del ciclo para una fecha (0 … ciclo-1). */
export function indiceCicloRotacion(
  fechaIso: string,
  fechaAnclaIso: string,
  cicloDias: number,
  faseOffset = 0
): number {
  const ciclo = Math.max(2, Math.floor(cicloDias) || 2)
  const days = differenceInCalendarDays(parseISO(fechaIso.slice(0, 10)), parseISO(fechaAnclaIso.slice(0, 10)))
  const fase = Math.floor(faseOffset) || 0
  return ((days + fase) % ciclo + ciclo) % ciclo
}

export function slotDeRotacion(
  plantilla: RotacionPlantilla,
  asignacion: RotacionAsignacion,
  fechaIso: string
): SlotResuelto | null {
  if (!plantilla.activo || !asignacion.activo) return null
  const f = fechaIso.slice(0, 10)
  const desde = asignacion.fecha_desde.slice(0, 10)
  const hasta = asignacion.fecha_hasta ? asignacion.fecha_hasta.slice(0, 10) : null
  if (f < desde) return null
  if (hasta && f > hasta) return null

  const idx = indiceCicloRotacion(f, plantilla.fecha_ancla, plantilla.ciclo_dias, asignacion.fase_offset)
  const slot =
    plantilla.slots.find((s) => s.dia_offset === idx) ||
    ({
      dia_offset: idx,
      etiqueta: 'Turno',
      hora_entrada: null,
      hora_salida: null,
      es_franco: false
    } satisfies RotacionSlot)

  return {
    etiqueta: slot.etiqueta || 'Turno',
    entrada: normalizeTime(slot.hora_entrada),
    salida: normalizeTime(slot.hora_salida),
    esFranco: slot.es_franco === true || (!slot.hora_entrada && !slot.hora_salida),
    diaOffset: idx,
    rotacionId: plantilla.id,
    rotacionNombre: plantilla.nombre,
    color: plantilla.color || '#6366f1'
  }
}

/** Primera asignación activa del usuario para esa fecha (si hay varias, la más reciente por fecha_desde). */
export function resolverRotacionUsuario(
  plantillas: RotacionPlantilla[],
  asignaciones: RotacionAsignacion[],
  idUsuario: number,
  fechaIso: string
): SlotResuelto | null {
  const delUser = asignaciones
    .filter((a) => a.id_usuario === idUsuario && a.activo)
    .sort((a, b) => b.fecha_desde.localeCompare(a.fecha_desde))

  for (const a of delUser) {
    const plantilla = plantillas.find((p) => p.id === a.id_rotacion)
    if (!plantilla) continue
    const slot = slotDeRotacion(plantilla, a, fechaIso)
    if (slot) return slot
  }
  return null
}

/** Slots por defecto para un ciclo (útil al crear). Franco en domingo del ciclo semanal típico. */
export function slotsDefaultCiclo(cicloDias: number): RotacionSlot[] {
  const n = Math.max(2, Math.min(56, Math.floor(cicloDias) || 7))
  const out: RotacionSlot[] = []
  for (let i = 0; i < n; i++) {
    const esFranco = n === 7 ? i === 6 : false
    out.push({
      dia_offset: i,
      etiqueta: esFranco ? 'Franco' : `Día ${i + 1}`,
      hora_entrada: esFranco ? null : '08:00',
      hora_salida: esFranco ? null : '17:00',
      es_franco: esFranco
    })
  }
  return out
}
