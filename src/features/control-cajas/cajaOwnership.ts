import { cajaSlugForUsuario, esCajaSlugUsuario } from './cajaPorUsuario'
import type { CajaMovimiento, CajaRegistro } from './types'

/** Cajas de sistema: no tienen titular de mostrador. */
export const CAJAS_SISTEMA = new Set(['admin', 'vuelto'])

export type CajaActor = {
  id: number
  esAdmin?: boolean
  nombre?: string
}

export function esCajaSistema(slug: string): boolean {
  return CAJAS_SISTEMA.has(slug)
}

/** Titular de una caja operativa `u-{id}` o por `id_usuario`. */
export function idTitularCaja(
  slug: string,
  caja?: Pick<CajaRegistro, 'slug' | 'id_usuario'> | null
): number | null {
  if (caja?.id_usuario != null && caja.id_usuario > 0) return caja.id_usuario
  if (!esCajaSlugUsuario(slug)) return null
  const n = Number(slug.slice(2))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function esDuenioCaja(
  actorId: number,
  slug: string,
  caja?: Pick<CajaRegistro, 'slug' | 'id_usuario'> | null
): boolean {
  if (esCajaSistema(slug)) return false
  if (slug === cajaSlugForUsuario(actorId)) return true
  const titular = idTitularCaja(slug, caja)
  return titular != null && titular === actorId
}

/**
 * Solo el titular puede operar su caja. Admin puede todo.
 * Cajas sistema (admin/vuelto) no se "operan" como propia de mostrador.
 */
export function assertPuedeOperarCaja(
  actor: CajaActor | null | undefined,
  slug: string,
  cajas?: Array<Pick<CajaRegistro, 'slug' | 'id_usuario' | 'nombre'>>
): void {
  if (!slug) throw new Error('Falta la caja.')
  if (esCajaSistema(slug)) return
  if (actor?.esAdmin) return
  if (actor?.id == null) {
    throw new Error('Tenés que estar identificado para operar una caja.')
  }
  const caja = cajas?.find((c) => c.slug === slug) ?? null
  if (esDuenioCaja(actor.id, slug, caja)) return
  const nombre = caja?.nombre ?? slug
  throw new Error(
    `Solo el titular puede registrar movimientos en ${nombre}. Cada caja es personal (Caja = usuario).`
  )
}

/**
 * Reglas al grabar un movimiento:
 * - Origen operativa → debe ser del actor (puede enviar fondo a otra).
 * - Destino operativa y origen sistema → debe ser del actor (cobro/ingreso).
 * - Admin: sin restricción.
 */
export function assertPuedeGrabarMovimiento(
  actor: CajaActor | null | undefined,
  mov: Pick<CajaMovimiento, 'origen_slug' | 'destino_slug' | 'tipo_movimiento'>,
  cajas?: Array<Pick<CajaRegistro, 'slug' | 'id_usuario' | 'nombre'>>
): void {
  if (actor?.esAdmin) return
  if (actor?.id == null) return

  const origenOp = !esCajaSistema(mov.origen_slug) && (esCajaSlugUsuario(mov.origen_slug) || Boolean(cajas?.find((c) => c.slug === mov.origen_slug)?.id_usuario))
  const destinoOp = !esCajaSistema(mov.destino_slug) && (esCajaSlugUsuario(mov.destino_slug) || Boolean(cajas?.find((c) => c.slug === mov.destino_slug)?.id_usuario))

  if (origenOp) {
    assertPuedeOperarCaja(actor, mov.origen_slug, cajas)
    return
  }
  if (destinoOp) {
    assertPuedeOperarCaja(actor, mov.destino_slug, cajas)
  }
}
