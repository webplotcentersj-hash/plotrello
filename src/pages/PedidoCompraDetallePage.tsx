import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra, EstadoEntrega } from '../types/pedidos'
import './PedidoCompraDetallePage.css'

const PedidoCompraDetallePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario, canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedido, setPedido] = useState<PedidoCompra | null>(null)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [esComentarioInterno, setEsComentarioInterno] = useState(false)
  const [mostrarAprobacion, setMostrarAprobacion] = useState(false)
  const [mostrarRechazo, setMostrarRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [cantidadesAprobadas, setCantidadesAprobadas] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [mostrarTracking, setMostrarTracking] = useState(false)
  const [formTracking, setFormTracking] = useState({
    estado_entrega: 'Pendiente' as EstadoEntrega,
    fecha_entrega_estimada: '',
    fecha_entrega_real: '',
    tracking_number: '',
    transportista: ''
  })

  useEffect(() => {
    if (authLoading) return // Esperar a que termine la carga de autenticación
    
    if (!canManageCompras) {
      navigate('/compras/dashboard')
      return
    }
    if (id) {
      loadPedido()
    }
  }, [id, canManageCompras, navigate, authLoading])

  const loadPedido = async () => {
    setLoading(true)
    try {
      const response = await apiService.getPedidoCompra(Number(id))
      if (response.success && response.data) {
        setPedido(response.data)
        // Inicializar cantidades aprobadas con las solicitadas
        const cantidades: Record<number, number> = {}
        response.data.items?.forEach(item => {
          cantidades[item.id] = item.cantidad_solicitada
        })
        setCantidadesAprobadas(cantidades)
        // Inicializar formulario de tracking con datos existentes
        if (response.data.estado_entrega || response.data.fecha_entrega_estimada) {
          setFormTracking({
            estado_entrega: (response.data.estado_entrega as EstadoEntrega) || 'Pendiente',
            fecha_entrega_estimada: response.data.fecha_entrega_estimada ? new Date(response.data.fecha_entrega_estimada).toISOString().split('T')[0] : '',
            fecha_entrega_real: response.data.fecha_entrega_real ? new Date(response.data.fecha_entrega_real).toISOString().split('T')[0] : '',
            tracking_number: response.data.tracking_number || '',
            transportista: response.data.transportista || ''
          })
        }
      }
    } catch (error) {
      console.error('Error cargando pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAgregarComentario = async () => {
    if (!pedido || !usuario || !nuevoComentario.trim()) return

    setSaving(true)
    try {
      const response = await apiService.agregarComentarioPedido(pedido.id, {
        id_usuario: usuario.id,
        nombre_usuario: usuario.nombre,
        comentario: nuevoComentario.trim(),
        es_interno: esComentarioInterno
      })

      if (response.success) {
        setNuevoComentario('')
        setEsComentarioInterno(false)
        loadPedido()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error agregando comentario:', error)
      alert('Error al agregar comentario')
    } finally {
      setSaving(false)
    }
  }

  const handleAprobar = async () => {
    if (!pedido || !usuario) return

    setSaving(true)
    try {
      const itemsAprobados = pedido.items?.map(item => ({
        id: item.id,
        cantidad_aprobada: cantidadesAprobadas[item.id] || item.cantidad_solicitada
      }))

      const response = await apiService.aprobarPedidoCompra(pedido.id, {
        id: usuario.id,
        nombre: usuario.nombre
      }, itemsAprobados)

      if (response.success) {
        setMostrarAprobacion(false)
        loadPedido()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error aprobando pedido:', error)
      alert('Error al aprobar pedido')
    } finally {
      setSaving(false)
    }
  }

  const handleRechazar = async () => {
    if (!pedido || !usuario || !motivoRechazo.trim()) {
      alert('Por favor, ingresa un motivo de rechazo')
      return
    }

    setSaving(true)
    try {
      const response = await apiService.rechazarPedidoCompra(pedido.id, {
        id: usuario.id,
        nombre: usuario.nombre
      }, motivoRechazo.trim())

      if (response.success) {
        setMostrarRechazo(false)
        setMotivoRechazo('')
        loadPedido()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error rechazando pedido:', error)
      alert('Error al rechazar pedido')
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (!pedido || nuevoEstado === pedido.estado) return

    if (!confirm(`¿Estás seguro de que deseas cambiar el estado a "${nuevoEstado}"?`)) {
      return
    }

    setSaving(true)
    try {
      const response = await apiService.actualizarEstadoPedido(pedido.id, nuevoEstado as any)
      if (response.success) {
        loadPedido()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error cambiando estado:', error)
      alert('Error al cambiar estado')
    } finally {
      setSaving(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, string> = {
      'Pendiente': '#f59e0b',
      'En Revisión': '#3b82f6',
      'Aprobado': '#10b981',
      'Rechazado': '#ef4444',
      'En Compra': '#8b5cf6',
      'Completado': '#059669',
      'Cancelado': '#6b7280'
    }
    return colores[estado] || '#6b7280'
  }

  const handleActualizarTracking = async () => {
    if (!pedido || !usuario) return

    setSaving(true)
    try {
      const updates: any = {
        estado_entrega: formTracking.estado_entrega,
        fecha_entrega_estimada: formTracking.fecha_entrega_estimada || null,
        fecha_entrega_real: formTracking.fecha_entrega_real || null,
        tracking_number: formTracking.tracking_number || null,
        transportista: formTracking.transportista || null
      }

      // Si el estado es "Entregado", actualizar fecha_entrega_real automáticamente
      if (formTracking.estado_entrega === 'Entregado' && !formTracking.fecha_entrega_real) {
        updates.fecha_entrega_real = new Date().toISOString()
      }

      const trackingResponse = await apiService.actualizarPedidoCompra(pedido.id, updates)
      if (trackingResponse.success) {
        setMostrarTracking(false)
        loadPedido()
        // Enviar notificación al solicitante
        if (pedido.id_solicitante && formTracking.estado_entrega !== pedido.estado_entrega) {
          await apiService.createNotification({
            user_id: pedido.id_solicitante,
            title: '📦 Estado de entrega actualizado',
            description: `El estado de entrega de tu pedido ${pedido.numero_pedido} cambió a "${formTracking.estado_entrega}"`,
            type: 'info',
            pedido_id: pedido.id
          })
        }
      } else {
        alert(`Error actualizando tracking: ${trackingResponse.error}`)
      }
    } catch (error) {
      console.error('Error actualizando tracking:', error)
      alert('Error al actualizar tracking')
    } finally {
      setSaving(false)
    }
  }

  const getPrioridadColor = (prioridad: string) => {
    const colores: Record<string, string> = {
      'Baja': '#6b7280',
      'Normal': '#3b82f6',
      'Alta': '#f59e0b',
      'Urgente': '#ef4444'
    }
    return colores[prioridad] || '#6b7280'
  }

  if (loading) {
    return (
      <div className="pedido-detalle-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando pedido...</p>
        </div>
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="pedido-detalle-page">
        <div className="error-container">
          <p>Pedido no encontrado</p>
          <button onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  const puedeAprobar = canManageCompras && (pedido.estado === 'Pendiente' || pedido.estado === 'En Revisión')
  const puedeRechazar = canManageCompras && (pedido.estado === 'Pendiente' || pedido.estado === 'En Revisión')
  const puedeCambiarEstado = canManageCompras && pedido.estado !== 'Rechazado' && pedido.estado !== 'Cancelado'

  return (
    <div className="pedido-detalle-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Pedido de Compra: {pedido.numero_pedido}</h1>
            <div className="header-badges">
              <span
                className="estado-badge"
                style={{ backgroundColor: getEstadoColor(pedido.estado) }}
              >
                {pedido.estado}
              </span>
              <span
                className="prioridad-badge"
                style={{ color: getPrioridadColor(pedido.prioridad) }}
              >
                Prioridad: {pedido.prioridad}
              </span>
            </div>
          </div>
            <button
              className="btn-secondary"
              onClick={() => navigate('/compras/dashboard')}
            >
              ← Volver
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate(`/compras/presupuestos/${pedido.id}`)}
            >
              💰 Presupuestos
            </button>
        </div>
      </header>

      <div className="pedido-content">
        {/* Información del Pedido */}
        <section className="info-section">
          <h2>Información del Pedido</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Solicitante:</label>
              <span>{pedido.nombre_solicitante}</span>
            </div>
            {pedido.sector_solicitante && (
              <div className="info-item">
                <label>Sector:</label>
                <span>{pedido.sector_solicitante}</span>
              </div>
            )}
            <div className="info-item">
              <label>Fecha de Solicitud:</label>
              <span>{new Date(pedido.fecha_solicitud).toLocaleString('es-AR')}</span>
            </div>
            {pedido.fecha_aprobacion && (
              <div className="info-item">
                <label>Fecha de Aprobación:</label>
                <span>{new Date(pedido.fecha_aprobacion).toLocaleString('es-AR')}</span>
              </div>
            )}
            {pedido.nombre_aprobador && (
              <div className="info-item">
                <label>Aprobado por:</label>
                <span>{pedido.nombre_aprobador}</span>
              </div>
            )}
            {pedido.motivo && (
              <div className="info-item full-width">
                <label>Motivo:</label>
                <span>{pedido.motivo}</span>
              </div>
            )}
            {pedido.observaciones && (
              <div className="info-item full-width">
                <label>Observaciones:</label>
                <span>{pedido.observaciones}</span>
              </div>
            )}
            {pedido.motivo_rechazo && (
              <div className="info-item full-width error">
                <label>Motivo de Rechazo:</label>
                <span>{pedido.motivo_rechazo}</span>
              </div>
            )}
          </div>
        </section>

        {/* Tracking de Entrega */}
        {pedido.estado === 'Aprobado' && (
          <section className="tracking-section">
            <div className="section-header">
              <h2>📦 Tracking de Entrega</h2>
              <button className="btn-action" onClick={() => setMostrarTracking(true)}>
                {pedido.estado_entrega ? '✏️ Editar Tracking' : '➕ Agregar Tracking'}
              </button>
            </div>
            {pedido.estado_entrega ? (
              <div className="tracking-info">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Estado:</label>
                    <span className={`estado-badge estado-${pedido.estado_entrega.toLowerCase().replace(' ', '-')}`}>
                      {pedido.estado_entrega}
                    </span>
                  </div>
                  {pedido.fecha_entrega_estimada && (
                    <div className="info-item">
                      <label>Fecha Estimada:</label>
                      <span>{new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                  {pedido.fecha_entrega_real && (
                    <div className="info-item">
                      <label>Fecha Real:</label>
                      <span>{new Date(pedido.fecha_entrega_real).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                  {pedido.tracking_number && (
                    <div className="info-item">
                      <label>Número de Tracking:</label>
                      <span>{pedido.tracking_number}</span>
                    </div>
                  )}
                  {pedido.transportista && (
                    <div className="info-item">
                      <label>Transportista:</label>
                      <span>{pedido.transportista}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="sin-tracking">
                <p>No hay información de tracking disponible</p>
              </div>
            )}
          </section>
        )}

        {/* Items del Pedido */}
        <section className="items-section">
          <h2>Productos Solicitados</h2>
          <div className="items-table">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Cantidad Solicitada</th>
                  {puedeAprobar && <th>Cantidad a Aprobar</th>}
                  <th>Cantidad Aprobada</th>
                  <th>Cantidad Comprada</th>
                  <th>Unidad</th>
                  {pedido.estado === 'Aprobado' && <th>Proveedor</th>}
                </tr>
              </thead>
              <tbody>
                {pedido.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.codigo_articulo || '-'}</td>
                    <td>{item.descripcion}</td>
                    <td>{item.cantidad_solicitada} {item.unidad}</td>
                    {puedeAprobar && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={cantidadesAprobadas[item.id] || item.cantidad_solicitada}
                          onChange={(e) => setCantidadesAprobadas({
                            ...cantidadesAprobadas,
                            [item.id]: parseFloat(e.target.value) || 0
                          })}
                          className="cantidad-input"
                        />
                        <span className="unidad-small">{item.unidad}</span>
                      </td>
                    )}
                    <td>{item.cantidad_aprobada ? `${item.cantidad_aprobada} ${item.unidad}` : '-'}</td>
                    <td>{item.cantidad_comprada ? `${item.cantidad_comprada} ${item.unidad}` : '-'}</td>
                    <td>{item.unidad}</td>
                    {pedido.estado === 'Aprobado' && (
                      <td>{item.proveedor || '-'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Acciones */}
        {canManageCompras && (
          <section className="acciones-section">
            <h2>Acciones</h2>
            <div className="acciones-buttons">
              {puedeAprobar && (
                <button
                  className="btn-success"
                  onClick={() => setMostrarAprobacion(true)}
                  disabled={saving}
                >
                  ✅ Aprobar Pedido
                </button>
              )}
              {puedeRechazar && (
                <button
                  className="btn-danger"
                  onClick={() => setMostrarRechazo(true)}
                  disabled={saving}
                >
                  ❌ Rechazar Pedido
                </button>
              )}
              {puedeCambiarEstado && (
                <div className="cambiar-estado-section">
                  <label htmlFor="nuevo-estado" className="estado-label">Cambiar Estado:</label>
                  <select
                    id="nuevo-estado"
                    value={pedido.estado}
                    onChange={(e) => handleCambiarEstado(e.target.value)}
                    disabled={saving}
                    className="estado-select"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Revisión">En Revisión</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="En Compra">En Compra</option>
                    <option value="Completado">Completado</option>
                    <option value="Rechazado">Rechazado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Comentarios */}
        <section className="comentarios-section">
          <h2>Comentarios</h2>
          <div className="comentarios-list">
            {pedido.comentarios && pedido.comentarios.length > 0 ? (
              pedido.comentarios.map((comentario) => (
                <div
                  key={comentario.id}
                  className={`comentario-card ${comentario.es_interno ? 'interno' : ''}`}
                >
                  <div className="comentario-header">
                    <strong>{comentario.nombre_usuario}</strong>
                    {comentario.es_interno && (
                      <span className="badge-interno">Interno</span>
                    )}
                    <span className="comentario-fecha">
                      {new Date(comentario.created_at).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="comentario-texto">{comentario.comentario}</div>
                </div>
              ))
            ) : (
              <p className="sin-comentarios">No hay comentarios aún</p>
            )}
          </div>
          {canManageCompras && (
            <div className="nuevo-comentario">
              <textarea
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={3}
              />
              <div className="comentario-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={esComentarioInterno}
                    onChange={(e) => setEsComentarioInterno(e.target.checked)}
                  />
                  Comentario interno (solo visible para compras)
                </label>
                <button
                  className="btn-primary"
                  onClick={handleAgregarComentario}
                  disabled={saving || !nuevoComentario.trim()}
                >
                  {saving ? 'Enviando...' : 'Agregar Comentario'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modal de Aprobación */}
      {mostrarAprobacion && (
        <div className="modal-overlay" onClick={() => setMostrarAprobacion(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar Aprobación</h3>
            <p>¿Estás seguro de que deseas aprobar este pedido?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMostrarAprobacion(false)}>
                Cancelar
              </button>
              <button className="btn-success" onClick={handleAprobar} disabled={saving}>
                {saving ? 'Aprobando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rechazo */}
      {mostrarRechazo && (
        <div className="modal-overlay" onClick={() => setMostrarRechazo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Rechazar Pedido</h3>
            <p>Por favor, indica el motivo del rechazo:</p>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={4}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMostrarRechazo(false)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={handleRechazar} disabled={saving || !motivoRechazo.trim()}>
                {saving ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PedidoCompraDetallePage

