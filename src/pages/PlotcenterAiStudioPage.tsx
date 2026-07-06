import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { STUDIO_NAV, STUDIO_PRIMARY } from '../features/plotcenter-ai-studio/constants'
import { renderStudioView } from '../features/plotcenter-ai-studio/studioViews'
import { StudioView, type StudioView as StudioViewId } from '../features/plotcenter-ai-studio/types'
import './PlotcenterAiStudioPage.css'

const PlotcenterAiStudioPage = () => {
  const navigate = useNavigate()
  const { loading, canAccessPlotDesign, isAdmin } = useAuth()
  const [view, setView] = useState<StudioViewId>(StudioView.DASHBOARD)
  const [navOpen, setNavOpen] = useState(false)

  const canAccess = canAccessPlotDesign || isAdmin

  if (loading) {
    return (
      <div className="pcai-page">
        <div className="pcai-loading">
          <span className="pcai-spinner pcai-spinner--lg" aria-hidden />
          <p>Cargando Plot AI Studio…</p>
        </div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="pcai-page">
        <div className="pcai-denied">
          <h1>Sin acceso</h1>
          <p>Plot AI Studio está disponible para el equipo de diseño.</p>
          <button type="button" className="pcai-btn pcai-btn--primary" onClick={() => navigate('/')}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const currentNav = STUDIO_NAV.find((item) => item.id === view)

  return (
    <div className="pcai-page">
      <header className="pcai-topbar">
        <div className="pcai-topbar-left">
          <button
            type="button"
            className="pcai-btn pcai-btn--ghost pcai-menu-btn"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
            aria-label="Menú de herramientas"
          >
            ☰
          </button>
          <div>
            <h1 className="pcai-brand">
              Plot <span style={{ color: STUDIO_PRIMARY }}>AI</span> Studio
            </h1>
            <p className="pcai-topbar-sub">{currentNav?.label || 'Herramientas creativas'}</p>
          </div>
        </div>
        <div className="pcai-topbar-actions">
          <button type="button" className="pcai-btn pcai-btn--ghost" onClick={() => navigate('/diseno/dashboard')}>
            Dashboard diseño
          </button>
          <button type="button" className="pcai-btn pcai-btn--ghost" onClick={() => navigate('/plot-design')}>
            Plot Design
          </button>
        </div>
      </header>

      <div className="pcai-layout">
        <nav className={`pcai-sidebar${navOpen ? ' pcai-sidebar--open' : ''}`} aria-label="Herramientas Gemini">
          {STUDIO_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pcai-nav-item${view === item.id ? ' pcai-nav-item--active' : ''}`}
              onClick={() => {
                setView(item.id)
                setNavOpen(false)
              }}
            >
              <span className="pcai-nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="pcai-nav-text">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>

        {navOpen && (
          <button
            type="button"
            className="pcai-sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setNavOpen(false)}
          />
        )}

        <main className="pcai-main">{renderStudioView(view, setView)}</main>
      </div>
    </div>
  )
}

export default PlotcenterAiStudioPage
