import { useState } from 'react'
import { PLOT_CENTER_DESIGN_TOOLS } from '../constants/plotCenterDesignTools'
import './HerramientaPage.css'

type HerramientaPageProps = {
  onBack: () => void
}

const HerramientaPage = ({ onBack }: HerramientaPageProps) => {
  const [loading] = useState(false)

  return (
    <div className="herramienta-page">
      <header className="herramienta-header">
        <div className="herramienta-header-content">
          <div className="herramienta-header-brand">
            <img 
              src="/plot-lab-logo.png" 
              alt="Plot Center Logo" 
              className="herramienta-logo"
            />
            <button className="back-button" onClick={onBack}>
              ← Volver al Tablero
            </button>
          </div>
          <h1>Nueva Herramienta</h1>
        </div>
      </header>

      <div className="herramienta-container">
        <div className="herramienta-card">
          <h2>🔧 Herramientas Disponibles</h2>
          <p>Acceso rápido a herramientas útiles para el trabajo diario.</p>
          
          <div className="herramientas-grid">
            <a
              href="https://tools.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">🔧</div>
              <div className="herramienta-content">
                <h3>Herramientas Plot Center</h3>
                <p>Acceso a todas las herramientas de producción</p>
                <span className="herramienta-url">tools.plotcenter.com.ar</span>
              </div>
            </a>

            <a
              href="https://aitools.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">🤖</div>
              <div className="herramienta-content">
                <h3>AI Tools</h3>
                <p>Herramientas de inteligencia artificial para diseño y producción</p>
                <span className="herramienta-url">aitools.plotcenter.com.ar</span>
              </div>
            </a>

            {PLOT_CENTER_DESIGN_TOOLS.map((tool) => (
              <a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="herramienta-link-card"
              >
                <div className="herramienta-icon">{tool.icon}</div>
                <div className="herramienta-content">
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                  <span className="herramienta-url">{tool.host}</span>
                </div>
              </a>
            ))}
          </div>
          
          {loading && (
            <div className="loading-state">
              <p>Cargando...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default HerramientaPage

