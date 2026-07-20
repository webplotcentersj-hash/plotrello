import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import ChatFloatingButton from './ChatFloatingButton'
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
        className={`insights-toggle-btn insights-tools-trigger${menuOpen ? ' insights-tools-trigger--open' : ''}${totalBadge > 0 ? ' insights-tools-trigger--badge' : ''}`}
        onClick={() => {
          setMenuOpen((v) => !v)
          setChatOpen(false)
        }}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title="Herramientas rápidas"
        aria-label="Abrir menú de herramientas"
      >
        <span className="insights-toggle-icon" aria-hidden="true">
          {menuOpen ? '✕' : '⋯'}
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
            <span className="insights-tools-item-icon">💬</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11C11 9.75 14.75 9.75 14.75 7.5C14.75 6.12 13.63 5 12.25 5C10.87 5 9.75 6.12 9.75 7.5H11.75C11.75 7.08 12.08 6.75 12.5 6.75C12.92 6.75 13.25 7.08 13.25 7.5C13.25 8.5 11 8.83 11 13H13Z" />
              </svg>
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">PlotAI</span>
              <span className="insights-tools-item-sub">
                {isPlotAIOpen ? 'Cerrar asistente' : 'Asistente inteligente'}
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
              <span className="insights-tools-item-icon">🖨️</span>
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
              <span className="insights-tools-item-icon">📋</span>
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
