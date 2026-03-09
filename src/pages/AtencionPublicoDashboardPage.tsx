import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import './AtencionPublicoDashboardPage.css'

const REFRESH_INTERVAL_MS = 25000

function isToday(dateStr: string): boolean {
  try {
    const d = new Date(dateStr)
    const today = new Date()
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  } catch {
    return false
  }
}

function clienteEnLinea(updatedAt: string, umbralMinutos = 2): boolean {
  try {
    const d = new Date(updatedAt)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
    return diffMin < umbralMinutos
  } catch {
    return false
  }
}

function mensajesSinLeer(c: Conversacion): number {
  if (c.visto_por_staff_at) return 0
  const hist = c.historial_mensajes ?? []
  return hist.filter((m) => m.role === 'user').length
}

function tiempoRelativo(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMin / 60)
    const diffD = Math.floor(diffH / 24)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `Hace ${diffMin} min`
    if (diffH < 24 && d.getDate() === now.getDate()) return `Hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    if (diffD === 1) return 'Ayer'
    if (diffD < 7) return `Hace ${diffD} días`
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

type SolicitudChat = {
  id: number
  cliente_nombre: string | null
  sector_solicitado: string
  rol_solicitado: string | null
  mensaje_cliente: string | null
  estado: string
  historial_mensajes: Array<{ role: string; text: string }>
  respuestas_staff: Array<{ autor: string; texto: string; created_at?: string }>
  created_at: string
}

type Conversacion = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  usuario_asignado_id: number | null
  visto_por_staff_at?: string | null
  historial_mensajes?: Array<{ role: string; text: string }>
  respuestas_staff?: Array<{ autor: string; texto: string; created_at?: string }>
  created_at: string
  updated_at: string
}

type ConversacionDetalle = {
  id: number
  cliente_nombre: string | null
  cliente_email: string | null
  canal: string
  ultimo_mensaje_preview: string | null
  estado: string
  historial_mensajes: Array<{ role: string; text: string }>
  respuestas_staff: Array<{ autor: string; texto: string; created_at?: string }>
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
  sector_id: number | null
  created_at: string
  updated_at: string
}

type Sector = { id: number; nombre: string }

const AtencionPublicoDashboardPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canAccessAtencionPublico, usuario } = useAuth()
  const [activeTab, setActiveTab] = useState<'mensajes' | 'reclamos'>('mensajes')
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [reclamos, setReclamos] = useState<Reclamo[]>([])
  const [loadingConv, setLoadingConv] = useState(false)
  const [loadingReclamos, setLoadingReclamos] = useState(false)
  const [solicitudChat, setSolicitudChat] = useState<SolicitudChat | null>(null)
  const [loadingSolicitud, setLoadingSolicitud] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [conversacionDetalle, setConversacionDetalle] = useState<ConversacionDetalle | null>(null)
  const [loadingConversacion, setLoadingConversacion] = useState(false)
  const [replyConversacionText, setReplyConversacionText] = useState('')
  const [sendingReplyConversacion, setSendingReplyConversacion] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false)
  const [searchBiblioteca, setSearchBiblioteca] = useState('')
  const [modalEmbed, setModalEmbed] = useState(false)
  const [modalConversacionId, setModalConversacionId] = useState<number | null>(null)
  const [modalSolicitudId, setModalSolicitudId] = useState<number | null>(null)
  const [modalReclamoEditar, setModalReclamoEditar] = useState<Reclamo | null>(null)
  const [reclamoEditForm, setReclamoEditForm] = useState({ estado: '', prioridad: '', notas_internas: '', usuario_asignado_id: null as number | null, sector_id: null as number | null })
  const [showCrearReclamo, setShowCrearReclamo] = useState(false)
  const [nuevoReclamoForm, setNuevoReclamoForm] = useState({ cliente_nombre: '', cliente_email: '', descripcion: '', prioridad: 'media', sector_id: null as number | null })
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string }>>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [searchReclamos, setSearchReclamos] = useState('')
  const [filtroEstadoReclamos, setFiltroEstadoReclamos] = useState<string>('')

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

  const loadConversacionDetalle = async (id: number) => {
    setLoadingConversacion(true)
    try {
      const res = await apiService.getConversacionAtencion(id)
      if (res.success && res.data) setConversacionDetalle(res.data)
      else setConversacionDetalle(null)
    } catch {
      setConversacionDetalle(null)
    } finally {
      setLoadingConversacion(false)
    }
  }

  const loadSolicitudChat = async (id: number) => {
    setLoadingSolicitud(true)
    try {
      const res = await apiService.getSolicitudAtencionChat(id)
      if (res.success && res.data) setSolicitudChat(res.data)
      else setSolicitudChat(null)
    } catch {
      setSolicitudChat(null)
    } finally {
      setLoadingSolicitud(false)
    }
  }

  useEffect(() => {
    if (canAccessAtencionPublico) {
      loadConversaciones()
      loadReclamos()
    }
  }, [canAccessAtencionPublico])

  useEffect(() => {
    if (!canAccessAtencionPublico || activeTab !== 'reclamos') return
    const load = async () => {
      const [usuariosRes, sectoresRes] = await Promise.all([
        apiService.getUsuarios(),
        apiService.getSectores()
      ])
      if (usuariosRes.success && usuariosRes.data) setUsuarios(usuariosRes.data)
      if (sectoresRes.success && sectoresRes.data) setSectores(sectoresRes.data.filter((s) => s.activo !== false) as Sector[])
    }
    void load()
  }, [canAccessAtencionPublico, activeTab])

  // Realtime: conversaciones y reclamos
  useEffect(() => {
    if (!canAccessAtencionPublico || !supabase) return
    const ch = supabase
      .channel(`atencion:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_conversaciones' }, () => {
        void loadConversaciones()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atencion_reclamos' }, () => {
        void loadReclamos()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_atencion_chat' }, () => {
        void loadConversaciones()
      })
      .subscribe()
    return () => {
      void ch.unsubscribe()
    }
  }, [canAccessAtencionPublico])

  useEffect(() => {
    if (!canAccessAtencionPublico) return
    const t = setInterval(() => {
      loadConversaciones()
      loadReclamos()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(t)
  }, [canAccessAtencionPublico])

  useEffect(() => {
    if (canAccessAtencionPublico && modalSolicitudId) {
      loadSolicitudChat(modalSolicitudId)
    } else if (!modalSolicitudId) {
      setSolicitudChat(null)
    }
  }, [canAccessAtencionPublico, modalSolicitudId])

  useEffect(() => {
    if (canAccessAtencionPublico && modalConversacionId) {
      loadConversacionDetalle(modalConversacionId)
    } else if (!modalConversacionId) {
      setConversacionDetalle(null)
    }
  }, [canAccessAtencionPublico, modalConversacionId])

  useEffect(() => {
    const sid = searchParams.get('solicitud_chat')
    const cid = searchParams.get('conversacion')
    const tab = searchParams.get('tab')
    if (tab === 'reclamos') {
      setActiveTab('reclamos')
    }
    if (sid) {
      const id = parseInt(sid, 10)
      if (!isNaN(id)) {
        setModalConversacionId(null)
        setModalSolicitudId(id)
      }
    } else if (cid) {
      const id = parseInt(cid, 10)
      if (!isNaN(id)) {
        setModalSolicitudId(null)
        setModalConversacionId(id)
      }
    }
  }, [searchParams])

  const sendReply = async () => {
    if (!solicitudChat || !replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      const res = await apiService.addRespuestaSolicitudChat(solicitudChat.id, {
        autor: usuario?.nombre || 'Equipo',
        texto: replyText.trim()
      })
      if (res.success) {
        setReplyText('')
        await loadSolicitudChat(solicitudChat.id)
      }
    } finally {
      setSendingReply(false)
    }
  }

  const closeConversacion = () => {
    setSearchParams((p) => {
      p.delete('solicitud_chat')
      return p
    })
    setModalSolicitudId(null)
    setSolicitudChat(null)
  }

  const openConversacion = (id: number) => {
    setModalConversacionId(id)
  }

  const closeConversacionDetalle = () => {
    setSearchParams((p) => {
      p.delete('conversacion')
      return p
    })
    setModalConversacionId(null)
    setConversacionDetalle(null)
    setReplyConversacionText('')
  }

  const sendReplyConversacion = async () => {
    if (!conversacionDetalle || !replyConversacionText.trim() || sendingReplyConversacion) return
    setSendingReplyConversacion(true)
    try {
      const res = await apiService.addRespuestaConversacionAtencion(conversacionDetalle.id, {
        autor: usuario?.nombre || 'Equipo',
        texto: replyConversacionText.trim()
      })
      if (res.success) {
        setReplyConversacionText('')
        await loadConversacionDetalle(conversacionDetalle.id)
      }
    } finally {
      setSendingReplyConversacion(false)
    }
  }

  const q = searchQuery.trim().toLowerCase()
  const { conversacionesHoy, conversacionesBiblioteca } = useMemo(() => {
    const hoy: Conversacion[] = []
    const bib: Conversacion[] = []
    for (const c of conversaciones) {
      const match = !q || (c.cliente_nombre || '').toLowerCase().includes(q) ||
        (c.cliente_email || '').toLowerCase().includes(q) ||
        (c.ultimo_mensaje_preview || '').toLowerCase().includes(q) ||
        (c.canal || '').toLowerCase().includes(q)
      if (!match) continue
      if (isToday(c.updated_at)) hoy.push(c)
      else bib.push(c)
    }
    hoy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    bib.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return { conversacionesHoy: hoy, conversacionesBiblioteca: bib }
  }, [conversaciones, q])

  const bibliotecaFiltrada = useMemo(() => {
    const qb = searchBiblioteca.trim().toLowerCase()
    if (!qb) return conversacionesBiblioteca
    return conversacionesBiblioteca.filter(
      (c) =>
        (c.cliente_nombre || '').toLowerCase().includes(qb) ||
        (c.cliente_email || '').toLowerCase().includes(qb) ||
        (c.ultimo_mensaje_preview || '').toLowerCase().includes(qb) ||
        (c.canal || '').toLowerCase().includes(qb)
    )
  }, [conversacionesBiblioteca, searchBiblioteca])

  const reclamosFiltrados = useMemo(() => {
    let list = reclamos
    const q = searchReclamos.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          (r.cliente_nombre || '').toLowerCase().includes(q) ||
          (r.cliente_email || '').toLowerCase().includes(q) ||
          (r.descripcion || '').toLowerCase().includes(q)
      )
    }
    if (filtroEstadoReclamos) {
      list = list.filter((r) => r.estado === filtroEstadoReclamos)
    }
    return list
  }, [reclamos, searchReclamos, filtroEstadoReclamos])

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
          <div className="atencion-publico-header-titulo">
            <span className="atencion-publico-header-icon">📞</span>
            <div>
              <h1>Atención al público</h1>
              <p className="atencion-publico-subtitle">
                Conversaciones del chat web, solicitudes de contacto y reclamos.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Modal: conversación, solicitud o código embed */}
      {(modalSolicitudId != null || modalConversacionId != null || modalEmbed) && (
        <div className="atencion-publico-modal-overlay" onClick={() => { if (modalEmbed) setModalEmbed(false); else if (modalSolicitudId) closeConversacion(); else closeConversacionDetalle(); }}>
          <div className="atencion-publico-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="atencion-publico-modal-close" onClick={() => { if (modalEmbed) setModalEmbed(false); else if (modalSolicitudId) closeConversacion(); else closeConversacionDetalle(); }} aria-label="Cerrar">✕</button>
            {modalEmbed && (
              <div className="atencion-publico-modal-embed">
                <h3>Código para incrustar en WordPress</h3>
                <p className="atencion-publico-embed-code-hint">Copiá el iframe y el script en la web de Plot Center (plotcenter.com.ar).</p>
                <p className="atencion-publico-embed-option-label"><strong>Opción 1 — Botón flotante (recomendado)</strong></p>
                <pre className="atencion-publico-pre">{`<iframe id="plotai-widget-iframe"
  src="https://plotrello.vercel.app/embed/chat-widget"
  title="Chat Plot Center"
  width="88"
  height="88"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999;"
></iframe>
<script>
(function() {
  var ORIGIN = 'https://plotrello.vercel.app';
  window.addEventListener('message', function(e) {
    if (e.origin !== ORIGIN || !e.data || e.data.type !== 'plotai-widget-resize') return;
    var iframe = document.getElementById('plotai-widget-iframe');
    if (iframe) { iframe.style.width = e.data.width + 'px'; iframe.style.height = e.data.height + 'px'; }
  });
})();
</script>`}</pre>
                <p className="atencion-publico-embed-option-label"><strong>Opción 2 — Chat en página</strong></p>
                <pre className="atencion-publico-pre">{`<iframe src="https://plotrello.vercel.app/embed/chat" title="Chat Plot Center" width="100%" height="500" style="border: none; border-radius: 8px;"></iframe>`}</pre>
              </div>
            )}
            {modalSolicitudId != null && !modalEmbed && (
              loadingSolicitud ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : solicitudChat ? (
                <>
                  <div className="atencion-publico-conversacion-header">
                    <div className="atencion-publico-conversacion-header-left">
                      <h2>💬 {solicitudChat.cliente_nombre || 'Cliente'}</h2>
                      <p className="atencion-publico-conversacion-meta">Solicitó <strong>{solicitudChat.sector_solicitado}</strong> · #{solicitudChat.id}</p>
                    </div>
                  </div>
                  <div className="atencion-publico-conversacion-mensajes">
                    {solicitudChat.historial_mensajes?.map((m, i) => (
                      <div key={i} className={`atencion-publico-msg atencion-publico-msg--${m.role}`}>
                        <span className="atencion-publico-msg-role">{m.role === 'user' ? 'Cliente' : 'PlotAI'}</span>
                        <p className="atencion-publico-msg-text">{m.text}</p>
                        {(m as any).imageDataUrl && (
                          <img
                            src={(m as any).imageDataUrl}
                            alt="Imagen enviada por el cliente"
                            className="atencion-publico-msg-image"
                          />
                        )}
                      </div>
                    ))}
                    {solicitudChat.respuestas_staff?.map((r, i) => (
                      <div key={`staff-${i}`} className="atencion-publico-msg atencion-publico-msg--staff">
                        <span className="atencion-publico-msg-role">{r.autor}</span>
                        <p className="atencion-publico-msg-text">{r.texto}</p>
                      </div>
                    ))}
                  </div>
                  <div className="atencion-publico-conversacion-reply">
                    <label className="atencion-publico-reply-label">Responder al cliente</label>
                    <textarea placeholder="Escribí tu respuesta..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="atencion-publico-reply-input" rows={3} disabled={sendingReply} />
                    <button type="button" className="atencion-publico-reply-send" onClick={sendReply} disabled={sendingReply || !replyText.trim()}>{sendingReply ? 'Enviando...' : 'Enviar'}</button>
                  </div>
                </>
              ) : (
                <div className="atencion-publico-empty"><p>Solicitud no encontrada.</p><button type="button" className="link-button" onClick={closeConversacion}>Cerrar</button></div>
              )
            )}
            {modalConversacionId != null && !modalEmbed && (
              loadingConversacion ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : conversacionDetalle ? (
                <>
                  <div className="atencion-publico-conversacion-header">
                    <div className="atencion-publico-conversacion-header-left">
                      <h2>💬 {conversacionDetalle.cliente_nombre || conversacionDetalle.cliente_email || 'Cliente'}</h2>
                      <p className="atencion-publico-conversacion-meta">{conversacionDetalle.canal} · {tiempoRelativo(conversacionDetalle.updated_at)}</p>
                    </div>
                  </div>
                  <div className="atencion-publico-conversacion-mensajes">
                    {conversacionDetalle.historial_mensajes?.map((m, i) => (
                      <div key={`h-${i}`} className={`atencion-publico-msg atencion-publico-msg--${m.role}`}>
                        <span className="atencion-publico-msg-role">{m.role === 'user' ? 'Cliente' : 'PlotAI'}</span>
                        <p className="atencion-publico-msg-text">{m.text}</p>
                        {(m as any).imageDataUrl && (
                          <img
                            src={(m as any).imageDataUrl}
                            alt="Imagen enviada por el cliente"
                            className="atencion-publico-msg-image"
                          />
                        )}
                      </div>
                    ))}
                    {conversacionDetalle.respuestas_staff?.map((r, i) => (
                      <div key={`s-${i}`} className="atencion-publico-msg atencion-publico-msg--staff">
                        <span className="atencion-publico-msg-role">{r.autor}</span>
                        <p className="atencion-publico-msg-text">{r.texto}</p>
                      </div>
                    ))}
                    {(!conversacionDetalle.historial_mensajes?.length && !conversacionDetalle.respuestas_staff?.length) && <p className="atencion-publico-empty">Sin mensajes.</p>}
                  </div>
                  <div className="atencion-publico-conversacion-reply">
                    <label className="atencion-publico-reply-label">Responder al cliente</label>
                    <textarea placeholder="Escribí tu respuesta..." value={replyConversacionText} onChange={(e) => setReplyConversacionText(e.target.value)} className="atencion-publico-reply-input" rows={3} disabled={sendingReplyConversacion} />
                    <button type="button" className="atencion-publico-reply-send" onClick={sendReplyConversacion} disabled={sendingReplyConversacion || !replyConversacionText.trim()}>{sendingReplyConversacion ? 'Enviando...' : 'Enviar'}</button>
                  </div>
                </>
              ) : (
                <div className="atencion-publico-empty"><p>Conversación no encontrada.</p><button type="button" className="link-button" onClick={closeConversacionDetalle}>Cerrar</button></div>
              )
            )}
          </div>
        </div>
      )}

      <div className="atencion-publico-container">
        {/* Primero: Mensajes y conversaciones */}
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
              <div className="atencion-publico-search-row">
                <input
                  type="search"
                  placeholder="Buscar por nombre, mensaje o canal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="atencion-publico-search"
                  aria-label="Buscar conversaciones"
                />
              </div>
              {loadingConv ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : conversaciones.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay conversaciones aún. Las charlas del chat web se guardan acá automáticamente.</p>
                </div>
              ) : (
                <>
                  {conversacionesHoy.length > 0 && (
                    <div className="atencion-publico-block">
                      <h4 className="atencion-publico-block-title">
                        <span className="atencion-publico-live-dot" aria-hidden /> Hoy
                      </h4>
                      <ul className="atencion-publico-list">
                        {conversacionesHoy.map((c) => (
                          <li
                            key={c.id}
                            className={`atencion-publico-list-item atencion-publico-list-item-clickable atencion-publico-list-item-live${(c.respuestas_staff?.length ?? 0) > 0 ? ' atencion-publico-list-item-staff' : ''}`}
                            onClick={() => openConversacion(c.id)}
                            onKeyDown={(e) => e.key === 'Enter' && openConversacion(c.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="atencion-publico-item-header">
                              <span className="atencion-publico-item-nombre">{c.cliente_nombre || c.cliente_email || 'Cliente web'}</span>
                              {!c.visto_por_staff_at && (
                                <span className="atencion-publico-badge atencion-publico-badge-no-leido" title="No abierto por el staff">
                                    ● No leído{mensajesSinLeer(c) > 0 ? ` (${mensajesSinLeer(c)})` : ''}
                                  </span>
                              )}
                              {clienteEnLinea(c.updated_at) && (
                                <span className="atencion-publico-badge atencion-publico-badge-online" title="Cliente activo recientemente">En línea</span>
                              )}
                              {c.visto_por_staff_at && (
                                <span className={`atencion-publico-badge atencion-publico-badge-${c.estado}`}>{estadoLabel(c.estado)}</span>
                              )}
                              <span className="atencion-publico-item-time">{tiempoRelativo(c.updated_at)}</span>
                            </div>
                            {c.ultimo_mensaje_preview && (
                              <p className="atencion-publico-item-preview">{c.ultimo_mensaje_preview}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {conversacionesBiblioteca.length > 0 && (
                    <div className="atencion-publico-block atencion-publico-block-biblioteca">
                      <button
                        type="button"
                        className="atencion-publico-block-title atencion-publico-block-title-toggle"
                        onClick={() => setBibliotecaAbierta((b) => !b)}
                        aria-expanded={bibliotecaAbierta}
                        aria-controls="atencion-publico-biblioteca-content"
                      >
                        <span className="atencion-publico-block-title-chevron" aria-hidden>
                          {bibliotecaAbierta ? '▼' : '▶'}
                        </span>
                        Biblioteca de conversaciones
                        <span className="atencion-publico-block-count">({conversacionesBiblioteca.length})</span>
                      </button>
                      <div id="atencion-publico-biblioteca-content" className="atencion-publico-biblioteca-content" hidden={!bibliotecaAbierta}>
                        <div className="atencion-publico-search-row atencion-publico-biblioteca-search">
                          <input
                            type="search"
                            placeholder="Buscar en la biblioteca..."
                            value={searchBiblioteca}
                            onChange={(e) => setSearchBiblioteca(e.target.value)}
                            className="atencion-publico-search"
                            aria-label="Buscar en biblioteca"
                          />
                        </div>
                        <ul className="atencion-publico-list">
                          {bibliotecaFiltrada.map((c) => (
                            <li
                              key={c.id}
                              className={`atencion-publico-list-item atencion-publico-list-item-clickable${(c.respuestas_staff?.length ?? 0) > 0 ? ' atencion-publico-list-item-staff' : ''}`}
                              onClick={() => openConversacion(c.id)}
                              onKeyDown={(e) => e.key === 'Enter' && openConversacion(c.id)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="atencion-publico-item-header">
                                <span className="atencion-publico-item-nombre">{c.cliente_nombre || c.cliente_email || 'Cliente web'}</span>
                                {!c.visto_por_staff_at && (
                                  <span className="atencion-publico-badge atencion-publico-badge-no-leido" title="No abierto por el staff">
                                    ● No leído{mensajesSinLeer(c) > 0 ? ` (${mensajesSinLeer(c)})` : ''}
                                  </span>
                                )}
                                {clienteEnLinea(c.updated_at) && (
                                  <span className="atencion-publico-badge atencion-publico-badge-online" title="Cliente activo recientemente">En línea</span>
                                )}
                                {c.visto_por_staff_at && (
                                  <span className={`atencion-publico-badge atencion-publico-badge-${c.estado}`}>{estadoLabel(c.estado)}</span>
                                )}
                                <span className="atencion-publico-item-time">{tiempoRelativo(c.updated_at)}</span>
                              </div>
                              {c.ultimo_mensaje_preview && (
                                <p className="atencion-publico-item-preview">{c.ultimo_mensaje_preview}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                        {bibliotecaFiltrada.length === 0 && (
                          <p className="atencion-publico-empty">Ningún resultado para &quot;{searchBiblioteca}&quot;.</p>
                        )}
                      </div>
                    </div>
                  )}
                  {conversacionesHoy.length === 0 && conversacionesBiblioteca.length === 0 && (
                    <div className="atencion-publico-empty">
                      <p>No hay resultados para &quot;{searchQuery}&quot;.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'reclamos' && (
            <div className="atencion-publico-content atencion-publico-reclamos-dark">
              <div className="atencion-publico-reclamos-header">
                <h3>Reclamos</h3>
                <button type="button" className="btn-primary" onClick={() => setShowCrearReclamo(true)}>
                  ➕ Crear reclamo
                </button>
              </div>
              <div className="atencion-publico-search-row">
                <input
                  type="search"
                  placeholder="Buscar por cliente o descripción..."
                  value={searchReclamos}
                  onChange={(e) => setSearchReclamos(e.target.value)}
                  className="atencion-publico-search"
                  aria-label="Buscar reclamos"
                />
                <select
                  value={filtroEstadoReclamos}
                  onChange={(e) => setFiltroEstadoReclamos(e.target.value)}
                  className="atencion-publico-filter-select"
                  aria-label="Filtrar por estado"
                >
                  <option value="">Todos los estados</option>
                  <option value="nuevo">Nuevo</option>
                  <option value="abierto">Abierto</option>
                  <option value="en_curso">En curso</option>
                  <option value="en_revision">En revisión</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              {loadingReclamos ? (
                <div className="atencion-publico-loading">Cargando...</div>
              ) : reclamos.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay reclamos registrados.</p>
                </div>
              ) : reclamosFiltrados.length === 0 ? (
                <div className="atencion-publico-empty">
                  <p>No hay resultados para la búsqueda.</p>
                </div>
              ) : (
                <ul className="atencion-publico-list">
                  {reclamosFiltrados.map((r) => (
                    <li
                      key={r.id}
                      className="atencion-publico-list-item atencion-publico-list-item-clickable"
                      onClick={() => {
                        setModalReclamoEditar(r)
                        setReclamoEditForm({ estado: r.estado, prioridad: r.prioridad, notas_internas: r.notas_internas || '', usuario_asignado_id: r.usuario_asignado_id ?? null, sector_id: r.sector_id ?? null })
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && (setModalReclamoEditar(r), setReclamoEditForm({ estado: r.estado, prioridad: r.prioridad, notas_internas: r.notas_internas || '', usuario_asignado_id: r.usuario_asignado_id ?? null, sector_id: r.sector_id ?? null }))}
                    >
                      <div className="atencion-publico-item-header">
                        <span className="atencion-publico-item-nombre">{r.cliente_nombre || r.cliente_email || 'Sin nombre'}</span>
                        <span className={`atencion-publico-badge atencion-publico-badge-${r.estado}`}>{estadoLabel(r.estado)}</span>
                        <span className={`atencion-publico-badge atencion-publico-prioridad-${r.prioridad}`}>{r.prioridad}</span>
                      </div>
                      <p className="atencion-publico-item-desc">{r.descripcion}</p>
                      {r.sector_id && (
                        <p className="atencion-publico-item-asignado">🏭 Sector: {sectores.find((s) => s.id === r.sector_id)?.nombre ?? `#${r.sector_id}`}</p>
                      )}
                      {r.usuario_asignado_id && (
                        <p className="atencion-publico-item-asignado">👤 Asignado a: {usuarios.find((u) => u.id === r.usuario_asignado_id)?.nombre ?? `#${r.usuario_asignado_id}`}</p>
                      )}
                      {r.notas_internas && (
                        <p className="atencion-publico-item-notas">📝 {r.notas_internas}</p>
                      )}
                      <div className="atencion-publico-item-meta">{formatFecha(r.updated_at)} · Clic para editar</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Al final: Chat con IA y código del widget (abre en modal) */}
        <section className="atencion-publico-chat-ia atencion-publico-chat-ia-footer">
          <h2>🤖 Chat con IA en la web</h2>
          <p>El chat para clientes está en <a href="https://plotcenter.com.ar/" target="_blank" rel="noopener noreferrer">plotcenter.com.ar</a>. El cliente puede decir su <strong>nombre o empresa</strong> y la IA busca sus trabajos.</p>
          <div className="atencion-publico-embed-actions">
            <a href="/embed/chat" target="_blank" rel="noopener noreferrer" className="atencion-publico-card atencion-publico-card-chat atencion-publico-card-link">
              <span className="atencion-publico-card-icon">🌐</span>
              <div className="atencion-publico-card-body">
                <h3>Vista previa del chat público</h3>
                <p>Abrir en nueva pestaña.</p>
              </div>
            </a>
            <button type="button" className="atencion-publico-card atencion-publico-card-chat" onClick={() => navigate('/chat')}>
              <span className="atencion-publico-card-icon">💬</span>
              <div className="atencion-publico-card-body">
                <h3>Chat del equipo</h3>
                <p>@plotai o /plotai en el chat interno.</p>
              </div>
            </button>
            <button type="button" className="atencion-publico-card atencion-publico-card-chat atencion-publico-card-embed" onClick={() => setModalEmbed(true)}>
              <span className="atencion-publico-card-icon">📋</span>
              <div className="atencion-publico-card-body">
                <h3>Ver código del widget</h3>
                <p>Iframe y script para WordPress.</p>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Modal editar reclamo */}
      {modalReclamoEditar && (
        <div className="atencion-publico-modal-overlay atencion-publico-modal-dark" onClick={() => setModalReclamoEditar(null)}>
          <div className="atencion-publico-modal atencion-publico-modal-dark" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="atencion-publico-modal-close" onClick={() => setModalReclamoEditar(null)} aria-label="Cerrar">✕</button>
            <h3>Editar reclamo #{modalReclamoEditar.id}</h3>
            <p className="atencion-publico-item-desc">{modalReclamoEditar.descripcion}</p>
            <div className="atencion-publico-form-group">
              <label>Estado</label>
              <select
                value={reclamoEditForm.estado}
                onChange={(e) => setReclamoEditForm((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="nuevo">Nuevo</option>
                <option value="abierto">Abierto</option>
                <option value="en_curso">En curso</option>
                <option value="en_revision">En revisión</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div className="atencion-publico-form-group">
              <label>Prioridad</label>
              <select
                value={reclamoEditForm.prioridad}
                onChange={(e) => setReclamoEditForm((f) => ({ ...f, prioridad: e.target.value }))}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="atencion-publico-form-group">
              <label>Enviar al sector</label>
              <select
                value={reclamoEditForm.sector_id ?? ''}
                onChange={(e) => setReclamoEditForm((f) => ({ ...f, sector_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Sin sector</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div className="atencion-publico-form-group">
              <label>Asignar a</label>
              <select
                value={reclamoEditForm.usuario_asignado_id ?? ''}
                onChange={(e) => setReclamoEditForm((f) => ({ ...f, usuario_asignado_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Sin asignar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
            <div className="atencion-publico-form-group">
              <label>Notas internas</label>
              <textarea
                value={reclamoEditForm.notas_internas}
                onChange={(e) => setReclamoEditForm((f) => ({ ...f, notas_internas: e.target.value }))}
                rows={3}
                placeholder="Notas para el equipo..."
              />
            </div>
            <div className="atencion-publico-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalReclamoEditar(null)}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const res = await apiService.updateReclamoAtencion(modalReclamoEditar.id, {
                    estado: reclamoEditForm.estado,
                    prioridad: reclamoEditForm.prioridad,
                    sector_id: reclamoEditForm.sector_id,
                    usuario_asignado_id: reclamoEditForm.usuario_asignado_id,
                    notas_internas: reclamoEditForm.notas_internas || null
                  })
                  if (res.success) {
                    await loadReclamos()
                    setModalReclamoEditar(null)
                  } else {
                    alert(res.error || 'Error al actualizar')
                  }
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear reclamo */}
      {showCrearReclamo && (
        <div className="atencion-publico-modal-overlay atencion-publico-modal-dark" onClick={() => setShowCrearReclamo(false)}>
          <div className="atencion-publico-modal atencion-publico-modal-dark" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="atencion-publico-modal-close" onClick={() => setShowCrearReclamo(false)} aria-label="Cerrar">✕</button>
            <h3>Crear reclamo</h3>
            <div className="atencion-publico-form-group">
              <label>Cliente (opcional)</label>
              <input
                type="text"
                value={nuevoReclamoForm.cliente_nombre}
                onChange={(e) => setNuevoReclamoForm((f) => ({ ...f, cliente_nombre: e.target.value }))}
                placeholder="Nombre del cliente"
              />
            </div>
            <div className="atencion-publico-form-group">
              <label>Email (opcional)</label>
              <input
                type="email"
                value={nuevoReclamoForm.cliente_email}
                onChange={(e) => setNuevoReclamoForm((f) => ({ ...f, cliente_email: e.target.value }))}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="atencion-publico-form-group">
              <label>Descripción *</label>
              <textarea
                value={nuevoReclamoForm.descripcion}
                onChange={(e) => setNuevoReclamoForm((f) => ({ ...f, descripcion: e.target.value }))}
                rows={4}
                placeholder="Describí el reclamo..."
                required
              />
            </div>
            <div className="atencion-publico-form-group">
              <label>Prioridad</label>
              <select
                value={nuevoReclamoForm.prioridad}
                onChange={(e) => setNuevoReclamoForm((f) => ({ ...f, prioridad: e.target.value }))}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="atencion-publico-form-group">
              <label>Enviar al sector</label>
              <select
                value={nuevoReclamoForm.sector_id ?? ''}
                onChange={(e) => setNuevoReclamoForm((f) => ({ ...f, sector_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Sin sector</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div className="atencion-publico-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowCrearReclamo(false)}>Cancelar</button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  if (!nuevoReclamoForm.descripcion.trim()) {
                    alert('La descripción es obligatoria')
                    return
                  }
                  const res = await apiService.crearReclamoAtencion({
                    cliente_nombre: nuevoReclamoForm.cliente_nombre || null,
                    cliente_email: nuevoReclamoForm.cliente_email || null,
                    descripcion: nuevoReclamoForm.descripcion.trim(),
                    prioridad: nuevoReclamoForm.prioridad,
                    sector_id: nuevoReclamoForm.sector_id,
                    estado: 'nuevo'
                  })
                  if (res.success) {
                    await loadReclamos()
                    setShowCrearReclamo(false)
                    setNuevoReclamoForm({ cliente_nombre: '', cliente_email: '', descripcion: '', prioridad: 'media', sector_id: null })
                  } else {
                    alert(res.error || 'Error al crear reclamo')
                  }
                }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AtencionPublicoDashboardPage
