import { Link } from 'react-router-dom'
import './ClientePortalFooter.css'

const LOGO_URL = 'https://www.plotcenterlab.com.ar/Group%20187.png'

const LINKS = [
  { label: 'Inicio', href: '/cliente/dashboard' },
  { label: 'Catálogo', href: '/cliente/catalogo' },
  { label: 'Presupuestos', href: '/cliente/presupuestos' },
  { label: 'Reclamos', href: '/cliente/reclamos' },
  { label: 'Chat PlotAI', href: '/cliente/chat' },
  { label: 'Ayuda', href: '/cliente/ayuda' }
]

export default function ClientePortalFooter() {
  return (
    <footer className="cliente-portal-footer">
      <div className="cliente-container cliente-portal-footer-inner">
        <Link to="/cliente/dashboard" className="cliente-portal-footer-logo">
          <img src={LOGO_URL} alt="Plot Center" />
        </Link>
        <nav className="cliente-portal-footer-nav" aria-label="Enlaces del portal">
          {LINKS.map((link) => (
            <Link key={link.href} to={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="cliente-portal-footer-divider" />
        <p className="cliente-portal-footer-copy">
          © {new Date().getFullYear()} Plot Center · Portal de clientes
        </p>
      </div>
    </footer>
  )
}
