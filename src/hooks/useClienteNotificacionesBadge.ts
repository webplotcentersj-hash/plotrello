import { useCallback, useEffect, useState } from 'react'
import { useClienteAuth } from './useClienteAuth'
import apiService from '../services/api'

const POLL_MS = 45_000

export function useClienteNotificacionesBadge() {
  const { cliente } = useClienteAuth()
  const [noLeidas, setNoLeidas] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!cliente?.id) {
      setNoLeidas(0)
      return
    }
    setLoading(true)
    try {
      const res = await apiService.contarNotificacionesClienteNoLeidas(cliente.id)
      if (res.success && res.data != null) {
        setNoLeidas(res.data)
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
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  return { noLeidas, loading, refresh, tieneNoLeidas: noLeidas > 0 }
}
