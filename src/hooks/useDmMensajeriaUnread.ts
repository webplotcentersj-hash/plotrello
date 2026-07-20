import { useCallback, useEffect, useRef, useState } from 'react'
import apiService from '../services/api'

/** Disparar desde Mensajería (u otras pantallas) para que el header actualice el badge sin esperar al polling. */
export const MENSAJERIA_DM_UNREAD_REFRESH = 'mensajeria-dm-unread-refresh'

export function dispatchMensajeriaDmUnreadRefresh() {
  window.dispatchEvent(new Event(MENSAJERIA_DM_UNREAD_REFRESH))
}

const POLL_MS = 60_000

/**
 * Total de mensajes privados (DM / mensajería interna) sin leer, para badge en el header.
 * Hace polling; escucha {@link MENSAJERIA_DM_UNREAD_REFRESH} para refrescar al instante.
 */
export function useDmMensajeriaUnread(usuarioId: number | null | undefined) {
  const [total, setTotal] = useState(0)
  const prevTotalRef = useRef<number | null>(null)
  const initialFetchDoneRef = useRef(false)

  useEffect(() => {
    prevTotalRef.current = null
    initialFetchDoneRef.current = false
  }, [usuarioId])

  const fetchUnread = useCallback(async () => {
    if (usuarioId == null) {
      setTotal(0)
      prevTotalRef.current = null
      initialFetchDoneRef.current = false
      return
    }
    const res = await apiService.getTotalDmMensajeriaUnread(usuarioId)
    if (!res.success || res.data == null) return
    const next = res.data
    const prev = prevTotalRef.current
    const onMensajeriaRoute =
      typeof window !== 'undefined' && window.location.pathname === '/mensajeria'
    if (
      initialFetchDoneRef.current &&
      prev != null &&
      next > prev &&
      document.hidden &&
      !onMensajeriaRoute &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        const bn = new Notification('Mensajes nuevos en mensajería', {
          body: next === 1 ? 'Tenés 1 mensaje sin leer.' : `Tenés ${next} mensajes sin leer en mensajería interna.`,
          tag: 'plot-mensajeria-dm'
        })
        bn.onclick = () => {
          window.focus()
          window.location.assign('/avisar-ausencia?mensajeria=1')
        }
      } catch {
        /* ignore */
      }
    }
    initialFetchDoneRef.current = true
    prevTotalRef.current = next
    setTotal(next)
  }, [usuarioId])

  useEffect(() => {
    void fetchUnread()
    const interval = window.setInterval(() => void fetchUnread(), POLL_MS)
    const onRefresh = () => void fetchUnread()
    window.addEventListener(MENSAJERIA_DM_UNREAD_REFRESH, onRefresh)
    const onVis = () => {
      if (!document.hidden) void fetchUnread()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener(MENSAJERIA_DM_UNREAD_REFRESH, onRefresh)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [fetchUnread])

  return total
}
