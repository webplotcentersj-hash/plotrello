import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlotLabConnectivity } from '../hooks/usePlotLabConnectivity'
import {
  isPlotLabOfflinePartialEnabled,
  labelOfflinePilotMode,
  plotLabOfflineDbSuffix
} from '../utils/plotLabOffline'
import {
  formatCacheAge,
  readOfflineCacheMeta,
  type OfflineCacheMeta
} from '../utils/plotLabOfflineMeta'
import {
  dismissOfflineConflict,
  listOfflineConflicts,
  subscribeOfflineConflicts,
  type OfflineSyncConflict
} from '../utils/plotLabOfflineConflicts'
import { blobOutboxCount, blobOutboxList } from '../utils/plotLabBlobOutbox'
import { syncQueueFlush, syncQueueList, syncQueueRemove, type SyncJob } from '../utils/syncQueue'
import { TABLERO_CACHE_MAX_ROWS } from '../utils/ordenesTableroIdb'
import { getPlotLabRuntimeMode, labelPlotLabRuntimeMode } from '../utils/plotLabRuntimeMode'
import './OfflineDiagnosticoPage.css'

export default function OfflineDiagnosticoPage() {
  const { online, pending, flush, flushing, lastFlushMsg } = usePlotLabConnectivity()
  const [meta, setMeta] = useState<OfflineCacheMeta>({})
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [conflicts, setConflicts] = useState<OfflineSyncConflict[]>([])
  const [blobs, setBlobs] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setMeta(readOfflineCacheMeta())
    setConflicts(listOfflineConflicts())
    try {
      setJobs(await syncQueueList())
      setBlobs(await blobOutboxCount())
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error leyendo cola')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const unsub = subscribeOfflineConflicts(() => setConflicts(listOfflineConflicts()))
    const t = window.setInterval(() => void refresh(), 8000)
    return () => {
      unsub()
      window.clearInterval(t)
    }
  }, [refresh])

  return (
    <div className="offline-diag">
      <header className="offline-diag__head">
        <div>
          <p className="offline-diag__eyebrow">Plot Lab</p>
          <h1>Diagnóstico offline</h1>
          <p className="offline-diag__sub">
            Cola, caché y conflictos · {labelOfflinePilotMode()} · scope{' '}
            <code>{plotLabOfflineDbSuffix()}</code>
          </p>
        </div>
        <Link to="/tablero" className="offline-diag__back">
          ← Tablero
        </Link>
      </header>

      <section className="offline-diag__cards">
        <article>
          <h2>Red</h2>
          <p>
            {online ? 'En línea' : 'Sin conexión'} · {labelPlotLabRuntimeMode(getPlotLabRuntimeMode())}
          </p>
          <p>Pendientes cola: <strong>{pending}</strong></p>
          <p>Blobs outbox: <strong>{blobs}</strong></p>
          <p>Offline parcial: {isPlotLabOfflinePartialEnabled() ? 'sí' : 'no (VITE_PLOTLAB_OFFLINE=0)'}</p>
          {lastFlushMsg ? <p className="offline-diag__hint">{lastFlushMsg}</p> : null}
          <button type="button" disabled={!online || flushing} onClick={() => void flush()}>
            {flushing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </article>

        <article>
          <h2>Caché (edad)</h2>
          <ul>
            <li>
              Tablero: {formatCacheAge(meta.tableroSavedAt) || '—'} (máx. {TABLERO_CACHE_MAX_ROWS} OPs)
            </li>
            <li>Artículos/precios: {formatCacheAge(meta.articulosSavedAt) || '—'}</li>
            <li>Stock: {formatCacheAge(meta.stockSavedAt) || '—'}</li>
            <li>Clientes (última búsqueda): {formatCacheAge(meta.clientesTouchedAt) || '—'}</li>
            <li>
              Último flush OK: {formatCacheAge(meta.lastFlushAt) || '—'}
              {meta.lastFlushOk != null ? ` (${meta.lastFlushOk})` : ''}
            </li>
          </ul>
          <button type="button" onClick={() => void refresh()}>
            Actualizar vista
          </button>
        </article>
      </section>

      {conflicts.length > 0 && (
        <section className="offline-diag__block">
          <h2>Conflictos</h2>
          <ul className="offline-diag__list">
            {conflicts.map((c) => (
              <li key={c.id}>
                <div>
                  OP {c.ordenId}: origen «{c.estadoOrigen || '?'}» → servidor «{c.estadoActual || '?'}» ·
                  destino «{c.nuevoEstado || '?'}»
                  {c.applied ? ' · aplicado' : ' · no aplicado'}
                </div>
                <button type="button" onClick={() => dismissOfflineConflict(c.id)}>
                  Descartar aviso
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="offline-diag__block">
        <h2>Cola ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p className="offline-diag__hint">Sin jobs pendientes.</p>
        ) : (
          <ul className="offline-diag__list">
            {jobs.map((j) => (
              <li key={j.id}>
                <div>
                  <strong>{j.kind}</strong> · {new Date(j.createdAt).toLocaleString('es-AR')} · intentos{' '}
                  {j.attempts}
                  {j.lastError ? <span className="offline-diag__err"> · {j.lastError}</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void syncQueueRemove(j.id).then(() => refresh())
                  }}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={!online}
          onClick={() => {
            void syncQueueFlush().then((r) => {
              setMsg(`OK ${r.ok} · falló ${r.failed} · quedan ${r.remaining}`)
              void refresh()
            })
          }}
        >
          Flush manual
        </button>
      </section>

      <section className="offline-diag__block">
        <h2>Outbox blobs</h2>
        <button
          type="button"
          onClick={() => {
            void blobOutboxList().then((rows) => {
              setMsg(
                rows.length
                  ? rows.map((r) => `${r.kind} ${r.id.slice(0, 18)}…`).join(' | ')
                  : 'Sin blobs'
              )
            })
          }}
        >
          Listar firmas/fotos en cola
        </button>
      </section>

      {msg ? <p className="offline-diag__msg">{msg}</p> : null}
    </div>
  )
}
