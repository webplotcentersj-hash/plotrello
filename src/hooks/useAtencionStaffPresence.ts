import { useEffect } from 'react'
import { plotLabFetch } from '../utils/plotLabApiOrigin'

const PRESENCE_INTERVAL_MS = 40_000

/** Heartbeat mientras el panel de atención al público está abierto. */
export function useAtencionStaffPresence(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const ping = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (!token) return
      try {
        await plotLabFetch('/api/plotai/atencion-presence', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      } catch {
        /* ignore */
      }
    }

    void ping()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void ping()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(() => void ping(), PRESENCE_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [enabled])
}
