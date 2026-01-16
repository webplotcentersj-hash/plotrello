import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import './GlobalAlertScreen.css'

const GlobalAlertScreen = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [alertMessage, setAlertMessage] = useState('ALERTA')

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
          const data = payload.payload as { message?: string }
          if (data?.message) {
            setAlertMessage(data.message)
          }
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

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="global-alert-screen">
      <div className="alert-content">
        <div className="alert-text">{alertMessage}</div>
        <button className="alert-close-btn" onClick={handleClose}>
          Cerrar
        </button>
      </div>
    </div>
  )
}

export default GlobalAlertScreen

