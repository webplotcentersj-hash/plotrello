import { useCallback, useEffect, useState } from 'react'
import { useClienteAuth } from './useClienteAuth'
import apiService from '../services/api'

const POLL_MS = 45_000
export const CLIENTE_CARRITO_UPDATED_EVENT = 'cliente-carrito-updated'

export function useClienteCarritoBadge() {
  const { cliente } = useClienteAuth()
  const [cantidadItems, setCantidadItems] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!cliente?.id) {
      setCantidadItems(0)
      return
    }
    setLoading(true)
    try {
      const res = await apiService.getCarritoCliente(cliente.id)
      if (res.success && res.data) {
        setCantidadItems(res.data.cantidad_items)
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
    const onCartUpdated = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(CLIENTE_CARRITO_UPDATED_EVENT, onCartUpdated)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(CLIENTE_CARRITO_UPDATED_EVENT, onCartUpdated)
    }
  }, [refresh])

  return { cantidadItems, loading, refresh, tieneItems: cantidadItems > 0 }
}

export function notifyClienteCarritoUpdated(): void {
  window.dispatchEvent(new Event(CLIENTE_CARRITO_UPDATED_EVENT))
}
