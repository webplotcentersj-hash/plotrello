import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './PlotAIFloatingButton.css'

type PlotAIFloatingButtonProps = {
  onClick: () => void
  isOpen?: boolean
  alertCount?: number
  hasUnreadMessages?: boolean
}

const SEEN_ALERTS_KEY = 'plotai-fab-alerts-seen'

function readSeenAlertCount(): number {
  try {
    const n = Number(sessionStorage.getItem(SEEN_ALERTS_KEY) || 0)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function writeSeenAlertCount(n: number) {
  try {
    sessionStorage.setItem(SEEN_ALERTS_KEY, String(n))
  } catch {
    /* ignore quota / private mode */
  }
}

const PlotAIFloatingButton = ({
  onClick,
  isOpen = false,
  alertCount = 0,
  hasUnreadMessages = false
}: PlotAIFloatingButtonProps) => {
  const [pulse, setPulse] = useState(false)
  const [seenAlertCount, setSeenAlertCount] = useState(readSeenAlertCount)
  const pendingAlerts = Math.max(0, alertCount - seenAlertCount)
  const showBadge = !isOpen && (pendingAlerts > 0 || hasUnreadMessages)
  const badgeLabel = pendingAlerts > 99 ? '99+' : pendingAlerts > 0 ? String(pendingAlerts) : '!'

  useEffect(() => {
    if (!isOpen || alertCount <= seenAlertCount) return
    setSeenAlertCount(alertCount)
    writeSeenAlertCount(alertCount)
  }, [isOpen, alertCount, seenAlertCount])

  useEffect(() => {
    if (isOpen) {
      setPulse(false)
      return
    }
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setPulse(true)
      timeoutId = setTimeout(() => setPulse(false), 700)
    }, pendingAlerts > 0 ? 2200 : 4500)
    return () => {
      clearInterval(interval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isOpen, pendingAlerts])

  const button = (
    <button
      type="button"
      className={[
        'plotai-floating-button',
        isOpen ? 'open' : '',
        pulse ? 'pulse' : '',
        showBadge ? 'has-alerts' : '',
        pendingAlerts > 0 ? 'has-critical' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={isOpen ? 'Cerrar PlotAI' : 'Abrir PlotAI'}
      title={
        isOpen
          ? 'Cerrar PlotAI'
          : pendingAlerts > 0
            ? `PlotAI · ${pendingAlerts} alerta${pendingAlerts === 1 ? '' : 's'} del tablero`
            : 'PlotAI · asistente agéntico'
      }
    >
      <span className="plotai-fab-glow" aria-hidden />
      <span className="plotai-fab-core">
        {isOpen ? (
          <span className="plotai-fab-close" aria-hidden>
            ×
          </span>
        ) : (
          <>
            <span className="plotai-fab-bot" aria-hidden>
              🤖
            </span>
            <span className="plotai-fab-copy">
              <strong>PlotAI</strong>
              <small>{pendingAlerts > 0 ? 'Alertas' : 'Agéntico'}</small>
            </span>
          </>
        )}
      </span>
      {showBadge ? (
        <span className="plotai-fab-badge" aria-hidden>
          {badgeLabel}
        </span>
      ) : null}
    </button>
  )

  if (typeof document === 'undefined') return button
  return createPortal(button, document.body)
}

export default PlotAIFloatingButton
