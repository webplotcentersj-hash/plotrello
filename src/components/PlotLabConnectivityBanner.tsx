import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePlotLabConnectivity } from '../hooks/usePlotLabConnectivity'
import { labelPlotLabRuntimeMode } from '../utils/plotLabRuntimeMode'
import { isPlotLabOfflinePartialEnabled } from '../utils/plotLabOffline'
import {
  dismissOfflineConflict,
  listOfflineConflicts,
  subscribeOfflineConflicts,
  type OfflineSyncConflict
} from '../utils/plotLabOfflineConflicts'
import { formatCacheAge, readOfflineCacheMeta } from '../utils/plotLabOfflineMeta'
import { TABLERO_CACHE_MAX_ROWS } from '../utils/ordenesTableroIdb'
import './PlotLabConnectivityBanner.css'

type Props = {
  /** Compacto para kiosco / tablet. */
  compact?: boolean
}

export default function PlotLabConnectivityBanner({ compact = false }: Props) {
  const { online, mode, pending, flushing, lastFlushMsg, flush } = usePlotLabConnectivity()
  const [conflicts, setConflicts] = useState<OfflineSyncConflict[]>([])
  const [tableroAge, setTableroAge] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      setConflicts(listOfflineConflicts())
      setTableroAge(formatCacheAge(readOfflineCacheMeta().tableroSavedAt))
    }
    refresh()
    return subscribeOfflineConflicts(refresh)
  }, [pending, lastFlushMsg])

  if (!isPlotLabOfflinePartialEnabled() && online && pending === 0 && !lastFlushMsg && conflicts.length === 0) {
    return null
  }

  if (online && pending === 0 && mode === 'cloud' && !lastFlushMsg && conflicts.length === 0) return null

  const tone = !online ? 'offline' : conflicts.length > 0 ? 'pending' : pending > 0 ? 'pending' : mode === 'lan' ? 'lan' : 'ok'
  const topConflict = conflicts[conflicts.length - 1]

  return (
    <div className={`plotlab-conn plotlab-conn--${tone}${compact ? ' plotlab-conn--compact' : ''}`} role="status">
      <span className="plotlab-conn__label">
        {!online
          ? 'Sin conexión'
          : mode === 'lan'
            ? labelPlotLabRuntimeMode('lan')
            : pending > 0
              ? `${pending} pendiente${pending === 1 ? '' : 's'}`
              : 'En línea'}
      </span>
      {!online && tableroAge ? (
        <span className="plotlab-conn__msg">
          Caché tablero {tableroAge} · máx. {TABLERO_CACHE_MAX_ROWS} OPs
        </span>
      ) : null}
      {pending > 0 && online ? (
        <button type="button" className="plotlab-conn__btn" disabled={flushing} onClick={() => void flush()}>
          {flushing ? 'Sync…' : 'Sincronizar'}
        </button>
      ) : null}
      {lastFlushMsg && online ? <span className="plotlab-conn__msg">{lastFlushMsg}</span> : null}
      {topConflict ? (
        <span className="plotlab-conn__conflict">
          Conflicto OP {topConflict.ordenId}
          {topConflict.applied ? ' (aplicado)' : ''}: era «{topConflict.estadoOrigen || '?'}», servidor «
          {topConflict.estadoActual || '?'}»
          <button type="button" className="plotlab-conn__btn" onClick={() => dismissOfflineConflict(topConflict.id)}>
            Ok
          </button>
          <Link className="plotlab-conn__link" to="/offline-diagnostico">
            Ver
          </Link>
        </span>
      ) : (
        <Link className="plotlab-conn__link" to="/offline-diagnostico" title="Diagnóstico offline">
          ·
        </Link>
      )}
    </div>
  )
}
