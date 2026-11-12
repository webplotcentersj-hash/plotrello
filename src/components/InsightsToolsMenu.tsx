import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { HeaderNavGlyph } from './HeaderNavGlyph'
import './InsightsToolsMenu.css'

/** Props legacy (BoardPage); Chat / PlotAI / Impresoras ya no están en este menú. */
type InsightsToolsMenuProps = {
  onNavigateToChat?: () => void
  onTogglePlotAI?: () => void
  isPlotAIOpen?: boolean
  showImpresoras?: boolean
}

export default function InsightsToolsMenu(_props: InsightsToolsMenuProps = {}) {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendientesCount, setPendientesCount] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="insights-tools-menu" ref={rootRef}>
      <button
        type="button"
        className={`insights-toggle-btn insights-tools-trigger header-board-tool header-board-tool--tools${menuOpen ? ' insights-tools-trigger--open is-on' : ''}${pendientesCount > 0 ? ' insights-tools-trigger--badge' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        title="Herramientas rápidas"
        aria-label="Abrir menú de herramientas"
      >
        <span className="header-board-tool__glyph" aria-hidden>
          <HeaderNavGlyph id={menuOpen ? 'close' : 'grid'} size={16} />
        </span>
        {pendientesCount > 0 && (
          <span className="insights-tools-trigger-badge" aria-label={`${pendientesCount} pendientes`}>
            {pendientesCount > 9 ? '9+' : pendientesCount}
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="insights-tools-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="insights-tools-item"
            onClick={() => {
              navigate('/compras/crear-pedido')
              setMenuOpen(false)
            }}
          >
            <span className="insights-tools-item-icon" aria-hidden>
              <HeaderNavGlyph id="cart" size={18} />
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">Pedido a compras</span>
              <span className="insights-tools-item-sub">Solicitar compra a proveedor</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="insights-tools-item"
            onClick={() => {
              navigate('/generador-codigo-barras-afip')
              setMenuOpen(false)
            }}
          >
            <span className="insights-tools-item-icon" aria-hidden>
              <HeaderNavGlyph id="receipt" size={18} />
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">Código barras AFIP</span>
              <span className="insights-tools-item-sub">Generar ITF RG 1702</span>
            </span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="insights-tools-item"
            onClick={() => {
              window.open('/lector-afip/', '_blank', 'noopener,noreferrer')
              setMenuOpen(false)
            }}
          >
            <span className="insights-tools-item-icon" aria-hidden>
              <HeaderNavGlyph id="spark" size={18} />
            </span>
            <span className="insights-tools-item-text">
              <span className="insights-tools-item-title">Lector AFIP</span>
              <span className="insights-tools-item-sub">Escanear con la cámara</span>
            </span>
          </button>

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

          {usuario && (
            <button
              type="button"
              role="menuitem"
              className="insights-tools-item"
              onClick={() => {
                setMenuOpen(false)
                navigate('/mis-recibos')
              }}
            >
              <span className="insights-tools-item-icon" aria-hidden>
                <HeaderNavGlyph id="receipt" size={18} />
              </span>
              <span className="insights-tools-item-text">
                <span className="insights-tools-item-title">Mis recibos</span>
                <span className="insights-tools-item-sub">Ver y firmar recibos de sueldo</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
