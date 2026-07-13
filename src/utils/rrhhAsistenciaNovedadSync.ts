import type { Asistencia, RrhhNovedad, RrhhNovedadGrupo } from '../types/api'
import apiService from '../services/api'
import {
  evaluarDiaAsistencia,
  type HorarioFijoAsistencia
} from './asistenciaStats'
import { novedadEnDia } from './rrhhNovedadDates'
import { asistenciaHoraCorta } from './dateUtils'

export type NovedadAsistenciaPendiente = {
  id_usuario: number
  fecha: string
  grupo: RrhhNovedadGrupo
  codigo: string
  duracion_minutos?: number | null
  horas_extra_cantidad?: number | null
  observaciones: string
}

function tieneNovedad(
  novedades: RrhhNovedad[],
  idUsuario: number,
  fecha: string,
  grupo: RrhhNovedadGrupo,
  codigo?: string
): boolean {
  return novedades.some(
    (n) =>
      n.id_usuario === idUsuario &&
      n.grupo === grupo &&
      novedadEnDia(n, fecha) &&
      (codigo == null || n.codigo === codigo)
  )
}

/** Detecta tardanzas, faltas y horas extra de marcación que aún no tienen novedad en legajo. */
export function detectarNovedadesDesdeAsistencia(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
}): NovedadAsistenciaPendiente[] {
  const { asistencia, novedades, dias, horariosPorMes = {}, horarioFallback } = params
  const porUsuarioDia = new Map<string, Asistencia>()
  for (const a of asistencia) {
    porUsuarioDia.set(`${a.id_usuario}|${a.fecha.slice(0, 10)}`, a)
  }

  const novedadesPorUsuarioDia = new Map<string, RrhhNovedad[]>()
  for (const n of novedades) {
    for (const f of dias) {
      if (!novedadEnDia(n, f)) continue
      const k = `${n.id_usuario}|${f}`
      const prev = novedadesPorUsuarioDia.get(k) ?? []
      prev.push(n)
      novedadesPorUsuarioDia.set(k, prev)
    }
  }

  const pendientes: NovedadAsistenciaPendiente[] = []
  const ids = new Set(asistencia.map((a) => a.id_usuario))

  for (const id of ids) {
    for (const f of dias) {
      const a = porUsuarioDia.get(`${id}|${f}`)
      if (!a) continue
      const novs = novedadesPorUsuarioDia.get(`${id}|${f}`) ?? []
      const mes = f.slice(0, 7)
      const horario = horariosPorMes[mes]?.[id] ?? horarioFallback?.[id] ?? null
      const ev = evaluarDiaAsistencia({
        idUsuario: id,
        fecha: f,
        asistencia: a,
        novedades: novs,
        horario
      })

      if (ev.esAusenciaInjustificada && !tieneNovedad(novedades, id, f, 'falta')) {
        pendientes.push({
          id_usuario: id,
          fecha: f,
          grupo: 'falta',
          codigo: 'falta_injustificada',
          observaciones: a.observaciones?.trim()
            ? `Ausencia detectada automáticamente. ${a.observaciones}`
            : 'Ausencia detectada automáticamente desde asistencia / reloj.'
        })
        continue
      }

      if (
        ev.esTarde &&
        !ev.esAusenciaInjustificada &&
        !ev.esJustificado &&
        !tieneNovedad(novedades, id, f, 'tardanza_retiro', 'tardanza')
      ) {
        const entrada = asistenciaHoraCorta(a.hora_entrada) || '—'
        const horarioEsp = horario?.entrada || '—'
        const min = ev.minutosTarde > 0 ? ev.minutosTarde : null
        pendientes.push({
          id_usuario: id,
          fecha: f,
          grupo: 'tardanza_retiro',
          codigo: 'tardanza',
          duracion_minutos: min,
          observaciones:
            min != null
              ? `Tardanza de ${min} min (entró ${entrada}, horario ${horarioEsp}). Detectada automáticamente.`
              : `Tardanza (entró ${entrada}, horario ${horarioEsp}). Detectada automáticamente.`
        })
      }
    }
  }

  return pendientes
}

export async function sincronizarNovedadesDesdeAsistencia(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
  registradoPor: number
}): Promise<{ creadas: number; omitidas: number; errores: number }> {
  const pendientes = detectarNovedadesDesdeAsistencia(params)
  if (!pendientes.length) return { creadas: 0, omitidas: 0, errores: 0 }

  let creadas = 0
  let omitidas = 0
  let errores = 0

  for (const p of pendientes) {
    const r = await apiService.rrhhNovedadCrear({
      id_usuario: p.id_usuario,
      grupo: p.grupo,
      codigo: p.codigo,
      fecha_desde: p.fecha,
      fecha_hasta: p.fecha,
      duracion_minutos: p.duracion_minutos ?? null,
      horas_extra_cantidad: p.horas_extra_cantidad ?? null,
      observaciones: p.observaciones,
      registrado_por: params.registradoPor
    })
    if (r.success) creadas++
    else errores++
  }

  return { creadas, omitidas, errores }
}
