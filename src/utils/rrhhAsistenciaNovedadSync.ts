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

/** Detecta tardanzas (solo entrada), faltas y horas extra de marcación sin novedad en legajo. */
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
  /** Evita encolar dos veces la misma tardanza en un mismo pass. */
  const keysPendientes = new Set<string>()

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

      // Tardanza = solo si hay hora de ENTRADA tarde vs horario base.
      if (
        a.hora_entrada &&
        ev.esTarde &&
        ev.minutosTarde > 0 &&
        !ev.esAusenciaInjustificada &&
        !ev.esJustificado &&
        !tieneNovedad(novedades, id, f, 'tardanza_retiro', 'tardanza')
      ) {
        const key = `${id}|${f}|tardanza`
        if (keysPendientes.has(key)) continue
        keysPendientes.add(key)
        const entrada = asistenciaHoraCorta(a.hora_entrada) || '—'
        const horarioEsp = horario?.entrada || '—'
        const min = ev.minutosTarde
        pendientes.push({
          id_usuario: id,
          fecha: f,
          grupo: 'tardanza_retiro',
          codigo: 'tardanza',
          duracion_minutos: min,
          observaciones: `Tardanza de ${min} min (entró ${entrada}, horario ${horarioEsp}). Detectada automáticamente.`
        })
      }
    }
  }

  return pendientes
}

function esErrorDuplicado(msg: string): boolean {
  return /duplicate|unique|uq_rrhh_novedades_tardanza/i.test(msg)
}

export async function sincronizarNovedadesDesdeAsistencia(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
  registradoPor: number
}): Promise<{ creadas: number; omitidas: number; errores: number }> {
  // Releer novedades frescas del rango para no duplicar por estado React stale.
  let novedadesFresh = params.novedades
  if (params.dias.length) {
    const desde = params.dias[0]
    const hasta = params.dias[params.dias.length - 1]
    const prev = await apiService.rrhhNovedadesListar({
      fechaDesde: desde,
      fechaHasta: hasta
    })
    if (prev.success && prev.data) novedadesFresh = prev.data
  }

  const pendientes = detectarNovedadesDesdeAsistencia({
    ...params,
    novedades: novedadesFresh
  })
  if (!pendientes.length) return { creadas: 0, omitidas: 0, errores: 0 }

  let creadas = 0
  let omitidas = 0
  let errores = 0
  const creadasKeys = new Set<string>()

  for (const p of pendientes) {
    const key = `${p.id_usuario}|${p.fecha}|${p.codigo}`
    if (creadasKeys.has(key)) {
      omitidas++
      continue
    }
    if (
      p.codigo === 'tardanza' &&
      tieneNovedad(novedadesFresh, p.id_usuario, p.fecha, 'tardanza_retiro', 'tardanza')
    ) {
      omitidas++
      continue
    }

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
    if (r.success) {
      creadas++
      creadasKeys.add(key)
      novedadesFresh = [
        ...novedadesFresh,
        {
          id: r.data?.id ?? Date.now(),
          id_usuario: p.id_usuario,
          id_solicitud_permiso: null,
          grupo: p.grupo,
          codigo: p.codigo,
          fecha_desde: p.fecha,
          fecha_hasta: p.fecha,
          duracion_minutos: p.duracion_minutos ?? null,
          horas_extra_cantidad: p.horas_extra_cantidad ?? null,
          observaciones: p.observaciones,
          adjuntos: [],
          registrado_por: params.registradoPor,
          firma_data_url: null,
          firmado_at: null,
          created_at: '',
          updated_at: ''
        }
      ]
    } else if (r.error && esErrorDuplicado(r.error)) {
      omitidas++
      creadasKeys.add(key)
    } else {
      errores++
    }
  }

  return { creadas, omitidas, errores }
}
