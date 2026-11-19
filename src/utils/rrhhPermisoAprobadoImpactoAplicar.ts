import apiService from '../services/api'
import type { SolicitudPermiso } from '../types/api'
import {
  diasEntreInclusive,
  mapearSolicitudANovedad,
  observacionesNovedadDesdePermiso,
  rangoFechasSolicitud,
  solicitudImpactaAsistencia
} from './rrhhPermisoAprobadoImpacto'

export type ImpactoPermisoAprobadoResultado = {
  novedadCreada: boolean
  novedadId: number | null
  diasJustificados: number
  error?: string
}

/**
 * Al aprobar un permiso/ausencia/vacaciones:
 * 1) crea (si no existe) una novedad vinculada → calendario de Novedades
 * 2) marca asistencia justificada en días completos → planilla / liquidación
 */
export async function impactarPermisoAprobado(params: {
  solicitud: SolicitudPermiso
  idAprobador: number
}): Promise<ImpactoPermisoAprobadoResultado> {
  const { solicitud, idAprobador } = params
  const vacio: ImpactoPermisoAprobadoResultado = {
    novedadCreada: false,
    novedadId: null,
    diasJustificados: 0
  }
  if (solicitud.estado !== 'aprobado' && solicitud.estado !== 'pendiente') {
    // Tras RPC ya viene aprobada; aceptamos ambos por si el caller pasa el snapshot previo.
  }
  if (!solicitudImpactaAsistencia(solicitud.tipo_solicitud)) return vacio

  const mapeo = mapearSolicitudANovedad(solicitud)
  const rango = rangoFechasSolicitud(solicitud)
  if (!mapeo || !rango) {
    return { ...vacio, error: 'Sin fechas válidas o tipo no aplicable a asistencia' }
  }

  let novedadCreada = false
  let novedadId: number | null = null

  const existentes = await apiService.rrhhNovedadesListar({
    idUsuario: solicitud.id_usuario,
    fechaDesde: rango.desde,
    fechaHasta: rango.hasta
  })
  const ya =
    existentes.success && existentes.data
      ? existentes.data.find((n) => Number(n.id_solicitud_permiso) === Number(solicitud.id))
      : null

  if (ya) {
    novedadId = ya.id
  } else {
    const creada = await apiService.rrhhNovedadCrear({
      id_usuario: solicitud.id_usuario,
      id_solicitud_permiso: solicitud.id,
      grupo: mapeo.grupo,
      codigo: mapeo.codigo,
      fecha_desde: rango.desde,
      fecha_hasta: rango.hasta,
      observaciones: observacionesNovedadDesdePermiso(solicitud),
      registrado_por: idAprobador
    })
    if (!creada.success || !creada.data) {
      return { ...vacio, error: creada.success === false ? creada.error : 'No se pudo crear la novedad' }
    }
    novedadCreada = true
    novedadId = creada.data.id
  }

  let diasJustificados = 0
  if (mapeo.diaCompleto) {
    const dias = diasEntreInclusive(rango.desde, rango.hasta)
    const obs = `Justificado por solicitud #${solicitud.id} aprobada${solicitud.titulo ? `: ${solicitud.titulo}` : ''}`
    const asisRes = await apiService.obtenerAsistencia(solicitud.id_usuario, rango.desde, rango.hasta)
    const porFecha = new Map<string, { id: number; hora_entrada: string | null; hora_salida: string | null; horas_trabajadas: number | null }>()
    if (asisRes.success && asisRes.data) {
      for (const a of asisRes.data) {
        if (Number(a.id_usuario) !== Number(solicitud.id_usuario)) continue
        porFecha.set(String(a.fecha).slice(0, 10), {
          id: Number(a.id),
          hora_entrada: a.hora_entrada,
          hora_salida: a.hora_salida,
          horas_trabajadas: a.horas_trabajadas
        })
      }
    }
    for (const fecha of dias) {
      const prev = porFecha.get(fecha)
      const r = await apiService.actualizarAsistencia({
        id: prev?.id && prev.id > 0 ? prev.id : 0,
        idUsuario: solicitud.id_usuario,
        fecha,
        horaEntrada: prev?.hora_entrada ?? null,
        horaSalida: prev?.hora_salida ?? null,
        horasTrabajadas: prev?.horas_trabajadas ?? null,
        tipoRegistro: 'justificado',
        observaciones: obs
      })
      if (r.success) diasJustificados += 1
    }
  }

  return { novedadCreada, novedadId, diasJustificados }
}
