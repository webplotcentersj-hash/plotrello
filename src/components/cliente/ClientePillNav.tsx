import { useState } from 'react'
import { Bell, LogOut, Menu, MessageCircle, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../../hooks/useClienteAuth'
import { useClienteNotificacionesBadge } from '../../hooks/useClienteNotificacionesBadge'
import { useClienteMensajesBadge } from '../../hooks/useClienteMensajesBadge'
import { CLIENTE_NAV_ITEMS } from './clienteNavConfig'
import ClienteThemeToggle from './ClienteThemeToggle'
import './ClientePillNav.css'

const LOGO_URL = 'https://trello.plotcenter.com.ar/Group%20187.png'

export default function ClientePillNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, cliente } = useClienteAuth()
  const { noLeidas, tieneNoLeidas } = useClienteNotificacionesBadge()
  const { noLeidos: mensajesNoLeidos, tieneNoLeidas: tieneMensajesNoLeidos } =
    useClienteMensajesBadge()
  const [mobileOpen, setMobileOpen] = useState(false)
  const notifLabel =
    noLeidas > 0
      ? `Notificaciones, ${noLeidas} sin leer`
      : 'Notificaciones'
  const mensajesLabel =
    mensajesNoLeidos > 0
      ? `Mensajes, ${mensajesNoLeidos} sin leer`
      : 'Mensajes con el equipo'

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
          {CLIENTE_NAV_ITEMS.map((item) => {
            const Icon = item.Icon
            const active = isActive(item.href)
            return (
              <li key={item.href} role="none">
                <Link
                  to={item.href}
                  role="menuitem"
                  className={`cliente-pill-link ${active ? 'active' : ''}`}
                >
                  <Icon className="cliente-pill-link__icon" size={15} strokeWidth={2.25} aria-hidden />
                  <span className="cliente-pill-link__text">{item.label}</span>
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
            className={`cliente-pill-icon-btn cliente-pill-notif-btn${tieneNoLeidas ? ' cliente-pill-notif-btn--alert' : ''}`}
            title={notifLabel}
            aria-label={notifLabel}
            onClick={() => navigate('/cliente/notificaciones')}
          >
            <Bell size={18} strokeWidth={2.25} />
            {noLeidas > 0 && (
              <span className="cliente-pill-notif-badge" aria-hidden>
                {noLeidas > 9 ? '9+' : noLeidas}
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
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={isActive(item.href) ? 'active' : ''}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={18} strokeWidth={2.25} aria-hidden />
                    {item.label}
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
