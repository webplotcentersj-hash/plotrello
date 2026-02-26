import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import './AtencionPublicoDashboardPage.css'

type Conversacion = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  usuario_asignado_id: number | null
  created_at: string
  updated_at: string
}

type Reclamo = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  descripcion: string
  estado: string
  prioridad: string
  notas_internas: string | null
  usuario_asignado_id: number | null
  created_at: string
  updated_at: string
}

const AtencionPublicoDashboardPage = () => {
  const navigate = useNavigate()
  const { canAccessAtencionPublico } = useAuth()
  const [activeTab, setActiveTab] = useState<'mensajes' | 'reclamos'>('mensajes')
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [loadingConv, setLoadingConv] = useState(false)
  const [loadingReclamos, setLoadingReclamos] = useState(false)

  const loadConversaciones = async () => {
    setLoadingConv(true)
    try {
      const res = await apiService.listConversacionesAtencion()
      if (res.success && res.data) setConversaciones(res.data)
      else setConversaciones([])
    } catch {
      setConversaciones([])
    } finally {
      setLoadingConv(false)
    }
  }

  const loadReclamos = async () => {
    setLoadingReclamos(true)
    try {
      const res = await apiService.listReclamosAtencion()
      if (res.success && res.data) setReclamos(res.data)
      else setReclamos([])
    } catch {
      setReclamos([])
    } finally {
      setLoadingReclamos(false)
    }
  }

  useEffect(() => {
    if (canAccessAtencionPublico) {
      loadConversaciones()
      loadReclamos()
    }
  }, [canAccessAtencionPublico])

  const formatFecha = (s: string) => {
    try {
      return new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return s
    }
  }

  const estadoLabel = (estado: string) => {
    const map: Record<string, string> = {
      abierto: 'Abierto',
      en_curso: 'En curso',
      cerrado: 'Cerrado',
      nuevo: 'Nuevo',
      en_revision: 'En revisión',
      resuelto: 'Resuelto'
    }
    return map[estado] || estado
  }

  if (!canAccessAtencionPublico) {
    return (
      <div className="atencion-publico-page">
        <div className="atencion-publico-header">
          <button type="button" className="back-button" onClick={() => navigate('/')}>
            ← Volver
          </button>
          <p className="atencion-publico-forbidden">No tenés acceso a Atención al público.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="atencion-publico-page">
      <header className="atencion-publico-header">
        <div className="atencion-publico-header-content">
          <div className="atencion-publico-header-top">
            <button type="button" className="back-button" onClick={() => navigate('/')}>
              ← Volver al Tablero
            </button>
          </div>
          <h1>📞 Atención al público</h1>
          <p className="atencion-publico-subtitle">
            Mensajes con clientes, estado de reclamos. Chat con IA para clientes en la web (Plot Center): conoce la base de clientes, estado de trabajos y datos de la empresa.
          </p>
        </div>
      </header>

      <div className="atencion-publico-container">
        {/* Chat: embed para web + link interno */}
        <section className="atencion-publico-chat-ia">
          <h2>🤖 Chat con IA</h2>
          <p>El chat para clientes (Gemini) está disponible para la web <a href="https://plotcenter.com.ar/" target="_blank" rel="noopener noreferrer">plotcenter.com.ar</a>. Si el cliente se identifica con <strong>nombre, DNI o CUIT</strong>, la IA sabe quién es, conoce el estado de sus trabajos y los datos de la empresa.</p>
          <div className="atencion-publico-embed-actions">
            <a href="/embed/chat" target="_blank" rel="noopener noreferrer" className="atencion-publico-card atencion-publico-card-chat atencion-publico-card-link">
              <span className="atencion-publico-card-icon">🌐</span>
              <div className="atencion-publico-card-body">
                <h3>Abrir chat público (vista previa)</h3>
                <p>Mismo chat que se incrusta en la web. Probá identificándote con nombre, DNI o CUIT.</p>
              </div>
            </a>
            <button
              type="button"
              className="atencion-publico-card atencion-publico-card-chat"
              onClick={() => navigate('/chat')}
            >
              <span className="atencion-publico-card-icon">💬</span>
              <div className="atencion-publico-card-body">
                <h3>Chat del equipo (PlotAI)</h3>
                <p>Escribí <strong>@plotai</strong> o <strong>/plotai</strong> para consultar con la IA.</p>
              </div>
            </button>
          </div>
          <div className="atencion-publico-embed-code">
            <h4>Código para incrustar en WordPress (plotcenter.com.ar)</h4>
            <p className="atencion-publico-embed-code-hint">Reemplazá <code>TU_DOMINIO_DE_LA_APP</code> por la URL donde está desplegada esta aplicación (ej. tu proyecto en Vercel).</p>
            <pre className="atencion-publico-pre">{`<iframe
  src="https://TU_DOMINIO_DE_LA_APP/embed/chat"
  title="Chat Plot Center"
  width="100%"
  height="500"
  style="border: none; border-radius: 8px;"
></iframe>`}</pre>
          </div>
        </section>

        {/* Tabs: Mensajes | Reclamos */}
        <section className="atencion-publico-panel">
          <div className="atencion-publico-tabs">
            <button
              type="button"
              className={`atencion-publico-tab ${activeTab === 'mensajes' ? 'active' : ''}`}
              onClick={() => setActiveTab('mensajes')}
            >
              💬 Mensajes y conversaciones
            </button>
            <button
              type="button"
              className={`atencion-publico-tab ${activeTab === 'reclamos' ? 'active' : ''}`}
              onClick={() => setActiveTab('reclamos')}
            >
              📋 Estado de reclamos
            </button>
          </div>

          {activeTab === 'mensajes' && (
            <div className="atencion-publico-content">
              <h3>Conversaciones con clientes</h3>
              {loadingConv ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : conversaciones.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay conversaciones aún. Cuando el chat esté incrustado en la web (WordPress), las conversaciones aparecerán acá.</p>
                </div>
              ) : (
                <ul className="atencion-publico-list">
                  {conversaciones.map((c) => (
                    <li key={c.id} className="atencion-publico-list-item">
                      <div className="atencion-publico-item-header">
                        <span className="atencion-publico-item-nombre">{c.cliente_nombre || c.cliente_email || 'Sin nombre'}</span>
                        <span className={`atencion-publico-badge atencion-publico-badge-${c.estado}`}>{estadoLabel(c.estado)}</span>
                      </div>
                      <div className="atencion-publico-item-meta">{c.canal} · {formatFecha(c.updated_at)}</div>
                      {c.ultimo_mensaje_preview && (
                        <p className="atencion-publico-item-preview">{c.ultimo_mensaje_preview}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'reclamos' && (
            <div className="atencion-publico-content">
              <h3>Reclamos</h3>
              {loadingReclamos ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : reclamos.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay reclamos registrados.</p>
                </div>
              ) : (
                <ul className="atencion-publico-list">
                  {reclamos.map((r) => (
                    <li key={r.id} className="atencion-publico-list-item">
                      <div className="atencion-publico-item-header">
                        <span className="atencion-publico-item-nombre">{r.cliente_nombre || r.cliente_email || 'Sin nombre'}</span>
                        <span className={`atencion-publico-badge atencion-publico-badge-${r.estado}`}>{estadoLabel(r.estado)}</span>
                        <span className={`atencion-publico-badge atencion-publico-prioridad-${r.prioridad}`}>{r.prioridad}</span>
                      </div>
                      <p className="atencion-publico-item-desc">{r.descripcion}</p>
                      <div className="atencion-publico-item-meta">{formatFecha(r.updated_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default AtencionPublicoDashboardPage
