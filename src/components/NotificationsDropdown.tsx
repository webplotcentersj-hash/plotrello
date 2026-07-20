import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { operarioExternoHomeRoute } from '../features/work-pool/workPoolOperarioExterno'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { Notification } from '../types/api'
import { ventasConOportunidadId, ventasConVentaId } from '../utils/ventasRoutes'
import './NotificationsDropdown.css'

import {
  formatNotificationForDisplay,
  getTotemNotificationNavigatePath,
  notificationIsTotemAtencionMostrador,
  notificationIsTotemSolicitudAsesor,
} from '../utils/totemNotifications'
import {
  briefsPendientesPath,
  notificationIsBriefPublico,
  parseBriefIdFromNotification
} from '../utils/briefsPendientesNuevos'

function notificationIsWorkPoolBolsa(n: Pick<Notification, 'title'>): boolean {
  const title = (n.title ?? '').trim()
  return title.startsWith('[Plot Design]') || title.startsWith('[Bolsa Plot]')
}

/** Coincide con títulos/textos insertados por solicitar/responder_intercambio_turno_menu (menú diario). */
function notificationTargetsMenuDiario(n: Pick<Notification, 'title' | 'description'>): boolean {
  const title = (n.title ?? '').toLowerCase()
  const desc = (n.description ?? '').toLowerCase()
  if (title.includes('intercambio de turno')) return true
  if (desc.includes('menú diario') || desc.includes('menu diario')) return true
  if (desc.includes('menú del día') || desc.includes('menu del dia')) return true
  if (desc.includes('menú de hoy') || desc.includes('menu de hoy')) return true
  return false
}

type NotificationsDropdownProps = {
  onNotificationClick?: (notification: Notification) => void
}

