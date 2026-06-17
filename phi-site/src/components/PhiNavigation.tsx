import { Mail } from 'lucide-react'
import { PHI_BRAND, PHI_NAV_LINKS } from '../phiContent'
import { plotLabPath } from '../plotLabLinks'

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

        <a
          href={plotLabPath('/login')}
          className="phi-btn phi-btn--dark phi-btn--icon"
          title="Ingresar"
        >
          <Mail size={22} strokeWidth={2.5} aria-hidden />
          <span className="phi-sr-only">Ingresar</span>
        </a>
      </nav>
    </div>
  )
}
