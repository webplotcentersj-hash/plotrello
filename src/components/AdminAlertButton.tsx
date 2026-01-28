import { useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import './AdminAlertButton.css'

const AdminAlertButton = () => {
  const { isAdmin, usuario } = useAuth()
  const [isSendingActivate, setIsSendingActivate] = useState(false)
  const [isSendingDeactivate, setIsSendingDeactivate] = useState(false)

  if (!isAdmin) return null

  const sendGlobalAlert = async () => {
    if (!supabase || !usuario) return

    const confirmed = window.confirm(
      '¿Estás seguro de enviar una ALERTA GLOBAL a todos los usuarios?\n\nSe mostrará una pantalla roja de alerta en todos los dispositivos conectados hasta que la desactives.'
    )

    if (!confirmed) return

    setIsSendingActivate(true)
    try {
      const channel = supabase.channel('global-alerts')

      await channel.send({
        type: 'broadcast',
        event: 'global-alert',
        payload: {
          active: true,
          message: 'ALERTA GLOBAL',
          sentBy: usuario.nombre || 'Administrador',
          timestamp: new Date().toISOString()
        }
      })

      console.log('✅ Alerta global activada')
    } catch (error) {
      console.error('❌ Error enviando alerta global:', error)
      alert('Error al enviar la alerta. Intenta nuevamente.')
    } finally {
      setIsSendingActivate(false)
    }
  }

  const clearGlobalAlert = async () => {
    if (!supabase || !usuario) return

    const confirmed = window.confirm(
      '¿Querés desactivar la ALERTA GLOBAL en todos los dispositivos?'
    )

    if (!confirmed) return

    setIsSendingDeactivate(true)
    try {
      const channel = supabase.channel('global-alerts')

      await channel.send({
        type: 'broadcast',
        event: 'global-alert',
        payload: {
          active: false,
          sentBy: usuario.nombre || 'Administrador',
          timestamp: new Date().toISOString()
        }
      })

      console.log('✅ Alerta global desactivada')
    } catch (error) {
      console.error('❌ Error desactivando alerta global:', error)
      alert('Error al desactivar la alerta. Intenta nuevamente.')
    } finally {
      setIsSendingDeactivate(false)
    }
  }

  return (
    <div className="admin-alert-button-group">
      <button
        className="admin-alert-button primary"
        onClick={sendGlobalAlert}
        disabled={isSendingActivate}
        title="Enviar ALERTA GLOBAL a todos los usuarios"
      >
        {isSendingActivate ? '⏳' : '🚨'}
        <span className="alert-button-text">Alerta Global</span>
      </button>
      <button
        className="admin-alert-button secondary"
        onClick={clearGlobalAlert}
        disabled={isSendingDeactivate}
        title="Desactivar ALERTA GLOBAL en todos los usuarios"
      >
        {isSendingDeactivate ? '⏳' : '✖'}
        <span className="alert-button-text">Desactivar</span>
      </button>
    </div>
  )
}

export default AdminAlertButton

