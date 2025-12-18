import { useState, useEffect } from 'react'
import './PlotAIFloatingButton.css'

type PlotAIFloatingButtonProps = {
  onClick: () => void
  isOpen?: boolean
  hasUnreadMessages?: boolean
}

const PlotAIFloatingButton = ({ onClick, isOpen = false, hasUnreadMessages = false }: PlotAIFloatingButtonProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    // Pulso suave cada 3 segundos cuando está cerrado
    if (!isOpen) {
      const interval = setInterval(() => {
        setPulse(true)
        setTimeout(() => setPulse(false), 600)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  return (
    <button
      className={`plotai-floating-button ${isOpen ? 'open' : ''} ${pulse ? 'pulse' : ''} ${hasUnreadMessages ? 'has-unread' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Abrir PlotAI"
      title="PlotAI - Asistente Inteligente"
    >
      <div className="plotai-button-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11C11 9.75 14.75 9.75 14.75 7.5C14.75 6.12 13.63 5 12.25 5C10.87 5 9.75 6.12 9.75 7.5H11.75C11.75 7.08 12.08 6.75 12.5 6.75C12.92 6.75 13.25 7.08 13.25 7.5C13.25 8.5 11 8.83 11 13H13Z"
            fill="currentColor"
          />
        </svg>
      </div>
      {isHovered && !isOpen && (
        <div className="plotai-button-tooltip">
          <span>PlotAI</span>
          <span className="tooltip-subtitle">Asistente Inteligente</span>
        </div>
      )}
      {hasUnreadMessages && !isOpen && (
        <div className="plotai-unread-badge">
          <span>!</span>
        </div>
      )}
      {isOpen && (
        <div className="plotai-button-close-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </button>
  )
}

export default PlotAIFloatingButton

