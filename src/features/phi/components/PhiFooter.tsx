import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import { PHI_BRAND, PHI_NAV_LINKS, phiAsset } from '../phiContent'
import { OPERARIO_EXTERNO_LOGIN } from '../../work-pool/workPoolOperarioExterno'

export default function PhiFooter() {
  return (
    <footer className="phi-footer">
      <div className="phi-container">
        <div className="phi-footer-newsletter">
          <img
            src={phiAsset('images/newsletter-icon.png')}
            alt=""
            className="phi-footer-newsletter-icon"
          />
          <div className="phi-footer-newsletter-box">
            <h3>Sumate a la red de diseño Plot</h3>
            <p className="phi-footer-newsletter-hint">
              Postulate como diseñador externo y empezá a tomar trabajos desde phi.
            </p>
            <Link to="/postulacion-operarios" className="phi-btn phi-btn--dark">
              Comenzar postulación
            </Link>
          </div>
        </div>

        <div className="phi-footer-grid">
          <div>
            <div className="phi-footer-brand">
              <img src={phiAsset('images/footer-logo.jpeg')} alt="" />
              <span>
                {PHI_BRAND.name} <span aria-hidden>{PHI_BRAND.symbol}</span>
              </span>
            </div>
            <p className="phi-footer-blurb">{PHI_BRAND.tagline}</p>
          </div>

          <div>
            <h4>Secciones</h4>
            <ul>
              {PHI_NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a href={`#${link.id}`}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Acceso</h4>
            <ul>
              <li>
                <Link to="/postulacion-operarios">Postulación operarios</Link>
              </li>
              <li>
                <Link to={OPERARIO_EXTERNO_LOGIN}>Ingreso operario externo</Link>
              </li>
              <li>
                <Link to={OPERARIO_EXTERNO_LOGIN}>Panel operario externo</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4>Contacto Plot Center</h4>
            <ul className="phi-footer-contact">
              <li>
                <Mail size={16} aria-hidden />
                <a href="mailto:info@plotcenter.com.ar">info@plotcenter.com.ar</a>
              </li>
              <li>
                <Phone size={16} aria-hidden />
                <a href="tel:+543644000000">Plot Center · San Juan</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="phi-footer-bottom">
          <p>
            {PHI_BRAND.fullName} · Plot Center · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  )
}
