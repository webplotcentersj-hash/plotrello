import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { PedidoClienteRecord } from '../types/api'
import './ClienteDashboardPage.css'

type BriefResumen = {
  id: number
  token: string
  completado: boolean
  id_orden_asociada: number | null
  numero_op: string | null
  fecha_creacion: string | null
  fecha_completado: string | null
  es_urgencia: boolean | null
  objetivo_proyecto: string | null
  estado?: string | null
}

export default function ClienteDashboardPage() {
  const { cliente, logout, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchOp, setSearchOp] = useState('')
  const [searchPedido, setSearchPedido] = useState('')
  const [briefs, setBriefs] = useState<BriefResumen[]>([])
  const [loadingBriefs, setLoadingBriefs] = useState(false)

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

  const loadBriefs = useCallback(async () => {
    if (!cliente) return
    setLoadingBriefs(true)
    try {
      const response = await apiService.listarBriefsPorCliente(cliente.id)
      if (response.success && response.data) {
        setBriefs(response.data as BriefResumen[])
      }
    } finally {
      setLoadingBriefs(false)
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
    loadBriefs()
  }, [cliente, authLoading, navigate, loadPedidos, loadBriefs])

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

  const getEstadoBriefColor = (brief: BriefResumen) => {
    if (!brief.completado) return '#f59e0b'
    if (brief.id_orden_asociada && brief.estado) {
      const colorMap: Record<string, string> = {
        'Pendiente': '#6B7280',
        'Asesor Técnico': '#8b5cf6',
        'Presupuestos': '#8b5cf6',
        'Finalizado Asesor Presupuestos': '#10b981',
        'Diseño Gráfico': '#f97316',
        'Diseño en Proceso': '#f97316',
        'En Espera': '#6B7280',
        'Imprenta (Área de Impresión)': '#0ea5e9',
        'Taller de Imprenta': '#0ea5e9',
        'Taller Gráfico': '#6366f1',
        'Instalaciones': '#a855f7',
        'Metalúrgica': '#ec4899',
        'Finalizado en Taller': '#10b981',
        'Almacén de Entrega': '#10b981',
        'Mostrador': '#10b981',
        'Caja': '#facc15',
        'Entregado o Instalado': '#16a34a'
      }
      return colorMap[brief.estado] || '#10b981'
    }
    if (brief.id_orden_asociada) return '#10b981'
    return '#3b82f6'
  }

  const getEstadoBriefLabel = (brief: BriefResumen) => {
    if (!brief.completado) return 'En edición'
    if (brief.id_orden_asociada && brief.estado) {
      const estadosMap: Record<string, string> = {
        'Pendiente': 'Recibimos tu pedido',
        'Asesor Técnico': 'Revisando tu pedido',
        'Presupuestos': 'Preparando tu presupuesto',
        'Finalizado Asesor Presupuestos': 'Tu presupuesto está listo',
        'Diseño Gráfico': 'Diseñando tu trabajo',
        'Diseño en Proceso': 'Diseñando tu trabajo',
        'En Espera': 'En cola de producción',
        'Imprenta (Área de Impresión)': 'Imprimiendo tu trabajo',
        'Taller de Imprenta': 'En taller de impresión',
        'Taller Gráfico': 'En taller gráfico',
        'Instalaciones': 'Instalando tu trabajo',
        'Metalúrgica': 'Fabricando estructuras',
        'Finalizado en Taller': 'Listo en taller',
        'Almacén de Entrega': 'Listo para retirar',
        'Entregado o Instalado': 'Entregado'
      }
      return estadosMap[brief.estado] || brief.estado
    }
    if (brief.id_orden_asociada) {
      return `OP ${brief.numero_op || brief.id_orden_asociada}`
    }
    return 'Completado - Pendiente de asignación'
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

  const handleSearchOp = () => {
    if (searchOp.trim()) {
      navigate(`/cliente/buscar-op/${searchOp.trim()}`)
    }
  }

  const handleSearchPedido = () => {
    if (searchPedido.trim()) {
      const pedido = pedidos.find(p => 
        p.numero_pedido.toLowerCase().includes(searchPedido.toLowerCase()) ||
        p.id.toString() === searchPedido.trim()
      )
      if (pedido) {
        navigate(`/cliente/pedido/${pedido.id}`)
      } else {
        setError('No se encontró el pedido')
      }
    }
  }

  return (
    <div className="cliente-dashboard-page">
      <header className="cliente-dashboard-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <div className="cliente-header-info">
              <h1>Bienvenido, {cliente?.nombre}</h1>
              <p>{cliente?.empresa || 'Cliente'}</p>
            </div>
          </div>
          <div className="cliente-header-actions">
            <button 
              className="btn-primary"
              onClick={() => navigate('/cliente/nuevo-pedido')}
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
              className="btn-secondary"
              onClick={() => navigate('/cliente/presupuestos')}
            >
              💰 Presupuestos
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/disenos')}
            >
              📋 Pedidos de Diseño
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/mensajes')}
            >
              💬 Mensajes
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/reclamos')}
            >
              📢 Reclamos
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/chat')}
            >
              🤖 Chat PlotAI
            </button>
            <button 
              className="btn-icon btn-notificaciones"
              onClick={() => navigate('/cliente/notificaciones')}
              title="Notificaciones"
              aria-label="Notificaciones"
            >
              🔔
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
        <div className="cliente-search-section">
          <h3>🔍 Buscar</h3>
          <div className="search-input-group">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por número de OP..."
              value={searchOp}
              onChange={(e) => setSearchOp(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchOp()}
            />
            <button className="btn-search" onClick={handleSearchOp}>
              Buscar OP
            </button>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar pedido por número..."
              value={searchPedido}
              onChange={(e) => setSearchPedido(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchPedido()}
            />
            <button className="btn-search" onClick={handleSearchPedido}>
              Buscar Pedido
            </button>
          </div>
        </div>

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
          <div className="stat-card">
            <div className="stat-value">
              {pedidos.filter(p => p.es_urgente).length}
            </div>
            <div className="stat-label">Urgentes</div>
          </div>
        </div>

        {error && (
          <div className="cliente-error-message">
            {error}
          </div>
        )}

        {briefs.length > 0 && (
          <div className="cliente-briefs-resumen-section">
            <h2>Pedidos de Diseño</h2>
            <p className="section-desc">
              Tus últimos pedidos de diseño y su estado actual en producción.
            </p>
            <div className="cliente-briefs-resumen-list">
              {briefs.slice(0, 3).map((brief) => (
                <div
                  key={brief.id}
                  className={`cliente-brief-resumen-card ${brief.es_urgencia ? 'urgente' : ''}`}
                  onClick={() => navigate(`/cliente/brief/${brief.token}`)}
                >
                  <div className="brief-resumen-header">
                    <div>
                      <h3>Brief #{brief.id}</h3>
                      <p className="brief-resumen-fecha">
                        {formatDate(
                          (brief.fecha_completado || brief.fecha_creacion || new Date().toISOString())
                        )}
                      </p>
                    </div>
                    <div
                      className="brief-resumen-estado"
                      style={{ backgroundColor: getEstadoBriefColor(brief) }}
                    >
                      {getEstadoBriefLabel(brief)}
                    </div>
                  </div>
                  {brief.objetivo_proyecto && (
                    <p className="brief-resumen-objetivo">
                      {brief.objetivo_proyecto.length > 90
                        ? `${brief.objetivo_proyecto.slice(0, 90)}...`
                        : brief.objetivo_proyecto}
                    </p>
                  )}
                  {brief.es_urgencia && (
                    <span className="badge badge-urgente">⚡ Urgente</span>
                  )}
                </div>
              ))}
              {briefs.length > 3 && (
                <button
                  className="btn-link-ver-mas"
                  onClick={() => navigate('/cliente/disenos')}
                  disabled={loadingBriefs}
                >
                  Ver todos los pedidos de diseño
                </button>
              )}
            </div>
          </div>
        )}

        {pedidos.some(p => p.id_op_asociada) && (
          <div className="cliente-ops-section">
            <h2>Seguimiento de OP</h2>
            <p className="section-desc">Tus órdenes de producción en curso</p>
            <div className="cliente-ops-list">
              {pedidos
                .filter(p => p.id_op_asociada)
                .map((pedido) => (
                  <div
                    key={pedido.id}
                    className="cliente-op-card"
                    onClick={() => navigate(`/cliente/buscar-op/${pedido.id_op_asociada}`)}
                  >
                    <span className="op-numero">OP-{pedido.id_op_asociada}</span>
                    <span className="op-pedido">{pedido.numero_pedido}</span>
                    <span className={`op-estado estado-${pedido.estado}`}>
                      {getEstadoLabel(pedido.estado)}
                    </span>
                  </div>
                ))}
            </div>
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
                  className={`cliente-pedido-card ${pedido.es_urgente ? 'urgente' : ''}`}
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
                        <span className="pedido-value">
                          <button
                            className="btn-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/cliente/buscar-op/${pedido.id_op_asociada}`)
                            }}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: '#eb671b', 
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0,
                              fontSize: 'inherit',
                              fontWeight: 'inherit'
                            }}
                          >
                            OP-{pedido.id_op_asociada}
                          </button>
                        </span>
                      </div>
                    )}
                    <div className="pedido-badges">
                      {pedido.es_urgente && (
                        <span className="badge badge-urgente">⚡ Urgente</span>
                      )}
                      {pedido.requiere_delivery && (
                        <span className="badge badge-delivery">🚚 Delivery</span>
                      )}
                    </div>
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

