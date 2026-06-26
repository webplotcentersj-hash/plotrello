import { useCallback, useEffect, useRef } from 'react'
import { loadEstadoOperativaHoy, type CajaEstadoOperativaHoy } from './cajaOperativaHoy'
import { sincronizarVentasPlotLabRango } from './plotlabVentaCajaSync'

const SYNC_INTERVAL_MS = 15_000

type Options = {
  usuarioId?: number
  usuarioNombre: string
  fecha: string
  enabled: boolean
  onEstado: (estado: CajaEstadoOperativaHoy | null) => void
  onCargando?: (cargando: boolean) => void
}

/** Sincroniza ventas Plot Lab → caja y recarga el menú en tiempo casi real. */
export function useCajaMenuRealtime({
  usuarioId,
  usuarioNombre,
  fecha,
  enabled,
  onEstado,
  onCargando
}: Options) {
  const busyRef = useRef(false)

  const recargar = useCallback(async () => {
    if (!usuarioId || busyRef.current) return
    busyRef.current = true
    onCargando?.(true)
    try {
      await sincronizarVentasPlotLabRango(fecha, fecha)
      const estado = await loadEstadoOperativaHoy(usuarioId, usuarioNombre, fecha)
      onEstado(estado)
    } finally {
      busyRef.current = false
      onCargando?.(false)
    }
  }, [usuarioId, usuarioNombre, fecha, onEstado, onCargando])

  useEffect(() => {
    if (!enabled || !usuarioId) return

    const onDatos = () => {
      void recargar()
    }

    void recargar()

    window.addEventListener('caja-datos-actualizados', onDatos)
    window.addEventListener('plotlab-sync-caja', onDatos as EventListener)

    const interval = window.setInterval(() => {
      void recargar()
    }, SYNC_INTERVAL_MS)

    return () => {
      window.removeEventListener('caja-datos-actualizados', onDatos)
      window.removeEventListener('plotlab-sync-caja', onDatos as EventListener)
      window.clearInterval(interval)
    }
  }, [enabled, usuarioId, recargar])

  return { recargar }
}
