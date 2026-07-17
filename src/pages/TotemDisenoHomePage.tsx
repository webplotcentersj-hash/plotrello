import { useNavigate } from 'react-router-dom'
import './TotemDisenoPages.css'

const LOGO_URL = '/plot-lab-logo.png'

/**
 * Tótem 1° piso — Diseño: contratar servicio o llamar diseñador.
 */
export default function TotemDisenoHomePage() {
  const navigate = useNavigate()

  return (
    <div className="totem-diseno-page">
      <div className="totem-diseno-ambient" aria-hidden>
        <span className="totem-diseno-orb totem-diseno-orb--1" />
        <span className="totem-diseno-orb totem-diseno-orb--2" />
      </div>

      <header className="totem-diseno-header">
        <img src={LOGO_URL} alt="Plot Center" className="totem-diseno-logo" />
        <div>
          <p className="totem-diseno-kicker">1° piso · Diseño gráfico</p>
          <h1 className="totem-diseno-title">Bienvenido a Diseño</h1>
          <p className="totem-diseno-lead">
            Armá tu brief, mirá un mockup en vivo y avisá al equipo. O llamá a un diseñador si preferís
            atención personal.
          </p>
        </div>
      </header>

      <main className="totem-diseno-home-grid">
        <button
          type="button"
          className="totem-diseno-home-tile totem-diseno-home-tile--brief"
          onClick={() => navigate('/totem/diseno/brief')}
        >
          <span className="totem-diseno-home-tile-icon" aria-hidden>
            ✨
          </span>
          <strong>Contratar diseño</strong>
          <span>Brief interactivo · mockup · imagen con IA</span>
        </button>

        <button
          type="button"
          className="totem-diseno-home-tile totem-diseno-home-tile--call"
          onClick={() => navigate('/totem/diseno/brief?llamar=1')}
        >
          <span className="totem-diseno-home-tile-icon" aria-hidden>
            🎨
          </span>
          <strong>Llamar a un diseñador</strong>
          <span>Te avisamos en pantalla cuando alguien venga</span>
        </button>
      </main>

      <footer className="totem-diseno-footer">
        <button type="button" className="totem-diseno-back" onClick={() => navigate('/totem/consulta-cliente')}>
          ← Volver al tótem de planta baja
        </button>
      </footer>
    </div>
  )
}
