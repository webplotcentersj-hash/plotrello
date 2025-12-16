import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
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
}

const BriefsPendientesPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isDiseno } = useAuth()
  const [briefs, setBriefs] = useState<BriefPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar permisos
    if (!isAdmin && !isDiseno) {
      setError('No tienes permisos para acceder a esta página')
      setLoading(false)
      return
    }

    loadBriefs()
  }, [isAdmin, isDiseno])

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
    } catch (error) {
      console.error('Error cargando briefs:', error)
      setError('Error al cargar los briefs')
    } finally {
      setLoading(false)
    }
  }

  const handleCopiarLink = (token: string) => {
    const url = `${window.location.origin}/brief/${token}`
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado al portapapeles')
    }).catch(() => {
      alert('Error al copiar el link')
    })
  }

  const handleCrearOP = (brief: BriefPendiente) => {
    // Guardar el token del brief en localStorage para que TaskCreateModal lo use
    localStorage.setItem('brief_token_seleccionado', brief.token)
    navigate('/')
    // Abrir el modal de creación de OP (se manejará desde BoardPage)
    window.dispatchEvent(new CustomEvent('open-create-modal-with-brief', { 
      detail: { briefToken: brief.token } 
    }))
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
            <h1>📋 Briefs Públicos Pendientes</h1>
            <p className="header-description">
              Briefs completados por clientes que aún no tienen una OP asociada
            </p>
          </div>
          <button onClick={() => navigate('/')} className="btn-back">
            ← Volver
          </button>
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
            {briefs.map((brief) => (
              <div 
                key={brief.id} 
                className={`brief-card ${brief.es_urgencia ? 'urgent' : ''} ${brief.completado ? 'completed' : 'pending'}`}
              >
                <div className="brief-card-header">
                  <div className="brief-status">
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
                      ? `Completado: ${brief.fecha_completado ? new Date(brief.fecha_completado).toLocaleDateString('es-AR') : 'N/A'}`
                      : `Creado: ${brief.fecha_creacion ? new Date(brief.fecha_creacion).toLocaleDateString('es-AR') : 'N/A'}`
                    }
                  </div>
                </div>

                <div className="brief-card-body">
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

                  {brief.tipo_producto_servicio && Array.isArray(brief.tipo_producto_servicio) && brief.tipo_producto_servicio.length > 0 && (
                    <div className="brief-info">
                      <strong>Tipo de Producto/Servicio:</strong>
                      <div className="brief-tags">
                        {brief.tipo_producto_servicio.map((tipo, idx) => (
                          <span key={idx} className="brief-tag">{tipo}</span>
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
                    className="btn-action btn-link"
                    onClick={() => handleCopiarLink(brief.token)}
                    title="Copiar link del formulario"
                  >
                    📋 Copiar Link
                  </button>
                  {brief.completado && (
                    <button
                      className="btn-action btn-create"
                      onClick={() => handleCrearOP(brief)}
                    >
                      ➕ Crear OP desde este Brief
                    </button>
                  )}
                  <a
                    href={`/brief/${brief.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-action btn-view"
                  >
                    👁️ Ver Brief Completo
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BriefsPendientesPage

