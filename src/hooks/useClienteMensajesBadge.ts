import { useCallback, useEffect, useState } from 'react'
import { useClienteAuth } from './useClienteAuth'
import apiService from '../services/api'

const POLL_MS = 45_000
export const CLIENTE_MENSAJES_REFRESH_EVENT = 'cliente-mensajes-badge-refresh'

export function useClienteMensajesBadge() {
  const { cliente } = useClienteAuth()
  const [noLeidos, setNoLeidos] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!cliente?.id) {
      setNoLeidos(0)
      return
    }
    setLoading(true)
    try {
      const res = await apiService.contarMensajesClienteNoLeidos(cliente.id)
      if (res.success && res.data != null) {
        setNoLeidos(res.data)
      }
    } finally {
      setLoading(false)
    }
  }, [cliente?.id])

  useEffect(() => {
    void refresh()
    if (!cliente?.id) return
    const t = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(t)
  }, [cliente?.id, refresh])

  useEffect(() => {
    const onFocus = () => void refresh()
    const onCustom = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(CLIENTE_MENSAJES_REFRESH_EVENT, onCustom)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(CLIENTE_MENSAJES_REFRESH_EVENT, onCustom)
    }
  }, [refresh])

  return { noLeidos, loading, refresh, tieneNoLeidas: noLeidos > 0 }
}
