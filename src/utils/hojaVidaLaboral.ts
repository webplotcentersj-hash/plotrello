import { differenceInDays, differenceInMonths, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
  Capacitacion,
  Evaluacion,
  LegajoEmpleado,
  RrhhEventoLaboral,
  RrhhNovedad,
  SolicitudPermiso,
  UsuarioBajaLog,
  UsuarioRecord
} from '../types/api'
import { etiquetaCodigoRrhhNovedad } from './rrhhNovedadCatalog'
import { etiquetaTipoDesvinculacion } from './rrhhBajaCatalog'

export type HojaVidaCategoria =
  | 'ingreso'
  | 'cambio_puesto'
  | 'capacitacion'
  | 'evaluacion'
  | 'reconocimiento'
  | 'sancion'
  | 'vacaciones'
  | 'licencia'
  | 'baja'

export type HojaVidaEvento = {
  id: string
  fechaIso: string
  fechaLabel: string
  categoria: HojaVidaCategoria
  titulo: string
  detalle?: string
  meta?: string
}

export const HOJA_VIDA_CATEGORIA_LABEL: Record<HojaVidaCategoria, string> = {
  ingreso: 'Ingreso',
  cambio_puesto: 'Cambio de puesto',
  capacitacion: 'Capacitación',
  evaluacion: 'Evaluación',
  reconocimiento: 'Reconocimiento',
  sancion: 'Sanción',
  vacaciones: 'Vacaciones',
  licencia: 'Licencia prolongada',
  baja: 'Baja laboral'
}

const LICENCIA_PROLONGADA_MIN_DIAS = 5
const CODIGOS_LICENCIA_PROLONGADA = new Set([
  'licencia_maternidad',
  'licencia_paternidad',
  'licencia_casamiento'
])
const CODIGOS_SANCION_NOVEDAD = new Set(['falta_injustificada', 'perdida_beneficio_comida'])

function fmtFecha(iso: string): string {
  try {
    return format(parseISO(iso.slice(0, 10)), "d 'de' MMM yyyy", { locale: es })
  } catch {
    return iso.slice(0, 10)
  }
}

function fmtAntiguedad(meses: number): string {
  if (meses < 1) return 'menos de 1 mes'
  const años = Math.floor(meses / 12)
  const m = meses % 12
  if (años === 0) return `${m} mes${m === 1 ? '' : 'es'}`
  if (m === 0) return `${años} año${años === 1 ? '' : 's'}`
  return `${años} año${años === 1 ? '' : 's'} y ${m} mes${m === 1 ? '' : 'es'}`
}

function diasEntre(desde: string, hasta: string): number {
  try {
    return Math.max(1, differenceInDays(parseISO(hasta.slice(0, 10)), parseISO(desde.slice(0, 10))) + 1)
  } catch {
    return 1
  }
}

function pushEvento(
  out: HojaVidaEvento[],
  fechaIso: string,
  categoria: HojaVidaCategoria,
  id: string,
  titulo: string,
  detalle?: string,
  meta?: string
) {
  if (!fechaIso || fechaIso.length < 8) return
  out.push({
    id: `${categoria}-${id}`,
    fechaIso: fechaIso.slice(0, 10),
    fechaLabel: fmtFecha(fechaIso),
    categoria,
    titulo,
    detalle,
    meta
  })
}

export type HojaVidaInput = {
  legajo: LegajoEmpleado | null
  usuario: UsuarioRecord
  capacitaciones: Capacitacion[]
  evaluaciones: Evaluacion[]
  permisos: SolicitudPermiso[]
  novedades: RrhhNovedad[]
  eventosLaborales: RrhhEventoLaboral[]
  baja: UsuarioBajaLog | null
}

