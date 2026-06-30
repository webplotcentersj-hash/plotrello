import { useState } from 'react'
import { LogOut, Menu, MessageCircle, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../../hooks/useClienteAuth'
import { useClienteCarritoBadge } from '../../hooks/useClienteCarritoBadge'
import { useClienteNotificacionesBadge } from '../../hooks/useClienteNotificacionesBadge'
import { useClienteMensajesBadge } from '../../hooks/useClienteMensajesBadge'
import { CLIENTE_NAV_ITEMS, type ClienteNavBadge } from './clienteNavConfig'
import ClienteThemeToggle from './ClienteThemeToggle'
import './ClientePillNav.css'

const LOGO_URL = '/plot-lab-logo.png'

export default function ClientePillNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, cliente } = useClienteAuth()
  const { noLeidas } = useClienteNotificacionesBadge()
  const { cantidadItems } = useClienteCarritoBadge()
  const { noLeidos: mensajesNoLeidos, tieneNoLeidas: tieneMensajesNoLeidos } =
    useClienteMensajesBadge()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navBadgeCount = (badge?: ClienteNavBadge): number => {
    if (badge === 'carrito') return cantidadItems
    if (badge === 'notificaciones') return noLeidas
    return 0
  }

  const navBadgeLabel = (badge: ClienteNavBadge, count: number): string => {
    if (badge === 'carrito') return count > 0 ? `Carrito, ${count} productos` : 'Carrito'
    return count > 0 ? `Avisos, ${count} sin leer` : 'Avisos'
  }
  const mensajesLabel =
    mensajesNoLeidos > 0
      ? `Mensajes, ${mensajesNoLeidos} sin leer`
      : 'Mensajes con el equipo'

  const isActive = (href: string) => {
    if (href === '/cliente/dashboard') {
      return location.pathname === '/cliente/dashboard' || location.pathname === '/cliente'
    }
    if (href === '/cliente/carrito') {
      return (
        location.pathname === '/cliente/carrito' || location.pathname === '/cliente/checkout'
      )
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
          {CLIENTE_NAV_ITEMS.map((item) => {
            const Icon = item.Icon
            const active = isActive(item.href)
            const badgeCount = navBadgeCount(item.badge)
            const ariaLabel =
              item.badge && badgeCount > 0
                ? navBadgeLabel(item.badge, badgeCount)
                : item.label
            return (
              <li key={item.href} role="none">
                <Link
                  to={item.href}
                  role="menuitem"
                  className={`cliente-pill-link${active ? ' active' : ''}${badgeCount > 0 ? ' cliente-pill-link--badged' : ''}`}
                  aria-label={ariaLabel}
                >
                  <Icon className="cliente-pill-link__icon" size={15} strokeWidth={2.25} aria-hidden />
                  <span className="cliente-pill-link__text">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="cliente-pill-link__badge" aria-hidden>
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="cliente-pill-actions">
          <ClienteThemeToggle compact />
          <button
            type="button"
            className={`cliente-pill-icon-btn cliente-pill-notif-btn${tieneMensajesNoLeidos ? ' cliente-pill-notif-btn--alert' : ''}`}
            title={mensajesLabel}
            aria-label={mensajesLabel}
            onClick={() => navigate('/cliente/mensajes')}
          >
            <MessageCircle size={18} strokeWidth={2.25} />
            {mensajesNoLeidos > 0 && (
              <span className="cliente-pill-notif-badge" aria-hidden>
                {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
              </span>
            )}
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
            <LogOut size={16} strokeWidth={2.25} />
            <span className="cliente-pill-icon-btn__label">Salir</span>
          </button>
          <button
            type="button"
            className="cliente-pill-hamburger"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="cliente-pill-mobile">
          <ul>
            {CLIENTE_NAV_ITEMS.map((item) => {
              const Icon = item.Icon
              const badgeCount = navBadgeCount(item.badge)
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={`${isActive(item.href) ? 'active' : ''}${badgeCount > 0 ? ' has-badge' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={18} strokeWidth={2.25} aria-hidden />
                    {item.label}
                    {badgeCount > 0 && (
                      <span className="cliente-pill-mobile__badge" aria-hidden>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </header>
  )
}
