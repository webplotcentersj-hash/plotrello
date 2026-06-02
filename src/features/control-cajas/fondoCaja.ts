import type { CajaRegistro } from './types'

/** Efectivo permanente en caja operativa (billetes que siempre deben estar). */
export const FONDO_CAJA_BASE_MIN = 100_000

/** Cajas sin regla de fondo mínimo (administración / vuelto). */
export const CAJAS_EXENTAS_FONDO_MIN = new Set(['admin', 'vuelto'])

export function requiereFondoMinimo(cajaSlug: string): boolean {
  return !CAJAS_EXENTAS_FONDO_MIN.has(cajaSlug)
}

/** Fondo fijo efectivo para cálculos y validación (nunca bajo la base en cajas operativas). */
export function fondoFijoEfectivo(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  if (!requiereFondoMinimo(caja.slug)) return caja.fondo_fijo || 0
  return Math.max(caja.fondo_fijo || 0, FONDO_CAJA_BASE_MIN)
}

export function fondoMinimoCaja(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  return fondoFijoEfectivo(caja)
}

export type ValidacionFondoFisico =
  | { ok: true }
  | { ok: false; mensaje: string; minimo: number }

export function validarEfectivoFisicoVsFondo(
  monto: number,
  caja: Pick<CajaRegistro, 'slug' | 'nombre' | 'fondo_fijo'>
): ValidacionFondoFisico {
  const minimo = fondoMinimoCaja(caja)
  if (minimo <= 0 || monto >= minimo) return { ok: true }
  return {
    ok: false,
    minimo,
    mensaje: `El efectivo contado ($${monto.toLocaleString('es-AR')}) no puede ser menor al fondo de caja de ${caja.nombre} ($${minimo.toLocaleString('es-AR')}). El fondo es el dinero real que debe permanecer siempre en la caja.`
  }
}
