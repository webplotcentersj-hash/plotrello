import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { PHI_ABOUT_BULLETS, phiAsset } from '../phiContent'

export default function PhiAbout() {
  return (
    <section id="nosotros" className="phi-section">
      <div className="phi-container phi-about-grid">
        <div className="phi-about-visual">
          <div className="phi-about-frame">
            <img src={phiAsset('images/about-me.svg')} alt="Equipo creativo Plot Design" />
          </div>
        </div>

        <div className="phi-about-copy">
          <h2 className="phi-section-title phi-section-title--left">
            ¿Quién está detrás de{' '}
            <span className="phi-highlight phi-highlight--blue">phi (φ)</span>?
          </h2>
          <p className="phi-section-desc phi-section-desc--left">
            Plot Design conecta diseñadores externos con la operación diaria de Plot Center: bolsa
            de trabajos, briefs, revisiones y pagos en un solo flujo dentro de Plot Lab.
          </p>

          <ul className="phi-about-list">
            {PHI_ABOUT_BULLETS.map((item) => (
              <li key={item.title}>
                <span className="phi-about-bullet" style={{ background: item.color }} aria-hidden />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <Link to="/operario-externo/diseno" className="phi-btn phi-btn--dark phi-btn--lg">
            <User size={20} aria-hidden />
            Ir al panel diseñador
          </Link>
        </div>
      </div>
    </section>
  )
}
