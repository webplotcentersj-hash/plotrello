import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { PHI_SERVICES, phiAsset } from '../phiContent'

export default function PhiServices() {
  return (
    <section id="servicios" className="phi-section phi-section--white">
      <div className="phi-container">
        <div className="phi-section-head">
          <h2 className="phi-section-title">
            Qué podés hacer en{' '}
            <span className="phi-highlight phi-highlight--red">la bolsa Plot Design</span>
          </h2>
          <p className="phi-section-desc">
            Trabajos reales de clientes Plot Center: desde piezas rápidas hasta proyectos de
            identidad con seguimiento en Plot Lab.
          </p>
        </div>

        <div className="phi-services-grid">
          {PHI_SERVICES.map((service) => (
            <article key={service.title} className="phi-service-card">
              <div className="phi-service-card-media">
                <img src={phiAsset(service.image)} alt="" />
              </div>
              <div className="phi-service-card-body">
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>
            </article>
          ))}

          <article className="phi-service-card phi-service-card--cta">
            <img
              src={phiAsset('images/get-in-touch.svg')}
              alt=""
              className="phi-service-cta-icon"
            />
            <h3>¿Querés sumarte?</h3>
            <p>
              Completá la postulación como operario de diseño. El equipo Plot revisa tu perfil y te
              habilita en phi.
            </p>
            <Link to="/postulacion-operarios" className="phi-btn phi-btn--dark phi-btn--block">
              <Mail size={18} aria-hidden />
              Postularme ahora
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
