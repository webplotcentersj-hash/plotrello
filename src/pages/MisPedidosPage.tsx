import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import { formatArgentinaDate, formatArgentinaDateTime } from '../utils/dateUtils'
import './MisPedidosPage.css'

const MisPedidosPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    loadPedidos()
  }, [authLoading, usuario, navigate, filtroEstado])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const filters: any = {
        id_solicitante: usuario?.id
      }
      if (filtroEstado !== 'todos') {
        filters.estado = filtroEstado
      }
      const response = await apiService.getPedidosCompra(filters)
      if (response.success && response.data) {
        setPedidos(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return '#f59e0b'
      case 'En Revisión':
        return '#3b82f6'
      case 'Aprobado':
        return '#10b981'
      case 'Rechazado':
        return '#ef4444'
      case 'En Compra':
        return '#8b5cf6'
      case 'Completado':
        return '#059669'
      case 'Cancelado':
        return '#6b7280'
      default:
        return '#6b7280'
    }
  }

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'Pendiente':
        return '⏳'
      case 'En Revisión':
        return '👀'
      case 'Aprobado':
        return '✅'
      case 'Rechazado':
        return '❌'
      case 'En Compra':
        return '🛒'
      case 'Completado':
        return '🎉'
      case 'Cancelado':
        return '🚫'
      default:
        return '📋'
    }
  }

  if (loading) {
    return (
      <div className="mis-pedidos-page">
        <div className="mis-pedidos-header">
          <h1>📦 Mis Pedidos de Compra</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div className="mis-pedidos-page">
      <div className="mis-pedidos-header">
        <h1>📦 Mis Pedidos de Compra</h1>
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Volver al Tablero
        </button>
      </div>

      <div className="mis-pedidos-filters">
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="filter-select"
        >
          <option value="todos">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="En Revisión">En Revisión</option>
          <option value="Aprobado">Aprobado</option>
          <option value="Rechazado">Rechazado</option>
          <option value="En Compra">En Compra</option>
          <option value="Completado">Completado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </div>

      <div className="mis-pedidos-content">
        {pedidos.length === 0 ? (
          <div className="empty-state">
            <p>No tienes pedidos de compra</p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              Solicitar Productos
            </button>
          </div>
        ) : (
          <div className="pedidos-list">
            {pedidos.map((pedido) => (
              <div key={pedido.id} className="pedido-card">
                <div className="pedido-card-header">
                  <div className="pedido-info">
                    <h3>{pedido.numero_pedido}</h3>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                    >
                      {getEstadoIcon(pedido.estado)} {pedido.estado}
                    </span>
                  </div>
                  <div className="pedido-meta">
                    <span className="fecha">
                      {formatArgentinaDate(pedido.fecha_solicitud)}
                    </span>
                  </div>
                </div>

                <div className="pedido-card-body">
                  {pedido.motivo && (
                    <div className="pedido-field">
                      <strong>Motivo:</strong> {pedido.motivo}
                    </div>
                  )}
                  {pedido.prioridad && (
                    <div className="pedido-field">
                      <strong>Prioridad:</strong>{' '}
                      <span className={`prioridad-badge prioridad-${pedido.prioridad.toLowerCase()}`}>
                        {pedido.prioridad}
                      </span>
                    </div>
                  )}
                  {pedido.items && pedido.items.length > 0 && (
                    <div className="pedido-items">
                      <strong>Productos ({pedido.items.length}):</strong>
                      <ul>
                        {pedido.items.map((item, idx) => (
                          <li key={idx}>
                            {item.descripcion} - {item.cantidad_solicitada} {item.unidad || 'unidad'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pedido.motivo_rechazo && (
                    <div className="pedido-rechazo">
                      <strong>Motivo de rechazo:</strong> {pedido.motivo_rechazo}
                    </div>
                  )}
                  {pedido.fecha_aprobacion && (
                    <div className="pedido-field">
                      <strong>Aprobado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_aprobacion)}
                      {pedido.nombre_aprobador && ` por ${pedido.nombre_aprobador}`}
                    </div>
                  )}
                  {pedido.fecha_rechazo && (
                    <div className="pedido-field">
                      <strong>Rechazado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_rechazo)}
                    </div>
                  )}
                  {pedido.fecha_completado && (
                    <div className="pedido-field">
                      <strong>Completado:</strong>{' '}
                      {formatArgentinaDateTime(pedido.fecha_completado)}
                    </div>
                  )}
                </div>

                <div className="pedido-card-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                  >
                    Ver Detalles
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MisPedidosPage

