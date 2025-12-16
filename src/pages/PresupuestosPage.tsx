import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra, Presupuesto, Proveedor, EstadoPresupuesto } from '../types/pedidos'
import './PresupuestosPage.css'

const PresupuestosPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedido, setPedido] = useState<PedidoCompra | null>(null)
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false)
  const [mostrarModalComparar, setMostrarModalComparar] = useState(false)
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null)
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState<number | null>(null)
  const [criterioSeleccion, setCriterioSeleccion] = useState('')
  const [notasComparacion, setNotasComparacion] = useState('')
  const [formDataPresupuesto, setFormDataPresupuesto] = useState({
    fecha_vencimiento: '',
    condiciones_pago: '',
    tiempo_entrega_dias: '',
    observaciones: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/compras/dashboard')
      return
    }
    if (id) {
      loadData()
    }
  }, [id, canManageCompras, navigate, authLoading])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar pedido
      if (id) {
        const pedidoResponse = await apiService.getPedidoCompra(Number(id))
        if (pedidoResponse.success && pedidoResponse.data) {
          setPedido(pedidoResponse.data)
        }
      }

      // Cargar presupuestos del pedido
      if (id) {
        const presupuestosResponse = await apiService.getPresupuestos({ id_pedido_compra: Number(id) })
        if (presupuestosResponse.success && presupuestosResponse.data) {
          setPresupuestos(presupuestosResponse.data)
        }
      }

      // Cargar proveedores activos
      const proveedoresResponse = await apiService.getProveedores(true)
      if (proveedoresResponse.success && proveedoresResponse.data) {
        setProveedores(proveedoresResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCrearPresupuesto = async () => {
    if (!proveedorSeleccionado || !pedido || !pedido.items || pedido.items.length === 0) {
      alert('Debes seleccionar un proveedor y el pedido debe tener items')
      return
    }

    try {
      // Crear items del presupuesto basados en los items del pedido
      const items = pedido.items.map(item => ({
        id_item_pedido: item.id,
        codigo_producto: item.codigo_articulo || undefined,
        descripcion: item.descripcion,
        cantidad: item.cantidad_aprobada || item.cantidad_solicitada,
        unidad: item.unidad,
        precio_unitario: 0, // Se debe completar después
        observaciones: item.observaciones || undefined
      }))

      const response = await apiService.crearPresupuesto({
        id_pedido_compra: pedido.id,
        id_proveedor: proveedorSeleccionado.id,
        fecha_vencimiento: formDataPresupuesto.fecha_vencimiento || undefined,
        condiciones_pago: formDataPresupuesto.condiciones_pago || undefined,
        tiempo_entrega_dias: formDataPresupuesto.tiempo_entrega_dias ? parseInt(formDataPresupuesto.tiempo_entrega_dias) : undefined,
        observaciones: formDataPresupuesto.observaciones || undefined,
        items: items
      })

      if (response.success) {
        alert('Presupuesto creado exitosamente')
        setMostrarModalNuevo(false)
        setProveedorSeleccionado(null)
        setFormDataPresupuesto({
          fecha_vencimiento: '',
          condiciones_pago: '',
          tiempo_entrega_dias: '',
          observaciones: ''
        })
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando presupuesto:', error)
      alert('Error al crear el presupuesto')
    }
  }

  const handleActualizarEstado = async (presupuestoId: number, nuevoEstado: EstadoPresupuesto) => {
    try {
      const updates: any = { estado: nuevoEstado }
      if (nuevoEstado === 'Recibido') {
        updates.fecha_recepcion = new Date().toISOString()
      }
      if (nuevoEstado === 'Aceptado') {
        updates.fecha_aceptacion = new Date().toISOString()
      }

      const response = await apiService.actualizarPresupuesto(presupuestoId, updates)
      if (response.success) {
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error actualizando estado:', error)
      alert('Error al actualizar el estado')
    }
  }

  const handleCompararPresupuestos = async () => {
    if (!presupuestoSeleccionado || !criterioSeleccion.trim()) {
      alert('Debes seleccionar un presupuesto y especificar el criterio de selección')
      return
    }

    try {
      const response = await apiService.compararPresupuestos(pedido!.id, {
        id_presupuesto_seleccionado: presupuestoSeleccionado,
        criterio_seleccion: criterioSeleccion,
        notas_comparacion: notasComparacion || undefined
      })

      if (response.success) {
        alert('Presupuesto seleccionado y comparación guardada')
        setMostrarModalComparar(false)
        setPresupuestoSeleccionado(null)
        setCriterioSeleccion('')
        setNotasComparacion('')
        loadData()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error comparando presupuestos:', error)
      alert('Error al comparar presupuestos')
    }
  }

  const getEstadoColor = (estado: EstadoPresupuesto) => {
    const colores: Record<EstadoPresupuesto, string> = {
      'Pendiente': '#f59e0b',
      'Enviado': '#3b82f6',
      'Recibido': '#8b5cf6',
      'Aceptado': '#10b981',
      'Rechazado': '#ef4444',
      'Vencido': '#6b7280'
    }
    return colores[estado] || '#6b7280'
  }

  if (authLoading || loading) {
    return (
      <div className="presupuestos-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras || !pedido) {
    return (
      <div className="presupuestos-page">
        <div className="error-container">
          <p>No tienes permiso o el pedido no existe.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="presupuestos-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>💰 Presupuestos - {pedido.numero_pedido}</h1>
            <p className="subtitle">Solicitar y comparar cotizaciones de proveedores</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}>
              ← Volver al Pedido
            </button>
            {presupuestos.length >= 2 && (
              <button className="btn-primary" onClick={() => setMostrarModalComparar(true)}>
                🔍 Comparar Presupuestos
              </button>
            )}
            <button className="btn-primary" onClick={() => setMostrarModalNuevo(true)}>
              + Solicitar Presupuesto
            </button>
          </div>
        </div>
      </header>

      {/* Información del Pedido */}
      <section className="pedido-info-section">
        <h2>Información del Pedido</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Solicitante:</span>
            <span>{pedido.nombre_solicitante}</span>
          </div>
          <div className="info-item">
            <span className="label">Estado:</span>
            <span>{pedido.estado}</span>
          </div>
          <div className="info-item">
            <span className="label">Prioridad:</span>
            <span>{pedido.prioridad}</span>
          </div>
          <div className="info-item">
            <span className="label">Items:</span>
            <span>{pedido.items?.length || 0}</span>
          </div>
        </div>
      </section>

      {/* Lista de Presupuestos */}
      <section className="presupuestos-section">
        <h2>Presupuestos Recibidos ({presupuestos.length})</h2>
        {presupuestos.length === 0 ? (
          <div className="empty-state">
            <p>No hay presupuestos aún. Solicita uno a un proveedor.</p>
          </div>
        ) : (
          <div className="presupuestos-list">
            {presupuestos.map((presupuesto) => (
              <div key={presupuesto.id} className="presupuesto-card">
                <div className="presupuesto-header">
                  <div>
                    <h3>{presupuesto.numero_presupuesto}</h3>
                    <p className="proveedor-nombre">{presupuesto.proveedor?.nombre || 'Proveedor desconocido'}</p>
                  </div>
                  <div
                    className="presupuesto-estado"
                    style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
                  >
                    {presupuesto.estado}
                  </div>
                </div>
                <div className="presupuesto-info">
                  <div className="info-row">
                    <span className="label">Monto Total:</span>
                    <span className="monto">${presupuesto.monto_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || 'N/A'}</span>
                  </div>
                  {presupuesto.tiempo_entrega_dias && (
                    <div className="info-row">
                      <span className="label">Tiempo de Entrega:</span>
                      <span>{presupuesto.tiempo_entrega_dias} días</span>
                    </div>
                  )}
                  {presupuesto.fecha_vencimiento && (
                    <div className="info-row">
                      <span className="label">Vence:</span>
                      <span>{new Date(presupuesto.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
                    </div>
                  )}
                  {presupuesto.items && presupuesto.items.length > 0 && (
                    <div className="info-row">
                      <span className="label">Items:</span>
                      <span>{presupuesto.items.length}</span>
                    </div>
                  )}
                </div>
                {presupuesto.observaciones && (
                  <div className="presupuesto-observaciones">
                    <strong>Observaciones:</strong> {presupuesto.observaciones}
                  </div>
                )}
                <div className="presupuesto-actions">
                  {presupuesto.estado === 'Recibido' && (
                    <>
                      <button
                        className="btn-success"
                        onClick={() => handleActualizarEstado(presupuesto.id, 'Aceptado')}
                      >
                        ✓ Aceptar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleActualizarEstado(presupuesto.id, 'Rechazado')}
                      >
                        ✗ Rechazar
                      </button>
                    </>
                  )}
                  {presupuesto.estado === 'Pendiente' && (
                    <button
                      className="btn-info"
                      onClick={() => handleActualizarEstado(presupuesto.id, 'Enviado')}
                    >
                      Marcar como Enviado
                    </button>
                  )}
                  {presupuesto.estado === 'Enviado' && (
                    <button
                      className="btn-info"
                      onClick={() => handleActualizarEstado(presupuesto.id, 'Recibido')}
                    >
                      Marcar como Recibido
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de Nuevo Presupuesto */}
      {mostrarModalNuevo && (
        <div className="modal-overlay" onClick={() => setMostrarModalNuevo(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Solicitar Presupuesto</h2>
              <button className="btn-close" onClick={() => setMostrarModalNuevo(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Seleccionar Proveedor *</label>
                <select
                  value={proveedorSeleccionado?.id || ''}
                  onChange={(e) => {
                    const prov = proveedores.find(p => p.id === Number(e.target.value))
                    setProveedorSeleccionado(prov || null)
                  }}
                >
                  <option value="">Selecciona un proveedor</option>
                  {proveedores.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                  ))}
                </select>
              </div>
              {proveedorSeleccionado && (
                <div className="proveedor-seleccionado-info">
                  <p><strong>Proveedor:</strong> {proveedorSeleccionado.nombre}</p>
                  {proveedorSeleccionado.telefono && <p><strong>Teléfono:</strong> {proveedorSeleccionado.telefono}</p>}
                  {proveedorSeleccionado.email && <p><strong>Email:</strong> {proveedorSeleccionado.email}</p>}
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={formDataPresupuesto.fecha_vencimiento}
                    onChange={(e) => setFormDataPresupuesto({ ...formDataPresupuesto, fecha_vencimiento: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tiempo de Entrega (días)</label>
                  <input
                    type="number"
                    value={formDataPresupuesto.tiempo_entrega_dias}
                    onChange={(e) => setFormDataPresupuesto({ ...formDataPresupuesto, tiempo_entrega_dias: e.target.value })}
                    placeholder="Días"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Condiciones de Pago</label>
                <textarea
                  value={formDataPresupuesto.condiciones_pago}
                  onChange={(e) => setFormDataPresupuesto({ ...formDataPresupuesto, condiciones_pago: e.target.value })}
                  placeholder="Ej: 30 días, contado, etc."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formDataPresupuesto.observaciones}
                  onChange={(e) => setFormDataPresupuesto({ ...formDataPresupuesto, observaciones: e.target.value })}
                  placeholder="Notas adicionales para el proveedor"
                  rows={3}
                />
              </div>
              {pedido.items && pedido.items.length > 0 && (
                <div className="items-preview">
                  <h3>Items a cotizar:</h3>
                  <ul>
                    {pedido.items.map((item, idx) => (
                      <li key={idx}>
                        {item.descripcion} - Cantidad: {item.cantidad_aprobada || item.cantidad_solicitada} {item.unidad}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalNuevo(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCrearPresupuesto}
                disabled={!proveedorSeleccionado}
              >
                Crear Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comparar Presupuestos */}
      {mostrarModalComparar && presupuestos.length >= 2 && (
        <div className="modal-overlay" onClick={() => setMostrarModalComparar(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Comparar Presupuestos</h2>
              <button className="btn-close" onClick={() => setMostrarModalComparar(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="comparacion-grid">
                {presupuestos.map((presupuesto) => (
                  <div
                    key={presupuesto.id}
                    className={`comparacion-card ${presupuestoSeleccionado === presupuesto.id ? 'selected' : ''}`}
                    onClick={() => setPresupuestoSeleccionado(presupuesto.id)}
                  >
                    <div className="comparacion-header">
                      <h3>{presupuesto.proveedor?.nombre || 'Proveedor'}</h3>
                      <div className="comparacion-monto">
                        ${presupuesto.monto_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || 'N/A'}
                      </div>
                    </div>
                    <div className="comparacion-details">
                      {presupuesto.tiempo_entrega_dias && (
                        <div className="detail-item">
                          <span className="label">Entrega:</span>
                          <span>{presupuesto.tiempo_entrega_dias} días</span>
                        </div>
                      )}
                      {presupuesto.fecha_vencimiento && (
                        <div className="detail-item">
                          <span className="label">Vence:</span>
                          <span>{new Date(presupuesto.fecha_vencimiento).toLocaleDateString('es-AR')}</span>
                        </div>
                      )}
                      {presupuesto.condiciones_pago && (
                        <div className="detail-item">
                          <span className="label">Pago:</span>
                          <span>{presupuesto.condiciones_pago}</span>
                        </div>
                      )}
                    </div>
                    {presupuesto.items && presupuesto.items.length > 0 && (
                      <div className="comparacion-items">
                        <strong>Items:</strong>
                        <ul>
                          {presupuesto.items.slice(0, 3).map((item, idx) => (
                            <li key={idx}>{item.descripcion} - ${item.precio_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</li>
                          ))}
                          {presupuesto.items.length > 3 && <li>... y {presupuesto.items.length - 3} más</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {presupuestoSeleccionado && (
                <div className="seleccion-form">
                  <div className="form-group">
                    <label>Criterio de Selección *</label>
                    <textarea
                      value={criterioSeleccion}
                      onChange={(e) => setCriterioSeleccion(e.target.value)}
                      placeholder="Ej: Mejor precio, mejor tiempo de entrega, mejor calidad, etc."
                      rows={3}
                    />
                  </div>
                  <div className="form-group">
                    <label>Notas de Comparación</label>
                    <textarea
                      value={notasComparacion}
                      onChange={(e) => setNotasComparacion(e.target.value)}
                      placeholder="Notas adicionales sobre la comparación"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setMostrarModalComparar(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCompararPresupuestos}
                disabled={!presupuestoSeleccionado || !criterioSeleccion.trim()}
              >
                Seleccionar Presupuesto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PresupuestosPage

