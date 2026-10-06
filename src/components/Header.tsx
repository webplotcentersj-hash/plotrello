import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { buildHeaderQuickNavItems, type HeaderQuickNavItem } from '../utils/headerQuickNav'
import { HeaderNavGlyph, glyphMetaForNavId } from './HeaderNavGlyph'
import type { ActivityEvent, TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { canVerActividadesOperarios } from '../features/work-pool/workPoolOperarioNotas'
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
import { CLIENTES_DASHBOARD } from '../utils/clientesRoutes'
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
  /** Botones de estadísticas / movimientos / herramientas del tablero. */
  boardTools?: ReactNode
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
  compactPhone = false,
  boardTools
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
    canAccessClientesConsulta,
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
  const canVerPanelActividadesOperarios = canVerActividadesOperarios(usuario)
  const quickNavBadges = useHeaderQuickNavBadges()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [menuQuery, setMenuQuery] = useState('')
  const actionsRef = useRef<HTMLDivElement>(null)
  const menuSearchRef = useRef<HTMLInputElement>(null)

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

  const quickNavIds = useMemo(() => new Set(quickNavItems.map((item) => item.id)), [quickNavItems])

  const moreMenuItems = useMemo((): HeaderQuickNavItem[] => {
    const extras: HeaderQuickNavItem[] = []
    const skip = (id: string) => quickNavIds.has(id)
    const push = (item: HeaderQuickNavItem) => {
      if (!extras.some((e) => e.id === item.id) && !skip(item.id)) extras.push(item)
    }

    if (onNavigateToMensajeria) {
      push({
        id: 'mensajeria',
        label: 'Mensajería',
        icon: '✉️',
        onClick: onNavigateToMensajeria,
        badge: showMensajeriaUnreadBadge ? dmMensajeriaUnread : 0
      })
    }
    if (canAccessAppCampo && !skip('dashboard-campo-inst')) {
      push({
        id: 'app-campo',
        label:
          campoSectorMode === 'both'
            ? 'App campo (Inst. / Met.)'
            : campoSectorMode === 'metalurgica'
              ? 'App campo (Metalúrgica)'
              : campoSectorMode === 'instalaciones'
                ? 'App campo (Instalaciones)'
                : 'App campo',
        icon: '📱',
        href: '/app-campo'
      })
    }
    if (onNavigateToCalendar) {
      push({ id: 'calendario', label: 'Calendario', icon: '📅', onClick: onNavigateToCalendar })
    }
    if (onNavigateToUsuarios && isAdmin) {
      push({ id: 'usuarios', label: 'Usuarios', icon: '👥', onClick: onNavigateToUsuarios })
    }
    if (canAccessMostradorViews && onNavigateToMostrador) {
      push({
        id: 'dashboard-mostrador',
        label: 'Mostrador',
        icon: '📋',
        onClick: onNavigateToMostrador
      })
    }
    if (canAccessMostradorViews) {
      push({ id: 'ventas', label: 'Ventas', icon: '🧾', href: VENTAS })
    }
    if (canAccessTotemImpresionPanel) {
      push({
        id: 'impresoras-totem',
        label: 'Pedidos tótem',
        icon: '🖨️',
        href: '/impresoras/totem',
        badge: quickNavBadges['impresoras-totem'] ?? 0
      })
    }
    if (canManageCompras && onNavigateToCompras) {
      push({ id: 'dashboard-compras', label: 'Compras', icon: '🛒', onClick: onNavigateToCompras })
    }
    if (canManageCaja) {
      push({
        id: 'dashboard-caja',
        label: 'Caja',
        icon: '🏦',
        href: isAdmin ? '/caja/dashboard/admin' : '/caja/dashboard/caja',
        onClick: onNavigateToCaja
      })
    }
    if (isDiseno || isMetalurgica || canAccessAppCampo || isAdmin) {
      push({ id: 'plotbolsa', label: 'PlotBolsa', icon: '🧰', href: '/bolsa' })
    }
    if ((isDiseno || isAdmin) && onNavigateToDiseno) {
      push({ id: 'dashboard-diseno', label: 'Diseño', icon: '🎨', onClick: onNavigateToDiseno })
    }
    if (canManageRecursosHumanos && onNavigateToRecursosHumanos) {
      push({ id: 'dashboard-rrhh', label: 'Recursos Humanos', icon: '👥', onClick: onNavigateToRecursosHumanos })
    }
    if (canAccessClientesConsulta && !skip('clientes-consulta')) {
      push({ id: 'clientes-dashboard', label: 'Clientes', icon: '👥', href: CLIENTES_DASHBOARD })
    }
    if (canAccessMostradorViews && onNavigateToClientesWeb) {
      push({ id: 'portal-web', label: 'Portal web', icon: '🌐', onClick: onNavigateToClientesWeb })
    }
    if (canAccessAsesorPresupuestos && onNavigateToAsesorPresupuestos) {
      push({ id: 'dashboard-dt', label: 'DT', icon: '📐', onClick: onNavigateToAsesorPresupuestos })
    }
    if (isTallerGrafico || isAdmin) {
      push({ id: 'inventario-tg', label: 'Inventario Taller', icon: '🧴', href: '/taller-grafico/inventario' })
      if (!skip('dashboard-taller')) {
        push({ id: 'kanban-tg', label: 'Kanban Taller', icon: '🧩', href: '/taller-grafico/dashboard' })
      }
    }
    if ((isMetalurgica || isAdmin) && !skip('dashboard-metalurgica')) {
      push({ id: 'inventario-metal', label: 'Inventario Metalúrgica', icon: '🔧', href: '/metalurgica/inventario' })
    }
    if ((isTallerImprenta || isAdmin) && !skip('panol-taller-imprenta') && !skip('panol-taller-imprenta-admin') && !skip('panol-taller-imprenta-gerencia')) {
      push({ id: 'panol-taller-imprenta', label: 'Pañol Imprenta', icon: '🧰', href: '/taller-imprenta/panol' })
    }
    if (onNavigateToFlota) {
      push({ id: 'flota', label: 'Flota', icon: '🚗', onClick: onNavigateToFlota })
    }
    if (onNavigateToERP && isAdmin) {
      push({ id: 'dashboard-erp', label: 'ERP', icon: '💰', onClick: onNavigateToERP })
    }
    if (onNavigateToStats && isAdmin) {
      push({ id: 'dashboard-stats', label: 'Estadísticas', icon: '📊', onClick: onNavigateToStats })
    }
    if (isDiseno || isAdmin) {
      push({ id: 'briefs', label: 'Briefs pendientes', icon: '📋', href: '/briefs-pendientes' })
    }
    push({ id: 'libro-actas', label: 'Libro de actas', icon: '📝', href: '/libro-actas' })
    push({ id: 'protocolos', label: 'Protocolos y bases', icon: '📚', href: '/protocolos-bases' })
    push({ id: 'capacitaciones', label: 'Capacitaciones', icon: '📚', href: '/capacitaciones' })
    push({ id: 'evaluaciones', label: 'Mis evaluaciones', icon: '📝', href: '/mis-pruebas' })
    push({ id: 'manual', label: 'Manual', icon: '📖', href: '/manual' })
    push({ id: 'mis-pedidos', label: 'Mis pedidos', icon: '📋', href: '/mis-pedidos' })
    return extras
  }, [
    quickNavIds,
    onNavigateToMensajeria,
    showMensajeriaUnreadBadge,
    dmMensajeriaUnread,
    canAccessAppCampo,
    campoSectorMode,
    onNavigateToCalendar,
    onNavigateToUsuarios,
    isAdmin,
    canAccessMostradorViews,
    onNavigateToMostrador,
    canAccessTotemImpresionPanel,
    quickNavBadges,
    canManageCompras,
    onNavigateToCompras,
    canManageCaja,
    onNavigateToCaja,
    isDiseno,
    isMetalurgica,
    onNavigateToDiseno,
    canManageRecursosHumanos,
    onNavigateToRecursosHumanos,
    canAccessClientesConsulta,
    onNavigateToClientesWeb,
    canAccessAsesorPresupuestos,
    onNavigateToAsesorPresupuestos,
    isTallerGrafico,
    isTallerImprenta,
    onNavigateToFlota,
    onNavigateToERP,
    onNavigateToStats
  ])

  const allMenuItems = useMemo(() => {
    const seen = new Set<string>()
    const list: HeaderQuickNavItem[] = []
    for (const item of [...quickNavItems, ...moreMenuItems]) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      list.push(item)
    }
    return list
  }, [quickNavItems, moreMenuItems])

  const filteredMenuItems = useMemo(() => {
    const q = menuQuery.trim().toLowerCase()
    if (!q) return allMenuItems
    const tokens = q.split(/\s+/).filter(Boolean)
    return allMenuItems.filter((item) => {
      const hay = [item.label, item.title, item.id].filter(Boolean).join(' ').toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
  }, [allMenuItems, menuQuery])

  const menuBadgeCount = useMemo(
    () => allMenuItems.reduce((sum, item) => sum + (item.badge ?? 0), 0),
    [allMenuItems]
  )

  useEffect(() => {
    if (!actionsOpen) return
    setMenuQuery('')
    const focusTimer = window.setTimeout(() => menuSearchRef.current?.focus(), 40)
    const onDown = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (!actionsRef.current?.contains(event.target)) setActionsOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menuSearchRef.current && document.activeElement === menuSearchRef.current && menuSearchRef.current.value) {
        setMenuQuery('')
        return
      }
      setActionsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [actionsOpen])

  const closeMenu = () => setActionsOpen(false)

  const renderMenuBadge = (count: number) =>
    count > 0 ? (
      <span className="header-menu-badge" title={`${count} novedad${count === 1 ? '' : 'es'}`}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null

  const renderMenuItem = (item: HeaderQuickNavItem) => {
    const { glyph, tone } = glyphMetaForNavId(item.id)
    const className = `header-menu-item header-menu-item--tile${
      item.id.startsWith('dashboard-') || item.id === 'panel-admin' ? ' header-menu-item--primary' : ''
    }`
    const inner = (
      <>
        <span className="header-menu-glyph" data-tone={tone} aria-hidden>
          <HeaderNavGlyph id={glyph} size={22} />
        </span>
        <span className="header-menu-label">{item.label}</span>
        {renderMenuBadge(item.badge ?? 0)}
      </>
    )
    const activate = () => {
      closeMenu()
      item.onClick?.()
    }
    if (item.href && item.external) {
      return (
        <a
          key={item.id}
          href={item.href}
          className={className}
          title={item.title ?? item.label}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMenu}
        >
          {inner}
        </a>
      )
    }
    if (item.href) {
      return (
        <Link
          key={item.id}
          to={item.href}
          className={className}
          title={item.title ?? item.label}
          onClick={() => {
            closeMenu()
            item.onClick?.()
          }}
        >
          {inner}
        </Link>
      )
    }
    return (
      <button
        key={item.id}
        type="button"
        className={className}
        title={item.title ?? item.label}
        onClick={activate}
      >
        {inner}
      </button>
    )
  }

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
        <div className="header-actions" ref={actionsRef}>
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
            {boardTools && (
              <>
                <span className="header-util-divider" aria-hidden />
                <div className="header-util-tools">{boardTools}</div>
              </>
            )}
            <span className="header-util-divider" aria-hidden />
            <TemaToggle className="header-util-btn header-util-btn--tema" />
            <span className="header-util-divider" aria-hidden />
            <button
              className={`header-util-btn actions-toggle${menuBadgeCount > 0 ? ' has-mensajeria-unread' : ''}${actionsOpen ? ' actions-toggle--open' : ''}`}
              type="button"
              onClick={() => setActionsOpen((prev) => !prev)}
              aria-expanded={actionsOpen}
              aria-label={
                menuBadgeCount > 0
                  ? `Menú de módulos. Novedades: ${menuBadgeCount}`
                  : 'Menú de módulos'
              }
              title={actionsOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              <span className="actions-toggle-icon" aria-hidden>
                <HeaderNavGlyph id={actionsOpen ? 'close' : 'menu'} size={18} />
              </span>
              <span className="actions-toggle-label">Menú</span>
              {renderMenuBadge(menuBadgeCount)}
            </button>
          </div>

          <div className={`actions-dropdown ${actionsOpen ? 'open' : ''}`} role="menu" aria-label="Menú de módulos">
            <div className="actions-dropdown-head">
              <div className="actions-dropdown-head__copy">
                <span className="actions-dropdown-eyebrow">Plot Lab</span>
                <strong>Módulos</strong>
              </div>
              <label className="header-menu-search">
                <span className="header-menu-search__icon" aria-hidden>
                  <HeaderNavGlyph id="search" size={15} />
                </span>
                <input
                  ref={menuSearchRef}
                  type="search"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  placeholder="Buscar herramienta…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Buscar herramienta o módulo"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                />
              </label>
            </div>
            <div className="actions-dropdown-scroll">
              {filteredMenuItems.length > 0 ? (
                <div className="header-menu-tiles">{filteredMenuItems.map((item) => renderMenuItem(item))}</div>
              ) : (
                <p className="header-menu-empty">
                  {menuQuery.trim() ? 'Ninguna herramienta coincide.' : 'No hay módulos para mostrar.'}
                </p>
              )}
              {onLogout && (
                <button
                  type="button"
                  className="header-menu-item header-menu-item--tile header-menu-item--logout"
                  onClick={() => {
                    closeMenu()
                    onLogout()
                  }}
                  title="Cerrar sesión"
                >
                  <span className="header-menu-glyph" data-tone="rose" aria-hidden>
                    <HeaderNavGlyph id="door" size={22} />
                  </span>
                  <span className="header-menu-label">Salir</span>
                </button>
              )}
            </div>
          </div>
          {currentUserName && (
            canVerPanelActividadesOperarios ? (
              <Link
                to="/actividades-operarios"
                className="user-chip header-user-chip header-user-chip--link"
                title="Ver actividades de operarios"
              >
                <div className="user-avatar">
                  {currentUserName.slice(0, 1).toUpperCase()}
                </div>
                <div className="user-meta">
                  <span>Actividades operarios</span>
                  <strong>{currentUserName}</strong>
                </div>
              </Link>
            ) : (
              <div className="user-chip header-user-chip" title="Usuario conectado">
                <div className="user-avatar">
                  {currentUserName.slice(0, 1).toUpperCase()}
                </div>
                <div className="user-meta">
                  <span>Conectado</span>
                  <strong>{currentUserName}</strong>
                </div>
              </div>
            )
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

