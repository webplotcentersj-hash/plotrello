import type { RrhhNovedadGrupo } from '../types/api'

export const RRHH_NOVEDAD_GRUPOS: { value: RrhhNovedadGrupo; label: string }[] = [
  { value: 'falta', label: 'Faltas' },
  { value: 'tardanza_retiro', label: 'Tardanzas / Retiros anticipados' },
  { value: 'licencia', label: 'Licencias' },
  { value: 'horas_extra', label: 'Horas extra' },
  { value: 'beneficio_comida', label: 'Beneficio comida' },
  { value: 'parte_diario', label: 'Parte diario' },
  { value: 'anticipacion_sueldo', label: 'Anticipación de sueldo' }
]

export const RRHH_NOVEDAD_CODIGOS_POR_GRUPO: Record<
  RrhhNovedadGrupo,
  { value: string; label: string }[]
> = {
  falta: [
    { value: 'falta_justificada_enfermedad', label: 'Justificada — enfermedad' },
    { value: 'falta_justificada_tramites', label: 'Justificada — trámites' },
    { value: 'falta_injustificada', label: 'Injustificada' }
  ],
  tardanza_retiro: [
    { value: 'tardanza', label: 'Tardanza' },
    { value: 'retiro_anticipado', label: 'Retiro anticipado' }
  ],
  licencia: [
    { value: 'licencia_vacaciones', label: 'Vacaciones' },
    { value: 'licencia_examen', label: 'Examen' },
    { value: 'licencia_maternidad', label: 'Maternidad' },
    { value: 'licencia_paternidad', label: 'Paternidad' },
    { value: 'licencia_casamiento', label: 'Casamiento' },
    { value: 'licencia_otro', label: 'Otra licencia' }
  ],
  horas_extra: [
    { value: 'horas_extra_50', label: 'Al 50 %' },
    { value: 'horas_extra_100', label: 'Al 100 %' }
  ],
  beneficio_comida: [{ value: 'perdida_beneficio_comida', label: 'Pérdida del beneficio de comida' }],
  parte_diario: [{ value: 'parte_diario', label: 'Parte diario' }],
  anticipacion_sueldo: [{ value: 'anticipacion_sueldo', label: 'Anticipación de sueldo' }]
}

export function etiquetaCodigoRrhhNovedad(codigo: string): string {
  for (const lista of Object.values(RRHH_NOVEDAD_CODIGOS_POR_GRUPO)) {
    const f = lista.find((x) => x.value === codigo)
    if (f) return f.label
  }
  return codigo
}
