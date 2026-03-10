import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import './ClienteBriefsPage.css'

type BriefRecord = {
  id: number
  token: string
  cliente_nombre_completo: string | null
  cliente_empresa: string | null
  email_cliente: string | null
  brief_publico: string | null
  objetivo_proyecto: string | null
  tipo_producto_servicio: string[] | null
  completado: boolean
  id_orden_asociada: number | null
  numero_op: string | null
  fecha_creacion: string | null
  fecha_completado: string | null
  es_urgencia: boolean | null
}

export default function ClienteBriefsPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [briefs, setBriefs] = useState<BriefRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const loadBriefs = useCallback(async () => {
    if (!cliente) return
    setLoading(true)
    setError('')
    try {
      const response = await apiService.listarBriefsPorCliente(cliente.id)
      if (response.success && response.data) {
        setBriefs(response.data)
      } else {
        setError(response.error || 'Error al cargar pedidos de diseño')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [cliente])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadBriefs()
  }, [cliente, authLoading, navigate, loadBriefs])

  const handleNuevoBrief = async () => {
    if (!cliente) return
    setCreating(true)
    setError('')
    try {
      const response = await apiService.crearBriefPublico(undefined, cliente.id)
      if (response.success && response.data) {
        navigate(`/cliente/brief/${response.data}`)
      } else {
        setError(response.error || 'Error al crear pedido de diseño')
      }
    } catch (err) {
      setError('Error al crear pedido de diseño')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getEstadoLabel = (b: BriefRecord) => {
    if (!b.completado) return 'En edición'
    if (b.id_orden_asociada) return `OP ${b.numero_op || b.id_orden_asociada}`
    return 'Completado - Pendiente de asignación'
  }

  const getEstadoColor = (b: BriefRecord) => {
    if (!b.completado) return '#f59e0b'
    if (b.id_orden_asociada) return '#10b981'
    return '#3b82f6'
  }

  if (authLoading || loading) {
    return (
      <div className="cliente-briefs-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-briefs-page">
      <header className="cliente-briefs-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center"
            />
            <h1>Pedidos de Diseño</h1>
          </div>
          <div className="cliente-header-actions">
            <button
              className="btn-primary"
              onClick={handleNuevoBrief}
              disabled={creating}
            >
              {creating ? 'Creando...' : '+ Nuevo Pedido de Diseño'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/cliente/dashboard')}
            >
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <main className="cliente-briefs-main">
        {error && (
          <div className="cliente-error-message">{error}</div>
        )}

        <div className="cliente-briefs-section">
          <h2>Mis Pedidos de Diseño (Briefs)</h2>
          <p className="section-desc">
            Aquí podés ver el estado de tus pedidos de diseño. Creá un nuevo brief para solicitar un trabajo de diseño gráfico.
          </p>

          {briefs.length === 0 ? (
            <div className="cliente-empty-state">
              <p>No tenés pedidos de diseño aún</p>
              <button
                className="btn-primary"
                onClick={handleNuevoBrief}
                disabled={creating}
              >
                Crear Primer Pedido de Diseño
              </button>
            </div>
          ) : (
            <div className="cliente-briefs-list">
              {briefs.map((brief) => (
                <div
                  key={brief.id}
                  className={`cliente-brief-card ${brief.es_urgencia ? 'urgente' : ''}`}
                  onClick={() => navigate(`/cliente/brief/${brief.token}`)}
                >
                  <div className="brief-card-header">
                    <div>
                      <h3>Brief #{brief.id}</h3>
                      <p className="brief-fecha">
                        {formatDate(brief.fecha_completado || brief.fecha_creacion)}
                      </p>
                    </div>
                    <div
                      className="brief-estado-badge"
                      style={{ backgroundColor: getEstadoColor(brief) }}
                    >
                      {getEstadoLabel(brief)}
                    </div>
                  </div>
                  <div className="brief-card-body">
                    {brief.objetivo_proyecto && (
                      <p className="brief-objetivo">{brief.objetivo_proyecto}</p>
                    )}
                    {brief.brief_publico && (
                      <p className="brief-desc">{brief.brief_publico.slice(0, 120)}...</p>
                    )}
                    {brief.tipo_producto_servicio && brief.tipo_producto_servicio.length > 0 && (
                      <div className="brief-tags">
                        {brief.tipo_producto_servicio.slice(0, 3).map((t) => (
                          <span key={t} className="brief-tag">{t}</span>
                        ))}
                      </div>
                    )}
                    {brief.es_urgencia && (
                      <span className="badge badge-urgente">⚡ Urgente</span>
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