const NotificationsDropdown = ({ onNotificationClick }: NotificationsDropdownProps) => {
  const { usuario, canManageRecursosHumanos, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState({ top: 0, right: 12 })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const updatePanelPosition = () => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setPanelStyle({
      top: rect.bottom + 12,
      right: Math.max(12, window.innerWidth - rect.right)
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [isOpen])

  // Cargar notificaciones
  const loadNotifications = async () => {
    if (!usuario?.id) {
      console.log('🔔 Notificaciones: No hay usuario.id')
      return
    }

    console.log('🔔 Cargando notificaciones para usuario ID:', usuario.id)
    setLoading(true)
    try {
      const response = await apiService.getUserNotifications(usuario.id)
      console.log('🔔 Respuesta de getUserNotifications:', response)
      if (response.success && response.data) {
        console.log('🔔 Notificaciones cargadas:', response.data.length)
        setNotifications(response.data)
      } else {
        console.warn('🔔 Error en respuesta:', response.error)
      }
    } catch (error) {
      console.error('🔔 Error cargando notificaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  // Marcar notificación como leída
  const markAsRead = async (notificationId: number) => {
    try {
      const response = await apiService.markNotificationAsRead(notificationId)
      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        )
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    if (!usuario?.id) return

    try {
      const response = await apiService.markAllNotificationsAsRead(usuario.id)
      if (response.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      }
    } catch (error) {
      console.error('Error marcando todas como leídas:', error)
    }
  }

  // Cargar notificaciones al montar y cuando cambia el usuario
  useEffect(() => {
    loadNotifications()
  }, [usuario?.id])

  // Suscripción a Realtime para nuevas notificaciones
  useEffect(() => {
    if (!usuario?.id || !supabase) {
      console.warn('🔔 Notificaciones Realtime: Usuario o Supabase no disponible')
      return
    }

    console.log('🔔 Configurando suscripción Realtime para usuario:', usuario.id)

    const channel = supabase
      .channel(`notifications:${usuario.id}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        (payload: any) => {
          console.log('🔔 Nueva notificación recibida vía Realtime:', payload)
          const newNotification = payload.new as Notification
          setNotifications((prev) => {
            // Evitar duplicados
            const exists = prev.some((n) => n.id === newNotification.id)
            if (exists) {
              console.log('⚠️ Notificación duplicada ignorada:', newNotification.id)
              return prev
            }
            console.log('✅ Notificación agregada a la lista')
            return [newNotification, ...prev]
          })
          
          // Mostrar notificación del navegador si está permitido
          if ('Notification' in window && Notification.permission === 'granted') {
            const bn = new Notification(newNotification.title, {
              body: newNotification.description || '',
              icon: '/vite.svg',
              tag: `notification-${newNotification.id}`
            })
            if (notificationTargetsMenuDiario(newNotification)) {
              bn.onclick = () => {
                window.focus()
                navigate('/menu-diario')
                bn.close()
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        (payload: any) => {
          console.log('🔔 Notificación actualizada vía Realtime:', payload)
          const updatedNotification = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          )
        }
      )
      .subscribe((status) => {
        console.log(`🔔 Estado de suscripción Realtime: ${status}`)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción Realtime activa para notificaciones')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal Realtime de notificaciones')
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Timeout en suscripción Realtime de notificaciones')
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Canal Realtime de notificaciones cerrado')
        }
      })

    return () => {
      console.log('🧹 Limpiando suscripción Realtime de notificaciones')
      void channel.unsubscribe()
    }
  }, [usuario?.id])

  // Cerrar al clic fuera (panel en portal: incluir panelRef)
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [isOpen])

  // Solicitar permiso para notificaciones del navegador
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours} h`
    if (diffDays < 7) return `Hace ${diffDays} días`
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit'
    }).format(time)
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    setIsOpen(false)

    if (onNotificationClick) {
      onNotificationClick(notification)
    }

    try {
      if (notificationIsWorkPoolBolsa(notification)) {
        const route = operarioExternoHomeRoute(usuario?.rol) ?? '/plot-design'
        if (notification.pedido_id != null) {
          navigate(`${route}?view=mensajes&pedido=${notification.pedido_id}`)
        } else {
          navigate(`${route}?view=mis`)
        }
        return
      }
      // Briefs públicos → lista de pendientes (con highlight si hay id)
      if (notificationIsBriefPublico(notification)) {
        navigate(briefsPendientesPath(parseBriefIdFromNotification(notification)))
        return
      }
      // Atención al público / chat de solicitud
      if (notification.solicitud_chat_id != null) {
        navigate(`/atencion-publico?solicitud_chat=${notification.solicitud_chat_id}`)
        return
      }
      // Reclamo de atención al público
      if (notification.reclamo_id != null) {
        navigate(`/atencion-publico?tab=reclamos`)
        return
      }
      // Menú diario (intercambio de turno u otros avisos con copy del menú del día)
      if (notificationTargetsMenuDiario(notification)) {
        navigate('/menu-diario')
        return
      }
      // Tótem: solicitud de asesor → panel /asesor
      if (notificationIsTotemSolicitudAsesor(notification)) {
        navigate('/asesor')
        return
      }
      // Tótem / atención mostrador: canal del sector del usuario
      if (notificationIsTotemAtencionMostrador(notification)) {
        navigate(getTotemNotificationNavigatePath(notification, usuario?.rol))
        return
      }
      // Menciones en el chat (@usuario)
      if (notification.type === 'mention' || notification.description?.includes('te mencionó')) {
        navigate('/chat')
        return
      }
      // Pedido de compra
      if (notification.pedido_id != null) {
        navigate(`/compras/pedidos/${notification.pedido_id}`)
        return
      }
      // Orden de trabajo: obtener número de OP y abrir vista de OP
      if (notification.orden_id != null) {
        const res = await apiService.getOrden(notification.orden_id)
        if (res.success && res.data?.numero_op) {
          navigate(`/op/${encodeURIComponent(res.data.numero_op)}`)
        } else {
          navigate('/')
        }
        return
      }
      // Venta (CRM)
      if (notification.venta_id != null) {
        navigate(ventasConVentaId(notification.venta_id))
        return
      }
      // Oportunidad (CRM)
      if (notification.oportunidad_id != null) {
        navigate(ventasConOportunidadId(notification.oportunidad_id))
        return
      }
      // Solicitud de permiso / ausencia
      if (notification.solicitud_id != null) {
        if (canManageRecursosHumanos || isAdmin) {
          navigate(`/rrhh/permisos?solicitud=${notification.solicitud_id}`)
        } else {
          navigate(`/avisar-ausencia?solicitud=${notification.solicitud_id}`)
        }
        return
      }
      // Comunicados RRHH (notificador masivo)
      if (notification.origen === 'rrhh_masivo') {
        navigate(`/avisar-ausencia?comunicado=${notification.id}`)
        return
      }
      // Capacitación
      if (notification.capacitacion_id != null) {
        navigate('/rrhh/capacitaciones')
        return
      }
      // Sin enlace específico: ir al tablero
      navigate('/')
    } catch (error) {
      console.error('Error navegando desde notificación:', error)
      navigate('/')
    }
  }

  const panelContent = (
    <>
      <div className="notifications-header">
        <h3>Notificaciones</h3>
        {unreadCount > 0 && (
          <button type="button" className="mark-all-read-btn" onClick={markAllAsRead}>
            Marcar todas como leídas
          </button>
        )}
      </div>

      <div className="notifications-list">
        {loading ? (
          <div className="notifications-loading">Cargando...</div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">No hay notificaciones</div>
        ) : (
          notifications.map((notification) => {
            const display = formatNotificationForDisplay(notification)
            return (
            <div
              key={notification.id}
              className={`notification-item ${!notification.is_read ? 'unread' : ''} ${notification.type}${
                notificationIsTotemSolicitudAsesor(notification) ? ' totem-asesor' : ''
              }${notificationIsTotemAtencionMostrador(notification) ? ' totem-atencion' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-icon">{display.icon}</div>
              <div className="notification-content">
                <div className="notification-title">{display.title}</div>
                {display.description && (
                  <div className="notification-description">{display.description}</div>
                )}
                {'actionLabel' in display && display.actionLabel && (
                  <div className="notification-action-hint">{display.actionLabel}</div>
                )}
                <div className="notification-time">{formatTimeAgo(notification.timestamp)}</div>
              </div>
              {!notification.is_read && <div className="notification-dot"></div>}
            </div>
          )})
        )}
      </div>
    </>
  )

  const panelEl = isOpen ? (
    <div
      ref={panelRef}
      className="notifications-panel notifications-panel--portal"
      style={{ top: panelStyle.top, right: panelStyle.right }}
      role="dialog"
      aria-label="Notificaciones"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {panelContent}
    </div>
  ) : null

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className="notifications-button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const next = !isOpen
          setIsOpen(next)
          if (next) {
            updatePanelPosition()
            void loadNotifications()
          }
        }}
        title="Notificaciones"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        🔔
        {unreadCount > 0 && <span className="notifications-badge">{unreadCount}</span>}
      </button>

      {typeof document !== 'undefined' && panelEl
        ? createPortal(panelEl, document.body)
        : null}
    </div>
  )
}

export default NotificationsDropdown

