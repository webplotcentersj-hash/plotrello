import { useLocation } from 'react-router-dom'
import NotificationsDropdown from '../NotificationsDropdown'
import AdminAlertButton from '../AdminAlertButton'
import { useAuth } from '../../hooks/useAuth'
import { useDmMensajeriaUnread } from '../../hooks/useDmMensajeriaUnread'
import type { Notification } from '../../types/api'

export type AdminPanelUtilBarProps = {
  onNavigateToMensajeria?: () => void
  onNavigateToChat?: () => void
}

export default function AdminPanelUtilBar({
  onNavigateToMensajeria,
  onNavigateToChat
}: AdminPanelUtilBarProps) {
  const { usuario, isAdmin } = useAuth()
  const location = useLocation()
  const dmUnread = useDmMensajeriaUnread(usuario?.id)
  const showDmBadge =
    dmUnread > 0 && !!onNavigateToMensajeria && location.pathname !== '/mensajeria'

  const handleNotificationClick = (notification: Notification) => {
    if (
      notification.type === 'mention' &&
      notification.description?.includes('te mencionó en')
    ) {
      onNavigateToChat?.()
    }
  }

  return (
    <div className="amp-util-bar" role="toolbar" aria-label="Notificaciones y mensajería">
      <NotificationsDropdown onNotificationClick={handleNotificationClick} />

      {onNavigateToMensajeria && (
        <button
          type="button"
          className={`amp-util-btn amp-util-btn--mensajeria${showDmBadge ? ' has-unread' : ''}`}
          onClick={onNavigateToMensajeria}
          title={showDmBadge ? `Mensajería (${dmUnread} sin leer)` : 'Mensajería'}
          aria-label={
            showDmBadge ? `Mensajería, ${dmUnread} mensajes sin leer` : 'Mensajería'
          }
        >
          <span className="amp-util-btn-icon" aria-hidden>
            ✉️
          </span>
          <span className="amp-util-btn-label">Mensajería</span>
          {showDmBadge && (
            <span className="amp-util-badge" aria-hidden>
              {dmUnread > 99 ? '99+' : dmUnread}
            </span>
          )}
        </button>
      )}

      {isAdmin && (
        <div className="amp-util-alert-wrap">
          <AdminAlertButton />
        </div>
      )}
    </div>
  )
}
