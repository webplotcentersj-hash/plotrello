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
  estado?: string | null
  etapa_taller_grafico?: string | null
  etapa_instalaciones?: string | null
  etapa_taller_imprenta?: string | null
  etapa_impresion_digital?: string | null
  etapa_metalurgica?: string | null
}

const ESTADOS_DISPLAY: Record<string, string> = {
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

const ESTADOS_COLOR: Record<string, string> = {
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

const ETAPAS_SECTOR: Array<{ key: keyof BriefRecord; label: string }> = [
  { key: 'etapa_taller_grafico', label: 'Taller Gráfico' },
  { key: 'etapa_instalaciones', label: 'Instalaciones' },
  { key: 'etapa_taller_imprenta', label: 'Taller Imprenta' },
  { key: 'etapa_impresion_digital', label: 'Impresión Digital' },
  { key: 'etapa_metalurgica', label: 'Metalúrgica' }
]

export default function ClienteBriefsPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [briefs, setBriefs] = useState<BriefRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const loadBriefs = useCallback(async (silent = false) => {
    if (!cliente) return
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const response = await apiService.listarBriefsPorCliente(cliente.id)
      if (response.success && response.data) {
        setBriefs(response.data)
      } else if (!silent) {
        setError(response.error || 'Error al cargar pedidos de diseño')
      }
    } catch (err) {
      if (!silent) setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [cliente])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadBriefs(false)
  }, [cliente, authLoading, navigate, loadBriefs])

  // Actualización automática: refresca cada 30 s para que el cliente vea el avance del proyecto
  useEffect(() => {
    if (!cliente || authLoading) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadBriefs(true)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [cliente, authLoading, loadBriefs])

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
    if (b.id_orden_asociada && b.estado) {
      const display = ESTADOS_DISPLAY[b.estado]
      return display || b.estado
    }
    if (b.id_orden_asociada) return `OP ${b.numero_op || b.id_orden_asociada}`
    return 'Completado - Pendiente de asignación'
  }

  const getEstadoColor = (b: BriefRecord) => {
    if (!b.completado) return '#f59e0b'
    if (b.id_orden_asociada && b.estado) {
      return ESTADOS_COLOR[b.estado] || '#10b981'
    }
    if (b.id_orden_asociada) return '#10b981'
    return '#3b82f6'
  }

  const getEtapasActivas = (b: BriefRecord) => {
    if (!b.id_orden_asociada) return []
    return ETAPAS_SECTOR.filter(({ key }) => {
      const val = b[key]
      return val && String(val).trim() !== ''
    }).map(({ key, label }) => ({
      sector: label,
      etapa: b[key] as string
    }))
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
          <div className="cliente-briefs-section-header">
            <div>
              <h2>Mis Pedidos de Diseño (Briefs)</h2>
              <p className="section-desc">
                Aquí podés ver el estado de tus pedidos de diseño. Creá un nuevo brief para solicitar un trabajo de diseño gráfico.
              </p>
            </div>
            <button
              type="button"
              className="btn-actualizar-briefs"
              onClick={async () => {
                setRefreshing(true)
                await loadBriefs(true)
                setRefreshing(false)
              }}
              disabled={refreshing}
              title="Actualizar estado de los pedidos"
            >
              {refreshing ? 'Actualizando...' : '↻ Actualizar'}
            </button>
          </div>

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
                    {/* Estado del pedido: siempre visible */}
                    <div
                      className="brief-estado-pedido"
                      style={{
                        borderLeftColor: getEstadoColor(brief),
                        backgroundColor: `${getEstadoColor(brief)}18`
                      }}
                    >
                      <span className="brief-estado-pedido-label">Estado:</span>
                      <span className="brief-estado-pedido-valor">{getEstadoLabel(brief)}</span>
                    </div>
                    {brief.id_orden_asociada && (
                      <div className="brief-etapas">
                        <p className="brief-etapas-titulo">
                          OP {brief.numero_op || brief.id_orden_asociada} — Avance del proyecto
                        </p>
                        <div className="brief-etapas-lista">
                          {getEtapasActivas(brief).length > 0 ? (
                            getEtapasActivas(brief).map(({ sector, etapa }) => (
                              <div key={sector} className="brief-etapa-item">
                                <span className="brief-etapa-sector">{sector}:</span>
                                <span className="brief-etapa-valor">{etapa}</span>
                              </div>
                            ))
                          ) : (
                            <div className="brief-etapa-item">
                              <span className="brief-etapa-valor">{getEstadoLabel(brief)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
