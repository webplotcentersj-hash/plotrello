import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoClienteRecord } from '../types/api'
import './ClientesWebDashboardPage.css'

const ClientesWebDashboardPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoClienteRecord[]>([])
  const [stats, setStats] = useState({
    totalClientes: 0,
    clientesActivos: 0,
    pedidosPendientes: 0,
    pedidosConvertidos: 0,
    pedidosRechazados: 0
  })

  useEffect(() => {
    if (authLoading) return
    // Permitir acceso a admin y mostrador
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadDashboardData()
  }, [navigate, isAdmin, isMostrador, authLoading])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Cargar pedidos pendientes
      const pedidosResponse = await apiService.getPedidosPendientes()
      if (pedidosResponse.success && pedidosResponse.data) {
        setPedidosPendientes(pedidosResponse.data)
        
        const pendientes = pedidosResponse.data.filter(p => p.estado === 'pendiente').length
        const convertidos = pedidosResponse.data.filter(p => p.estado === 'convertido_completo' || p.estado === 'convertido_parcial').length
        const rechazados = pedidosResponse.data.filter(p => p.estado === 'rechazado').length

        setStats(prev => ({
          ...prev,
          pedidosPendientes: pendientes,
          pedidosConvertidos: convertidos,
          pedidosRechazados: rechazados
        }))
      }

      // Cargar clientes
      const clientesResponse = await apiService.getClientesWeb()
      if (clientesResponse.success && clientesResponse.data) {
        const clientes = clientesResponse.data
        const activos = clientes.filter(c => c.activo).length
        setStats(prev => ({
          ...prev,
          totalClientes: clientes.length,
          clientesActivos: activos
        }))
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="clientes-web-dashboard-loading">
        <div className="spinner"></div>
        <p>Cargando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="clientes-web-dashboard">
      <header className="clientes-web-dashboard-header">
        <div className="clientes-web-header-content">
          <h1>🌐 Gestión de Clientes Web</h1>
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Volver al Tablero
          </button>
        </div>
      </header>

      <div className="clientes-web-dashboard-content">
        {/* Estadísticas principales */}
        <div className="clientes-web-stats-grid">
          <div className="clientes-web-stat-card">
            <div className="clientes-web-stat-icon">👥</div>
            <div className="clientes-web-stat-info">
              <h3>Total de Clientes</h3>
              <p className="clientes-web-stat-value">{stats.totalClientes}</p>
            </div>
          </div>

          <div className="clientes-web-stat-card">
            <div className="clientes-web-stat-icon">✅</div>
            <div className="clientes-web-stat-info">
              <h3>Clientes Activos</h3>
              <p className="clientes-web-stat-value">{stats.clientesActivos}</p>
            </div>
          </div>

          <div className="clientes-web-stat-card">
            <div className="clientes-web-stat-icon">📋</div>
            <div className="clientes-web-stat-info">
              <h3>Pedidos Pendientes</h3>
              <p className="clientes-web-stat-value warning">{stats.pedidosPendientes}</p>
            </div>
          </div>

          <div className="clientes-web-stat-card">
            <div className="clientes-web-stat-icon">✅</div>
            <div className="clientes-web-stat-info">
              <h3>Pedidos Convertidos</h3>
              <p className="clientes-web-stat-value success">{stats.pedidosConvertidos}</p>
            </div>
          </div>

          <div className="clientes-web-stat-card">
            <div className="clientes-web-stat-icon">❌</div>
            <div className="clientes-web-stat-info">
              <h3>Pedidos Rechazados</h3>
              <p className="clientes-web-stat-value error">{stats.pedidosRechazados}</p>
            </div>
          </div>
        </div>

        {/* Sección de acciones rápidas */}
        <div className="clientes-web-actions-section">
          <h2>Acciones Rápidas</h2>
          <div className="clientes-web-actions-grid">
            <button
              className="clientes-web-action-card"
              onClick={() => navigate('/clientes-web/gestion')}
            >
              <div className="clientes-web-action-icon">👤</div>
              <h3>Gestión de Clientes</h3>
              <p>Crear, editar y gestionar clientes web</p>
            </button>

            <button
              className="clientes-web-action-card"
              onClick={() => navigate('/clientes-web/pedidos')}
            >
              <div className="clientes-web-action-icon">📋</div>
              <h3>Pedidos Pendientes</h3>
              <p>Ver y gestionar pedidos de clientes ({stats.pedidosPendientes} pendientes)</p>
            </button>

            <button
              className="clientes-web-action-card"
              onClick={() => navigate('/clientes-web/articulos')}
            >
              <div className="clientes-web-action-icon">📦</div>
              <h3>Artículos de Empresa</h3>
              <p>Gestionar catálogo de artículos y servicios</p>
            </button>
          </div>
        </div>

        {/* Pedidos pendientes recientes */}
        {pedidosPendientes.length > 0 && (
          <div className="clientes-web-section">
            <h2>Pedidos Pendientes Recientes</h2>
            <div className="clientes-web-pedidos-table">
              <table>
                <thead>
                  <tr>
                    <th>N° Pedido</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosPendientes.slice(0, 10).map((pedido) => (
                    <tr key={pedido.id}>
                      <td>{pedido.numero_pedido}</td>
                      <td>Cliente #{pedido.id_cliente}</td>
                    <td>{new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className={`clientes-web-status-badge ${pedido.estado}`}>
                        {pedido.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td>${pedido.precio_total?.toFixed(2) || '0.00'}</td>
                      <td>
                        <button
                          className="btn-view"
                          onClick={() => navigate(`/clientes-web/pedidos/${pedido.id}`)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClientesWebDashboardPage

