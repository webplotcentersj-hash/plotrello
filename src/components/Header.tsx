import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buildHeaderQuickNavItems } from '../utils/headerQuickNav'
import type { ActivityEvent, TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { useCampoSectorMode } from '../hooks/useCampoSectorMode'
import { useDmMensajeriaUnread } from '../hooks/useDmMensajeriaUnread'
import { useHeaderQuickNavBadges } from '../hooks/useHeaderQuickNavBadges'
import NotificationsDropdown from './NotificationsDropdown'
import HeaderSpotlightCard from './HeaderSpotlightCard'
import ClockWidget from './ClockWidget'
import WeatherWidget from './WeatherWidget'
import AdminAlertButton from './AdminAlertButton'
import PwaUpdateButton from './PwaUpdateButton'
import PwaUpdateModalHost from './PwaUpdateModalHost'
import TemaToggle from './TemaToggle'
import { VENTAS } from '../utils/ventasRoutes'
import './Header.css'

type HeaderProps = {
  teamMembers: TeamMember[]
  activity: ActivityEvent[]
  currentUserName?: string
  onNavigateToStats?: () => void
  onNavigateToCalendar?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToMostrador?: () => void
  onNavigateToCompras?: () => void
  onNavigateToCaja?: () => void
  onNavigateToDiseno?: () => void
  onNavigateToRecursosHumanos?: () => void
  onNavigateToClientesWeb?: () => void
  onNavigateToAsesorPresupuestos?: () => void
  onNavigateToAtencionPublico?: () => void
  onNavigateToFlota?: () => void
  onNavigateToERP?: () => void
  onSolicitarProductos?: () => void
  onOpenPermisos?: () => void
  onNavigateToChat?: () => void
  onNavigateToMensajeria?: () => void
  onLogout?: () => void
  isAdmin?: boolean
  isDiseno?: boolean
  /** Teléfono en tablero: sin reloj, clima ni tarjeta spotlight. */
  compactPhone?: boolean
}

const Header = ({
  teamMembers: _teamMembers,
  activity: _activity,
  currentUserName,
  onNavigateToStats,
  onNavigateToCalendar,
  onNavigateToUsuarios,
  onNavigateToMostrador,
  onNavigateToCompras,
  onNavigateToCaja,
  onNavigateToDiseno,
  onNavigateToRecursosHumanos,
  onNavigateToClientesWeb,
  onNavigateToAsesorPresupuestos,
  onNavigateToAtencionPublico,
  onNavigateToFlota,
  onNavigateToERP,
  onSolicitarProductos,
  onOpenPermisos,
  onNavigateToChat,
  onNavigateToMensajeria,
  onLogout,
  isAdmin: isAdminProp = false,
  isDiseno = false,
  compactPhone = false
}: HeaderProps) => {
  const {
    usuario,
    canManageCompras,
    canManageCaja,
    canManageRecursosHumanos,
    isAdmin: isAdminFromAuth,
    isAsesorTecnico,
    isPresupuestos,
    canAccessAtencionPublico,
    canAccessMostradorViews,
    isTallerGrafico,
    isTallerImprenta,
    isMetalurgica,
    canAccessTotemImpresionPanel,
    canManageWorkPool
  } = useAuth()
  const location = useLocation()
  const { mode: campoSectorMode } = useCampoSectorMode()
  const canAccessAppCampo = campoSectorMode !== 'none'
  const dmMensajeriaUnread = useDmMensajeriaUnread(usuario?.id)
  const showMensajeriaUnreadBadge =
    dmMensajeriaUnread > 0 && !!onNavigateToMensajeria && location.pathname !== '/mensajeria'
  const isAdmin = isAdminProp || isAdminFromAuth
  const canAccessAsesorPresupuestos = isAdmin || isAsesorTecnico || isPresupuestos
  const quickNavBadges = useHeaderQuickNavBadges()
  const [actionsOpen, setActionsOpen] = useState(false)

  const quickNavItems = useMemo(() => {
    const items = buildHeaderQuickNavItems({
      usuario,
      isAdmin,
      canAccessMostradorViews,
      canAccessAsesorPresupuestos,
      canAccessAtencionPublico,
      canManageCompras,
      canManageCaja,
      canManageRecursosHumanos,
      canManageWorkPool,
      onNavigateToStats,
      onNavigateToMostrador,
      onNavigateToCompras,
      onNavigateToCaja,
      onNavigateToDiseno,
      onNavigateToRecursosHumanos,
      onNavigateToAsesorPresupuestos,
      onNavigateToAtencionPublico,
      onNavigateToFlota,
      onNavigateToERP,
      onOpenPermisos,
      onSolicitarProductos
    })
    return items.map((item) => ({
      ...item,
      badge: quickNavBadges[item.id] ?? item.badge ?? 0
    }))
  }, [
    usuario,
    isAdmin,
    canAccessMostradorViews,
    canAccessAsesorPresupuestos,
    canAccessAtencionPublico,
    canManageCompras,
    canManageCaja,
    canManageRecursosHumanos,
    canManageWorkPool,
    onNavigateToStats,
    onNavigateToMostrador,
    onNavigateToCompras,
    onNavigateToCaja,
    onNavigateToDiseno,
    onNavigateToRecursosHumanos,
    onNavigateToAsesorPresupuestos,
    onNavigateToAtencionPublico,
    onNavigateToFlota,
    onNavigateToERP,
    onOpenPermisos,
    onSolicitarProductos,
    quickNavBadges
  ])

  const renderQuickNavBadge = (count: number) =>
    count > 0 ? (
      <span className="header-quick-nav-badge" title={`${count} novedad${count === 1 ? '' : 'es'}`}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null

  return (
    <header className="tp-header">
      <div className="header-line">
        <div className="header-brand">
          {/* El logo trae el texto "Plot Lab": versión clara para noche, oscura para día. */}
          <h1 className="header-brand-title">
            <img
              src="/plot-lab-lockup.png"
              alt="Plot Lab"
              className="header-logo header-logo--noche"
            />
            <img
              src="/plot-lab-lockup-dia.png"
              alt=""
              aria-hidden
              className="header-logo header-logo--dia"
            />
          </h1>
        </div>
        <div className="header-line-aside">
          {quickNavItems.length > 0 && (
            <nav className="header-quick-nav" aria-label="Accesos de tu sector">
              {quickNavItems.map((item) => {
                const btnClass = `header-quick-nav-btn${
                  item.id.startsWith('dashboard-') ? ' header-quick-nav-btn--primary' : ''
                }${(item.badge ?? 0) > 0 ? ' header-quick-nav-btn--has-badge' : ''}`
                const badge = renderQuickNavBadge(item.badge ?? 0)
                return item.href && item.external ? (
                  <a
                    key={item.id}
                    href={item.href}
                    className={btnClass}
                    title={item.title ?? item.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="header-quick-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="header-quick-nav-label">{item.label}</span>
                    {badge}
                  </a>
                ) : item.href ? (
                  <Link
                    key={item.id}
                    to={item.href}
                    className={btnClass}
                    title={item.title ?? item.label}
                  >
                    <span className="header-quick-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="header-quick-nav-label">{item.label}</span>
                    {badge}
                  </Link>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    className={btnClass}
                    title={item.title ?? item.label}
                    onClick={() => item.onClick?.()}
                  >
                    <span className="header-quick-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="header-quick-nav-label">{item.label}</span>
                    {badge}
                  </button>
                )
              })}
            </nav>
          )}
        <div className="header-actions">
          {compactPhone && (
            <div className="header-status-card header-status-card--compact-phone" aria-label="Hora y clima">
              <ClockWidget compact />
              <div className="header-status-divider" aria-hidden />
              <WeatherWidget />
            </div>
          )}

          <div className="header-util-bar" role="toolbar" aria-label="Acciones rápidas">
            {compactPhone && (
              <>
                <PwaUpdateButton className="header-util-btn header-util-btn--pwa" />
                <span className="header-util-divider" aria-hidden />
              </>
            )}
            <NotificationsDropdown
              onNotificationClick={(notification) => {
                if (
                  notification.type === 'mention' &&
                  notification.description?.includes('te mencionó en')
                ) {
                  onNavigateToChat?.()
                }
              }}
            />
            {isAdmin && (
              <>
                <span className="header-util-divider" aria-hidden />
                <AdminAlertButton />
              </>
            )}
            <span className="header-util-divider" aria-hidden />
            <TemaToggle className="header-util-btn header-util-btn--tema" />
            <span className="header-util-divider" aria-hidden />
            <button
              className={`header-util-btn actions-toggle${showMensajeriaUnreadBadge ? ' has-mensajeria-unread' : ''}${actionsOpen ? ' actions-toggle--open' : ''}`}
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              aria-expanded={actionsOpen}
              aria-label={
                showMensajeriaUnreadBadge
                  ? `Menú de navegación. Mensajes sin leer: ${dmMensajeriaUnread}`
                  : 'Menú de navegación'
              }
              title={actionsOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              <span className="actions-toggle-icon" aria-hidden>
                {actionsOpen ? '✕' : '☰'}
              </span>
              <span className="actions-toggle-label">Menú</span>
            </button>
          </div>

          <div className={`actions-dropdown ${actionsOpen ? 'open' : ''}`} role="menu" aria-label="Menú de navegación">
            <div className="actions-dropdown-head">
              <span className="actions-dropdown-eyebrow">PlotLab</span>
              <strong>Explorar módulos</strong>
            </div>
            <div className="actions-dropdown-scroll">
            <div className="actions-dropdown-grid">
            {onNavigateToMensajeria && (
              <span className="header-mensajeria-btn-wrap">
                <button
                  type="button"
                  className="brand-button"
                  onClick={() => {
                    setActionsOpen(false)
                    onNavigateToMensajeria()
                  }}
                >
                  ✉️ Mensajería
                </button>
                {showMensajeriaUnreadBadge && (
                  <span className="header-dm-unread-badge" title="Mensajes sin leer">
                    {dmMensajeriaUnread > 99 ? '99+' : dmMensajeriaUnread}
                  </span>
                )}
              </span>
            )}
            {onNavigateToStats && isAdmin && (
              <button className="brand-button" onClick={onNavigateToStats}>
                📊 Estadísticas
              </button>
            )}
            {canAccessAppCampo && (
              <Link
                to="/app-campo"
                className="brand-button"
                onClick={() => setActionsOpen(false)}
              >
                📱 App campo
                {campoSectorMode === 'both'
                  ? ' (Inst. / Met.)'
                  : campoSectorMode === 'metalurgica'
                    ? ' (Metalúrgica)'
                    : campoSectorMode === 'instalaciones'
                      ? ' (Instalaciones)'
                      : ''}
              </Link>
            )}
            {onNavigateToCalendar && (
              <button className="brand-button" onClick={onNavigateToCalendar}>
                📅 Calendario
              </button>
            )}
            {onNavigateToUsuarios && isAdmin && (
              <button className="brand-button" onClick={onNavigateToUsuarios}>
                👥 Usuarios
              </button>
            )}
            {canAccessMostradorViews && onNavigateToMostrador && (
              <button className="brand-button" onClick={onNavigateToMostrador}>
                📋 Dashboard Mostrador
              </button>
            )}
            {canAccessMostradorViews && (
              <Link
                to={VENTAS}
                className="brand-button"
                onClick={() => setActionsOpen(false)}
              >
                💰 Ventas
              </Link>
            )}
            {canAccessTotemImpresionPanel && (
              <Link
                to="/impresoras/totem"
                className="brand-button"
                onClick={() => setActionsOpen(false)}
              >
                🖨️ Pedidos tótem (impresión)
              </Link>
            )}
            {canManageCompras && onNavigateToCompras && (
              <button className="brand-button" onClick={onNavigateToCompras}>
                🛒 Compras
              </button>
            )}
            {canManageCaja && (
              <Link
                to={isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja'}
                className="brand-button"
                onClick={() => {
                  setActionsOpen(false)
                  onNavigateToCaja?.()
                }}
              >
                💰 Caja
              </Link>
            )}
            {(isDiseno || isMetalurgica || canAccessAppCampo || isAdmin) && (
              <Link to="/bolsa" className="brand-button" onClick={() => setActionsOpen(false)}>
                🧰 PlotBolsa
              </Link>
            )}
            {(isDiseno || isAdmin) && onNavigateToDiseno && (
              <button className="brand-button" onClick={onNavigateToDiseno}>
                🎨 Dashboard Diseño
              </button>
            )}
            {canManageRecursosHumanos && onNavigateToRecursosHumanos && (
              <button className="brand-button" onClick={onNavigateToRecursosHumanos}>
                👥 Recursos Humanos
              </button>
            )}
            {canAccessMostradorViews && onNavigateToClientesWeb && (
              <button className="brand-button" onClick={onNavigateToClientesWeb}>
                Clientes
              </button>
            )}
            {canAccessAsesorPresupuestos && onNavigateToAsesorPresupuestos && (
              <button className="brand-button" onClick={onNavigateToAsesorPresupuestos}>
                📐 DT
              </button>
            )}
            {(isTallerGrafico || isAdmin) && (
              <a
                href="/taller-grafico/inventario"
                className="brand-button"
              >
                🧴 Inventario Taller Gráfico
              </a>
            )}
            {(isMetalurgica || isAdmin) && (
              <a href="/metalurgica/inventario" className="brand-button">
                🔧 Inventario Metalúrgica
              </a>
            )}
            {(isTallerGrafico || isAdmin) && (
              <a
                href="/taller-grafico/dashboard"
                className="brand-button"
              >
                🧩 Kanban Taller Gráfico
              </a>
            )}
            {(isTallerImprenta || isAdmin) && (
              <a href="/taller-imprenta/panol" className="brand-button">
                🧰 Pañol Taller Imprenta
              </a>
            )}
            {onNavigateToFlota && (
              <button className="brand-button" onClick={onNavigateToFlota}>
                🚗 Gestión de Flota
              </button>
            )}
            {onNavigateToERP && isAdmin && (
              <button className="brand-button" onClick={onNavigateToERP}>
                💰 Sistema ERP
              </button>
            )}
            {(isDiseno || isAdmin) && (
              <a
                href="/briefs-pendientes"
                className="brand-button"
              >
                📋 Briefs Pendientes
              </a>
            )}
            <a
              href="/libro-actas"
              className="brand-button"
            >
              📝 Libro de Actas
            </a>
            <a
              href="/protocolos-bases"
              className="brand-button"
            >
              📚 Protocolos y Bases
            </a>
            <a
              href="/capacitaciones"
              className="brand-button"
            >
              📚 Capacitaciones
            </a>
            <Link
              to="/mis-pruebas"
              className="brand-button"
              onClick={() => setActionsOpen(false)}
            >
              📝 Mis evaluaciones
            </Link>
            <Link
              to="/manual"
              className="brand-button"
              onClick={() => setActionsOpen(false)}
              title="Manual de usuario actualizado"
            >
              📖 Manual
            </Link>
            <a
              href="/mis-pedidos"
              className="brand-button"
            >
              📋 Mis Pedidos
            </a>
            {onLogout && (
              <button className="brand-button logout-button" onClick={onLogout} title="Cerrar sesión">
                🚪 Salir
              </button>
            )}
            </div>
            </div>
          </div>
          {currentUserName && (
            <div className="user-chip header-user-chip" title="Usuario conectado">
              <div className="user-avatar">
                {currentUserName.slice(0, 1).toUpperCase()}
              </div>
              <div className="user-meta">
                <span>Conectado</span>
                <strong>{currentUserName}</strong>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {!compactPhone && (
        <div className="header-stats header-stats--single">
          <div className="header-stat-card header-stat-card--spotlight">
            <HeaderSpotlightCard userId={usuario?.id} />
          </div>
          <aside className="header-stats-rail" aria-label="Estado y actualización">
            <div className="header-status-card header-status-card--rail" aria-label="Hora y clima">
              <ClockWidget compact />
              <div className="header-status-divider" aria-hidden />
              <WeatherWidget />
            </div>
            <div className="header-stats-rail-update">
              <PwaUpdateButton className="header-util-btn header-util-btn--pwa header-util-btn--pwa-rail" />
            </div>
          </aside>
        </div>
      )}
      <PwaUpdateModalHost />
    </header>
  )
}

export default Header

