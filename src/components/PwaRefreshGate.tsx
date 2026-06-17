import type { ReactNode } from 'react'
import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import './PwaUpdate.css'

/**
 * Bloquea la app mientras hay un SW nuevo esperando.
 * Evita mezclar chunks viejos/nuevos (p. ej. useAuth fuera de AuthProvider en /admin).
 */
export default function PwaRefreshGate({ children }: { children: ReactNode }) {
  const pwa = usePwaUpdateOptional()

  if (pwa?.needRefresh) {
    return (
      <div className="pwa-refresh-gate" role="dialog" aria-modal="true" aria-labelledby="pwa-refresh-gate-title">
        <div className="pwa-refresh-gate__card">
          <p className="pwa-refresh-gate__eyebrow">Plot Lab</p>
          <h1 id="pwa-refresh-gate-title">Nueva versión lista</h1>
          <p>
            Hay una actualización pendiente. Para seguir usando el panel (incluido{' '}
            <strong>/admin</strong>), actualizá ahora y evitá errores de carga.
          </p>
          <button
            type="button"
            className="pwa-refresh-gate__btn"
            onClick={() => void pwa.applyUpdate()}
          >
            Actualizar ahora
          </button>
        </div>
      </div>
    )
  }

  return children
}
