import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { PedidoClienteRecord } from '../types/api'
import './ClienteDashboardPage.css'

export default function ClienteDashboardPage() {
  const { cliente, logout, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPedidos = useCallback(async () => {
    if (!cliente) return
    
    setLoading(true)
    setError('')
    
    try {
      const response = await apiService.getPedidosCliente(cliente.id)
      if (response.success && response.data) {
        setPedidos(response.data)
      } else {
        setError(response.error || 'Error al cargar pedidos')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [cliente])

  useEffect(() => {
    // Esperar a que termine la carga de autenticación antes de verificar
    if (authLoading) {
      console.log('ClienteDashboardPage - Esperando carga de autenticación...')
      return
    }

    console.log('ClienteDashboardPage - cliente:', cliente, 'authLoading:', authLoading)
    if (!cliente) {
      console.log('No hay cliente, redirigiendo a login')
      navigate('/cliente/login')
      return
    }
    console.log('Cliente encontrado, cargando pedidos...')
    loadPedidos()
  }, [cliente, authLoading, navigate, loadPedidos])

  const getEstadoColor = (estado: PedidoClienteRecord['estado']) => {
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

  const getEstadoLabel = (estado: PedidoClienteRecord['estado']) => {
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="cliente-dashboard-page">
      <header className="cliente-dashboard-header">
        <div className="cliente-header-content">
          <div>
            <h1>Bienvenido, {cliente?.nombre}</h1>
            <p>{cliente?.empresa || 'Cliente'}</p>
          </div>
          <div className="cliente-header-actions">
            <button 
              className="btn-primary"
              onClick={() => navigate('/cliente/catalogo')}
            >
              + Nuevo Pedido
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/catalogo')}
            >
              Ver Catálogo
            </button>
            <button 
              className="btn-logout"
              onClick={() => {
                logout()
                navigate('/cliente/login')
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="cliente-dashboard-main">
        <div className="cliente-dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{pedidos.length}</div>
            <div className="stat-label">Total Pedidos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'en_revision').length}
            </div>
            <div className="stat-label">Pendientes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {pedidos.filter(p => p.estado === 'convertido_completo').length}
            </div>
            <div className="stat-label">Convertidos</div>
          </div>
        </div>

        {error && (
          <div className="cliente-error-message">
            {error}
          </div>
        )}

        <div className="cliente-pedidos-section">
          <h2>Mis Pedidos</h2>
          
          {pedidos.length === 0 ? (
            <div className="cliente-empty-state">
              <p>No tienes pedidos aún</p>
              <button 
                className="btn-primary"
                onClick={() => navigate('/cliente/catalogo')}
              >
                Crear Primer Pedido
              </button>
            </div>
          ) : (
            <div className="cliente-pedidos-list">
              {pedidos.map((pedido) => (
                <div 
                  key={pedido.id} 
                  className="cliente-pedido-card"
                  onClick={() => navigate(`/cliente/pedido/${pedido.id}`)}
                >
                  <div className="pedido-card-header">
                    <div>
                      <h3>{pedido.numero_pedido}</h3>
                      <p className="pedido-fecha">
                        {formatDate(pedido.fecha_pedido)}
                      </p>
                    </div>
                    <div 
                      className="pedido-estado-badge"
                      style={{ backgroundColor: getEstadoColor(pedido.estado) }}
                    >
                      {getEstadoLabel(pedido.estado)}
                    </div>
                  </div>
                  
                  <div className="pedido-card-body">
                    <div className="pedido-info">
                      <span className="pedido-label">Total:</span>
                      <span className="pedido-value">${pedido.precio_total.toFixed(2)}</span>
                    </div>
                    {pedido.fecha_limite_deseada && (
                      <div className="pedido-info">
                        <span className="pedido-label">Fecha límite:</span>
                        <span className="pedido-value">
                          {formatDate(pedido.fecha_limite_deseada)}
                        </span>
                      </div>
                    )}
                    {pedido.id_op_asociada && (
                      <div className="pedido-info">
                        <span className="pedido-label">OP asociada:</span>
                        <span className="pedido-value">OP-{pedido.id_op_asociada}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

