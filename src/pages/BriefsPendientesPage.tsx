import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import BriefMockupCard from '../components/BriefMockupCard'
import {
  markBriefVisto,
  markBriefsVistos,
  readBriefsVistos
} from '../utils/briefsPendientesNuevos'
import './BriefsPendientesPage.css'

interface BriefPendiente {
  id: number
  token: string
  cliente_nombre_completo: string | null
  cliente_empresa: string | null
  telefono_cliente: string | null
  email_cliente: string | null
  tipo_producto_servicio: string[] | null
  objetivo_proyecto: string | null
  fecha_creacion: string
  fecha_completado: string | null
  completado: boolean
  es_urgencia: boolean
  mockup_url?: string | null
}

const BriefsPendientesPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin, isDiseno } = useAuth()
  const [briefs, setBriefs] = useState<BriefPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vistos, setVistos] = useState<Set<number>>(() => readBriefsVistos())
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!isAdmin && !isDiseno) {
      setError('No tienes permisos para acceder a esta página')
      setLoading(false)
      return
    }

    void loadBriefs()
  }, [isAdmin, isDiseno])

  useEffect(() => {
    const raw = searchParams.get('brief')
    if (!raw) return
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) return
    setHighlightId(id)
    setVistos(markBriefVisto(id))
  }, [searchParams])

  useEffect(() => {
    if (highlightId == null || loading || briefs.length === 0) return
    const el = cardRefs.current.get(highlightId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = window.setTimeout(() => {
      setHighlightId(null)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('brief')
          return next
        },
        { replace: true }
      )
    }, 4500)
    return () => window.clearTimeout(t)
  }, [highlightId, loading, briefs, setSearchParams])

  const loadBriefs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.listarBriefsPendientes()
      if (response.success && response.data) {
        setBriefs(response.data)
      } else {
        setError(response.error || 'Error al cargar los briefs')
      }
    } catch (err) {
      console.error('Error cargando briefs:', err)
      setError('Error al cargar los briefs')
    } finally {
      setLoading(false)
    }
  }

  const nuevosCount = useMemo(
    () => briefs.filter((b) => !vistos.has(b.id)).length,
    [briefs, vistos]
  )

  const orderedBriefs = useMemo(() => {
    return [...briefs].sort((a, b) => {
      const aNew = !vistos.has(a.id) ? 1 : 0
      const bNew = !vistos.has(b.id) ? 1 : 0
      if (aNew !== bNew) return bNew - aNew
      const ta = Date.parse(a.fecha_completado || a.fecha_creacion) || 0
      const tb = Date.parse(b.fecha_completado || b.fecha_creacion) || 0
      return tb - ta
    })
  }, [briefs, vistos])

  const handleCopiarLink = (token: string) => {
    const url = `${window.location.origin}/brief/${token}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado al portapapeles')
    }).catch(() => {
      alert('Error al copiar el link')
    })
  }

  const handleCrearOP = (brief: BriefPendiente) => {
    setVistos(markBriefVisto(brief.id))
    localStorage.setItem('brief_token_seleccionado', brief.token)
    navigate('/', { state: { openCreateModalWithBrief: brief.token } })
  }

  const handleVerBrief = (brief: BriefPendiente) => {
    setVistos(markBriefVisto(brief.id))
  }

  const handleMarcarTodosVistos = () => {
    setVistos(markBriefsVistos(briefs.map((b) => b.id)))
  }

  if (loading) {
    return (
      <div className="briefs-pendientes-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando briefs pendientes...</p>
        </div>
      </div>
    )
  }

  if (error && !isAdmin && !isDiseno) {
    return (
      <div className="briefs-pendientes-page">
        <div className="error-container">
          <h1>❌ Acceso Denegado</h1>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="btn-back">
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="briefs-pendientes-page">
      <div className="briefs-container">
        <header className="briefs-header">
          <div className="header-content">
            <h1>
              📋 Briefs Públicos Pendientes
              {nuevosCount > 0 && (
                <span className="briefs-nuevos-count" title="Briefs que todavía no abriste">
                  {nuevosCount} nuevo{nuevosCount === 1 ? '' : 's'}
                </span>
              )}
            </h1>
            <p className="header-description">
              Briefs completados por clientes que aún no tienen una OP asociada
            </p>
          </div>
          <div className="briefs-header-actions">
            {nuevosCount > 0 && (
              <button type="button" className="btn-mark-seen" onClick={handleMarcarTodosVistos}>
                Marcar todos como vistos
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className="btn-back">
              ← Volver
            </button>
          </div>
        </header>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {briefs.length === 0 ? (
          <div className="empty-state">
            <p>📭 No hay briefs pendientes</p>
            <p className="empty-description">
              Los briefs completados por clientes aparecerán aquí hasta que se cree una OP asociada.
            </p>
          </div>
        ) : (
          <div className="briefs-grid">
            {orderedBriefs.map((brief) => {
              const isNuevo = !vistos.has(brief.id)
              const isHighlight = highlightId === brief.id
              return (
                <div
                  key={brief.id}
                  ref={(node) => {
                    if (node) cardRefs.current.set(brief.id, node)
                    else cardRefs.current.delete(brief.id)
                  }}
                  className={[
                    'brief-card',
                    brief.es_urgencia ? 'urgent' : '',
                    brief.completado ? 'completed' : 'pending',
                    isNuevo ? 'brief-card--nuevo' : '',
                    isHighlight ? 'brief-card--highlight' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    if (isNuevo) setVistos(markBriefVisto(brief.id))
                  }}
                >
                  <div className="brief-card-header">
                    <div className="brief-status">
                      {isNuevo && <span className="status-badge nuevo">● Nuevo</span>}
                      {brief.completado ? (
                        <span className="status-badge completed">✓ Completado</span>
                      ) : (
                        <span className="status-badge pending">⏳ Pendiente</span>
                      )}
                      {brief.es_urgencia && (
                        <span className="status-badge urgent">⚠️ Urgencia</span>
                      )}
                    </div>
                    <div className="brief-date">
                      {brief.fecha_completado
                        ? `Completado: ${new Date(brief.fecha_completado).toLocaleDateString('es-AR')}`
                        : `Creado: ${brief.fecha_creacion ? new Date(brief.fecha_creacion).toLocaleDateString('es-AR') : 'N/A'}`}
                    </div>
                  </div>

                  <div className="brief-card-body">
                    {brief.mockup_url && (
                      <div className="brief-card-mockup">
                        <BriefMockupCard
                          mockupUrl={brief.mockup_url}
                          compact
                          alt={`Mockup ${brief.cliente_nombre_completo || 'brief'}`}
                        />
                      </div>
                    )}

                    <h3 className="brief-cliente">
                      {brief.cliente_nombre_completo || 'Cliente sin nombre'}
                      {brief.cliente_empresa && (
                        <span className="brief-empresa"> - {brief.cliente_empresa}</span>
                      )}
                    </h3>

                    {brief.telefono_cliente && (
                      <div className="brief-info">
                        <strong>Teléfono:</strong> {brief.telefono_cliente}
                      </div>
                    )}

                    {brief.email_cliente && (
                      <div className="brief-info">
                        <strong>Email:</strong> {brief.email_cliente}
                      </div>
                    )}

                    {brief.tipo_producto_servicio &&
                      Array.isArray(brief.tipo_producto_servicio) &&
                      brief.tipo_producto_servicio.length > 0 && (
                        <div className="brief-info">
                          <strong>Tipo de Producto/Servicio:</strong>
                          <div className="brief-tags">
                            {brief.tipo_producto_servicio.map((tipo, idx) => (
                              <span key={idx} className="brief-tag">
                                {tipo}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {brief.objetivo_proyecto && (
                      <div className="brief-info">
                        <strong>Objetivo:</strong>
                        <p className="brief-text">{brief.objetivo_proyecto}</p>
                      </div>
                    )}
                  </div>

                  <div className="brief-card-actions">
                    <button
                      type="button"
                      className="btn-action btn-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopiarLink(brief.token)
                      }}
                      title="Copiar link del formulario"
                    >
                      📋 Copiar Link
                    </button>
                    {brief.completado && (
                      <button
                        type="button"
                        className="btn-action btn-create"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCrearOP(brief)
                        }}
                      >
                        ➕ Crear OP desde este Brief
                      </button>
                    )}
                    <a
                      href={`/brief/${brief.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-action btn-view"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVerBrief(brief)
                      }}
                    >
                      👁️ Ver Brief Completo
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default BriefsPendientesPage
