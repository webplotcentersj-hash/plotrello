import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { WorkPoolSolicitud } from '../../types/workPool'
import { nivelLabel, rubroLabel } from './workPoolPostulacion'
import { solicitudTipoLabel } from './workPoolOperarioExterno'

type Props = {
  solicitud: WorkPoolSolicitud
  onClose: () => void
  onAprobar: () => void
  onRechazar: () => void
}

function adjuntoLink(url: string | null | undefined, nombre?: string | null) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="work-pool-solicitud-link">
      {nombre || 'Ver archivo'}
    </a>
  )
}

function SolicitudDetalleBody({ s }: { s: WorkPoolSolicitud }) {
  const rubro = s.rubro ?? (s.tipo === 'diseno' ? 'diseno' : 'instalaciones')
  return (
    <div className="work-pool-solicitud-modal__body">
      <div className="work-pool-solicitud-modal__tags">
        <span>{rubroLabel(rubro)}</span>
        {s.nivel && <span>{nivelLabel(s.nivel)}</span>}
        {!s.rubro && <span>{solicitudTipoLabel(s.tipo)}</span>}
        {s.zona_cobertura && <span>{s.zona_cobertura}</span>}
        <span>{new Date(s.created_at).toLocaleDateString('es-AR')}</span>
      </div>

      <div className="work-pool-solicitud-modal__grid">
        {s.telefono && (
          <div>
            <dt>Teléfono</dt>
            <dd>{s.telefono}</dd>
          </div>
        )}
        {s.documento && (
          <div>
            <dt>Documento</dt>
            <dd>{s.documento}</dd>
          </div>
        )}
        {s.titulo_texto && (
          <div className="work-pool-solicitud-modal__grid--full">
            <dt>Título</dt>
            <dd>{s.titulo_texto}</dd>
          </div>
        )}
      </div>

      {s.experiencia && (
        <div className="work-pool-solicitud-modal__block">
          <h4>Experiencia</h4>
          <p>{s.experiencia}</p>
        </div>
      )}
      {s.referencias && (
        <div className="work-pool-solicitud-modal__block">
          <h4>Referencias</h4>
          <p>{s.referencias}</p>
        </div>
      )}
      {s.mensaje && (
        <div className="work-pool-solicitud-modal__block">
          <h4>Comentarios</h4>
          <p>{s.mensaje}</p>
        </div>
      )}
      {s.skills.length > 0 && (
        <div className="work-pool-solicitud-modal__skills">
          {s.skills.map((sk) => (
            <span key={sk}>{sk}</span>
          ))}
        </div>
      )}

      <div className="work-pool-solicitud-modal__adjuntos">
        <h4>Archivos</h4>
        <div className="work-pool-solicitud-adjuntos">
          <span>{adjuntoLink(s.cv_url, s.cv_nombre ?? 'CV')}</span>
          <span>{adjuntoLink(s.titulo_url, s.titulo_nombre ?? 'Título / certificado')}</span>
          <span>
            {adjuntoLink(s.titulo_universitario_url, s.titulo_universitario_nombre ?? 'Título universitario')}
          </span>
          <span>{adjuntoLink(s.libreta_url, s.libreta_nombre ?? 'Libreta')}</span>
          <span>{adjuntoLink(s.portfolio_archivo_url, s.portfolio_archivo_nombre ?? 'Portafolio')}</span>
          {s.portfolio_url && (
            <a href={s.portfolio_url} target="_blank" rel="noreferrer" className="work-pool-solicitud-link">
              Portafolio (URL)
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default function WorkPoolSolicitudDetailModal({
  solicitud,
  onClose,
  onAprobar,
  onRechazar
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="work-pool-solicitud-modal" role="dialog" aria-modal="true" aria-labelledby="wp-sol-modal-title">
      <button type="button" className="work-pool-solicitud-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="work-pool-solicitud-modal__panel">
        <header className="work-pool-solicitud-modal__head">
          <div className="work-pool-solicitud-modal__identity">
            <span className="work-pool-solicitud-modal__avatar" aria-hidden>
              {initials(solicitud.nombre_completo)}
            </span>
            <div>
              <p className="work-pool-solicitud-modal__eyebrow">Solicitud #{solicitud.id}</p>
              <h2 id="wp-sol-modal-title">{solicitud.nombre_completo}</h2>
              <p className="work-pool-solicitud-modal__email">{solicitud.email}</p>
            </div>
          </div>
          <button type="button" className="work-pool-solicitud-modal__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <SolicitudDetalleBody s={solicitud} />

        <footer className="work-pool-solicitud-modal__foot">
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--success"
            onClick={onAprobar}
          >
            Aprobar
          </button>
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--warn"
            onClick={onRechazar}
          >
            Rechazar
          </button>
          <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
