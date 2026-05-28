import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PedidoClienteDetalle } from '../../types/api'
import apiService from '../../services/api'
import {
  buildPedidoEspecificacionTexto,
  downloadArchivo,
  isImageArchivo,
  splitPedidoArchivos
} from '../../utils/pedidoClienteMaterial'
import './PedidoClienteMaterialModal.css'

type Props = {
  pedidoId: number | null
  numeroPedido?: string
  onClose: () => void
}

export default function PedidoClienteMaterialModal({ pedidoId, numeroPedido, onClose }: Props) {
  const [detalle, setDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!pedidoId) {
      setDetalle(null)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await apiService.getDetallePedidoCliente(pedidoId)
        if (cancelled) return
        if (res.success && res.data) {
          setDetalle(res.data)
        } else {
          setError(res.error || 'No se pudo cargar el pedido')
        }
      } catch {
        if (!cancelled) setError('Error al cargar el pedido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [pedidoId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!pedidoId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [pedidoId])

  if (!pedidoId) return null

  const pedido = detalle?.pedido
  const archivos = detalle?.archivos ?? []
  const { mockup, otros } = splitPedidoArchivos(archivos)
  const especificacion = pedido ? buildPedidoEspecificacionTexto(pedido) : ''
  const titulo = numeroPedido || pedido?.numero_pedido || `Pedido #${pedidoId}`

  const modal = (
    <div className="pedido-material-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pedido-material-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pedido-material-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pedido-material-modal__header">
          <div>
            <h2 id="pedido-material-modal-title">Material del pedido</h2>
            <p className="pedido-material-modal__sub">{titulo}</p>
          </div>
          <button type="button" className="pedido-material-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>

        {loading && (
          <div className="pedido-material-modal__loading">
            <div className="spinner" />
            <p>Cargando mockup y archivos…</p>
          </div>
        )}

        {error && !loading && <div className="pedido-material-modal__error">{error}</div>}

        {!loading && !error && detalle && (
          <div className="pedido-material-modal__body">
            <section className="pedido-material-modal__section">
              <h3>Vista previa (mockup)</h3>
              {mockup ? (
                <div className="pedido-material-mockup-wrap">
                  <img src={mockup.url} alt="Mockup del pedido" className="pedido-material-mockup-img" />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void downloadArchivo(mockup.url, mockup.nombre_archivo)}
                  >
                    Descargar mockup
                  </button>
                </div>
              ) : (
                <p className="pedido-material-modal__empty">Sin mockup guardado para este pedido.</p>
              )}
            </section>

            <section className="pedido-material-modal__section">
              <h3>Especificación y brief</h3>
              {especificacion ? (
                <pre className="pedido-material-spec">{especificacion}</pre>
              ) : (
                <p className="pedido-material-modal__empty">Sin especificación registrada.</p>
              )}
            </section>

            {detalle.items.length > 0 && (
              <section className="pedido-material-modal__section">
                <h3>Artículos</h3>
                <ul className="pedido-material-items">
                  {detalle.items.map((item) => (
                    <li key={item.id}>
                      <strong>{item.articulo?.nombre || 'Artículo'}</strong>
                      {item.descripcion_personalizada && (
                        <span> — {item.descripcion_personalizada}</span>
                      )}
                      <span className="pedido-material-item-qty"> × {item.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="pedido-material-modal__section">
              <h3>Archivos del cliente</h3>
              {otros.length === 0 ? (
                <p className="pedido-material-modal__empty">No hay otros archivos adjuntos.</p>
              ) : (
                <div className="pedido-material-archivos">
                  {otros.map((archivo) => (
                    <div key={archivo.id} className="pedido-material-archivo-card">
                      {isImageArchivo(archivo) && (
                        <img src={archivo.url} alt="" className="pedido-material-archivo-thumb" />
                      )}
                      <div className="pedido-material-archivo-meta">
                        <span className="pedido-material-archivo-name">{archivo.nombre_archivo}</span>
                        {archivo.tamaño != null && (
                          <span className="pedido-material-archivo-size">
                            {(archivo.tamaño / 1024).toFixed(1)} KB
                          </span>
                        )}
                        <div className="pedido-material-archivo-actions">
                          <a href={archivo.url} target="_blank" rel="noopener noreferrer">
                            Abrir
                          </a>
                          <button
                            type="button"
                            onClick={() => void downloadArchivo(archivo.url, archivo.nombre_archivo)}
                          >
                            Descargar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
