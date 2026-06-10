import { useEffect, useMemo, useRef } from 'react'
import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import { getReleaseModalContent, readLastSeenReleaseId } from '../data/pwaReleaseNotes'
import { downloadReleaseGuide } from '../utils/pwaReleaseGuide'
import './PwaUpdate.css'

type PwaUpdateModalProps = {
  mode: 'available' | 'installed'
  onClose: () => void
}

export default function PwaUpdateModal({ mode, onClose }: PwaUpdateModalProps) {
  const pwa = usePwaUpdateOptional()
  const dialogRef = useRef<HTMLDivElement>(null)

  const release = useMemo(
    () => getReleaseModalContent(readLastSeenReleaseId(), mode),
    [mode]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const isAvailable = mode === 'available'
  const hasGuide = release.guideSteps.length > 0

  return (
    <div className="pwa-update-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="pwa-update-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-update-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pwa-update-modal__header">
          <span className="pwa-update-modal__badge" aria-hidden>
            {isAvailable ? '⟳' : '✓'}
          </span>
          <div>
            <h2 id="pwa-update-modal-title">
              {isAvailable ? 'Hay una actualización lista' : release.title}
            </h2>
            <p className="pwa-update-modal__subtitle">
              {isAvailable
                ? `Versión ${release.label} · Instalá para usar estos cambios.`
                : `Versión ${release.label} · Ya está instalada en tu dispositivo.`}
            </p>
          </div>
          <button type="button" className="pwa-update-modal__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="pwa-update-modal__body">
          <p className="pwa-update-modal__summary">{release.summary}</p>

          <section className="pwa-update-modal__section">
            <h3>{isAvailable ? 'Novedades de esta versión' : '¿Qué mejoramos?'}</h3>
            <ul className="pwa-update-modal__improvements">
              {release.improvements.map((item) => (
                <li key={item.title}>
                  <span className="pwa-update-modal__improvement-icon" aria-hidden>
                    {item.icon}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {!isAvailable && hasGuide && (
            <section className="pwa-update-modal__section">
              <h3>Guía rápida</h3>
              <ol className="pwa-update-modal__steps">
                {release.guideSteps.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <footer className="pwa-update-modal__footer">
          {!isAvailable && hasGuide && (
            <button
              type="button"
              className="pwa-update-modal__btn pwa-update-modal__btn--ghost"
              onClick={() =>
                downloadReleaseGuide({
                  id: release.ids.join('+'),
                  label: release.label,
                  title: release.title,
                  summary: release.summary,
                  improvements: release.improvements,
                  guideSteps: release.guideSteps
                })
              }
            >
              ⬇ Descargar guía
            </button>
          )}
          <div className="pwa-update-modal__footer-main">
            {!isAvailable ? (
              <button
                type="button"
                className="pwa-update-modal__btn pwa-update-modal__btn--primary"
                onClick={onClose}
              >
                Entendido, seguir trabajando
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="pwa-update-modal__btn pwa-update-modal__btn--ghost"
                  onClick={onClose}
                >
                  Más tarde
                </button>
                <button
                  type="button"
                  className="pwa-update-modal__btn pwa-update-modal__btn--primary"
                  onClick={() => void pwa?.applyUpdate()}
                >
                  Actualizar ahora
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
