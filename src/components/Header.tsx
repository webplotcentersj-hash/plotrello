import { useState } from 'react'
import type { ActivityEvent, TeamMember } from '../types/board'
import { useAuth } from '../hooks/useAuth'
import NotificationsDropdown from './NotificationsDropdown'
import ClockWidget from './ClockWidget'
import WeatherWidget from './WeatherWidget'
import './Header.css'

type HeaderProps = {
  teamMembers: TeamMember[]
  activity: ActivityEvent[]
  currentUserName?: string
  onOptimizeSprint?: () => void
  onNavigateToStats?: () => void
  onNavigateToCalendar?: () => void
  onNavigateToGantt?: () => void
  onNavigateToUsuarios?: () => void
  onNavigateToHerramienta?: () => void
  onNavigateToMostrador?: () => void
  onNavigateToCompras?: () => void
  onNavigateToDiseno?: () => void
  onNavigateToRecursosHumanos?: () => void
  onNavigateToClientesWeb?: () => void
  onNavigateToAsesorPresupuestos?: () => void
  onNavigateToFlota?: () => void
  onNavigateToERP?: () => void
  onSolicitarProductos?: () => void
  onOpenChatAI?: () => void
  onNavigateToChat?: () => void
  onLogout?: () => void
  isAdmin?: boolean
  isMostrador?: boolean
  isDiseno?: boolean
  isCompact?: boolean
  onToggleCompact?: () => void
}

const Header = ({
  teamMembers,
  activity,
  currentUserName,
  onOptimizeSprint,
  onNavigateToStats,
  onNavigateToCalendar,
  onNavigateToGantt,
  onNavigateToUsuarios,
  onNavigateToHerramienta,
  onNavigateToMostrador,
  onNavigateToCompras,
  onNavigateToDiseno,
  onNavigateToRecursosHumanos,
  onNavigateToClientesWeb,
  onNavigateToAsesorPresupuestos,
  onNavigateToFlota,
  onNavigateToERP,
  onSolicitarProductos,
  onOpenChatAI,
  onNavigateToChat,
  onLogout,
  isAdmin: isAdminProp = false,
  isMostrador = false,
  isDiseno = false,
  isCompact = false,
  onToggleCompact
}: HeaderProps) => {
  const { canManageCompras, canManageRecursosHumanos, isAdmin: isAdminFromAuth, isAsesorTecnico, isPresupuestos } = useAuth()
  const isAdmin = isAdminProp || isAdminFromAuth
  const canAccessAsesorPresupuestos = isAdmin || isAsesorTecnico || isPresupuestos
  const [actionsOpen, setActionsOpen] = useState(false)
  const today = new Date()
  const movesToday = activity.filter((event) => {
    const eventDate = new Date(event.timestamp)
    return (
      eventDate.getFullYear() === today.getFullYear() &&
      eventDate.getMonth() === today.getMonth() &&
      eventDate.getDate() === today.getDate()
    )
  }).length

  const highPriority = teamMembers.length
  const activePeople = new Set(activity.map((event) => event.actorId)).size

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
          <NotificationsDropdown onNotificationClick={(notification) => {
            // Si es una notificación de mención del chat, navegar al chat
            if (notification.type === 'mention' && notification.description?.includes('te mencionó en')) {
              onNavigateToChat?.()
            }
          }} />
          <button
            className="ghost-button actions-toggle"
            type="button"
            onClick={() => setActionsOpen((prev) => !prev)}
            aria-expanded={actionsOpen}
            aria-label="Abrir menú de acciones"
          >
          {actionsOpen ? '✕' : '☰'}
          </button>
          <div className={`actions-dropdown ${actionsOpen ? 'open' : ''}`}>
            {onOpenChatAI && (
              <button className="brand-button ai-button" onClick={onOpenChatAI}>
                🤖 PlotAI
              </button>
            )}
            {onNavigateToChat && (
              <button className="brand-button chat-button" onClick={onNavigateToChat}>
                💬 Chat
              </button>
            )}
            {onNavigateToStats && isAdmin && (
              <button className="brand-button" onClick={onNavigateToStats}>
                📊 Estadísticas
              </button>
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
            {onToggleCompact && (
              <button 
                className="brand-button" 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Botón Vista expandida/Modo compacto clickeado. Estado actual:', isCompact)
                  onToggleCompact()
                }}
                title={isCompact ? 'Cambiar a vista expandida' : 'Cambiar a modo compacto'}
              >
                {isCompact ? '🪄 Vista expandida' : '🧊 Modo compacto'}
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
            {(isMostrador || isAdmin) && onNavigateToMostrador && (
              <button className="brand-button" onClick={onNavigateToMostrador}>
                📋 Dashboard Mostrador
              </button>
            )}
            {(isMostrador || isAdmin) && (
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
            {(isAdmin || isMostrador) && onNavigateToClientesWeb && (
              <button className="brand-button" onClick={onNavigateToClientesWeb}>
                🌐 Clientes Web
              </button>
            )}
            {canAccessAsesorPresupuestos && onNavigateToAsesorPresupuestos && (
              <button className="brand-button" onClick={onNavigateToAsesorPresupuestos}>
                📐 DT
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
            {isAdmin && (
              <AdminAlertButton />
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
            {onOptimizeSprint && (
              <button className="brand-button" onClick={onOptimizeSprint}>
                Optimizar sprint
              </button>
            )}
            <a
              href="https://tools.plotcenter.com.ar/"
              target="_blank"
              rel="noopener noreferrer"
              className="brand-button tools-button"
            >
              🔧 Herramientas
            </a>
            {(isDiseno || isAdmin) && (
              <a
                href="https://aitools.plotcenter.com.ar/"
                target="_blank"
                rel="noopener noreferrer"
                className="brand-button ai-tools-button"
              >
                🤖 AI Tools
              </a>
            )}
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

      <div className="header-stats">
        <div className="header-stat-card">
          <span>Movimientos hoy</span>
          <strong>{movesToday}</strong>
        </div>
        <div className="header-stat-card">
          <span>Personas activas</span>
          <strong>{activePeople}</strong>
        </div>
        <div className="header-stat-card">
          <span>Squad Trello Plot</span>
          <strong>{highPriority}</strong>
        </div>
      </div>
    </header>
  )
}

export default Header

