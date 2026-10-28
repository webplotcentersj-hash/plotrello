import { useCallback, useEffect, useState } from 'react'
import {
  getPlotLabRuntimeMode,
  isPlotLabOnline,
  type PlotLabRuntimeMode
} from '../utils/plotLabRuntimeMode'
import { subscribeSyncQueue, syncQueueCount, syncQueueFlush } from '../utils/syncQueue'

export function usePlotLabConnectivity() {
  const [online, setOnline] = useState(isPlotLabOnline)
  const [mode, setMode] = useState<PlotLabRuntimeMode>(getPlotLabRuntimeMode)
  const [pending, setPending] = useState(0)
  const [flushing, setFlushing] = useState(false)
  const [lastFlushMsg, setLastFlushMsg] = useState<string | null>(null)

  const refreshPending = useCallback(async () => {
    try {
      setPending(await syncQueueCount())
    } catch {
      setPending(0)
    }
  }, [])

  const refreshMode = useCallback(() => {
    setOnline(isPlotLabOnline())
    setMode(getPlotLabRuntimeMode())
  }, [])

  const flush = useCallback(async () => {
    if (!isPlotLabOnline() || flushing) return
    setFlushing(true)
    setLastFlushMsg(null)
    try {
      const r = await syncQueueFlush()
      await refreshPending()
      if (r.ok > 0) {
        setLastFlushMsg(
          r.remaining > 0
            ? `Sincronizadas ${r.ok}. Quedan ${r.remaining}.`
            : `Sincronizadas ${r.ok} pendiente${r.ok === 1 ? '' : 's'}.`
        )
      } else if (r.failed > 0) {
        setLastFlushMsg(`No se pudieron sync ${r.failed}. Se reintenta al volver la red.`)
      }
    } finally {
      setFlushing(false)
    }
  }, [flushing, refreshPending])

  useEffect(() => {
    refreshMode()
    void refreshPending()
    const onNet = () => {
      refreshMode()
      if (isPlotLabOnline()) void flush()
      else void refreshPending()
    }
    const onConflict = (ev: Event) => {
      const d = (ev as CustomEvent<{ ordenId?: number; estadoOrigen?: string; estadoActual?: string; nuevoEstado?: string }>)
        .detail
      if (!d?.ordenId) return
      setLastFlushMsg(
        `Conflicto OP ${d.ordenId}: estaba en «${d.estadoOrigen || '?'}», en servidor «${d.estadoActual || '?'}». Se aplicó «${d.nuevoEstado || '?'}».`
      )
    }
    window.addEventListener('online', onNet)
    window.addEventListener('offline', onNet)
    window.addEventListener('plotlab-sync-conflict', onConflict)
    const unsub = subscribeSyncQueue(() => {
      void refreshPending()
    })
    const timer = window.setInterval(() => {
      if (isPlotLabOnline()) void flush()
    }, 45_000)
    return () => {
      window.removeEventListener('online', onNet)
      window.removeEventListener('offline', onNet)
      window.removeEventListener('plotlab-sync-conflict', onConflict)
      unsub()
      window.clearInterval(timer)
    }
  }, [flush, refreshMode, refreshPending])

  return {
    online,
    mode,
    pending,
    flushing,
    lastFlushMsg,
    flush,
    refreshPending
  }
}
