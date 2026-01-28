import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import './GlobalAlertScreen.css'

const GlobalAlertScreen = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [alertMessage, setAlertMessage] = useState('ALERTA')
  const [sentBy, setSentBy] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    // Suscribirse a alertas globales
    const channel = supabase
      .channel('global-alerts')
      .on(
        'broadcast',
        { event: 'global-alert' },
        (payload) => {
          console.log('🚨 Alerta global recibida:', payload)
          const data = payload.payload as { active?: boolean; message?: string; sentBy?: string; timestamp?: string }

          // Si viene active:false, apagar alerta en todos los dispositivos
          if (data && data.active === false) {
            setIsVisible(false)
            return
          }

          // Activar alerta
          if (data?.message) {
            setAlertMessage(data.message)
          } else {
            setAlertMessage('ALERTA')
          }
          setSentBy(data?.sentBy || null)
          setTimestamp(data?.timestamp || null)
          setIsVisible(true)
          
          // Reproducir sonido de alerta
          playAlertSound()
        }
      )
      .subscribe((status) => {
        console.log(`🔔 Estado de suscripción a alertas globales: ${status}`)
      })

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Sonido de alerta más intenso
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2)
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.3)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4)

      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.error('Error al reproducir sonido:', error)
    }
  }

  if (!isVisible) return null

  return (
    <div className="global-alert-screen">
      <div className="alert-content">
        <div className="alert-text">{alertMessage}</div>
        {sentBy && (
          <div className="alert-meta">
            Enviada por <strong>{sentBy}</strong>
            {timestamp && (
              <span className="alert-time">
                {' '}
                • {new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GlobalAlertScreen

