import type { CajaRegistro } from './types'

/**
 * Referencia opcional de fondo de caja (NO se aplica sola).
 * El fondo es el que configure el operador/admin; si no hay valor, es 0.
 */
export const FONDO_CAJA_RECOMENDADO = 100_000

/** @deprecated No usar como mínimo obligatorio. Alias histórico del recomendado. */
export const FONDO_CAJA_BASE_MIN = FONDO_CAJA_RECOMENDADO

/** Cajas de sistema sin fondo de mostrador. */
export const CAJAS_SIN_FONDO_MOSTRADOR = new Set(['admin', 'vuelto'])

/** @deprecated Preferí CAJAS_SIN_FONDO_MOSTRADOR. Ya no implica mínimo obligatorio. */
export const CAJAS_EXENTAS_FONDO_MIN = CAJAS_SIN_FONDO_MOSTRADOR

/** @deprecated El fondo no es obligatorio; se mantiene por compatibilidad (true si no es admin/vuelto). */
export function requiereFondoMinimo(cajaSlug: string): boolean {
  return !CAJAS_SIN_FONDO_MOSTRADOR.has(cajaSlug)
}

/** Fondo configurado en la caja. Si no hay valor, es 0 — nunca se inventa $100.000. */
export function fondoFijoEfectivo(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  return Math.max(0, Number(caja.fondo_fijo) || 0)
}

/** @deprecated Alias de fondoFijoEfectivo; no implica un mínimo a exigir. */
export function fondoMinimoCaja(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  return fondoFijoEfectivo(caja)
}

export type ValidacionFondoFisico =
  | { ok: true }
  | { ok: false; mensaje: string; minimo: number }

/**
 * Solo valida contra el fondo SI la caja tiene fondo_fijo > 0 configurado.
 * Si fondo es 0, no hay mínimo que cumplir.
 */
export function validarEfectivoFisicoVsFondo(
  monto: number,
  caja: Pick<CajaRegistro, 'slug' | 'nombre' | 'fondo_fijo'>
): ValidacionFondoFisico {
  const fondo = fondoFijoEfectivo(caja)
  if (fondo <= 0 || monto >= fondo) return { ok: true }
  return {
    ok: false,
    minimo: fondo,
    mensaje: `El efectivo contado ($${monto.toLocaleString('es-AR')}) no puede ser menor al fondo configurado de ${caja.nombre} ($${fondo.toLocaleString('es-AR')}).`
  }
}
