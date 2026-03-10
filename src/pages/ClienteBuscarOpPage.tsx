import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import './ClienteBuscarOpPage.css'

export default function ClienteBuscarOpPage() {
  const { numeroOp } = useParams<{ numeroOp: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState(numeroOp || '')
  const [loading, setLoading] = useState(false)
  const [op, setOp] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    if (numeroOp) {
      buscarOp(numeroOp)
    }
  }, [numeroOp, cliente, authLoading, navigate])

  const buscarOp = async (numero: string) => {
    if (!cliente || !numero.trim()) return

    setLoading(true)
    setError('')
    setOp(null)

    try {
      let response = await apiService.obtenerOpPorNumeroCliente(numero.trim(), cliente.id)
      if (!response.success && /^\d+$/.test(numero.trim())) {
        response = await apiService.obtenerOpPorIdCliente(parseInt(numero.trim(), 10), cliente.id)
      }
      if (response.success && response.data) {
        setOp(response.data)
      } else {
        setError(response.error || 'OP no encontrada')
      }
    } catch (err) {
      setError('Error al buscar OP')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (searchValue.trim()) {
      buscarOp(searchValue.trim())
    }
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      pendiente: '#f59e0b',
      en_proceso: '#3b82f6',
      completado: '#10b981',
      cancelado: '#ef4444'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En Proceso',
      completado: 'Completado',
      cancelado: 'Cancelado'
    }
    return labels[estado] || estado
  }

  if (authLoading || loading) {
    return (
      <div className="cliente-buscar-op-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-buscar-op-page">
      <header className="cliente-buscar-op-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <h1>Buscar OP</h1>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/cliente/dashboard')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="cliente-buscar-op-main">
        <div className="cliente-search-section">
          <h3>🔍 Buscar Orden de Trabajo</h3>
          <div className="search-input-group">
            <input
              type="text"
              className="search-input"
              placeholder="Ingresa el número de OP (ej: OP-12345)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-search" onClick={handleSearch}>
              Buscar
            </button>
          </div>
        </div>

        {error && (
          <div className="cliente-error-message">
            {error}
          </div>
        )}

        {op && (
          <div className="op-detail-card">
            <div className="op-detail-header">
              <div>
                <h2>{op.numero_op}</h2>
                <p className="op-titulo">{op.titulo}</p>
              </div>
              <div 
                className="op-estado-badge"
                style={{ backgroundColor: getEstadoColor(op.estado) }}
              >
                {getEstadoLabel(op.estado)}
              </div>
            </div>

            <div className="op-detail-body">
              <div className="op-info-grid">
                <div className="op-info-item">
                  <span className="op-info-label">Sector:</span>
                  <span className="op-info-value">{op.sector_asignado || 'Sin asignar'}</span>
                </div>
                <div className="op-info-item">
                  <span className="op-info-label">Fecha creación:</span>
                  <span className="op-info-value">
                    {new Date(op.fecha_creacion).toLocaleDateString('es-AR')}
                  </span>
                </div>
                {op.fecha_limite && (
                  <div className="op-info-item">
                    <span className="op-info-label">Fecha límite:</span>
                    <span className="op-info-value">
                      {new Date(op.fecha_limite).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                )}
                {op.origen_pedido_web && (
                  <div className="op-info-item">
                    <span className="op-info-label">Origen:</span>
                    <span className="op-info-value badge badge-delivery">Pedido Web</span>
                  </div>
                )}
              </div>

              {op.id_pedido_cliente && (
                <div className="op-pedido-link">
                  <button 
                    className="btn-primary"
                    onClick={() => navigate(`/cliente/pedido/${op.id_pedido_cliente}`)}
                  >
                    Ver Pedido Original
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

