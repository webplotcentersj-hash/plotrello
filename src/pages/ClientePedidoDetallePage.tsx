import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { PedidoClienteDetalle } from '../types/api'
import './ClientePedidoDetallePage.css'

export default function ClientePedidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [detalle, setDetalle] = useState<PedidoClienteDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  const [formData, setFormData] = useState({
    fecha_limite_deseada: '',
    observaciones_cliente: '',
    es_urgente: false,
    requiere_delivery: false,
    direccion_delivery: '',
    brief_publico: '',
    objetivo_proyecto: '',
    estilo_diseno: '',
    referencias: '',
    referencias_links: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    if (id) {
      loadDetalle()
    }
  }, [id, cliente, authLoading, navigate])

  const loadDetalle = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const response = await apiService.getDetallePedidoCliente(parseInt(id))
      if (response.success && response.data) {
        setDetalle(response.data)
        const pedido = response.data.pedido
        setFormData({
          fecha_limite_deseada: pedido.fecha_limite_deseada || '',
          observaciones_cliente: pedido.observaciones_cliente || '',
          es_urgente: pedido.es_urgente || false,
          requiere_delivery: pedido.requiere_delivery || false,
          direccion_delivery: pedido.direccion_delivery || '',
          brief_publico: pedido.brief_publico || '',
          objetivo_proyecto: pedido.objetivo_proyecto || '',
          estilo_diseno: pedido.estilo_diseno || '',
          referencias: pedido.referencias || '',
          referencias_links: pedido.referencias_links || ''
        })
      } else {
        setError(response.error || 'Error al cargar el pedido')
      }
    } catch (err) {
      setError('Error al cargar el pedido')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!cliente || !id) return

    setGuardando(true)
    setError('')
    try {
      const response = await apiService.actualizarPedidoCliente(
        parseInt(id),
        cliente.id,
        {
          fecha_limite_deseada: formData.fecha_limite_deseada || undefined,
          observaciones_cliente: formData.observaciones_cliente.trim() || undefined,
          es_urgente: formData.es_urgente,
          requiere_delivery: formData.requiere_delivery,
          direccion_delivery: formData.direccion_delivery.trim() || undefined,
          brief_publico: formData.brief_publico.trim() || undefined,
          objetivo_proyecto: formData.objetivo_proyecto.trim() || undefined,
          estilo_diseno: formData.estilo_diseno.trim() || undefined,
          referencias: formData.referencias.trim() || undefined,
          referencias_links: formData.referencias_links.trim() || undefined
        }
      )

      if (response.success) {
        setEditando(false)
        loadDetalle()
      } else {
        setError(response.error || 'Error al guardar cambios')
      }
    } catch (err) {
      setError('Error al guardar cambios')
    } finally {
      setGuardando(false)
    }
  }

  const handleCancelar = async () => {
    if (!cliente || !id) return
    if (!confirm('¿Estás seguro de que deseas cancelar este pedido?')) return

    setCancelando(true)
    setError('')
    try {
      const response = await apiService.cancelarPedidoCliente(parseInt(id), cliente.id)
      if (response.success) {
        navigate('/cliente/dashboard')
      } else {
        setError(response.error || 'Error al cancelar el pedido')
      }
    } catch (err) {
      setError('Error al cancelar el pedido')
    } finally {
      setCancelando(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: '#f59e0b',
      en_revision: '#3b82f6',
      aprobado: '#10b981',
      rechazado: '#ef4444',
      convertido_completo: '#6366f1',
      cancelado: '#6b7280'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_revision: 'En Revisión',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
      convertido_completo: 'Convertido a OP',
      cancelado: 'Cancelado'
    }
    return labels[estado] || estado
  }

  const puedeEditar = detalle?.pedido.estado === 'pendiente' || detalle?.pedido.estado === 'en_revision'
  const puedeCancelar = detalle?.pedido.estado !== 'cancelado' && 
                        detalle?.pedido.estado !== 'convertido_completo' &&
                        detalle?.pedido.estado !== 'convertido_parcial'

  if (authLoading || loading) {
    return (
      <div className="cliente-pedido-detalle-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="cliente-pedido-detalle-page">
        <div className="error-container">
          <h2>Pedido no encontrado</h2>
          <p>{error || 'No se pudo cargar el pedido'}</p>
          <button className="btn-primary" onClick={() => navigate('/cliente/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-pedido-detalle-page">
      <header className="cliente-pedido-detalle-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <div>
              <h1>{detalle.pedido.numero_pedido}</h1>
              <p className="pedido-fecha">
                {new Date(detalle.pedido.fecha_pedido).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/dashboard')}
            >
              ← Volver
            </button>
            {puedeEditar && (
              <button 
                className="btn-secondary"
                onClick={() => setEditando(!editando)}
              >
                {editando ? 'Cancelar Edición' : '✏️ Editar'}
              </button>
            )}
            {puedeCancelar && (
              <button 
                className="btn-danger"
                onClick={handleCancelar}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando...' : '❌ Cancelar Pedido'}
              </button>
            )}
            <button 
              className="btn-primary"
              onClick={() => navigate(`/cliente/mensajes/${detalle.pedido.id}`)}
            >
              💬 Mensajes
            </button>
          </div>
        </div>
      </header>

      <main className="cliente-pedido-detalle-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="pedido-info-grid">
          {/* Estado y Badges */}
          <div className="info-card">
            <h2>Estado del Pedido</h2>
            <div className="estado-badge-large" style={{ backgroundColor: getEstadoColor(detalle.pedido.estado) }}>
              {getEstadoLabel(detalle.pedido.estado)}
            </div>
            <div className="badges-list">
              {detalle.pedido.es_urgente && (
                <span className="badge badge-urgente">⚡ Urgente</span>
              )}
              {detalle.pedido.requiere_delivery && (
                <span className="badge badge-delivery">🚚 Delivery</span>
              )}
            </div>
            {detalle.pedido.id_op_asociada && (
              <div className="op-link">
                <strong>OP Asociada:</strong>
                <button
                  className="btn-link"
                  onClick={() => navigate(`/cliente/buscar-op/${detalle.pedido.id_op_asociada}`)}
                >
                  OP-{detalle.pedido.id_op_asociada}
                </button>
              </div>
            )}
          </div>

          {/* Resumen Financiero */}
          <div className="info-card">
            <h2>Resumen</h2>
            <div className="resumen-item">
              <span className="resumen-label">Total:</span>
              <span className="resumen-value">${detalle.pedido.precio_total.toFixed(2)}</span>
            </div>
            {detalle.pedido.fecha_limite_deseada && (
              <div className="resumen-item">
                <span className="resumen-label">Fecha límite:</span>
                <span className="resumen-value">
                  {new Date(detalle.pedido.fecha_limite_deseada).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
            <div className="resumen-item">
              <span className="resumen-label">Artículos:</span>
              <span className="resumen-value">{detalle.items.length}</span>
            </div>
          </div>
        </div>

        {/* Artículos */}
        <div className="section-card">
          <h2>📦 Artículos del Pedido</h2>
          <div className="items-table">
            {detalle.items.map((item) => (
              <div key={item.id} className="item-row">
                <div className="item-info">
                  <h3>{item.articulo.nombre}</h3>
                  {item.descripcion_personalizada && (
                    <p className="item-descripcion">{item.descripcion_personalizada}</p>
                  )}
                </div>
                <div className="item-cantidad">Cantidad: {item.cantidad}</div>
                <div className="item-precio">${item.precio_unitario.toFixed(2)} c/u</div>
                <div className="item-total">${item.precio_total.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Información del Brief */}
        {editando ? (
          <div className="section-card">
            <h2>✏️ Editar Información del Pedido</h2>
            <div className="form-grid">
              <div className="form-group">
                <label>Fecha Límite Deseada:</label>
                <input
                  type="date"
                  value={formData.fecha_limite_deseada}
                  onChange={(e) => setFormData({ ...formData, fecha_limite_deseada: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.es_urgente}
                    onChange={(e) => setFormData({ ...formData, es_urgente: e.target.checked })}
                  />
                  <span>⚡ Pedido Urgente</span>
                </label>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.requiere_delivery}
                    onChange={(e) => setFormData({ ...formData, requiere_delivery: e.target.checked })}
                  />
                  <span>🚚 Requiere Delivery</span>
                </label>
              </div>
              {formData.requiere_delivery && (
                <div className="form-group full-width">
                  <label>Dirección de Delivery:</label>
                  <textarea
                    value={formData.direccion_delivery}
                    onChange={(e) => setFormData({ ...formData, direccion_delivery: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
              <div className="form-group full-width">
                <label>Brief Público:</label>
                <textarea
                  value={formData.brief_publico}
                  onChange={(e) => setFormData({ ...formData, brief_publico: e.target.value })}
                  rows={5}
                />
              </div>
              <div className="form-group full-width">
                <label>Objetivo del Proyecto:</label>
                <textarea
                  value={formData.objetivo_proyecto}
                  onChange={(e) => setFormData({ ...formData, objetivo_proyecto: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Estilo de Diseño:</label>
                <input
                  type="text"
                  value={formData.estilo_diseno}
                  onChange={(e) => setFormData({ ...formData, estilo_diseno: e.target.value })}
                />
              </div>
              <div className="form-group full-width">
                <label>Referencias:</label>
                <textarea
                  value={formData.referencias}
                  onChange={(e) => setFormData({ ...formData, referencias: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group full-width">
                <label>Links de Referencias:</label>
                <textarea
                  value={formData.referencias_links}
                  onChange={(e) => setFormData({ ...formData, referencias_links: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-group full-width">
                <label>Observaciones Adicionales:</label>
                <textarea
                  value={formData.observaciones_cliente}
                  onChange={(e) => setFormData({ ...formData, observaciones_cliente: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditando(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardar} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        ) : (
          <div className="section-card">
            <h2>📋 Información del Brief</h2>
            {detalle.pedido.brief_publico && (
              <div className="info-section">
                <h3>Brief Público:</h3>
                <p>{detalle.pedido.brief_publico}</p>
              </div>
            )}
            {detalle.pedido.objetivo_proyecto && (
              <div className="info-section">
                <h3>Objetivo del Proyecto:</h3>
                <p>{detalle.pedido.objetivo_proyecto}</p>
              </div>
            )}
            {detalle.pedido.estilo_diseno && (
              <div className="info-section">
                <h3>Estilo de Diseño:</h3>
                <p>{detalle.pedido.estilo_diseno}</p>
              </div>
            )}
            {detalle.pedido.referencias && (
              <div className="info-section">
                <h3>Referencias:</h3>
                <p>{detalle.pedido.referencias}</p>
              </div>
            )}
            {detalle.pedido.referencias_links && (
              <div className="info-section">
                <h3>Links de Referencias:</h3>
                <div className="links-list">
                  {detalle.pedido.referencias_links.split('\n').map((link, idx) => (
                    <a key={idx} href={link.trim()} target="_blank" rel="noopener noreferrer" className="link-item">
                      {link.trim()}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {detalle.pedido.observaciones_cliente && (
              <div className="info-section">
                <h3>Observaciones:</h3>
                <p>{detalle.pedido.observaciones_cliente}</p>
              </div>
            )}
            {detalle.pedido.observaciones_internas && (
              <div className="info-section">
                <h3>Observaciones Internas:</h3>
                <p className="observaciones-internas">{detalle.pedido.observaciones_internas}</p>
              </div>
            )}
          </div>
        )}

        {/* Archivos Adjuntos */}
        {detalle.archivos.length > 0 && (
          <div className="section-card">
            <h2>📎 Archivos Adjuntos</h2>
            <div className="archivos-grid">
              {detalle.archivos.map((archivo) => (
                <a
                  key={archivo.id}
                  href={archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="archivo-card"
                >
                  <div className="archivo-icon">📄</div>
                  <div className="archivo-info">
                    <div className="archivo-nombre">{archivo.nombre_archivo}</div>
                    {archivo.tamaño && (
                      <div className="archivo-tamaño">
                        {(archivo.tamaño / 1024).toFixed(2)} KB
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

