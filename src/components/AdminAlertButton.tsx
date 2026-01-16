import { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import './AdminAlertButton.css'

const AdminAlertButton = () => {
  const { isAdmin, usuario } = useAuth()
  const [isSending, setIsSending] = useState(false)

  if (!isAdmin) return null

  const sendGlobalAlert = async () => {
    if (!supabase || !usuario) return

    const confirmed = window.confirm(
      '¿Estás seguro de enviar una alerta global a todos los usuarios?\n\nEsto mostrará una pantalla roja con "ALERTA" en todos los dispositivos conectados.'
    )

    if (!confirmed) return

    setIsSending(true)
    try {
      const channel = supabase.channel('global-alerts')
      
      await channel.send({
        type: 'broadcast',
        event: 'global-alert',
        payload: {
          message: 'ALERTA',
          sentBy: usuario.nombre || 'Administrador',
          timestamp: new Date().toISOString()
        }
      })

      console.log('✅ Alerta global enviada')
    } catch (error) {
      console.error('❌ Error enviando alerta global:', error)
      alert('Error al enviar la alerta. Intenta nuevamente.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <button
      className="admin-alert-button"
      onClick={sendGlobalAlert}
      disabled={isSending}
      title="Enviar alerta global a todos los usuarios"
    >
      {isSending ? '⏳' : '🚨'}
      <span className="alert-button-text">Alerta Global</span>
    </button>
  )
}

export default AdminAlertButton

