import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoCompra } from '../types/pedidos'
import './ComprasDashboardPage.css'

const ComprasDashboardPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([])
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  useEffect(() => {
    if (authLoading) return // Esperar a que termine la carga de autenticación
    
    if (!canManageCompras) {
      navigate('/')
      return
    }
    loadPedidos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, canManageCompras, navigate, authLoading])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const filters: any = {}
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

  const getEstadisticas = () => {
    const total = pedidos.length
    const pendientes = pedidos.filter(p => p.estado === 'Pendiente').length
    const enRevision = pedidos.filter(p => p.estado === 'En Revisión').length
    const aprobados = pedidos.filter(p => p.estado === 'Aprobado').length
    const enCompra = pedidos.filter(p => p.estado === 'En Compra').length
    const completados = pedidos.filter(p => p.estado === 'Completado').length
    const rechazados = pedidos.filter(p => p.estado === 'Rechazado').length

    return {
      total,
      pendientes,
      enRevision,
      aprobados,
      enCompra,
      completados,
      rechazados
    }
  }

  const stats = getEstadisticas()

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

  const getPrioridadColor = (prioridad: string) => {
    const colores: Record<string, string> = {
      'Baja': '#6b7280',
      'Normal': '#3b82f6',
      'Alta': '#f59e0b',
      'Urgente': '#ef4444'
    }
    return colores[prioridad] || '#6b7280'
  }

  if (authLoading || loading) {
    return (
      <div className="compras-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="compras-dashboard-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Volver al Tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="compras-dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>🛒 Dashboard de Compras</h1>
            <p className="subtitle">Gestión de pedidos y stock</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/pedidos')}
            >
              Ver Todos los Pedidos
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/gestion-stock')}
            >
              📦 Gestión Stock
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate('/compras/reportes')}
            >
              📊 Reportes
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              Ver Tablero
            </button>
          </div>
        </div>
      </header>

      {/* Estadísticas */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Pedidos</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.pendientes}</div>
            <div className="stat-label">Pendientes</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{stats.enRevision}</div>
            <div className="stat-label">En Revisión</div>
          </div>
          <div className="stat-card success">
            <div className="stat-value">{stats.aprobados}</div>
            <div className="stat-label">Aprobados</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-value">{stats.enCompra}</div>
            <div className="stat-label">En Compra</div>
          </div>
          <div className="stat-card completed">
            <div className="stat-value">{stats.completados}</div>
            <div className="stat-label">Completados</div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="filters-section">
        <div className="filters">
          <button
            className={`filter-btn ${filtroEstado === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'Pendiente' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('Pendiente')}
          >
            Pendientes
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'En Revisión' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('En Revisión')}
          >
            En Revisión
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'Aprobado' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('Aprobado')}
          >
            Aprobados
          </button>
          <button
            className={`filter-btn ${filtroEstado === 'En Compra' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('En Compra')}
          >
            En Compra
          </button>
        </div>
      </section>

      {/* Lista de Pedidos */}
      <section className="pedidos-section">
        <h2>Pedidos Recientes</h2>
        {pedidos.length === 0 ? (
          <div className="empty-state">
            <p>No hay pedidos para mostrar</p>
          </div>
        ) : (
          <div className="pedidos-list">
            {pedidos.slice(0, 10).map((pedido) => (
              <div
                key={pedido.id}
                className="pedido-card"
                onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
              >
                <div className="pedido-header">
                  <div className="pedido-numero">
                    <strong>{pedido.numero_pedido}</strong>
                  </div>
                  <div
                    className="pedido-estado"
                    style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                  >
                    {pedido.estado}
                  </div>
                </div>
                <div className="pedido-info">
                  <div className="info-row">
                    <span className="label">Solicitante:</span>
                    <span>{pedido.nombre_solicitante}</span>
                  </div>
                  {pedido.sector_solicitante && (
                    <div className="info-row">
                      <span className="label">Sector:</span>
                      <span>{pedido.sector_solicitante}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Prioridad:</span>
                    <span
                      className="prioridad-badge"
                      style={{ color: getPrioridadColor(pedido.prioridad) }}
                    >
                      {pedido.prioridad}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">Items:</span>
                    <span>{pedido.items?.length || 0} productos</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Fecha:</span>
                    <span>{new Date(pedido.fecha_solicitud).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
                {pedido.motivo && (
                  <div className="pedido-motivo">
                    <strong>Motivo:</strong> {pedido.motivo}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default ComprasDashboardPage

