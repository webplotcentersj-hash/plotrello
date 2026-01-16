import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import apiService from '../services/api'
import type { Notification } from '../types/api'
import './ChatFloatingButton.css'

type ChatFloatingButtonProps = {
  onNavigateToChat: () => void
}

const ChatFloatingButton = ({ onNavigateToChat }: ChatFloatingButtonProps) => {
  const { usuario } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  // Cargar notificaciones del chat
  useEffect(() => {
    if (!usuario?.id) return

    const loadNotifications = async () => {
      try {
        const response = await apiService.getUserNotifications(usuario.id)
        if (response.success && response.data) {
          // Filtrar solo notificaciones relacionadas con chat (menciones, alertas, etc.)
          const chatNotifications = response.data.filter(
            (n) =>
              n.type === 'mention' ||
              (n.description && (n.description.includes('chat') || n.description.includes('mencionó')))
          )
          setNotifications(chatNotifications)
          setUnreadCount(chatNotifications.filter((n) => !n.is_read).length)
        }
      } catch (error) {
        console.error('Error cargando notificaciones del chat:', error)
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 30000) // Actualizar cada 30 segundos

    return () => clearInterval(interval)
  }, [usuario?.id])

  // Suscripción a notificaciones en tiempo real
  useEffect(() => {
    if (!supabase || !usuario?.id) return

    const channel = supabase
      .channel(`chat-notifications:${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${usuario.id}`
        },
        () => {
          // Recargar notificaciones cuando hay una nueva
          apiService.getUserNotifications(usuario.id).then((response) => {
            if (response.success && response.data) {
              const chatNotifications = response.data.filter(
                (n) =>
                  n.type === 'mention' ||
                  (n.description && (n.description.includes('chat') || n.description.includes('mencionó')))
              )
              setNotifications(chatNotifications)
              setUnreadCount(chatNotifications.filter((n) => !n.is_read).length)
            }
          })
        }
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [usuario?.id])

  // Calcular mensajes no leídos del chat
  useEffect(() => {
    if (!supabase || !usuario?.id) return

    const calculateUnread = async () => {
      if (!supabase || !usuario?.id) return
      
      try {
        // Obtener todos los canales
        const channels = ['general', 'diseno', 'recursos-humanos', 'metalurgica', 'mostrador', 'taller-grafico', 'random']
        let totalUnread = 0

        for (const channel of channels) {
          const roomId = channel === 'general' ? 1 : 
                         channel === 'diseno' ? 2 :
                         channel === 'recursos-humanos' ? 3 :
                         channel === 'metalurgica' ? 4 :
                         channel === 'mostrador' ? 5 :
                         channel === 'taller-grafico' ? 6 : 7

          // Obtener última lectura del usuario
          const lastSeenResp = await apiService.obtenerLastSeenOtros(channel, usuario.id)
          if (lastSeenResp.success && lastSeenResp.data) {
            const lastSeen = new Date(lastSeenResp.data)
            
            // Contar mensajes después de la última lectura
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
    const interval = setInterval(calculateUnread, 60000) // Actualizar cada minuto

    return () => clearInterval(interval)
  }, [usuario?.id])

  const totalUnread = unreadCount + chatUnreadCount

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await apiService.markNotificationAsRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )
    }
    onNavigateToChat()
    setIsOpen(false)
  }

  return (
    <div className="chat-floating-button-container">
      <button
        className={`chat-floating-button ${isOpen ? 'open' : ''} ${totalUnread > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Chat y Notificaciones"
      >
        <div className="chat-button-icon">💬</div>
        {totalUnread > 0 && (
          <div className="chat-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</div>
        )}
      </button>

      {isOpen && (
        <div className="chat-floating-menu">
          <div className="chat-menu-header">
            <h3>Chat y Notificaciones</h3>
            <button className="close-menu-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="chat-menu-actions">
            <button
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
              {chatUnreadCount > 0 && (
                <div className="action-badge">{chatUnreadCount}</div>
              )}
            </button>
          </div>

          {notifications.length > 0 && (
            <div className="chat-notifications-section">
              <div className="section-header">
                <span>Notificaciones del Chat</span>
                {unreadCount > 0 && (
                  <span className="section-badge">{unreadCount}</span>
                )}
              </div>
              <div className="notifications-list">
                {notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      {notification.type === 'mention' ? '👤' : '🔔'}
                    </div>
                    <div className="notification-content">
                      <div className="notification-title">{notification.title}</div>
                      {notification.description && (
                        <div className="notification-description">{notification.description}</div>
                      )}
                    </div>
                    {!notification.is_read && <div className="notification-dot"></div>}
                  </div>
                ))}
                {notifications.length > 5 && (
                  <button
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
          )}

          {notifications.length === 0 && (
            <div className="chat-menu-empty">
              <p>No hay notificaciones del chat</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChatFloatingButton

