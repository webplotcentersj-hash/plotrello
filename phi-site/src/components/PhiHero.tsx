import { FolderOpen, UserPlus } from 'lucide-react'
import { phiAsset } from '../phiContent'
import { plotLabPath } from '../plotLabLinks'

export default function PhiHero() {
  return (
    <section id="inicio" className="phi-hero">
      <div className="phi-container phi-hero-grid">
        <div className="phi-hero-copy">
          <p className="phi-eyebrow">
            Plot Design · red externa <span aria-hidden>φ</span>
          </p>
          <h1 className="phi-hero-title">
            Somos{' '}
            <span className="phi-highlight phi-highlight--pink">phi (φ)</span>, la bolsa de{' '}
            <span className="phi-highlight phi-highlight--blue">diseñadores</span> de Plot Center
          </h1>
          <p className="phi-hero-desc">
            Unite como diseñador freelance, tomá trabajos desde la bolsa creativa y entregá con el
            respaldo del equipo gráfico de Plot Lab.
          </p>
          <div className="phi-hero-actions">
            <a href={plotLabPath('/postulacion-operarios')} className="phi-btn phi-btn--dark phi-btn--lg">
              <UserPlus size={20} aria-hidden />
              Postularme
            </a>
            <a href={plotLabPath('/login')} className="phi-btn phi-btn--outline phi-btn--lg">
              <FolderOpen size={20} aria-hidden />
              Ingresar al panel
            </a>
          </div>
        </div>

        <div className="phi-hero-visual">
          <div className="phi-hero-frame">
            <img
              src={phiAsset('images/design-mode/63407fbdc2d4ac5270385fd4_home-he.png')}
              alt="Ilustración phi Plot Design"
              className="phi-hero-img"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
