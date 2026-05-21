export const CONDICIONES_IVA_CUENTA_CORRIENTE = [
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_responsable', label: 'No responsable' },
  { value: 'consumidor_final', label: 'Consumidor final' }
] as const

export type CondicionIvaCuentaCorriente =
  (typeof CONDICIONES_IVA_CUENTA_CORRIENTE)[number]['value']

export function labelCondicionIva(value: string | null | undefined): string {
  const found = CONDICIONES_IVA_CUENTA_CORRIENTE.find((c) => c.value === value)
  return found?.label ?? value ?? '—'
}

export type EstadoCuentaCorriente = 'pendiente' | 'aprobada' | 'rechazada'

export const ESTADO_CC_LABELS: Record<EstadoCuentaCorriente, string> = {
  pendiente: 'Pendiente de aprobación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada'
}

/** Estado efectivo (DB puede traer null en registros viejos). */
export function normalizeEstadoCc(row: {
  estado?: string | null
  alta_completa?: boolean | null
}): EstadoCuentaCorriente {
  const e = row.estado
  if (e === 'aprobada' || e === 'pendiente' || e === 'rechazada') return e
  if (row.alta_completa) return 'aprobada'
  return 'pendiente'
}

export function isClienteCcOperativo(row: {
  estado?: string | null
  alta_completa?: boolean | null
}): boolean {
  return normalizeEstadoCc(row) === 'aprobada'
}

export type TipoClienteCuentaCorriente = 'empresa' | 'persona_fisica'

export const TIPO_CLIENTE_CC_LABELS: Record<TipoClienteCuentaCorriente, string> = {
  empresa: 'Empresa',
  persona_fisica: 'Persona física'
}
