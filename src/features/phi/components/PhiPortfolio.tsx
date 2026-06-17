import { ArrowRight } from 'lucide-react'
import { PHI_PORTFOLIO, phiAsset } from '../phiContent'

export default function PhiPortfolio() {
  return (
    <section id="portfolio" className="phi-section phi-section--white">
      <div className="phi-container">
        <div className="phi-section-head">
          <h2 className="phi-section-title">
            Tipos de trabajo que{' '}
            <span className="phi-highlight phi-highlight--yellow">verás en la bolsa</span>
          </h2>
        </div>

        <div className="phi-portfolio-list">
          {PHI_PORTFOLIO.map((project) => (
            <article key={project.title} className="phi-portfolio-card">
              <div className="phi-portfolio-card-copy">
                <div className="phi-portfolio-card-brand">
                  <img src={phiAsset(project.logo)} alt="" />
                </div>
                <span className="phi-portfolio-tag">{project.tag}</span>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <span className="phi-portfolio-link">
                  Ver flujo en Plot Lab <ArrowRight size={18} aria-hidden />
                </span>
              </div>
              <div className={`phi-portfolio-card-visual ${project.bgClass}`}>
                <img src={phiAsset(project.illustration)} alt="" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
