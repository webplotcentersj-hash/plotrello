import { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import './AdminAlertButton.css'

const AdminAlertButton = () => {
  const { isAdmin, usuario, nombreVisible } = useAuth()
  const [isSending, setIsSending] = useState(false)

  if (!isAdmin) return null

  const sendGlobalAlert = async () => {
    if (!supabase || !usuario) return

    const confirmed = window.confirm(
      '¿Estás seguro de enviar una ALERTA a todos los usuarios?\n\nSe mostrará una pantalla roja de alerta en todos los dispositivos conectados.'
    )

    if (!confirmed) return

    setIsSending(true)
    try {
      const channel = supabase.channel('global-alerts')

      await channel.send({
        type: 'broadcast',
        event: 'global-alert',
        payload: {
          active: true,
          message: 'ALERTA',
          sentBy: nombreVisible || 'Administrador',
          timestamp: new Date().toISOString()
        }
      })

      console.log('✅ Alerta activada')
    } catch (error) {
      console.error('❌ Error enviando alerta global:', error)
      alert('Error al enviar la alerta. Intenta nuevamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <button
      className="admin-alert-button primary"
      onClick={sendGlobalAlert}
      disabled={isSending}
      title="Enviar ALERTA a todos los usuarios"
    >
      {isSending ? '⏳' : '🚨'}
      <span className="alert-button-text">Alerta</span>
    </button>
  )
}

export default AdminAlertButton

