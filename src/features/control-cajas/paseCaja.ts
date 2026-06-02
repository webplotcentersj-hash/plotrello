import type { CajaMovimiento } from './types'

export type PaseCajaMontos = {
  origen_efectivo_antes: number
  origen_otros_antes: number
  destino_efectivo_antes: number
  destino_otros_antes: number
  pase_efectivo: number
  pase_otros: number
}

export type PaseCajaCalculado = PaseCajaMontos & {
  origen_efectivo_despues: number
  origen_otros_despues: number
  destino_efectivo_despues: number
  destino_otros_despues: number
}

export function calcularPaseTrazabilidad(input: PaseCajaMontos): PaseCajaCalculado {
  const pase_efectivo = input.pase_efectivo || 0
  const pase_otros = input.pase_otros || 0
  return {
    ...input,
    origen_efectivo_antes: input.origen_efectivo_antes || 0,
    origen_otros_antes: input.origen_otros_antes || 0,
    destino_efectivo_antes: input.destino_efectivo_antes || 0,
    destino_otros_antes: input.destino_otros_antes || 0,
    pase_efectivo,
    pase_otros,
    origen_efectivo_despues: (input.origen_efectivo_antes || 0) - pase_efectivo,
    origen_otros_despues: (input.origen_otros_antes || 0) - pase_otros,
    destino_efectivo_despues: (input.destino_efectivo_antes || 0) + pase_efectivo,
    destino_otros_despues: (input.destino_otros_antes || 0) + pase_otros
  }
}

export function validarPaseCaja(calc: PaseCajaCalculado): string | null {
  if (calc.pase_efectivo <= 0 && calc.pase_otros <= 0) {
    return 'Indicá el monto del pase (efectivo y/o tarjetas/otros).'
  }
  if (calc.origen_efectivo_antes <= 0 && calc.pase_efectivo > 0) {
    return 'Registrá cuánto efectivo había en la caja origen antes del pase.'
  }
  if (calc.origen_efectivo_despues < 0) {
    return 'El pase en efectivo supera lo registrado en la caja origen.'
  }
  if (calc.origen_otros_despues < 0) {
    return 'El pase en tarjetas/otros supera lo registrado en la caja origen.'
  }
  return null
}

export function movimientoEsPase(m: Pick<CajaMovimiento, 'concepto'>): boolean {
  return m.concepto === 'Pase de caja'
}

export function paseTieneTrazabilidad(m: CajaMovimiento): boolean {
  return (
    movimientoEsPase(m) &&
    (m.origen_efectivo_antes != null ||
      m.destino_efectivo_antes != null ||
      m.origen_efectivo_despues != null)
  )
}

export function resumenPaseTrazabilidad(m: CajaMovimiento): string {
  if (!paseTieneTrazabilidad(m)) return ''
  const oa = m.origen_efectivo_antes ?? 0
  const od = m.origen_efectivo_despues ?? 0
  const da = m.destino_efectivo_antes ?? 0
  const dd = m.destino_efectivo_despues ?? 0
  return `Origen $${oa.toLocaleString('es-AR')} → $${od.toLocaleString('es-AR')} · Destino $${da.toLocaleString('es-AR')} → $${dd.toLocaleString('es-AR')}`
}
