import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, X } from 'lucide-react'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import type { WorkPoolJob, WorkPoolSector } from '../../types/workPool'
import { downloadArchivo } from '../../utils/pedidoClienteMaterial'
import {
  loadWorkPoolJobDetalleOperario,
  type WorkPoolJobDetalleOperario
} from './workPoolRepository'
import './WorkPoolJobDetalleModal.css'

type Props = {
  job: WorkPoolJob | null
  idUsuario: number
  open: boolean
  onClose: () => void
  onTomar?: (jobId: number) => void
  onEntregar?: (jobId: number) => void
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(n)
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return iso
  }
}

function isImageUrl(url: string, name?: string | null) {
  const t = `${url} ${name ?? ''}`.toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(t) || t.includes('image/')
}

function formatTextValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((item) => formatTextValue(item))
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

function Field({ label, value }: { label: string; value: unknown }) {
  const v = formatTextValue(value)
  if (!v) return null
  return (
    <div className="wp-job-detalle__field">
      <span className="wp-job-detalle__label">{label}</span>
      <p className="wp-job-detalle__value">{v}</p>
    </div>
  )
}

export default function WorkPoolJobDetalleModal({
  job,
  idUsuario,
  open,
  onClose,
  onTomar,
  onEntregar
}: Props) {
  const titleId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<WorkPoolJobDetalleOperario | null>(null)

  useEffect(() => {
    if (!open || !job) {
      setDetalle(null)
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void loadWorkPoolJobDetalleOperario(job.id, idUsuario).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.success || !res.data) {
        setError(res.error || 'No se pudo cargar el detalle')
        setDetalle(null)
        return
      }
      setDetalle(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [open, job, idUsuario])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !job) return null

  const j = detalle?.job
  const orden = detalle?.orden
  const adjuntos = detalle?.adjuntos ?? []
  const pedidoArchivos = detalle?.pedido_archivos ?? []
  const driveUrl = detalle?.entrega_drive_url

  const canTomar = job.estado === 'disponible' && onTomar
  const canEntregar =
    onEntregar && ['en_curso', 'asignado', 'cambios'].includes(job.estado)

  const fotos = [
    ...(orden?.foto_url
      ? [{ key: 'op-foto', url: orden.foto_url, title: 'Foto OP' }]
      : []),
    ...adjuntos
      .filter((a) => isImageUrl(a.url, a.titulo))
      .map((a) => ({ key: `adj-${a.id}`, url: a.url, title: a.titulo || 'Adjunto' })),
    ...pedidoArchivos
      .filter((a) => isImageUrl(a.url, a.nombre_archivo) || (a.tipo || '').includes('image'))
      .map((a) => ({
        key: `ped-${a.id}`,
        url: a.url,
        title: a.nombre_archivo || 'Archivo portal'
      }))
  ]

  const archivosDescarga = [
    ...adjuntos.map((a) => ({
      key: `d-adj-${a.id}`,
      url: a.url,
      name: a.titulo || `Adjunto ${a.id}`
    })),
    ...pedidoArchivos.map((a) => ({
      key: `d-ped-${a.id}`,
      url: a.url,
      name: a.nombre_archivo || `Archivo ${a.id}`
    }))
  ]

  const sectorLabel =
    WORK_POOL_SECTOR_LABELS[(j?.sector || job.sector) as WorkPoolSector] ||
    j?.sector ||
    job.sector

  return createPortal(
    <div className="wp-job-detalle" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="wp-job-detalle__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="wp-job-detalle__panel">
        <header className="wp-job-detalle__head">
          <div>
            <p className="wp-job-detalle__eyebrow">Detalle del trabajo</p>
            <h2 id={titleId}>{job.titulo}</h2>
            <div className="wp-job-detalle__meta-row">
              <span className={`wp-job-detalle__badge wp-job-detalle__badge--${job.estado}`}>
                {WORK_POOL_ESTADO_LABELS[job.estado]}
              </span>
              <span>{sectorLabel}</span>
              <span>{formatArs(job.monto_presupuestado)}</span>
              {job.plazo ? <span>Plazo {job.plazo}</span> : null}
            </div>
          </div>
          <button type="button" className="wp-job-detalle__close" onClick={onClose} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="wp-job-detalle__body">
          {loading ? <p className="wp-job-detalle__muted">Cargando info de la OP, fotos y archivos…</p> : null}
          {error ? <p className="wp-job-detalle__error">{error}</p> : null}

          {!loading && !error && detalle ? (
            <>
              <section className="wp-job-detalle__section">
                <h3>Trabajo en bolsa</h3>
                <div className="wp-job-detalle__grid">
                  <Field label="Descripción / brief publicado" value={j?.descripcion || job.descripcion} />
                  <Field label="Prioridad" value={j?.prioridad} />
                  <Field
                    label="Pedido portal"
                    value={j?.numero_pedido || (job.metadata?.numero_pedido as string) || null}
                  />
                  <Field label="Notas de entrega" value={j?.notas_entrega} />
                  <Field label="Pedidos de cambios" value={j?.motivo_rechazo} />
                </div>
                {driveUrl ? (
                  <a
                    className="wp-job-detalle__link"
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden />
                    Entrega en Drive
                  </a>
                ) : null}
              </section>

              <section className="wp-job-detalle__section">
                <h3>Datos de la OP</h3>
                {orden ? (
                  <div className="wp-job-detalle__grid">
                    <Field label="Número OP" value={orden.numero_op} />
                    <Field
                      label="Cliente / empresa"
                      value={
                        orden.cliente_empresa ||
                        orden.cliente_nombre_completo ||
                        orden.cliente ||
                        null
                      }
                    />
                    <Field label="Sector" value={orden.sector} />
                    <Field label="Objetivo" value={orden.objetivo_proyecto} />
                    <Field label="Brief público" value={orden.brief_publico} />
                    <Field label="Descripción OP" value={orden.descripcion} />
                    <Field label="Público objetivo" value={orden.publico_objetivo} />
                    <Field label="Etiquetas" value={orden.etiquetas} />
                    <Field label="Fecha límite brief" value={formatDate(orden.fecha_limite_brief)} />
                    <Field label="Deadline brief" value={formatDate(orden.deadline_brief)} />
                  </div>
                ) : (
                  <p className="wp-job-detalle__muted">
                    Este trabajo no tiene OP vinculada. Usá el brief del trabajo en bolsa.
                  </p>
                )}
              </section>

              <section className="wp-job-detalle__section">
                <h3>Fotos y previews</h3>
                {fotos.length === 0 ? (
                  <p className="wp-job-detalle__muted">No hay imágenes cargadas en la OP ni en el pedido.</p>
                ) : (
                  <div className="wp-job-detalle__gallery">
                    {fotos.map((f) => (
                      <a
                        key={f.key}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wp-job-detalle__thumb"
                        title={f.title}
                      >
                        <img src={f.url} alt={f.title} loading="lazy" />
                        <span>{f.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className="wp-job-detalle__section">
                <h3>Archivos descargables</h3>
                {archivosDescarga.length === 0 ? (
                  <p className="wp-job-detalle__muted">No hay archivos adjuntos para descargar.</p>
                ) : (
                  <ul className="wp-job-detalle__files">
                    {archivosDescarga.map((a) => (
                      <li key={a.key}>
                        <span className="wp-job-detalle__file-name">{a.name}</span>
                        <div className="wp-job-detalle__file-actions">
                          <a href={a.url} target="_blank" rel="noopener noreferrer">
                            Abrir
                          </a>
                          <button
                            type="button"
                            onClick={() => void downloadArchivo(a.url, a.name)}
                          >
                            <Download size={14} aria-hidden />
                            Descargar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>

        <footer className="wp-job-detalle__footer">
          <button type="button" className="phi-btn phi-btn--outline" onClick={onClose}>
            Cerrar
          </button>
          {canTomar ? (
            <button
              type="button"
              className="phi-btn phi-btn--dark"
              onClick={() => {
                onTomar?.(job.id)
                onClose()
              }}
            >
              Tomar trabajo
            </button>
          ) : null}
          {canEntregar ? (
            <button
              type="button"
              className="phi-btn phi-btn--dark"
              onClick={() => {
                onEntregar?.(job.id)
                onClose()
              }}
            >
              Entregar
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body
  )
}
