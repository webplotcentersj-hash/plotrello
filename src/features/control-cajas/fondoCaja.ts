import type { CajaRegistro } from './types'

/** Monto sugerido al crear una caja operativa por usuario. El operador puede cambiarlo en cierre de turno. */
export const FONDO_CAJA_RECOMENDADO = 100_000

/** Alias histórico — mismo valor recomendado, no es un mínimo obligatorio. */
export const FONDO_CAJA_BASE_MIN = FONDO_CAJA_RECOMENDADO

/** Cajas sin regla de fondo mínimo (administración / vuelto). */
export const CAJAS_EXENTAS_FONDO_MIN = new Set(['admin', 'vuelto'])

export function requiereFondoMinimo(cajaSlug: string): boolean {
  return !CAJAS_EXENTAS_FONDO_MIN.has(cajaSlug)
}

/** Fondo configurado en la caja; si no hay valor, usa el recomendado como sugerencia inicial. */
export function fondoFijoEfectivo(caja: Pick<CajaRegistro, 'slug' | 'fondo_fijo'>): number {
  if (!requiereFondoMinimo(caja.slug)) return caja.fondo_fijo || 0
  const v = Number(caja.fondo_fijo) || 0
  return v > 0 ? v : FONDO_CAJA_RECOMENDADO
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
