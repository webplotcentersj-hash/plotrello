import { useState, useEffect, useCallback, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import type { Notification } from '../types/api'
import {
  formatNotificationForDisplay,
  getTotemNotificationNavigatePath,
  isChatPanelNotification,
  notificationIsTotemAtencionMostrador,
  notificationIsTotemImpresionPedido,
  notificationIsTotemSolicitudAsesor
} from '../utils/totemNotifications'
import './ChatFloatingButton.css'

type ChatFloatingButtonBaseProps = {
  onNavigateToChat: () => void
  onUnreadChange?: (count: number) => void
}

type ChatFloatingButtonFloatingProps = ChatFloatingButtonBaseProps & {
  variant?: 'floating'
}

type ChatFloatingButtonInsightsProps = ChatFloatingButtonBaseProps & {
  variant: 'insights'
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: RefObject<HTMLElement | null>
}

type ChatFloatingButtonProps = ChatFloatingButtonFloatingProps | ChatFloatingButtonInsightsProps

function isInsightsVariant(
  props: ChatFloatingButtonProps
): props is ChatFloatingButtonInsightsProps {
  return props.variant === 'insights'
}

const ChatFloatingButton = (props: ChatFloatingButtonProps) => {
  const { onNavigateToChat, onUnreadChange } = props
  const insights = isInsightsVariant(props)
  const insightsOpen = insights ? props.isOpen : false
  const insightsAnchorRef = insights ? props.anchorRef : null
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = insights ? props.isOpen : internalOpen
  const setIsOpen = insights ? props.onOpenChange : setInternalOpen
  const panelRef = useRef<HTMLDivElement>(null)
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({})

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  const applyChatNotifications = useCallback((data: Notification[]) => {
    const chatNotifications = data.filter(isChatPanelNotification)
    setNotifications(chatNotifications)
    setUnreadCount(chatNotifications.filter((n) => !n.is_read).length)
  }, [])

  useEffect(() => {
    if (!usuario?.id) return

    const loadNotifications = async () => {
      try {
        const response = await apiService.getUserNotifications(usuario.id)
        if (response.success && response.data) {
          applyChatNotifications(response.data)
        }
      } catch (error) {
        console.error('Error cargando notificaciones del chat:', error)
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)

    return () => clearInterval(interval)
  }, [usuario?.id, applyChatNotifications])

  useEffect(() => {
    if (!supabase || !usuario?.id) return

    const reload = () => {
      apiService.getUserNotifications(usuario.id).then((response) => {
        if (response.success && response.data) {
          applyChatNotifications(response.data)
        }
      })
    }

    const channel = supabase
      .channel(`chat-notifications:${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        reload
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        reload
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [usuario?.id, applyChatNotifications])

  useEffect(() => {
    if (!supabase || !usuario?.id) return

    const calculateUnread = async () => {
      if (!supabase || !usuario?.id) return

      try {
        const channels = [
          'general',
          'diseno',
          'recursos-humanos',
          'metalurgica',
          'mostrador',
          'taller-grafico',
          'random'
        ]
        let totalUnread = 0

        for (const channel of channels) {
          const roomId =
            channel === 'general'
              ? 1
              : channel === 'diseno'
                ? 2
                : channel === 'recursos-humanos'
                  ? 3
                  : channel === 'metalurgica'
                    ? 4
                    : channel === 'mostrador'
                      ? 5
                      : channel === 'taller-grafico'
                        ? 6
                        : 7

          const lastSeenResp = await apiService.obtenerLastSeenOtros(channel, usuario.id)
          if (lastSeenResp.success && lastSeenResp.data) {
            const lastSeen = new Date(lastSeenResp.data)

            const { data: unreadMessages, error } = await supabase
              .from('chat_messages')
              .select('id', { count: 'exact' })
              .eq('room_id', roomId)
              .gt('timestamp', lastSeen.toISOString())
              .neq('id_usuario', usuario.id)

            if (!error && unreadMessages) {
              totalUnread += unreadMessages.length || 0
            }
          }
        }

        setChatUnreadCount(totalUnread)
      } catch (error) {
        console.error('Error calculando mensajes no leídos:', error)
      }
    }

    calculateUnread()
    const interval = setInterval(calculateUnread, 60000)

    return () => clearInterval(interval)
  }, [usuario?.id])

  const totalUnread = unreadCount + chatUnreadCount

  useEffect(() => {
    onUnreadChange?.(totalUnread)
  }, [totalUnread, onUnreadChange])

  const updatePortalPosition = useCallback(() => {
    if (!insightsOpen || !insightsAnchorRef?.current) return

    const rect = insightsAnchorRef.current.getBoundingClientRect()
    const panelWidth = Math.min(360, window.innerWidth - 24)
    const panelHeight = Math.min(520, window.innerHeight * 0.7)
    const margin = 12

    let top = rect.bottom + 8
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - panelHeight - 8)
    }

    let left = rect.right - panelWidth
    left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

    setPortalStyle({
      position: 'fixed',
      top,
      left,
      width: panelWidth,
      zIndex: 5000
    })
  }, [insightsOpen, insightsAnchorRef])

  useLayoutEffect(() => {
    if (!insightsOpen) return
    updatePortalPosition()

    const onReflow = () => updatePortalPosition()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [insightsOpen, updatePortalPosition])

  useEffect(() => {
    if (!insightsOpen) return

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (insightsAnchorRef?.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [insightsOpen, insightsAnchorRef, setIsOpen])

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await apiService.markNotificationAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
    }
    if (notificationIsTotemImpresionPedido(notification)) {
      navigate('/impresoras/totem')
    } else if (notificationIsTotemSolicitudAsesor(notification)) {
      navigate('/asesor')
    } else if (notificationIsTotemAtencionMostrador(notification)) {
      navigate(getTotemNotificationNavigatePath(notification, usuario?.rol))
    } else {
      onNavigateToChat()
    }
    setIsOpen(false)
  }

  const menuPanel = isOpen ? (
    <div
      ref={insights ? panelRef : undefined}
      className={`chat-floating-menu${insights ? ' chat-floating-menu--insights chat-floating-menu--insights-portal' : ''}`}
      style={insights ? portalStyle : undefined}
    >
      <div className="chat-menu-header">
        <h3>Chat y Notificaciones</h3>
        <button type="button" className="close-menu-btn" onClick={() => setIsOpen(false)}>
          ×
        </button>
      </div>

      <div className="chat-menu-actions">
        <button
          type="button"
          className="chat-menu-action"
          onClick={() => {
            onNavigateToChat()
            setIsOpen(false)
          }}
        >
          <span className="action-icon">💬</span>
          <div className="action-content">
            <div className="action-title">Abrir Chat</div>
            <div className="action-subtitle">Ver todos los canales</div>
          </div>
          {chatUnreadCount > 0 && <div className="action-badge">{chatUnreadCount}</div>}
        </button>
      </div>

      {notifications.length > 0 ? (
        <div className="chat-notifications-section">
          <div className="section-header">
            <span>Notificaciones</span>
            {unreadCount > 0 && <span className="section-badge">{unreadCount}</span>}
          </div>
          <div className="notifications-list">
            {notifications.slice(0, 5).map((notification) => {
              const display = formatNotificationForDisplay(notification)
              return (
              <div
                key={notification.id}
                className={`notification-item ${!notification.is_read ? 'unread' : ''}${
                  notificationIsTotemSolicitudAsesor(notification) ? ' totem-asesor' : ''
                }${notificationIsTotemAtencionMostrador(notification) ? ' totem-atencion' : ''}${
                  notificationIsTotemImpresionPedido(notification) ? ' totem-impresion' : ''
                }`}
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
                </div>
                {!notification.is_read && <div className="notification-dot"></div>}
              </div>
            )})}
            {notifications.length > 5 && (
              <button
                type="button"
                className="view-all-btn"
                onClick={() => {
                  onNavigateToChat()
                  setIsOpen(false)
                }}
              >
                Ver todas las notificaciones
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-menu-empty">
          <p>No hay notificaciones del chat</p>
        </div>
      )}
    </div>
  ) : null

  if (insights) {
    if (!menuPanel || typeof document === 'undefined') return null
    return createPortal(menuPanel, document.body)
  }

  return (
    <div className="chat-floating-button-container">
      <button
        type="button"
        className={`chat-floating-button ${isOpen ? 'open' : ''} ${totalUnread > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Chat y Notificaciones"
      >
        <div className="chat-button-icon">💬</div>
        {totalUnread > 0 && (
          <div className="chat-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</div>
        )}
      </button>
      {menuPanel}
    </div>
  )
}

export default ChatFloatingButton
