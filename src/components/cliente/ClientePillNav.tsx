import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../../hooks/useClienteAuth'
import './ClientePillNav.css'

const LOGO_URL = 'https://trello.plotcenter.com.ar/Group%20187.png'

const NAV_ITEMS = [
  { label: 'Inicio', href: '/cliente/dashboard' },
  { label: 'Catálogo', href: '/cliente/catalogo' },
  { label: 'Pedidos', href: '/cliente/nuevo-pedido' },
  { label: 'Buscar OP', href: '/cliente/buscar-op' },
  { label: 'Ayuda', href: '/cliente/ayuda' }
]

export default function ClientePillNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, cliente } = useClienteAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/cliente/dashboard') {
      return location.pathname === '/cliente/dashboard' || location.pathname === '/cliente'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <header className="cliente-pill-nav-wrap">
      <nav className="cliente-pill-nav" aria-label="Portal cliente">
        <Link to="/cliente/dashboard" className="cliente-pill-logo" aria-label="Plot Center inicio">
          <img src={LOGO_URL} alt="Plot Center" />
        </Link>

        <ul className="cliente-pill-list cliente-pill-list--desktop" role="menubar">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} role="none">
              <Link
                to={item.href}
                role="menuitem"
                className={`cliente-pill-link ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="cliente-pill-actions">
          <button
            type="button"
            className="cliente-pill-icon-btn"
            title="Notificaciones"
            aria-label="Notificaciones"
            onClick={() => navigate('/cliente/notificaciones')}
          >
            🔔
          </button>
          <button
            type="button"
            className="cliente-pill-icon-btn cliente-pill-icon-btn--logout"
            title={cliente?.nombre ? `Salir (${cliente.nombre})` : 'Cerrar sesión'}
            onClick={() => {
              logout()
              navigate('/cliente/login')
            }}
          >
            Salir
          </button>
          <button
            type="button"
            className="cliente-pill-hamburger"
            aria-label="Menú"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="cliente-pill-mobile">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={isActive(item.href) ? 'active' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
