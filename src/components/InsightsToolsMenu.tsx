import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import ChatFloatingButton from './ChatFloatingButton'
import { HeaderNavGlyph } from './HeaderNavGlyph'
import './InsightsToolsMenu.css'

type InsightsToolsMenuProps = {
  onNavigateToChat: () => void
  onTogglePlotAI: () => void
  isPlotAIOpen: boolean
  showImpresoras?: boolean
}

export default function InsightsToolsMenu({
  onNavigateToChat,
  onTogglePlotAI,
  isPlotAIOpen,
  showImpresoras = true
}: InsightsToolsMenuProps) {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [pendientesCount, setPendientesCount] = useState(0)
  const [chatUnread, setChatUnread] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const loadPendientesCount = async () => {
    if (!usuario?.id) return
    try {
      const response = await apiService.obtenerSolicitudesPermisos(
        usuario.id,
        'pendiente',
        null,
        null,
        null
      )
      if (response.success && response.data) {
        setPendientesCount(response.data.length)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadPendientesCount()
  }, [usuario?.id])

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const totalBadge = pendientesCount + chatUnread

  return (
    <div className="insights-tools-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`insights-toggle-btn insights-tools-trigger header-board-tool header-board-tool--tools${menuOpen ? ' insights-tools-trigger--open is-on' : ''}${totalBadge > 0 ? ' insights-tools-trigger--badge' : ''}`}
        onClick={() => {
          setMenuOpen((v) => !v)
          setChatOpen(false)
        }}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title="Herramientas rápidas"
        aria-label="Abrir menú de herramientas"
      >
        <span className="header-board-tool__glyph" aria-hidden>
          <HeaderNavGlyph id={menuOpen ? 'close' : 'grid'} size={16} />
        </span>
        {totalBadge > 0 && (
          <span className="insights-tools-trigger-badge" aria-label={`${totalBadge} pendientes`}>
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="insights-tools-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="insights-tools-item insights-tools-item--chat"
            onClick={() => {
              setMenuOpen(false)
              setChatOpen(true)
            }}
          >
            <span className="insights-tools-item-icon" aria-hidden>
              <HeaderNavGlyph id="chat" size={18} />
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">Chat</span>
              <span className="insights-tools-item-sub">Canales y menciones</span>
            </span>
            {chatUnread > 0 && (
              <span className="insights-tools-item-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            className={`insights-tools-item insights-tools-item--plotai${isPlotAIOpen ? ' insights-tools-item--active' : ''}`}
            onClick={() => {
              onTogglePlotAI()
              setMenuOpen(false)
            }}
          >
            <span className="insights-tools-item-icon insights-tools-item-icon--plotai" aria-hidden>
              <HeaderNavGlyph id="spark" size={18} />
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">PlotAI</span>
              <span className="insights-tools-item-sub">
                {isPlotAIOpen ? 'Cerrar agente' : 'Agente · flotante abajo a la izquierda'}
              </span>
            </span>
          </button>

          {showImpresoras && (
            <button
              type="button"
              role="menuitem"
              className="insights-tools-item insights-tools-item--print"
              onClick={() => {
                navigate('/impresoras')
                setMenuOpen(false)
              }}
            >
              <span className="insights-tools-item-icon" aria-hidden>
                <HeaderNavGlyph id="printer" size={18} />
              </span>
              <span className="insights-tools-item-text">
                <span className="insights-tools-item-title">Impresoras</span>
                <span className="insights-tools-item-sub">Ocupación y cola</span>
              </span>
            </button>
          )}

          {usuario && (
            <button
              type="button"
              role="menuitem"
              className="insights-tools-item insights-tools-item--solicitudes"
              onClick={() => {
                setMenuOpen(false)
                navigate('/avisar-ausencia')
              }}
            >
              <span className="insights-tools-item-icon" aria-hidden>
                <HeaderNavGlyph id="clipboard" size={18} />
              </span>
              <span className="insights-tools-item-text">
                <span className="insights-tools-item-title">Avisar ausencia</span>
                <span className="insights-tools-item-sub">Desde el celular · solo plataforma</span>
              </span>
              {pendientesCount > 0 && (
                <span className="insights-tools-item-badge">{pendientesCount}</span>
              )}
            </button>
          )}
        </div>
      )}

      <ChatFloatingButton
        variant="insights"
        anchorRef={triggerRef}
        isOpen={chatOpen}
        onOpenChange={setChatOpen}
        onNavigateToChat={() => {
          onNavigateToChat()
          setChatOpen(false)
        }}
        onUnreadChange={setChatUnread}
      />
    </div>
  )
}
