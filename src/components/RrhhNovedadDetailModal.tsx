import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RrhhNovedad } from '../types/api'
import { RRHH_NOVEDAD_GRUPOS, etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
import '../pages/RecursosHumanosNovedadesPage.css'

type Props = {
  novedad: RrhhNovedad
  empleadoNombre: string
  onClose: () => void
  onEdit?: () => void
}

const RrhhNovedadDetailModal = ({ novedad, empleadoNombre, onClose, onEdit }: Props) => (
  <div
    className="rrhh-novedades-modal-overlay rrhh-novedades-modal-overlay--detail"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rrhh-novedad-detail-title"
    onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}
  >
    <div className="rrhh-novedades-detail-card" onClick={(e) => e.stopPropagation()}>
      <header className="rrhh-novedades-detail-head">
        <div>
          <span
            className={`rrhh-novedades-detail-badge rrhh-novedades-detail-badge--${novedad.grupo}`}
          >
            {RRHH_NOVEDAD_GRUPOS.find((g) => g.value === novedad.grupo)?.label ?? novedad.grupo}
          </span>
          <h3 id="rrhh-novedad-detail-title">{empleadoNombre}</h3>
          <p className="rrhh-novedades-detail-sub">{etiquetaCodigoRrhhNovedad(novedad.codigo)}</p>
        </div>
        <button
          type="button"
          className="rrhh-novedades-modal-close"
          aria-label="Cerrar"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <dl className="rrhh-novedades-detail-dl">
        <div>
          <dt>Período</dt>
          <dd>
            {novedad.fecha_desde}
            {novedad.fecha_hasta !== novedad.fecha_desde ? ` → ${novedad.fecha_hasta}` : ''}
          </dd>
        </div>
        {novedad.grupo === 'tardanza_retiro' && novedad.duracion_minutos != null ? (
          <div>
            <dt>Duración</dt>
            <dd>{novedad.duracion_minutos} minutos</dd>
          </div>
        ) : null}
        {novedad.grupo === 'horas_extra' && novedad.horas_extra_cantidad != null ? (
          <div>
            <dt>Horas extra</dt>
            <dd>{novedad.horas_extra_cantidad} h</dd>
          </div>
        ) : null}
        {novedad.id_solicitud_permiso != null ? (
          <div>
            <dt>Permiso vinculado</dt>
            <dd>#{novedad.id_solicitud_permiso}</dd>
          </div>
        ) : null}
        <div>
          <dt>Registro</dt>
          <dd>
            {novedad.created_at
              ? format(parseISO(novedad.created_at), 'd MMM yyyy, HH:mm', { locale: es })
              : '—'}
          </dd>
        </div>
      </dl>

      {novedad.observaciones?.trim() ? (
        <div className="rrhh-novedades-detail-obs">
          <span className="rrhh-novedades-detail-obs-label">Observaciones</span>
          <p>{novedad.observaciones}</p>
        </div>
      ) : null}

      <div className="rrhh-novedades-detail-adj">
        <span className="rrhh-novedades-detail-obs-label">Adjuntos</span>
        {novedad.adjuntos?.length ? (
          <ul className="rrhh-novedades-detail-adj-list">
            {novedad.adjuntos.map((a, i) => (
              <li key={a.url + i}>
                {a.mime.startsWith('image/') ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rrhh-novedades-detail-thumb-wrap"
                  >
                    <img
                      src={a.url}
                      alt={a.nombre}
                      className="rrhh-novedades-detail-thumb"
                      loading="lazy"
                    />
                    <span className="rrhh-novedades-detail-file-name">{a.nombre}</span>
                  </a>
                ) : (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rrhh-novedades-detail-file-link"
                  >
                    <span className="rrhh-novedades-detail-file-icon" aria-hidden>
                      📄
                    </span>
                    {a.nombre}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rrhh-novedades-detail-empty">Sin archivos adjuntos.</p>
        )}
      </div>

      <footer className="rrhh-novedades-detail-foot">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
        {onEdit ? (
          <button type="button" className="btn-primary" onClick={onEdit}>
            Editar
          </button>
        ) : null}
      </footer>
    </div>
  </div>
)

export default RrhhNovedadDetailModal
