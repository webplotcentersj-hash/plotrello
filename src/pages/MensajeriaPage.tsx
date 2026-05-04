import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../hooks/useAuth'
import { dispatchMensajeriaDmUnreadRefresh } from '../hooks/useDmMensajeriaUnread'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './MensajeriaPage.css'

type ThreadMsg = {
  id: number
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  timestamp: string
}

type DmRoom = { id: number; nombre: string; created_at?: string }

const parseDmPeerId = (roomNombre: string, currentUserId: number): number | null => {
  const m = String(roomNombre).match(/^dm:(\d+):(\d+)$/)
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return a === currentUserId ? b : b === currentUserId ? a : null
}

type MensajeriaPageProps = {
  onLogout: () => void
}

export default function MensajeriaPage({ onLogout }: MensajeriaPageProps) {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [rooms, setRooms] = useState<DmRoom[]>([])
  const [unreadByRoomId, setUnreadByRoomId] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ThreadMsg[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [openingPeerId, setOpeningPeerId] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentUserId = usuario?.id ?? null

  const peers = useMemo(() => {
    if (currentUserId == null) return []
    const byId = new Map<number, UsuarioRecord>()
    for (const u of usuarios) byId.set(u.id, u)
    return rooms
      .map((r) => {
        const peerId = parseDmPeerId(r.nombre, currentUserId)
        return peerId != null ? { room: r, peer: byId.get(peerId), peerId } : null
      })
      .filter(Boolean) as Array<{ room: DmRoom; peer?: UsuarioRecord; peerId: number }>
  }, [rooms, usuarios, currentUserId])

  const selected = useMemo(() => peers.find((p) => p.room.id === selectedRoomId) || null, [peers, selectedRoomId])

  const loadIndex = async (opts?: { silent?: boolean }) => {
    if (!usuario) return
    const silent = opts?.silent ?? false
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    const [uRes, rRes] = await Promise.all([
      apiService.getUsuarios(),
      apiService.listarRoomsDmParaUsuario(usuario.id, 250)
    ])
    if (uRes.success && uRes.data) setUsuarios(uRes.data)
    if (rRes.success && rRes.data) {
      const nextRooms = rRes.data as DmRoom[]
      setRooms(nextRooms)
      const roomIds = nextRooms.map((r) => r.id)
      const unreadRes = await apiService.contarNoLeidosPorRooms(usuario.id, roomIds)
      if (unreadRes.success && unreadRes.data) setUnreadByRoomId(unreadRes.data)
    }
    if (!silent && ((!uRes.success && uRes.error) || (!rRes.success && rRes.error))) {
      setError(uRes.error || rRes.error || 'No se pudo cargar mensajería')
    }
    if (!silent) setLoading(false)
    dispatchMensajeriaDmUnreadRefresh()
  }

  const searchRecipients = useMemo(() => {
    if (!usuario || !canManageRecursosHumanos) return []
    const q = recipientSearch.trim().toLowerCase()
    const list = usuarios.filter((u) => u.id !== usuario.id)
    if (!q) return list
    return list.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        u.rol.toLowerCase().includes(q)
    )
  }, [usuarios, usuario, canManageRecursosHumanos, recipientSearch])

  const openConversationWithPeer = async (peerId: number) => {
    if (!usuario || openingPeerId != null) return
    setOpeningPeerId(peerId)
    setError(null)
    const res = await apiService.obtenerOCrearRoomDm(usuario.id, peerId)
    setOpeningPeerId(null)
    if (!res.success || !res.data) {
      setError(res.error || 'No se pudo abrir la conversación')
      return
    }
    setSelectedRoomId(res.data.roomId)
    setRecipientSearch('')
    await loadIndex({ silent: true })
  }

  const loadThread = async (roomId: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false
    if (!silent) {
      setLoadingThread(true)
      setError(null)
    }
    const res = await apiService.getMensajesPorRoomId(roomId, 120)
    if (res.success && res.data) {
      setMessages(res.data as ThreadMsg[])
    } else if (!silent) {
      setMessages([])
      setError(res.error || 'No se pudieron cargar los mensajes')
    }
    if (!silent) setLoadingThread(false)
  }

  useEffect(() => {
    if (!usuario) return
    void loadIndex()
  }, [usuario?.id])

  useEffect(() => {
    if (selectedRoomId == null) {
      setMessages([])
      return
    }
    void loadThread(selectedRoomId)
  }, [selectedRoomId])

  useEffect(() => {
    if (selectedRoomId == null) return
    const t = window.setInterval(() => void loadThread(selectedRoomId, { silent: true }), 12000)
    return () => window.clearInterval(t)
  }, [selectedRoomId])

  useEffect(() => {
    if (!usuario || selectedRoomId == null) return
    // Al abrir una conversación, marcar como leída y refrescar badges.
    void (async () => {
      await apiService.marcarChatLeido(`dm:${selectedRoomId}`, usuario.id)
      const roomIds = rooms.map((r) => r.id)
      const unreadRes = await apiService.contarNoLeidosPorRooms(usuario.id, roomIds)
      if (unreadRes.success && unreadRes.data) setUnreadByRoomId(unreadRes.data)
      dispatchMensajeriaDmUnreadRefresh()
    })()
  }, [usuario?.id, selectedRoomId, rooms])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!usuario || selectedRoomId == null) return
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const res = await apiService.enviarMensajeDm({ roomId: selectedRoomId, contenido: text, usuarioId: usuario.id })
    setSending(false)
    if (res.success && res.data) {
      setDraft('')
      setMessages((prev) => [...prev, res.data as any])
      // refrescar lista (por si se crean rooms en otro lado)
      void loadIndex()
    } else {
      setError(res.error || 'No se pudo enviar')
    }
  }

  if (!usuario) {
    return (
      <div className="mensajeria-page">
        <div className="mensajeria-wrap">
          <h1>Mensajería</h1>
          <p>Iniciá sesión para ver tus mensajes.</p>
          <button type="button" className="mensajeria-btn" onClick={() => navigate('/')}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mensajeria-page">
      <Header
        teamMembers={[]}
        activity={[]}
        onNavigateToChat={() => navigate('/chat')}
        onNavigateToMensajeria={() => navigate('/mensajeria')}
        onNavigateToStats={() => navigate('/statistics')}
        onNavigateToUsuarios={() => navigate('/usuarios')}
        onNavigateToRecursosHumanos={() => navigate('/rrhh/dashboard')}
        onLogout={onLogout}
      />

      <div className="mensajeria-wrap">
        <header className="mensajeria-head">
          <div>
            <h1>Mensajería interna</h1>
            <p>
              Tus conversaciones privadas con RRHH/Administración y otros usuarios. Se guarda fecha y hora de cada mensaje.
            </p>
          </div>
          <button type="button" className="mensajeria-btn mensajeria-btn-ghost" onClick={() => navigate('/')}>
            ← Tablero
          </button>
        </header>

        {error && (
          <div className="mensajeria-error" role="alert">
            {error}
          </div>
        )}

        <div className="mensajeria-layout">
          <aside className="mensajeria-sidebar">
            {canManageRecursosHumanos && (
              <div className="mensajeria-recipient-search">
                <label className="mensajeria-search-label" htmlFor="mensajeria-buscar-dest">
                  Buscar destinatario
                </label>
                <input
                  id="mensajeria-buscar-dest"
                  type="search"
                  className="mensajeria-search-input"
                  placeholder="Nombre, rol o ID…"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  autoComplete="off"
                  aria-label="Buscar usuario para escribirle"
                />
                <ul className="mensajeria-search-results" role="listbox" aria-label="Resultados de búsqueda">
                  {searchRecipients.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="mensajeria-search-pick"
                        role="option"
                        disabled={openingPeerId != null}
                        onClick={() => void openConversationWithPeer(u.id)}
                      >
                        <span className="mensajeria-search-pick-name">
                          {openingPeerId === u.id ? 'Abriendo…' : u.nombre}
                        </span>
                        <span className="mensajeria-search-pick-meta">
                          {u.rol} · #{u.id}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {recipientSearch.trim() && searchRecipients.length === 0 && (
                  <p className="mensajeria-search-empty">Sin coincidencias.</p>
                )}
              </div>
            )}

            <div className="mensajeria-sidebar-head">
              <strong>Conversaciones</strong>
              <button type="button" className="mensajeria-link" onClick={() => void loadIndex()}>
                Actualizar
              </button>
            </div>
            {loading ? (
              <p className="mensajeria-muted">Cargando…</p>
            ) : peers.length === 0 ? (
              <p className="mensajeria-muted">
                {canManageRecursosHumanos
                  ? 'Buscar arriba un destinatario para abrir el chat, o esperá a que alguien te escriba.'
                  : 'Todavía no tenés conversaciones. RRHH/Administración pueden iniciarlas desde el panel de RRHH o mensajería.'}
              </p>
            ) : (
              <ul className="mensajeria-list">
                {peers.map(({ room, peer, peerId }) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      className={`mensajeria-peer ${selectedRoomId === room.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      <span className="mensajeria-peer-name">{peer?.nombre || `Usuario #${peerId}`}</span>
                      <span className="mensajeria-peer-meta">
                        {peer?.rol || '—'}
                        {Number(unreadByRoomId[room.id] || 0) > 0 && (
                          <span className="mensajeria-unread" aria-label="Mensajes no leídos">
                            {unreadByRoomId[room.id]}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <main className="mensajeria-main">
            {selectedRoomId == null ? (
              <div className="mensajeria-empty">
                <p>Elegí una conversación para ver los mensajes.</p>
              </div>
            ) : (
              <>
                <div className="mensajeria-thread-head">
                  <div>
                    <strong>{selected?.peer?.nombre || 'Conversación'}</strong>
                    <span className="mensajeria-thread-meta">{selected?.peer?.rol || ''}</span>
                  </div>
                </div>

                <div className="mensajeria-thread">
                  {loadingThread ? (
                    <p className="mensajeria-muted">Cargando mensajes…</p>
                  ) : (
                    <ul className="mensajeria-bubbles">
                      {messages.map((m) => {
                        const mine = m.usuario_id === usuario.id
                        return (
                          <li key={m.id} className={`mensajeria-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
                            {!mine && <span className="mensajeria-author">{m.nombre_usuario || 'Usuario'}</span>}
                            <span className="mensajeria-text">{m.contenido}</span>
                            <time className="mensajeria-time" dateTime={m.timestamp}>
                              {new Date(m.timestamp).toLocaleString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </time>
                          </li>
                        )
                      })}
                      <div ref={bottomRef} />
                    </ul>
                  )}
                </div>

                <div className="mensajeria-compose">
                  <textarea
                    className="mensajeria-input"
                    rows={2}
                    placeholder="Escribí tu respuesta…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    disabled={selectedRoomId == null}
                  />
                  <button
                    type="button"
                    className="mensajeria-btn"
                    onClick={() => void handleSend()}
                    disabled={sending || !draft.trim() || selectedRoomId == null}
                  >
                    {sending ? 'Enviando…' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

