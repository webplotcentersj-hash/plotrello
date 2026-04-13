import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ActivityEvent, TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import { useDmMensajeriaUnread } from '../hooks/useDmMensajeriaUnread'
import NotificationsDropdown from './NotificationsDropdown'
import HeaderSpotlightCard from './HeaderSpotlightCard'
import ClockWidget from './ClockWidget'
import WeatherWidget from './WeatherWidget'
import AdminAlertButton from './AdminAlertButton'
import PwaUpdateButton from './PwaUpdateButton'
import './Header.css'

type HeaderProps = {
  teamMembers: TeamMember[]
  activity: ActivityEvent[]
  currentUserName?: string
  onNavigateToStats?: () => void
  onNavigateToCalendar?: () => void
  onNavigateToGantt?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToHerramienta?: () => void
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
  onNavigateToChat?: () => void
  onNavigateToMensajeria?: () => void
  onLogout?: () => void
  isAdmin?: boolean
  isMostrador?: boolean
  isDiseno?: boolean
}

const Header = ({
  teamMembers: _teamMembers,
  activity: _activity,
  currentUserName,
  onNavigateToStats,
  onNavigateToCalendar,
  onNavigateToGantt,
  onNavigateToUsuarios,
  onNavigateToHerramienta,
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
  onNavigateToChat,
  onNavigateToMensajeria,
  onLogout,
  isAdmin: isAdminProp = false,
  isMostrador = false,
  isDiseno = false
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
    isTallerGrafico,
    isInstalaciones,
    isMetalurgica
  } = useAuth()
  const location = useLocation()
  const dmMensajeriaUnread = useDmMensajeriaUnread(usuario?.id)
  const showMensajeriaUnreadBadge =
    dmMensajeriaUnread > 0 && !!onNavigateToMensajeria && location.pathname !== '/mensajeria'
  const isAdmin = isAdminProp || isAdminFromAuth
  const canAccessAsesorPresupuestos = isAdmin || isAsesorTecnico || isPresupuestos
  const [actionsOpen, setActionsOpen] = useState(false)

  return (
    <header className="tp-header">
      <div className="header-line">
        <div className="header-brand">
          <img 
            src="https://trello.plotcenter.com.ar/Group%20187.png" 
            alt="Plot Center Logo" 
            className="header-logo"
          />
          <h1>Plot Lab</h1>
        </div>
        <div className="header-actions">
          <ClockWidget />
          <WeatherWidget />
          <PwaUpdateButton className="ghost-button pwa-update-button" />
          <NotificationsDropdown onNotificationClick={(notification) => {
            // Si es una notificación de mención del chat, navegar al chat
            if (notification.type === 'mention' && notification.description?.includes('te mencionó en')) {
              onNavigateToChat?.()
            }
          }} />
          {isAdmin && (
            <AdminAlertButton />
          )}
          <button
            className={`ghost-button actions-toggle ${showMensajeriaUnreadBadge ? 'has-mensajeria-unread' : ''}`}
            type="button"
            onClick={() => setActionsOpen((prev) => !prev)}
            aria-expanded={actionsOpen}
            aria-label={
              showMensajeriaUnreadBadge
                ? `Abrir menú de acciones. Mensajes sin leer en mensajería: ${dmMensajeriaUnread}`
                : 'Abrir menú de acciones'
            }
          >
          {actionsOpen ? '✕' : '☰'}
          </button>
          <div className={`actions-dropdown ${actionsOpen ? 'open' : ''}`}>
            <PwaUpdateButton className="ghost-button pwa-update-button" />
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
            {(isInstalaciones || isMetalurgica || isAdmin) && (
              <Link
                to="/app-campo"
                className="brand-button"
                onClick={() => setActionsOpen(false)}
              >
                📱 App campo
                {isAdmin
                  ? ' (Inst. / Met.)'
                  : isMetalurgica
                    ? ' (Metalúrgica)'
                    : ' (Instalaciones)'}
              </Link>
            )}
            {onNavigateToCalendar && (
              <button className="brand-button" onClick={onNavigateToCalendar}>
                📅 Calendario
              </button>
            )}
            {onNavigateToGantt && (
              <button className="brand-button" onClick={onNavigateToGantt}>
                📈 Gantt
              </button>
            )}
            {onNavigateToUsuarios && isAdmin && (
              <button className="brand-button" onClick={onNavigateToUsuarios}>
                👥 Usuarios
              </button>
            )}
            {onNavigateToHerramienta && (
              <button className="brand-button" onClick={onNavigateToHerramienta}>
                🛠️ Nueva Herramienta
              </button>
            )}
            {(isMostrador || isAdmin || isPresupuestos) && onNavigateToMostrador && (
              <button className="brand-button" onClick={onNavigateToMostrador}>
                📋 Dashboard Mostrador
              </button>
            )}
            {(isMostrador || isAdmin || isPresupuestos) && (
              <a
                href="/crm-ventas"
                className="brand-button"
              >
                💼 CRM Ventas
              </a>
            )}
            {canManageCompras && onNavigateToCompras && (
              <button className="brand-button" onClick={onNavigateToCompras}>
                🛒 Compras
              </button>
            )}
            {canManageCompras && (
              <a
                href="/compras/calendario-entregas"
                className="brand-button"
              >
                📅 Calendario Entregas
              </a>
            )}
            {canManageCaja && (
              <Link
                to="/caja/dashboard"
                className="brand-button"
                onClick={() => {
                  setActionsOpen(false)
                  onNavigateToCaja?.()
                }}
              >
                💰 Caja
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
            {(isAdmin || isMostrador || isPresupuestos || canManageCaja) && onNavigateToClientesWeb && (
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
            {(isTallerGrafico || isAdmin) && (
              <a
                href="/taller-grafico/dashboard"
                className="brand-button"
              >
                🧩 Kanban Taller Gráfico
              </a>
            )}
            {canAccessAtencionPublico && onNavigateToAtencionPublico && (
              <button className="brand-button" onClick={onNavigateToAtencionPublico}>
                📞 Atención al público
              </button>
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
              href="/galeria"
              className="brand-button"
            >
              🖼️ Galería
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
            <button
              className="brand-button"
              onClick={() => {
                // Descargar el manual
                fetch('/MANUAL_USUARIO.md')
                  .then(response => response.blob())
                  .then(blob => {
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'MANUAL_USUARIO_TRELLO_PLOT.md'
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                  })
                  .catch(error => {
                    console.error('Error descargando manual:', error)
                    alert('Error al descargar el manual. Por favor, intenta nuevamente.')
                  })
              }}
              title="Descargar manual de usuario en formato Markdown"
            >
              📖 Descargar Manual
            </button>
            <a
              href="/menu-diario"
              className="brand-button"
            >
              🍽️ Menú Diario
            </a>
            {onSolicitarProductos && (
              <button className="brand-button" onClick={onSolicitarProductos}>
                📦 Solicitar Productos
              </button>
            )}
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
          {currentUserName && (
            <div className="user-chip" title="Usuario conectado">
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

      <div className="header-stats header-stats--single">
        <div className="header-stat-card header-stat-card--spotlight">
          <HeaderSpotlightCard userId={usuario?.id} />
        </div>
      </div>
    </header>
  )
}

export default Header