export function construirHojaVidaLaboral(input: HojaVidaInput): HojaVidaEvento[] {
  const eventos: HojaVidaEvento[] = []
  const hoy = new Date().toISOString().slice(0, 10)
  const fechaFinAntiguedad =
    input.baja?.fecha_desvinculacion?.slice(0, 10) ||
    input.baja?.created_at?.slice(0, 10) ||
    hoy

  if (input.legajo?.fecha_ingreso) {
    const fi = String(input.legajo.fecha_ingreso).slice(0, 10)
    let meta = ''
    try {
      const meses = differenceInMonths(parseISO(fechaFinAntiguedad), parseISO(fi))
      if (meses >= 0) {
        meta = input.baja
          ? `Antigüedad al egreso: ${fmtAntiguedad(meses)}`
          : `Antigüedad actual: ${fmtAntiguedad(meses)}`
      }
    } catch {
      /* ignore */
    }
    const sector = input.legajo.sector?.trim()
    pushEvento(
      eventos,
      fi,
      'ingreso',
      'ingreso',
      'Ingreso a la organización',
      sector ? `Sector inicial: ${sector}` : undefined,
      meta
    )
  }

  for (const ev of input.eventosLaborales) {
    const cat = ev.tipo as HojaVidaCategoria
    let detalle = ev.descripcion?.trim() || undefined
    if (ev.tipo === 'cambio_puesto' && (ev.sector_anterior || ev.sector_nuevo)) {
      const partes = [
        ev.sector_anterior ? `Desde: ${ev.sector_anterior}` : null,
        ev.sector_nuevo ? `Hacia: ${ev.sector_nuevo}` : null
      ].filter(Boolean)
      detalle = [detalle, partes.join(' · ')].filter(Boolean).join(' — ') || undefined
    }
    pushEvento(eventos, ev.fecha, cat, String(ev.id), ev.titulo, detalle)
  }

  for (const c of input.capacitaciones) {
    const fecha =
      c.fecha_fin || c.fecha_inicio || c.fecha_inscripcion || c.created_at
    if (!fecha) continue
    const completada =
      c.estado_inscripcion === 'completado' ||
      c.estado === 'completada' ||
      c.asistio === true
    pushEvento(
      eventos,
      fecha,
      'capacitacion',
      String(c.id),
      completada ? `Capacitación realizada: ${c.titulo}` : `Capacitación: ${c.titulo}`,
      [
        c.categoria,
        c.instructor ? `Instructor: ${c.instructor}` : null,
        c.calificacion != null ? `Calificación: ${c.calificacion}` : null,
        c.asistio === true ? 'Asistió' : c.asistio === false ? 'No asistió' : null
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    )
  }

  for (const e of input.evaluaciones) {
    pushEvento(
      eventos,
      e.fecha_evaluacion,
      'evaluacion',
      String(e.id),
      `Evaluación de desempeño (${e.tipo_evaluacion})`,
      [
        `Período: ${e.periodo_evaluacion}`,
        e.calificacion_general != null ? `Calificación: ${e.calificacion_general}` : null,
        e.estado ? `Estado: ${e.estado}` : null,
        e.comentarios_evaluador?.trim()
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
      e.nombre_evaluador ? `Evaluador: ${e.nombre_evaluador}` : undefined
    )
  }

  for (const n of input.novedades) {
    if (n.codigo === 'licencia_vacaciones') {
      const dias = diasEntre(n.fecha_desde, n.fecha_hasta)
      pushEvento(
        eventos,
        n.fecha_desde,
        'vacaciones',
        `nov-${n.id}`,
        'Vacaciones gozadas',
        `${fmtFecha(n.fecha_desde)} → ${fmtFecha(n.fecha_hasta)} (${dias} día${dias === 1 ? '' : 's'})`,
        n.observaciones?.trim() || undefined
      )
      continue
    }

    const diasLic = diasEntre(n.fecha_desde, n.fecha_hasta)
    const esProlongada =
      n.grupo === 'licencia' &&
      (CODIGOS_LICENCIA_PROLONGADA.has(n.codigo) || diasLic >= LICENCIA_PROLONGADA_MIN_DIAS)

    if (esProlongada) {
      pushEvento(
        eventos,
        n.fecha_desde,
        'licencia',
        `nov-${n.id}`,
        etiquetaCodigoRrhhNovedad(n.codigo),
        `${fmtFecha(n.fecha_desde)} → ${fmtFecha(n.fecha_hasta)} (${diasLic} días)`,
        n.observaciones?.trim() || undefined
      )
    }

    if (CODIGOS_SANCION_NOVEDAD.has(n.codigo)) {
      pushEvento(
        eventos,
        n.fecha_desde,
        'sancion',
        `nov-sanc-${n.id}`,
        etiquetaCodigoRrhhNovedad(n.codigo),
        n.observaciones?.trim() || `Registrado el ${fmtFecha(n.fecha_desde)}`
      )
    }
  }

  for (const p of input.permisos) {
    if (p.estado !== 'aprobado' || !p.fecha_inicio) continue
    const dias = p.dias_solicitados ?? (p.fecha_fin ? diasEntre(p.fecha_inicio, p.fecha_fin) : 1)

    if (p.tipo_solicitud === 'vacaciones') {
      pushEvento(
        eventos,
        p.fecha_inicio,
        'vacaciones',
        `perm-${p.id}`,
        p.titulo || 'Vacaciones aprobadas',
        p.fecha_fin
          ? `${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)}`
          : undefined,
        p.descripcion?.trim() || undefined
      )
    } else if (
      (p.tipo_solicitud === 'ausencia' || p.tipo_solicitud === 'permiso') &&
      dias >= LICENCIA_PROLONGADA_MIN_DIAS
    ) {
      pushEvento(
        eventos,
        p.fecha_inicio,
        'licencia',
        `perm-${p.id}`,
        p.titulo || 'Licencia / ausencia prolongada',
        p.fecha_fin
          ? `${fmtFecha(p.fecha_inicio)} → ${fmtFecha(p.fecha_fin)} (${dias} días)`
          : `${dias} días solicitados`,
        p.descripcion?.trim() || undefined
      )
    }
  }

  if (input.baja) {
    const fb =
      input.baja.fecha_desvinculacion?.slice(0, 10) ||
      input.baja.created_at.slice(0, 10)
    pushEvento(
      eventos,
      fb,
      'baja',
      String(input.baja.id),
      'Desvinculación laboral',
      input.baja.motivo,
      [
        input.baja.tipo_desvinculacion
          ? etiquetaTipoDesvinculacion(input.baja.tipo_desvinculacion)
          : null,
        input.baja.observaciones_finales?.trim()
      ]
        .filter(Boolean)
        .join(' · ') || undefined
    )
  }

  eventos.sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))
  return eventos
}

export function resumenHojaVida(eventos: HojaVidaEvento[]) {
  const porCategoria = new Map<HojaVidaCategoria, number>()
  for (const e of eventos) {
    porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + 1)
  }
  return {
    total: eventos.length,
    porCategoria: Object.fromEntries(porCategoria) as Partial<Record<HojaVidaCategoria, number>>
  }
}
