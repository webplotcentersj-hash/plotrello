import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './TotemImpresionBackofficePage.css'

const LIST_LIMIT = 500

type Row = {
  id: number
  cliente_nombre: string
  cliente_dni: string
  cliente_telefono: string
  cantidad_hojas: number
  tipo_impresion: string
  origen_archivo: string
  archivo_url: string
  archivo_nombre: string
  numero_op: string | null
  estado_pago: string
  created_at: string
  pagado_at: string | null
  id_venta?: number | null
  numero_venta_crm?: string | null
  valor_venta?: number | null
  estado_pago_venta?: string | null
  impreso_at?: string | null
  impreso_por_usuario_id?: number | null
}

type FiltroCola = 'todos' | 'pendiente_pago' | 'pagado_sin_imprimir' | 'impreso'

export default function TotemImpresionBackofficePage() {
  const { usuario, canAccessTotemImpresionPanel, canMarcarPagoTotemImpresion } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingPayId, setMarkingPayId] = useState<number | null>(null)
  const [markingPrintId, setMarkingPrintId] = useState<number | null>(null)
  const [filtro, setFiltro] = useState<FiltroCola>('todos')

  const usuarioId = useMemo(() => {
    const raw = (usuario as { id?: unknown })?.id
    if (typeof raw === 'number') return raw
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? n : null
    }
    return null
  }, [usuario])

  const load = useCallback(async () => {
    if (!usuarioId) return
    setLoading(true)
    setError(null)
    const r = await apiService.listarSolicitudesImpresionTotem(usuarioId, LIST_LIMIT)
    if (r.success && r.data) setRows(r.data as Row[])
    else setError(r.error || 'No se pudo cargar la cola.')
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    void load()
  }, [load])

  const handleMarkPaid = async (id: number) => {
    if (!usuarioId) return
    setMarkingPayId(id)
    setError(null)
    const r = await apiService.marcarPagoSolicitudImpresionTotem(id, usuarioId)
    if (!r.success) {
      setError(r.error || 'No se pudo marcar pago.')
      setMarkingPayId(null)
      return
    }
    await load()
    setMarkingPayId(null)
  }

  const handleMarkPrinted = async (id: number) => {
    if (!usuarioId) return
    setMarkingPrintId(id)
    setError(null)
    const r = await apiService.marcarImpresoSolicitudImpresionTotem(id, usuarioId)
    if (!r.success) {
      setError(r.error || 'No se pudo marcar como impreso.')
      setMarkingPrintId(null)
      return
    }
    await load()
    setMarkingPrintId(null)
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const pagado = r.estado_pago === 'pagado'
      const impreso = Boolean(r.impreso_at)
      switch (filtro) {
        case 'pendiente_pago':
          return !pagado
        case 'pagado_sin_imprimir':
          return pagado && !impreso
        case 'impreso':
          return impreso
        default:
          return true
      }
    })
  }, [rows, filtro])

  const counts = useMemo(() => {
    let pendientePago = 0
    let pagadoSinImprimir = 0
    let impreso = 0
    for (const r of rows) {
      const pagado = r.estado_pago === 'pagado'
      const hasPrint = Boolean(r.impreso_at)
      if (!pagado) pendientePago += 1
      if (pagado && !hasPrint) pagadoSinImprimir += 1
      if (hasPrint) impreso += 1
    }
    return { total: rows.length, pendientePago, pagadoSinImprimir, impreso }
  }, [rows])

  if (!canAccessTotemImpresionPanel) {
    return (
      <div className="totem-bo-page">
        <div className="totem-bo-card">
          <h1>Cola impresión (tótem)</h1>
          <p>Acceso restringido a administración, gerencia, taller gráfico, imprenta, mostrador o caja.</p>
          <Link to="/" className="totem-bo-link-back">
            Volver al tablero
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="totem-bo-page">
      <header className="totem-bo-header">
        <div>
          <h1>Pedidos tótem — impresión</h1>
          <p>
            Listado de solicitudes del kiosco (hasta {LIST_LIMIT}). Marcá impreso cuando salga de la cola física.
          </p>
        </div>
        <div className="totem-bo-actions">
          <Link to="/impresoras" className="totem-bo-btn totem-bo-btn--ghost">
            ← Impresoras
          </Link>
          <button type="button" className="totem-bo-btn" onClick={() => void load()} disabled={loading || !usuarioId}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      <main className="totem-bo-main">
        {error && <div className="totem-bo-error">{error}</div>}
        {!usuarioId && (
          <div className="totem-bo-error">No se pudo obtener el id de usuario para operar la cola.</div>
        )}

        <div className="totem-bo-summary">
          <button
            type="button"
            className={`totem-bo-chip ${filtro === 'todos' ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFiltro('todos')}
          >
            Todos <span className="totem-bo-chip-n">{counts.total}</span>
          </button>
          <button
            type="button"
            className={`totem-bo-chip ${filtro === 'pendiente_pago' ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFiltro('pendiente_pago')}
          >
            Sin cobrar <span className="totem-bo-chip-n">{counts.pendientePago}</span>
          </button>
          <button
            type="button"
            className={`totem-bo-chip ${filtro === 'pagado_sin_imprimir' ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFiltro('pagado_sin_imprimir')}
          >
            Cobrado, sin imprimir <span className="totem-bo-chip-n">{counts.pagadoSinImprimir}</span>
          </button>
          <button
            type="button"
            className={`totem-bo-chip ${filtro === 'impreso' ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFiltro('impreso')}
          >
            Impreso <span className="totem-bo-chip-n">{counts.impreso}</span>
          </button>
        </div>

        <div className="totem-bo-table-wrap">
          <table className="totem-bo-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Hojas</th>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Pago</th>
                <th>Impreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const isPrinted = Boolean(r.impreso_at)
                return (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>
                      <div className="totem-bo-client">
                        <strong>{r.cliente_nombre}</strong>
                        <span>DNI: {r.cliente_dni}</span>
                        <span>Tel: {r.cliente_telefono}</span>
                      </div>
                    </td>
                    <td>{r.cantidad_hojas}</td>
                    <td>
                      <div className="totem-bo-muted">{r.tipo_impresion}</div>
                      <div className="totem-bo-muted">Origen: {r.origen_archivo}</div>
                    </td>
                    <td>
                      <div className="totem-bo-file">
                        <div title={r.archivo_nombre}>{r.archivo_nombre}</div>
                        <a href={r.archivo_url} target="_blank" rel="noreferrer">
                          Abrir link
                        </a>
                      </div>
                    </td>
                    <td>
                      <span className={`totem-bo-badge ${r.estado_pago === 'pagado' ? 'ok' : 'pending'}`}>
                        {r.estado_pago}
                      </span>
                      {r.pagado_at ? (
                        <div className="totem-bo-muted">Pagado: {new Date(r.pagado_at).toLocaleString()}</div>
                      ) : null}
                    </td>
                    <td>
                      {isPrinted ? (
                        <>
                          <span className="totem-bo-badge ok">Impreso</span>
                          <div className="totem-bo-muted">{new Date(r.impreso_at as string).toLocaleString()}</div>
                          {r.impreso_por_usuario_id != null ? (
                            <div className="totem-bo-muted">Por usuario #{r.impreso_por_usuario_id}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="totem-bo-badge pending">Pendiente</span>
                      )}
                    </td>
                    <td>
                      <div className="totem-bo-action-stack">
                        {canMarcarPagoTotemImpresion ? (
                          <button
                            type="button"
                            className="totem-bo-btn totem-bo-btn--pay totem-bo-btn--sm"
                            disabled={!usuarioId || markingPayId === r.id || r.estado_pago === 'pagado'}
                            onClick={() => void handleMarkPaid(r.id)}
                          >
                            {r.estado_pago === 'pagado'
                              ? 'Pagado'
                              : markingPayId === r.id
                                ? 'Marcando…'
                                : 'Marcar pagado'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="totem-bo-btn totem-bo-btn--print totem-bo-btn--sm"
                          disabled={!usuarioId || markingPrintId === r.id || isPrinted}
                          onClick={() => void handleMarkPrinted(r.id)}
                        >
                          {isPrinted ? 'Impreso' : markingPrintId === r.id ? 'Marcando…' : 'Marcar impreso'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="totem-bo-empty">
                    No hay solicitudes en este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
