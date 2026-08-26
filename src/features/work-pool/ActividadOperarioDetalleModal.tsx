import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { WorkPoolNotaSupervision } from './workPoolOperarioNotas'
import { formatHorarioNota } from './workPoolOperarioNotas'
import './ActividadOperarioDetalleModal.css'

const TIPO_LABEL: Record<string, string> = {
  bitacora: 'Bitácora',
  checklist: 'Checklist',
  anotador: 'Anotador'
}

type Props = {
  nota: WorkPoolNotaSupervision | null
  onClose: () => void
  onVerLegajo?: (nota: WorkPoolNotaSupervision) => void
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

export default function ActividadOperarioDetalleModal({ nota, onClose, onVerLegajo }: Props) {
  if (!nota) return null

  return createPortal(
    <div
      className="act-op-detalle-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="act-op-detalle" role="dialog" aria-labelledby="act-op-detalle-title">
        <header className="act-op-detalle__head">
          <div>
            <p className="act-op-detalle__eyebrow">{TIPO_LABEL[nota.tipo] || nota.tipo}</p>
            <h2 id="act-op-detalle-title">{nota.titulo || nota.detalle}</h2>
          </div>
          <button type="button" className="act-op-detalle__close" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="act-op-detalle__body">
          <dl className="act-op-detalle__grid">
            <div>
              <dt>Operario</dt>
              <dd>{nota.usuario_nombre || `Usuario #${nota.id_usuario}`}</dd>
            </div>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{formatWhen(nota.created_at)}</dd>
            </div>
            {formatHorarioNota(nota.hora_inicio, nota.hora_fin) ? (
              <div>
                <dt>Horario registrado</dt>
                <dd>{formatHorarioNota(nota.hora_inicio, nota.hora_fin)}</dd>
              </div>
            ) : null}
            {nota.hecho ? (
              <div>
                <dt>Estado</dt>
                <dd className="act-op-detalle__hecho">Completado</dd>
              </div>
            ) : null}
            {nota.job_titulo ? (
              <div>
                <dt>Trabajo</dt>
                <dd>
                  {nota.job_titulo}
                  {nota.job_estado ? ` · ${nota.job_estado}` : ''}
                </dd>
              </div>
            ) : null}
            {nota.numero_op ? (
              <div>
                <dt>OP</dt>
                <dd>{nota.numero_op}</dd>
              </div>
            ) : null}
            {nota.numero_venta ? (
              <div>
                <dt>Venta</dt>
                <dd>{nota.numero_venta}</dd>
              </div>
            ) : null}
            {nota.numero_oportunidad ? (
              <div>
                <dt>Oportunidad</dt>
                <dd>{nota.numero_oportunidad}</dd>
              </div>
            ) : null}
            {nota.id_legajo ? (
              <div>
                <dt>Legajo</dt>
                <dd>#{nota.id_legajo}</dd>
              </div>
            ) : null}
          </dl>

          {nota.titulo && nota.detalle && nota.titulo !== nota.detalle ? (
            <section className="act-op-detalle__section">
              <h3>Detalle</h3>
              <p>{nota.detalle}</p>
            </section>
          ) : null}

          {nota.adjuntos.length > 0 ? (
            <section className="act-op-detalle__section">
              <h3>Documentos adjuntos</h3>
              <ul className="act-op-detalle__adjuntos">
                {nota.adjuntos.map((a) => (
                  <li key={a.url}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      {a.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="act-op-detalle__foot">
          {onVerLegajo ? (
            <button type="button" className="act-op-detalle__btn act-op-detalle__btn--primary" onClick={() => onVerLegajo(nota)}>
              Ver legajo
            </button>
          ) : null}
          <Link to="/rrhh/usuarios" className="act-op-detalle__btn act-op-detalle__btn--ghost">
            RRHH · Legajos
          </Link>
          <button type="button" className="act-op-detalle__btn act-op-detalle__btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
