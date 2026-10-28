/**
 * Offline parcial Plot Lab.
 * - Activo por defecto (cola + cachés).
 * - `VITE_PLOTLAB_OFFLINE=0` lo apaga en staff (útil en cloud/piloto).
 * - `VITE_PLOTLAB_OFFLINE=1` lo fuerza aunque el host sea nube.
 * Reloj tablet sigue pudiendo encolar aunque staff esté apagado.
 */

import { isPlotLabLanHost } from './plotLabRuntimeMode'

export function isPlotLabOfflinePartialEnabled(): boolean {
  const raw = String(import.meta.env.VITE_PLOTLAB_OFFLINE ?? '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  // Sin env: LAN sí; cloud también (comportamiento actual) salvo que apaguen con =0
  return true
}

/** Reloj / kiosco: cola de marcaciones siempre disponible. */
export function isPlotLabRelojOfflineEnabled(): boolean {
  return true
}

export function getPlotLabOfflineUsuarioId(): number {
  if (typeof localStorage === 'undefined') return 0
  const n = Number(localStorage.getItem('usuario_id') || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Sufijo de DB IndexedDB por usuario (evita mezclar tableros al cambiar de sesión). */
export function plotLabOfflineDbSuffix(): string {
  const id = getPlotLabOfflineUsuarioId()
  return id > 0 ? `u${id}` : 'anon'
}

export const MSG_SOLO_ONLINE =
  'Esta acción requiere conexión (AFIP, Mercado Pago, reportes o altas sensibles). Volvé a tener red e intentá de nuevo.'

export function assertOnlineOrThrow(actionLabel?: string): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(actionLabel ? `${MSG_SOLO_ONLINE} (${actionLabel})` : MSG_SOLO_ONLINE)
  }
}

export function isOnlineOnlyBlocked(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function labelOfflinePilotMode(): string {
  if (!isPlotLabOfflinePartialEnabled()) return 'Offline parcial: apagado'
  if (isPlotLabLanHost()) return 'Offline parcial: LAN'
  return 'Offline parcial: activo'
}
