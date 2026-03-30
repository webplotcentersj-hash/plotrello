import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RrhhMessagingCenter.css'

type ThreadMsg = {
  id: number
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  timestamp: string
}

type RrhhMessagingCenterProps = {
  usuarios: UsuarioRecord[]
  currentUserId: number
  currentUserName: string
}

const RrhhMessagingCenter = ({ usuarios, currentUserId, currentUserName }: RrhhMessagingCenterProps) => {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [roomId, setRoomId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ThreadMsg[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const peers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = usuarios.filter((u) => u.id !== currentUserId)
    if (!q) return list
    return list.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        u.rol.toLowerCase().includes(q)
    )
  }, [usuarios, currentUserId, search])

  const selectedUser = useMemo(
    () => (selectedId != null ? usuarios.find((u) => u.id === selectedId) : undefined),
    [usuarios, selectedId]
  )

  const loadMessages = useCallback(
    async (rid: number) => {
      const res = await apiService.getMensajesPorRoomId(rid, 100)
      if (res.success && res.data) {
        setMessages(res.data)
      } else {
        setError(res.error || 'No se pudieron cargar los mensajes')
      }
    },
    []
  )

  useEffect(() => {
    if (selectedId == null) {
      setRoomId(null)
      setMessages([])
      return
    }

    let cancelled = false
    const run = async () => {
      setLoadingThread(true)
      setError(null)
      const roomRes = await apiService.obtenerOCrearRoomDm(currentUserId, selectedId)
      if (cancelled) return
      if (!roomRes.success || !roomRes.data) {
        setError(roomRes.error || 'No se pudo abrir la conversación')
        setLoadingThread(false)
        return
      }
      setRoomId(roomRes.data.roomId)
      await loadMessages(roomRes.data.roomId)
      if (!cancelled) setLoadingThread(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedId, currentUserId, loadMessages])

  useEffect(() => {
    if (selectedId == null || roomId == null) return
    const t = window.setInterval(() => {
      void loadMessages(roomId)
    }, 12000)
    return () => window.clearInterval(t)
  }, [selectedId, roomId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || roomId == null || sending) return
    setSending(true)
    setError(null)
    const res = await apiService.enviarMensajeDm({
      roomId,
      contenido: text,
      usuarioId: currentUserId
    })
    setSending(false)
    if (res.success && res.data) {
      setDraft('')
      setMessages((prev) => [...prev, res.data!])
    } else {
      setError(res.error || 'No se pudo enviar')
    }
  }

  return (
    <section className="rrhh-msg" aria-label="Mensajería interna RRHH, distinta del chat general">
      <div className="rrhh-msg-header">
        <div>
          <h2 className="rrhh-msg-title">Mensajería RRHH</h2>
          <p className="rrhh-msg-sub">
            Comunicación <strong>1 a 1</strong> con cada usuario del sistema ({peers.length} contactos). No es el{' '}
            <strong>Chat general</strong> (canales tipo #general). Sesión: <strong>{currentUserName}</strong>
          </p>
        </div>
      </div>

      <p className="rrhh-msg-notice" role="note">
        Uso: avisos, seguimiento y mensajes privados desde Recursos Humanos. La conversación es{' '}
        <strong>bidireccional</strong>: el otro usuario puede responderte en el mismo hilo. El chat grupal del
        tablero sigue en <strong>Chat</strong> en el menú principal.
      </p>

      <div className="rrhh-msg-layout">
        <aside className="rrhh-msg-sidebar">
          <input
            type="search"
            className="rrhh-msg-search"
            placeholder="Buscar por nombre, rol o ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filtrar usuarios"
          />
          <ul className="rrhh-msg-user-list">
            {peers.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className={`rrhh-msg-user-btn ${selectedId === u.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <span className="rrhh-msg-user-name">{u.nombre}</span>
                  <span className="rrhh-msg-user-meta">
                    {u.rol} · #{u.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {peers.length === 0 && (
            <p className="rrhh-msg-empty-sidebar">No hay usuarios para mostrar.</p>
          )}
        </aside>

        <div className="rrhh-msg-main">
          {selectedId == null && (
            <div className="rrhh-msg-placeholder">
              <p>Elegí un usuario para abrir la conversación de mensajería.</p>
            </div>
          )}

          {selectedId != null && selectedUser && (
            <>
              <div className="rrhh-msg-thread-head">
                <div>
                  <strong>{selectedUser.nombre}</strong>
                  <span className="rrhh-msg-thread-meta">{selectedUser.rol}</span>
                </div>
                <span className="rrhh-msg-thread-badge">Mensajería · no es chat general</span>
              </div>

              {error && (
                <div className="rrhh-msg-error" role="alert">
                  {error}
                </div>
              )}

              <div className="rrhh-msg-thread">
                {loadingThread ? (
                  <p className="rrhh-msg-loading">Cargando mensajes…</p>
                ) : (
                  <ul className="rrhh-msg-bubbles">
                    {messages.map((m) => {
                      const mine = m.usuario_id === currentUserId
                      return (
                        <li
                          key={m.id}
                          className={`rrhh-msg-bubble ${mine ? 'is-mine' : 'is-theirs'}`}
                        >
                          {!mine && (
                            <span className="rrhh-msg-bubble-author">{m.nombre_usuario || 'Usuario'}</span>
                          )}
                          <span className="rrhh-msg-bubble-text">{m.contenido}</span>
                          <time className="rrhh-msg-bubble-time" dateTime={m.timestamp}>
                            {new Date(m.timestamp).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: 'short',
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

              <div className="rrhh-msg-compose">
                <textarea
                  className="rrhh-msg-input"
                  rows={2}
                  placeholder="Escribí un mensaje interno (mensajería RRHH)…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  disabled={loadingThread || roomId == null}
                />
                <button
                  type="button"
                  className="rrhh-msg-send"
                  onClick={() => void handleSend()}
                  disabled={sending || !draft.trim() || roomId == null}
                >
                  {sending ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default RrhhMessagingCenter
