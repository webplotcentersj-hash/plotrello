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
              src="https://trello.plotcenter.com.ar/Group%20187.png" 
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
          <h2>Contenido de la Herramienta</h2>
          <p>Aquí puedes agregar el contenido de tu nueva herramienta.</p>
          
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

