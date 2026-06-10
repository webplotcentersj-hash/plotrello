import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import './PwaUpdate.css'

export default function PwaUpdateToast() {
  const pwa = usePwaUpdateOptional()
  if (!pwa?.toast) return null

  return (
    <div
      className={`pwa-update-toast pwa-update-toast--${pwa.toast.type}`}
      role="status"
      aria-live="polite"
    >
      <span className="pwa-update-toast__message">{pwa.toast.message}</span>
      <button
        type="button"
        className="pwa-update-toast__close"
        onClick={pwa.dismissToast}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  )
}
