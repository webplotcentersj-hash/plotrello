import { useState, useEffect } from 'react'
import './ClockWidget.css'

type ClockWidgetProps = {
  /** En header compacto: fecha corta (ej. jue 21 may). */
  compact?: boolean
}

const ClockWidget = ({ compact = false }: ClockWidgetProps) => {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatDate = (date: Date) => {
    if (compact) {
      return date.toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      })
    }
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className={`clock-widget${compact ? ' clock-widget--compact' : ''}`}>
      <div className="clock-time">{formatTime(time)}</div>
      <div className="clock-date">{formatDate(time)}</div>
    </div>
  )
}

export default ClockWidget

