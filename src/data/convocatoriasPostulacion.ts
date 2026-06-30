export type RadioOption = { value: string; label: string }

export type ConvocatoriaConfig = {
  slug: string
  puesto: string
  categoria: string
  titulo: string
  subtitulo: string
  fraseCompromiso: string
  situacionLaboral: RadioOption[]
  conocimientoIa: RadioOption[]
  disponibilidadHoraria: RadioOption[]
  incorporacion: RadioOption[]
}

export const CONVOCATORIAS: Record<string, ConvocatoriaConfig> = {
  'community-manager': {
    slug: 'community-manager',
    puesto: 'Community Manager',
    categoria: 'Marketing',
    titulo: 'Community Manager',
    subtitulo:
      'Estamos armando un equipo de comunicación de alto nivel. Completá este formulario con atención: complementa tu CV y nos ayuda a conocerte mejor.',
    fraseCompromiso: 'Comprendo el compromiso',
    situacionLaboral: [
      { value: 'dependencia', label: 'Estoy trabajando en relación de dependencia' },
      { value: 'freelance', label: 'Trabajo de manera independiente / freelance' },
      { value: 'buscando', label: 'No estoy trabajando y busco activamente' },
      { value: 'primera_experiencia', label: 'Estudio y busco mi primera experiencia' },
      { value: 'otra', label: 'Otra situación' }
    ],
    conocimientoIa: [
      { value: 'uso_habitual', label: 'Sí, las uso habitualmente en mi trabajo' },
      { value: 'conozco', label: 'Sí, las conozco y he experimentado con ellas' },
      { value: 'interes', label: 'Tengo interés pero todavía no las utilizo' },
      { value: 'sin_conocimiento', label: 'No tengo conocimiento ni experiencia' }
    ],
    disponibilidadHoraria: [
      { value: 'full_time', label: 'Full time (jornada completa)' },
      { value: 'part_time', label: 'Part time / medio tiempo' },
      { value: 'proyecto', label: 'Por proyecto / freelance' },
      { value: 'a_convenir', label: 'A convenir' }
    ],
    incorporacion: [
      { value: 'inmediato', label: 'De inmediato' },
      { value: 'dos_semanas', label: 'En dos semanas' },
      { value: 'preaviso', label: 'Debo dar preaviso (un mes aprox.)' },
      { value: 'a_convenir', label: 'A convenir' }
    ]
  }
}

export function convocatoriaPorSlug(slug: string): ConvocatoriaConfig | null {
  return CONVOCATORIAS[slug] ?? null
}

export function labelDeOpcion(opciones: RadioOption[], value: string): string {
  return opciones.find((o) => o.value === value)?.label ?? value
}

export type FormularioExternoRespuestas = {
  situacion_laboral: string
  detalle_trabajo?: string
  experiencia_desde_cv: string
  fortalezas_cm: string
  conocimiento_ia: string
  detalle_ia: string
  disponibilidad_horaria: string
  incorporacion: string
  pretension_salarial: string
  motivacion_plot: string
  frase_compromiso: string
  confirmacion_puesto: string
  comentarios_adicionales?: string
}

export function buildResumenFormulario(
  conv: ConvocatoriaConfig,
  r: FormularioExternoRespuestas
): string {
  const lines = [
    `Situación: ${labelDeOpcion(conv.situacionLaboral, r.situacion_laboral)}`,
    r.detalle_trabajo ? `Trabajo reciente: ${r.detalle_trabajo}` : null,
    `Experiencia desde CV: ${r.experiencia_desde_cv}`,
    `Fortalezas CM: ${r.fortalezas_cm}`,
    `IA: ${labelDeOpcion(conv.conocimientoIa, r.conocimiento_ia)}`,
    `Detalle IA: ${r.detalle_ia}`,
    `Disponibilidad: ${labelDeOpcion(conv.disponibilidadHoraria, r.disponibilidad_horaria)}`,
    `Incorporación: ${labelDeOpcion(conv.incorporacion, r.incorporacion)}`,
    `Pretensión salarial: ${r.pretension_salarial}`,
    `Motivación: ${r.motivacion_plot}`,
    r.comentarios_adicionales ? `Comentarios: ${r.comentarios_adicionales}` : null
  ]
  return lines.filter(Boolean).join('\n')
}
