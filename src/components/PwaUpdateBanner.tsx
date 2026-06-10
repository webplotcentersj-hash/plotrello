import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import './PwaUpdate.css'

export default function PwaUpdateBanner() {
  const pwa = usePwaUpdateOptional()
  if (!pwa || !pwa.needRefresh || pwa.bannerDismissed) return null

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <div className="pwa-update-banner__content">
        <span className="pwa-update-banner__icon" aria-hidden>
          ⟳
        </span>
        <div className="pwa-update-banner__text">
          <strong>Nueva versión disponible</strong>
          <span>Actualizá PLOT para obtener mejoras y correcciones recientes.</span>
        </div>
      </div>
      <div className="pwa-update-banner__actions">
        <button
          type="button"
          className="pwa-update-banner__btn pwa-update-banner__btn--ghost"
          onClick={() => pwa.openUpdateModal('available')}
        >
          Ver novedades
        </button>
        <button type="button" className="pwa-update-banner__btn pwa-update-banner__btn--primary" onClick={pwa.applyUpdate}>
          Actualizar ahora
        </button>
        <button
          type="button"
          className="pwa-update-banner__btn pwa-update-banner__btn--ghost"
          onClick={pwa.dismissBanner}
        >
          Más tarde
        </button>
      </div>
    </div>
  )
}
