import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../hooks/useAuth'
import { dispatchMensajeriaDmUnreadRefresh } from '../hooks/useDmMensajeriaUnread'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import {
  avatarHue,
  downloadFileFromUrl,
  downloadProofJson,
  fileNameFromUrl,
  formatDayDivider,
  formatMessageTime,
  isImageUrl,
  userInitials
} from '../utils/mensajeriaHelpers'
import './MensajeriaPage.css'

type DmRoom = { id: number; nombre: string; created_at?: string }

type ThreadMsg = {
  id: number
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  timestamp: string
  archivos_urls?: string[]
}

type PendingAttachment = {
  id: string
  file: File
  uploading?: boolean
}

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

const MESSAGES_PAGE_SIZE = 5

const toThreadMsg = (m: {
  id: number
  usuario_id: number
  nombre_usuario?: string
  contenido: string
  timestamp: string
  archivos_urls?: string[]
}): ThreadMsg => ({
  id: m.id,
  usuario_id: m.usuario_id,
  nombre_usuario: m.nombre_usuario,
  contenido: m.contenido,
  timestamp: m.timestamp,
  archivos_urls: m.archivos_urls
})

export default function MensajeriaPage({ onLogout }: MensajeriaPageProps) {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [rooms, setRooms] = useState<DmRoom[]>([])
  const [unreadByRoomId, setUnreadByRoomId] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ThreadMsg[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [openingPeerId, setOpeningPeerId] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  const [proofLoadingId, setProofLoadingId] = useState<number | null>(null)
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<HTMLUListElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stickToBottomRef = useRef(true)
  const messagesRef = useRef<ThreadMsg[]>([])

  const currentUserId = usuario?.id ?? null

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 4000)
  }

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
    if (!usuario) return []
    const q = recipientSearch.trim().toLowerCase()
    const list = usuarios.filter((u) => u.id !== usuario.id)
    if (!q) return list.slice(0, 12)
    return list.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        String(u.id).includes(q) ||
        u.rol.toLowerCase().includes(q)
    )
  }, [usuarios, usuario, recipientSearch])

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
    setShowNewChat(false)
    stickToBottomRef.current = true
    await loadIndex({ silent: true })
  }

  const loadThread = useCallback(async (roomId: number) => {
    setLoadingThread(true)
    setError(null)
    setHasMoreOlder(false)
    const res = await apiService.getMensajesPorRoomIdPaginated(roomId, MESSAGES_PAGE_SIZE)
    if (res.success && res.data) {
      setMessages(res.data.messages.map(toThreadMsg))
      setHasMoreOlder(res.data.hasMore)
    } else {
      setMessages([])
      setError(res.error || 'No se pudieron cargar los mensajes')
    }
    setLoadingThread(false)
  }, [])

  const loadOlderMessages = async () => {
    if (!selectedRoomId || loadingOlder || !hasMoreOlder || messages.length === 0) return
    const el = bubblesRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0

    setLoadingOlder(true)
    const res = await apiService.getMensajesPorRoomIdPaginated(selectedRoomId, MESSAGES_PAGE_SIZE, {
      beforeId: messages[0].id
    })
    setLoadingOlder(false)

    if (res.success && res.data) {
      setHasMoreOlder(res.data.hasMore)
      setMessages((prev) => [...res.data!.messages.map(toThreadMsg), ...prev])
      stickToBottomRef.current = false
      requestAnimationFrame(() => {
        if (!el) return
        el.scrollTop = el.scrollHeight - prevScrollHeight
      })
    } else {
      setError(res.error || 'No se pudieron cargar mensajes anteriores')
    }
  }

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const pollNewMessages = useCallback(async (roomId: number) => {
    const current = messagesRef.current
    const lastId = current[current.length - 1]?.id
    if (lastId == null) {
      const res = await apiService.getMensajesPorRoomIdPaginated(roomId, MESSAGES_PAGE_SIZE)
      if (res.success && res.data) {
        setMessages(res.data.messages.map(toThreadMsg))
        setHasMoreOlder(res.data.hasMore)
      }
      return
    }

    const res = await apiService.getMensajesNuevosPorRoomId(roomId, lastId)
    if (!res.success || !res.data?.length) return

    const incoming = res.data.map(toThreadMsg)
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id))
      const novel = incoming.filter((m) => !ids.has(m.id))
      return novel.length > 0 ? [...prev, ...novel] : prev
    })
  }, [])

  useEffect(() => {
    if (!usuario) return
    void loadIndex()
  }, [usuario?.id])

  useEffect(() => {
    if (selectedRoomId == null) {
      setMessages([])
      setHasMoreOlder(false)
      return
    }
    stickToBottomRef.current = true
    void loadThread(selectedRoomId)
  }, [selectedRoomId, loadThread])

  useEffect(() => {
    if (selectedRoomId == null) return
    const t = window.setInterval(() => void pollNewMessages(selectedRoomId), 12000)
    return () => window.clearInterval(t)
  }, [selectedRoomId, pollNewMessages])

  useEffect(() => {
    if (!usuario || selectedRoomId == null) return
    void (async () => {
      await apiService.marcarChatLeido(`dm:${selectedRoomId}`, usuario.id)
      const roomIds = rooms.map((r) => r.id)
      const unreadRes = await apiService.contarNoLeidosPorRooms(usuario.id, roomIds)
      if (unreadRes.success && unreadRes.data) setUnreadByRoomId(unreadRes.data)
      dispatchMensajeriaDmUnreadRefresh()
    })()
  }, [usuario?.id, selectedRoomId, rooms])

  const handleBubblesScroll = () => {
    const el = bubblesRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distance < 80
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handlePickFiles = (files: FileList | null) => {
    if (!files?.length) return
    const next: PendingAttachment[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 6)}`,
      file
    }))
    setPendingFiles((prev) => [...prev, ...next])
  }

  const handleSend = async () => {
    if (!usuario || selectedRoomId == null) return
    const text = draft.trim()
    if ((!text && pendingFiles.length === 0) || sending) return

    setSending(true)
    setError(null)
    const uploadedUrls: string[] = []

    try {
      for (const item of pendingFiles) {
        setPendingFiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, uploading: true } : p)))
        const url = await uploadAttachmentAndGetUrl(item.file, 'mensajeria-dm')
        uploadedUrls.push(url)
      }

      let contenido = text
      if (!contenido && uploadedUrls.length > 0) {
        contenido = `📎 ${uploadedUrls.length} archivo(s) adjunto(s)`
      }

      const res = await apiService.enviarMensajeDm({
        roomId: selectedRoomId,
        contenido,
        usuarioId: usuario.id,
        archivosUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined
      })

      if (res.success && res.data) {
        setDraft('')
        setPendingFiles([])
        stickToBottomRef.current = true
        setMessages((prev) => [...prev, toThreadMsg(res.data!)])
        void loadIndex({ silent: true })
      } else {
        setError(res.error || 'No se pudo enviar')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir archivos')
    } finally {
      setSending(false)
    }
  }

  const handleDownloadAttachment = async (url: string) => {
    setDownloadingUrl(url)
    try {
      await downloadFileFromUrl(url, fileNameFromUrl(url))
    } catch {
      showToast('No se pudo descargar el archivo')
    } finally {
      setDownloadingUrl(null)
    }
  }

  const handleDownloadProof = async (messageId: number) => {
    if (!usuario) return
    setProofLoadingId(messageId)
    const res = await apiService.generarPruebaMensajeDm(messageId, usuario.id)
    setProofLoadingId(null)
    if (!res.success || !res.data) {
      setError(res.error || 'No se pudo generar la prueba')
      return
    }
    const verifyUrl = `${window.location.origin}/mensajeria/verificar/${res.data.proof_token}`
    downloadProofJson({
      ...res.data,
      verify_url: verifyUrl,
      sistema: 'PLOT Mensajería Interna'
    })
    showToast('Prueba descargada. El token también se puede verificar en línea.')
  }

  const messagesWithDividers = useMemo(() => {
    const out: Array<{ type: 'divider'; key: string; label: string } | { type: 'msg'; key: string; msg: ThreadMsg }> =
      []
    let lastDay = ''
    for (const msg of messages) {
      const dayKey = new Date(msg.timestamp).toDateString()
      if (dayKey !== lastDay) {
        lastDay = dayKey
        out.push({ type: 'divider', key: `d-${dayKey}`, label: formatDayDivider(msg.timestamp) })
      }
      out.push({ type: 'msg', key: `m-${msg.id}`, msg })
    }
    return out
  }, [messages])

  if (authLoading) {
    return (
      <div className="mensajeria-page">
        <div className="mensajeria-wrap mensajeria-wrap--center">
          <div className="mensajeria-loading-spinner" aria-hidden />
          <p>Cargando mensajería…</p>
        </div>
      </div>
    )
  }

  if (!usuario) {
    return (
      <div className="mensajeria-page">
        <div className="mensajeria-wrap mensajeria-wrap--center">
          <h1>Mensajería</h1>
          <p>Iniciá sesión para ver tus mensajes.</p>
          <button type="button" className="mensajeria-btn" onClick={() => navigate('/login')}>
            Ir a iniciar sesión
          </button>
          <button type="button" className="mensajeria-btn mensajeria-btn-ghost" onClick={() => navigate('/')}>
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
              Chateá con cualquier compañero del equipo. Los mensajes quedan registrados con fecha, hora y token de
              prueba descargable.
            </p>
          </div>
          <button type="button" className="mensajeria-btn mensajeria-btn-ghost" onClick={() => navigate('/')}>
            ← Tablero
          </button>
        </header>

        {error && (
          <div className="mensajeria-error" role="alert">
            {error}
            <button type="button" className="mensajeria-error-close" onClick={() => setError(null)} aria-label="Cerrar">
              ×
            </button>
          </div>
        )}

        {toast && (
          <div className="mensajeria-toast" role="status">
            {toast}
          </div>
        )}

        <div className="mensajeria-layout">
          <aside className="mensajeria-sidebar">
            <div className="mensajeria-sidebar-top">
              <button
                type="button"
                className={`mensajeria-new-chat-btn ${showNewChat ? 'is-open' : ''}`}
                onClick={() => setShowNewChat((v) => !v)}
              >
                ✉ Nuevo mensaje
              </button>
            </div>

            {showNewChat && (
              <div className="mensajeria-recipient-search">
                <input
                  id="mensajeria-buscar-dest"
                  type="search"
                  className="mensajeria-search-input"
                  placeholder="Buscar por nombre, rol o ID…"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  autoComplete="off"
                  aria-label="Buscar compañero"
                />
                <ul className="mensajeria-search-results" role="listbox">
                  {searchRecipients.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="mensajeria-search-pick"
                        disabled={openingPeerId != null}
                        onClick={() => void openConversationWithPeer(u.id)}
                      >
                        <span
                          className="mensajeria-avatar mensajeria-avatar--sm"
                          style={{ background: `hsl(${avatarHue(u.id)} 55% 42%)` }}
                          aria-hidden
                        >
                          {userInitials(u.nombre)}
                        </span>
                        <span className="mensajeria-search-pick-body">
                          <span className="mensajeria-search-pick-name">
                            {openingPeerId === u.id ? 'Abriendo…' : u.nombre}
                          </span>
                          <span className="mensajeria-search-pick-meta">
                            {u.rol} · #{u.id}
                          </span>
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
                Todavía no tenés conversaciones. Usá <strong>Nuevo mensaje</strong> para escribirle a un compañero.
              </p>
            ) : (
              <ul className="mensajeria-list">
                {peers.map(({ room, peer, peerId }) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      className={`mensajeria-peer ${selectedRoomId === room.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedRoomId(room.id)
                        stickToBottomRef.current = true
                      }}
                    >
                      <span
                        className="mensajeria-avatar"
                        style={{ background: `hsl(${avatarHue(peerId)} 55% 42%)` }}
                        aria-hidden
                      >
                        {userInitials(peer?.nombre || `U${peerId}`)}
                      </span>
                      <span className="mensajeria-peer-body">
                        <span className="mensajeria-peer-name">{peer?.nombre || `Usuario #${peerId}`}</span>
                        <span className="mensajeria-peer-meta">{peer?.rol || '—'}</span>
                      </span>
                      {Number(unreadByRoomId[room.id] || 0) > 0 && (
                        <span className="mensajeria-unread" aria-label="Mensajes no leídos">
                          {unreadByRoomId[room.id]}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <main className="mensajeria-main">
            {selectedRoomId == null ? (
              <div className="mensajeria-empty">
                <div className="mensajeria-empty-icon" aria-hidden>
                  💬
                </div>
                <p>Elegí una conversación o iniciá un mensaje nuevo.</p>
                <button type="button" className="mensajeria-btn" onClick={() => setShowNewChat(true)}>
                  Nuevo mensaje
                </button>
              </div>
            ) : (
              <>
                <div className="mensajeria-thread-head">
                  <div className="mensajeria-thread-peer">
                    <span
                      className="mensajeria-avatar mensajeria-avatar--lg"
                      style={{ background: `hsl(${avatarHue(selected?.peerId ?? 0)} 55% 42%)` }}
                      aria-hidden
                    >
                      {userInitials(selected?.peer?.nombre || 'U')}
                    </span>
                    <div>
                      <strong>{selected?.peer?.nombre || 'Conversación'}</strong>
                      <span className="mensajeria-thread-meta">{selected?.peer?.rol || ''}</span>
                    </div>
                  </div>
                </div>

                <div className="mensajeria-thread">
                  {loadingThread ? (
                    <p className="mensajeria-muted mensajeria-thread-loading">Cargando mensajes…</p>
                  ) : (
                    <ul
                      className="mensajeria-bubbles"
                      ref={bubblesRef}
                      onScroll={handleBubblesScroll}
                    >
                      {hasMoreOlder && (
                        <li className="mensajeria-load-older">
                          <button
                            type="button"
                            className="mensajeria-load-older-btn"
                            disabled={loadingOlder}
                            onClick={() => void loadOlderMessages()}
                          >
                            {loadingOlder
                              ? 'Cargando mensajes anteriores…'
                              : `↑ Ver ${MESSAGES_PAGE_SIZE} mensajes anteriores`}
                          </button>
                        </li>
                      )}
                      {messagesWithDividers.map((item) =>
                        item.type === 'divider' ? (
                          <li key={item.key} className="mensajeria-day-divider" aria-hidden>
                            <span>{item.label}</span>
                          </li>
                        ) : (
                          (() => {
                            const m = item.msg
                            const mine = m.usuario_id === usuario.id
                            return (
                              <li
                                key={item.key}
                                className={`mensajeria-bubble-row ${mine ? 'is-mine' : 'is-theirs'}`}
                              >
                                {!mine && (
                                  <span
                                    className="mensajeria-avatar mensajeria-avatar--xs"
                                    style={{ background: `hsl(${avatarHue(m.usuario_id)} 55% 42%)` }}
                                    aria-hidden
                                  >
                                    {userInitials(m.nombre_usuario || 'U')}
                                  </span>
                                )}
                                <div className={`mensajeria-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
                                  {!mine && (
                                    <span className="mensajeria-author">{m.nombre_usuario || 'Usuario'}</span>
                                  )}
                                  {m.contenido && <span className="mensajeria-text">{m.contenido}</span>}
                                  {m.archivos_urls && m.archivos_urls.length > 0 && (
                                    <div className="mensajeria-attachments">
                                      {m.archivos_urls.map((url, idx) => {
                                        const name = fileNameFromUrl(url)
                                        const image = isImageUrl(url)
                                        return (
                                          <div key={`${url}-${idx}`} className="mensajeria-attachment">
                                            <span className="mensajeria-attachment-icon" aria-hidden>
                                              {image ? '🖼' : '📎'}
                                            </span>
                                            <span className="mensajeria-attachment-name" title={name}>
                                              {name}
                                            </span>
                                            <button
                                              type="button"
                                              className="mensajeria-attachment-dl"
                                              disabled={downloadingUrl === url}
                                              onClick={() => void handleDownloadAttachment(url)}
                                            >
                                              {downloadingUrl === url ? '…' : 'Descargar'}
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  <div className="mensajeria-bubble-footer">
                                    <time className="mensajeria-time" dateTime={m.timestamp}>
                                      {formatMessageTime(m.timestamp)}
                                    </time>
                                    <button
                                      type="button"
                                      className="mensajeria-proof-btn"
                                      title="Descargar prueba verificable con token"
                                      disabled={proofLoadingId === m.id}
                                      onClick={() => void handleDownloadProof(m.id)}
                                    >
                                      {proofLoadingId === m.id ? '…' : '⎙ Prueba'}
                                    </button>
                                  </div>
                                </div>
                              </li>
                            )
                          })()
                        )
                      )}
                      <div ref={bottomRef} />
                    </ul>
                  )}
                </div>

                {pendingFiles.length > 0 && (
                  <div className="mensajeria-pending-files">
                    {pendingFiles.map((f) => (
                      <span key={f.id} className="mensajeria-pending-chip">
                        📎 {f.file.name}
                        {f.uploading && ' …'}
                        <button
                          type="button"
                          aria-label="Quitar archivo"
                          onClick={() => setPendingFiles((prev) => prev.filter((p) => p.id !== f.id))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mensajeria-compose">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="mensajeria-file-input"
                    multiple
                    onChange={(e) => {
                      handlePickFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="mensajeria-attach-btn"
                    title="Adjuntar archivo"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                  >
                    📎
                  </button>
                  <textarea
                    className="mensajeria-input"
                    rows={2}
                    placeholder="Escribí un mensaje… (Enter para enviar, Shift+Enter nueva línea)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    disabled={selectedRoomId == null || sending}
                  />
                  <button
                    type="button"
                    className="mensajeria-btn mensajeria-send-btn"
                    onClick={() => void handleSend()}
                    disabled={sending || (!draft.trim() && pendingFiles.length === 0) || selectedRoomId == null}
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
