import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { PHI_BRAND, PHI_NAV_LINKS } from '../phiContent'
import { OPERARIO_EXTERNO_LOGIN } from '../../work-pool/workPoolOperarioExterno'

export default function PhiNavigation() {
  return (
    <div className="phi-nav-wrap">
      <nav className="phi-nav" aria-label="Navegación phi">
        <div className="phi-nav-logo" aria-hidden>
          <span className="phi-nav-logo-symbol">{PHI_BRAND.symbol}</span>
        </div>

        <div className="phi-nav-links">
          {PHI_NAV_LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} className="phi-nav-link">
              {link.label}
            </a>
          ))}
        </div>

        <Link to={OPERARIO_EXTERNO_LOGIN} className="phi-btn phi-btn--dark phi-btn--icon" title="Ingreso operario externo">
          <Mail size={22} strokeWidth={2.5} aria-hidden />
          <span className="phi-sr-only">Ingresar</span>
        </Link>
      </nav>
    </div>
  )
}
