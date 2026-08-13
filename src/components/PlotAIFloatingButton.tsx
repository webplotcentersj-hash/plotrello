import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './PlotAIFloatingButton.css'

type PlotAIFloatingButtonProps = {
  onClick: () => void
  isOpen?: boolean
  alertCount?: number
  hasUnreadMessages?: boolean
}

const PlotAIFloatingButton = ({
  onClick,
  isOpen = false,
  alertCount = 0,
  hasUnreadMessages = false
}: PlotAIFloatingButtonProps) => {
  const [pulse, setPulse] = useState(false)
  const showBadge = !isOpen && (alertCount > 0 || hasUnreadMessages)
  const badgeLabel = alertCount > 99 ? '99+' : alertCount > 0 ? String(alertCount) : '!'

  useEffect(() => {
    if (isOpen) return
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const interval = setInterval(() => {
      setPulse(true)
      timeoutId = setTimeout(() => setPulse(false), 700)
    }, alertCount > 0 ? 2200 : 4500)
    return () => {
      clearInterval(interval)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isOpen, alertCount])

  const button = (
    <button
      type="button"
      className={[
        'plotai-floating-button',
        isOpen ? 'open' : '',
        pulse ? 'pulse' : '',
        showBadge ? 'has-alerts' : '',
        alertCount > 0 ? 'has-critical' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={isOpen ? 'Cerrar PlotAI' : 'Abrir PlotAI'}
      title={
        isOpen
          ? 'Cerrar PlotAI'
          : alertCount > 0
            ? `PlotAI · ${alertCount} alerta${alertCount === 1 ? '' : 's'} del tablero`
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
              <small>{alertCount > 0 ? 'Alertas' : 'Agéntico'}</small>
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
