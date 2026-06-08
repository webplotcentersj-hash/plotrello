export type TipoDesvinculacionRrhh =
  | 'renuncia_voluntaria'
  | 'despido_con_causa'
  | 'despido_sin_causa'
  | 'fin_contrato'
  | 'jubilacion'
  | 'mutuo_acuerdo'
  | 'fallecimiento'
  | 'otro'

export const TIPOS_DESVINCULACION_RRHH: { value: TipoDesvinculacionRrhh; label: string }[] = [
  { value: 'renuncia_voluntaria', label: 'Renuncia voluntaria' },
  { value: 'despido_con_causa', label: 'Despido con causa' },
  { value: 'despido_sin_causa', label: 'Despido sin causa' },
  { value: 'fin_contrato', label: 'Fin de contrato / plazo' },
  { value: 'jubilacion', label: 'Jubilación' },
  { value: 'mutuo_acuerdo', label: 'Mutuo acuerdo' },
  { value: 'fallecimiento', label: 'Fallecimiento' },
  { value: 'otro', label: 'Otro' }
]

export function etiquetaTipoDesvinculacion(tipo: string): string {
  return TIPOS_DESVINCULACION_RRHH.find((t) => t.value === tipo)?.label ?? tipo
}
