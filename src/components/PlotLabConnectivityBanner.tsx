import { usePlotLabConnectivity } from '../hooks/usePlotLabConnectivity'
import { labelPlotLabRuntimeMode } from '../utils/plotLabRuntimeMode'
import './PlotLabConnectivityBanner.css'

type Props = {
  /** Compacto para kiosco / tablet. */
  compact?: boolean
}

export default function PlotLabConnectivityBanner({ compact = false }: Props) {
  const { online, mode, pending, flushing, lastFlushMsg, flush } = usePlotLabConnectivity()

  if (online && pending === 0 && mode === 'cloud' && !lastFlushMsg) return null

  const tone = !online ? 'offline' : pending > 0 ? 'pending' : mode === 'lan' ? 'lan' : 'ok'

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
      {pending > 0 && online ? (
        <button type="button" className="plotlab-conn__btn" disabled={flushing} onClick={() => void flush()}>
          {flushing ? 'Sync…' : 'Sincronizar'}
        </button>
      ) : null}
      {lastFlushMsg && online ? <span className="plotlab-conn__msg">{lastFlushMsg}</span> : null}
    </div>
  )
}
