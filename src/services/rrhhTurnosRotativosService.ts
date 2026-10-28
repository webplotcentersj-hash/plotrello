import { supabase } from './supabaseClient'
import {
  slotsDefaultCiclo,
  type RotacionAsignacion,
  type RotacionPlantilla,
  type RotacionSlot
} from '../utils/rrhhTurnosRotativos'

function mapSlot(row: Record<string, unknown>): RotacionSlot {
  return {
    id: Number(row.id) || undefined,
    id_rotacion: Number(row.id_rotacion) || undefined,
    dia_offset: Number(row.dia_offset) || 0,
    etiqueta: String(row.etiqueta || 'Turno'),
    hora_entrada: row.hora_entrada != null ? String(row.hora_entrada).slice(0, 5) : null,
    hora_salida: row.hora_salida != null ? String(row.hora_salida).slice(0, 5) : null,
    es_franco: row.es_franco === true
  }
}

function mapAsignacion(row: Record<string, unknown>): RotacionAsignacion {
  return {
    id: Number(row.id),
    id_rotacion: Number(row.id_rotacion),
    id_usuario: Number(row.id_usuario),
    fase_offset: Number(row.fase_offset) || 0,
    fecha_desde: String(row.fecha_desde).slice(0, 10),
    fecha_hasta: row.fecha_hasta ? String(row.fecha_hasta).slice(0, 10) : null,
    activo: row.activo !== false
  }
}

export async function listarRotacionesCompletas(): Promise<{
  plantillas: RotacionPlantilla[]
  asignaciones: RotacionAsignacion[]
  error?: string
}> {
  if (!supabase) return { plantillas: [], asignaciones: [], error: 'Sin Supabase' }

  const [rPlant, rSlots, rAsig] = await Promise.all([
    supabase.from('rrhh_turnos_rotacion').select('*').order('id', { ascending: true }),
    supabase.from('rrhh_turnos_rotacion_slots').select('*').order('dia_offset', { ascending: true }),
    supabase.from('rrhh_turnos_rotacion_asignados').select('*').order('fecha_desde', { ascending: false })
  ])

  if (rPlant.error) {
    return {
      plantillas: [],
      asignaciones: [],
      error:
        /does not exist|schema cache/i.test(rPlant.error.message)
          ? 'Falta aplicar el patch 2026-10-28_rrhh_turnos_rotativos.sql'
          : rPlant.error.message
    }
  }

  const slotsByRot = new Map<number, RotacionSlot[]>()
  for (const raw of (rSlots.data || []) as Record<string, unknown>[]) {
    const slot = mapSlot(raw)
    const id = Number(raw.id_rotacion)
    const list = slotsByRot.get(id) || []
    list.push(slot)
    slotsByRot.set(id, list)
  }

  const plantillas: RotacionPlantilla[] = ((rPlant.data || []) as Record<string, unknown>[]).map((row) => {
    const id = Number(row.id)
    return {
      id,
      nombre: String(row.nombre || 'Rotación'),
      ciclo_dias: Number(row.ciclo_dias) || 7,
      fecha_ancla: String(row.fecha_ancla).slice(0, 10),
      color: String(row.color || '#6366f1'),
      activo: row.activo !== false,
      notas: row.notas != null ? String(row.notas) : null,
      slots: slotsByRot.get(id) || []
    }
  })

  const asignaciones = ((rAsig.data || []) as Record<string, unknown>[]).map(mapAsignacion)
  return { plantillas, asignaciones, error: rSlots.error?.message || rAsig.error?.message }
}

export async function crearRotacion(input: {
  nombre: string
  ciclo_dias: number
  fecha_ancla: string
  color?: string
  slots?: RotacionSlot[]
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sin Supabase' }
  const ciclo = Math.max(2, Math.min(56, Math.floor(input.ciclo_dias) || 7))
  const { data, error } = await supabase
    .from('rrhh_turnos_rotacion')
    .insert({
      nombre: input.nombre.trim() || 'Rotación',
      ciclo_dias: ciclo,
      fecha_ancla: input.fecha_ancla.slice(0, 10),
      color: input.color || '#6366f1',
      activo: true
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: error?.message || 'No se pudo crear' }
  const id = Number((data as { id: number }).id)
  const slots = input.slots?.length ? input.slots : slotsDefaultCiclo(ciclo)
  const payload = slots.map((s, i) => ({
    id_rotacion: id,
    dia_offset: s.dia_offset ?? i,
    etiqueta: s.etiqueta || `Día ${i + 1}`,
    hora_entrada: s.es_franco ? null : s.hora_entrada,
    hora_salida: s.es_franco ? null : s.hora_salida,
    es_franco: s.es_franco === true
  }))
  const { error: eSlots } = await supabase.from('rrhh_turnos_rotacion_slots').insert(payload)
  if (eSlots) return { ok: false, error: eSlots.message }
  return { ok: true, id }
}

export async function guardarSlotsRotacion(
  idRotacion: number,
  slots: RotacionSlot[]
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sin Supabase' }
  const { error: delErr } = await supabase
    .from('rrhh_turnos_rotacion_slots')
    .delete()
    .eq('id_rotacion', idRotacion)
  if (delErr) return { ok: false, error: delErr.message }
  const payload = slots.map((s, i) => ({
    id_rotacion: idRotacion,
    dia_offset: s.dia_offset ?? i,
    etiqueta: s.etiqueta || `Día ${i + 1}`,
    hora_entrada: s.es_franco ? null : s.hora_entrada,
    hora_salida: s.es_franco ? null : s.hora_salida,
    es_franco: s.es_franco === true
  }))
  const { error } = await supabase.from('rrhh_turnos_rotacion_slots').insert(payload)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function asignarARotacion(input: {
  id_rotacion: number
  id_usuario: number
  fase_offset?: number
  fecha_desde: string
  fecha_hasta?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sin Supabase' }
  const { error } = await supabase.from('rrhh_turnos_rotacion_asignados').insert({
    id_rotacion: input.id_rotacion,
    id_usuario: input.id_usuario,
    fase_offset: input.fase_offset ?? 0,
    fecha_desde: input.fecha_desde.slice(0, 10),
    fecha_hasta: input.fecha_hasta ? input.fecha_hasta.slice(0, 10) : null,
    activo: true
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function desactivarAsignacion(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sin Supabase' }
  const { error } = await supabase
    .from('rrhh_turnos_rotacion_asignados')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setRotacionActiva(
  id: number,
  activo: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sin Supabase' }
  const { error } = await supabase
    .from('rrhh_turnos_rotacion')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
