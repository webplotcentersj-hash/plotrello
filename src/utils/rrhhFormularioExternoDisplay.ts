import { CONVOCATORIAS, labelDeOpcion } from '../data/convocatoriasPostulacion'
import type { RrhhPostulacion } from '../types/api'

export const FORMULARIO_FIELD_LABELS: Record<string, string> = {
  situacion_laboral: 'Situación laboral',
  detalle_trabajo: 'Trabajo reciente',
  experiencia_desde_cv: 'Experiencia desde CV',
  fortalezas_cm: 'Fortalezas CM',
  conocimiento_ia: 'Conocimiento IA',
  detalle_ia: 'Detalle IA',
  disponibilidad_horaria: 'Disponibilidad',
  incorporacion: 'Incorporación',
  pretension_salarial: 'Pretensión salarial',
  motivacion_plot: 'Motivación',
  comentarios_adicionales: 'Comentarios'
}

export function isFormularioExterno(row: RrhhPostulacion): boolean {
  const meta = (row.metadata_ia || {}) as Record<string, unknown>
  return meta.tipo === 'formulario_externo'
}

export function getFormularioRespuestas(row: RrhhPostulacion): Record<string, string> {
  const meta = (row.metadata_ia || {}) as Record<string, unknown>
  const resp = meta.respuestas
  if (resp && typeof resp === 'object' && !Array.isArray(resp)) {
    return resp as Record<string, string>
  }
  return {}
}

export function formatFormularioField(key: string, value: string, slug = 'community-manager'): string {
  const conv = CONVOCATORIAS[slug]
  if (!conv || !value) return value || '—'
  if (key === 'situacion_laboral') return labelDeOpcion(conv.situacionLaboral, value)
  if (key === 'conocimiento_ia') return labelDeOpcion(conv.conocimientoIa, value)
  if (key === 'disponibilidad_horaria') return labelDeOpcion(conv.disponibilidadHoraria, value)
  if (key === 'incorporacion') return labelDeOpcion(conv.incorporacion, value)
  return value
}

export function formularioSlug(row: RrhhPostulacion): string {
  const meta = (row.metadata_ia || {}) as Record<string, unknown>
  return typeof meta.slug === 'string' ? meta.slug : 'community-manager'
}
