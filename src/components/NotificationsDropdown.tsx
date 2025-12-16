import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { supabase } from '../services/supabaseClient'
import type { Notification } from '../types/api'
import './NotificationsDropdown.css'

type NotificationsDropdownProps = {
  onNotificationClick?: (notification: Notification) => void
}

const NotificationsDropdown = ({ onNotificationClick }: NotificationsDropdownProps) => {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

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
            new Notification(newNotification.title, {
              body: newNotification.description || '',
              icon: '/vite.svg',
              tag: `notification-${newNotification.id}`
            })
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

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
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

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'mention':
        return '💬'
      default:
        return 'ℹ️'
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    setIsOpen(false)
    
    try {
      // Navegar según el tipo de notificación
      if (notification.type === 'mention' && notification.description?.includes('te mencionó en')) {
        // Es una notificación de mención del chat
        navigate('/chat')
      } else if (notification.pedido_id) {
        // Es una notificación relacionada con un pedido de compra
        navigate(`/compras/pedidos/${notification.pedido_id}`)
      } else if (notification.orden_id) {
        // Es una notificación relacionada con una orden
        navigate('/')
      } else {
        // Si no hay navegación específica, solo cerrar el dropdown
        console.log('Notificación sin navegación específica:', notification)
      }
    } catch (error) {
      console.error('Error navegando desde notificación:', error)
    }
    
    if (onNotificationClick) {
      onNotificationClick(notification)
    }
  }

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button
        className="notifications-button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            loadNotifications()
          }
        }}
        title="Notificaciones"
      >
        🔔
        {unreadCount > 0 && <span className="notifications-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={markAllAsRead}>
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
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''} ${notification.type}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    {notification.description && (
                      <div className="notification-description">{notification.description}</div>
                    )}
                    <div className="notification-time">{formatTimeAgo(notification.timestamp)}</div>
                  </div>
                  {!notification.is_read && <div className="notification-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationsDropdown

