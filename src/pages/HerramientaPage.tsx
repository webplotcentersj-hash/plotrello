import { useState } from 'react'
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
              src="https://www.plotcenterlab.com.ar/Group%20187.png" 
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

            <a
              href="https://qr.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">📱</div>
              <div className="herramienta-content">
                <h3>Generador QR / Link WhatsApp</h3>
                <p>Crear enlace de WhatsApp y código QR para escanear</p>
                <span className="herramienta-url">qr.plotcenter.com.ar</span>
              </div>
            </a>

            <a
              href="https://generadorqr.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">📷</div>
              <div className="herramienta-content">
                <h3>Generador de Códigos QR</h3>
                <p>Crear códigos QR con URL o texto, color personalizable y descarga de imagen</p>
                <span className="herramienta-url">generadorqr.plotcenter.com.ar</span>
              </div>
            </a>

            <a
              href="https://wcag.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">♿</div>
              <div className="herramienta-content">
                <h3>Verificador de Contraste WCAG</h3>
                <p>Comprobar ratio de contraste y cumplimiento de accesibilidad (WCAG 2.1)</p>
                <span className="herramienta-url">wcag.plotcenter.com.ar</span>
              </div>
            </a>

            <a
              href="https://resizer.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">🖼️</div>
              <div className="herramienta-content">
                <h3>Studio Resizer Pro</h3>
                <p>Redimensionar y exportar diseños a múltiples formatos con ajuste de encuadre</p>
                <span className="herramienta-url">resizer.plotcenter.com.ar</span>
              </div>
            </a>

            <a
              href="https://extractor.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="herramienta-link-card"
            >
              <div className="herramienta-icon">🎨</div>
              <div className="herramienta-content">
                <h3>Color Intelligence Studio</h3>
                <p>Extraer paletas de imágenes, HEX/RGB/CMYK y armonías cromáticas</p>
                <span className="herramienta-url">extractor.plotcenter.com.ar</span>
              </div>
            </a>
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

