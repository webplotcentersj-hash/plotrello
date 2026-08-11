import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import { notificationIsTotemImpresionPedido } from '../utils/totemNotifications'
import { formatArgentinaDateOnly, getArgentinaDateString } from '../utils/dateUtils'
import {
  openTotemArchivoParaImprimir,
  resolveTotemImpresionPedidoVista
} from '../utils/totemImpresionPedidoVista'
import TotemPrintPreviewMonitor from '../components/totem/TotemPrintPreviewMonitor'
import './TotemImpresionBackofficePage.css'

const LIST_LIMIT = 500
/** Valor especial: ver todos los días cargados. */
const FECHA_TODOS = 'all'

function rowFechaArgentina(createdAt: string): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  return formatArgentinaDateOnly(d)
}

function formatFechaLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!y || !m || !d) return yyyyMmDd
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/** Pedido nuevo: del día (AR) y todavía sin marcar impreso. */
function isPedidoTotemNuevo(row: { created_at: string; impreso_at?: string | null }, hoy: string): boolean {
  if (row.impreso_at) return false
  return rowFechaArgentina(row.created_at) === hoy
}

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
  mp_payment_id?: string | null
  mp_preference_id?: string | null
  detalle?: Record<string, unknown> | null
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
  const [fechaFiltro, setFechaFiltro] = useState<string>(() => getArgentinaDateString())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const hoy = getArgentinaDateString()

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

  useEffect(() => {
    if (!usuarioId || !supabase) return

    const markPrintNotifsRead = async () => {
      try {
        const notifRes = await apiService.getUserNotifications(usuarioId, 60)
        if (!notifRes.success || !notifRes.data) return
        const unread = notifRes.data.filter(
          (n) => !n.is_read && notificationIsTotemImpresionPedido(n)
        )
        await Promise.all(unread.map((n) => apiService.markNotificationAsRead(n.id)))
      } catch {
        /* ignore */
      }
    }

    void markPrintNotifsRead()

    const channel = supabase
      .channel(`totem-impresion-bo:${usuarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'totem_impresion_solicitudes' },
        () => {
          void load()
        }
      )
      .subscribe()

    return () => {
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [usuarioId, load])

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

  const rowsDelDia = useMemo(() => {
    if (fechaFiltro === FECHA_TODOS) return rows
    return rows.filter((r) => rowFechaArgentina(r.created_at) === fechaFiltro)
  }, [rows, fechaFiltro])

  const filteredRows = useMemo(() => {
    return rowsDelDia.filter((r) => {
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
  }, [rowsDelDia, filtro])

  const counts = useMemo(() => {
    let pendientePago = 0
    let pagadoSinImprimir = 0
    let impreso = 0
    for (const r of rowsDelDia) {
      const pagado = r.estado_pago === 'pagado'
      const hasPrint = Boolean(r.impreso_at)
      if (!pagado) pendientePago += 1
      if (pagado && !hasPrint) pagadoSinImprimir += 1
      if (hasPrint) impreso += 1
    }
    return { total: rowsDelDia.length, pendientePago, pagadoSinImprimir, impreso }
  }, [rowsDelDia])

  const fechasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const f = rowFechaArgentina(r.created_at)
      if (f) set.add(f)
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [rows])

  const pendientesOtrosDias = useMemo(() => {
    if (fechaFiltro === FECHA_TODOS) return 0
    return rows.filter((r) => {
      if (rowFechaArgentina(r.created_at) === fechaFiltro) return false
      const pagado = r.estado_pago === 'pagado'
      const impreso = Boolean(r.impreso_at)
      return !pagado || (pagado && !impreso)
    }).length
  }, [rows, fechaFiltro])

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
            Por defecto se muestran los pedidos de hoy. Marcá impreso cuando salga de la cola física.
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

        <div className="totem-bo-daybar" role="group" aria-label="Filtro por día">
          <button
            type="button"
            className={`totem-bo-chip ${fechaFiltro === hoy ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFechaFiltro(hoy)}
          >
            Hoy
          </button>
          <label className="totem-bo-daypicker">
            <span>Día</span>
            <input
              type="date"
              value={fechaFiltro === FECHA_TODOS ? '' : fechaFiltro}
              max={hoy}
              onChange={(e) => {
                const v = e.target.value
                if (v) setFechaFiltro(v)
              }}
            />
          </label>
          {fechasDisponibles.length > 0 && (
            <label className="totem-bo-daypicker">
              <span>Anteriores</span>
              <select
                value={fechaFiltro === FECHA_TODOS || fechaFiltro === hoy ? '' : fechaFiltro}
                onChange={(e) => {
                  const v = e.target.value
                  if (v) setFechaFiltro(v)
                }}
              >
                <option value="">Elegir día…</option>
                {fechasDisponibles
                  .filter((f) => f !== hoy)
                  .map((f) => (
                    <option key={f} value={f}>
                      {formatFechaLabel(f)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className={`totem-bo-chip ${fechaFiltro === FECHA_TODOS ? 'totem-bo-chip--active' : ''}`}
            onClick={() => setFechaFiltro(FECHA_TODOS)}
          >
            Todos los días <span className="totem-bo-chip-n">{rows.length}</span>
          </button>
          <div className="totem-bo-dayhint">
            {fechaFiltro === FECHA_TODOS
              ? 'Mostrando todos los pedidos cargados'
              : `Mostrando ${formatFechaLabel(fechaFiltro)}`}
          </div>
        </div>

        {pendientesOtrosDias > 0 && fechaFiltro !== FECHA_TODOS && (
          <div className="totem-bo-dayalert">
            Hay {pendientesOtrosDias} pedido{pendientesOtrosDias === 1 ? '' : 's'} pendiente
            {pendientesOtrosDias === 1 ? '' : 's'} de otro{pendientesOtrosDias === 1 ? '' : 's'} día
            {pendientesOtrosDias === 1 ? '' : 's'}.
            <button type="button" className="totem-bo-dayalert-btn" onClick={() => setFechaFiltro(FECHA_TODOS)}>
              Ver todos
            </button>
          </div>
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
                <th>Especificaciones</th>
                <th>Archivo</th>
                <th>Pago</th>
                <th>Impreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const isPrinted = Boolean(r.impreso_at)
                const vista = resolveTotemImpresionPedidoVista({
                  tipo_impresion: r.tipo_impresion,
                  archivo_url: r.archivo_url,
                  archivo_nombre: r.archivo_nombre,
                  detalle: r.detalle
                })
                const expanded = expandedId === r.id
                const esNuevo = isPedidoTotemNuevo(r, hoy)
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={[
                        expanded ? 'totem-bo-row--open' : '',
                        esNuevo ? 'totem-bo-row--nuevo' : ''
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined}
                    >
                      <td>#{r.id}</td>
                      <td>
                        <div className="totem-bo-client">
                          <strong>
                            {r.cliente_nombre}
                            {esNuevo ? <span className="totem-bo-nuevo-badge">Nuevo</span> : null}
                          </strong>
                          <span>DNI: {r.cliente_dni}</span>
                          <span>Tel: {r.cliente_telefono}</span>
                        </div>
                      </td>
                      <td>{r.cantidad_hojas}</td>
                      <td>
                        <div className="totem-bo-specs">
                          <strong>{vista.tipoLabel}</strong>
                          <span>
                            Formato: {vista.formato}
                            {vista.papelLabel ? ` · ${vista.papelLabel}` : ''}
                          </span>
                          <span>
                            {vista.faz === 'doble' ? 'Doble faz' : 'Simple faz'} ·{' '}
                            {vista.esBlancoNegro ? 'Blanco y negro' : vista.modoColor === 'auto' ? 'Auto color' : 'Color'}
                          </span>
                          {(vista.colorPages != null || vista.bwPages != null) && (
                            <span>
                              Págs color: {vista.colorPages ?? '—'} · B/N: {vista.bwPages ?? '—'}
                            </span>
                          )}
                          <span>Origen: {r.origen_archivo}</span>
                          {vista.descripcion ? <span className="totem-bo-notes">Notas: {vista.descripcion}</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="totem-bo-file">
                          <div title={r.archivo_nombre}>{r.archivo_nombre}</div>
                          {vista.archivos.map((f, i) => (
                            <button
                              key={`${f.url}-${i}`}
                              type="button"
                              className="totem-bo-file-link"
                              onClick={() =>
                                void openTotemArchivoParaImprimir(f.url, {
                                  nombre: f.nombre || r.archivo_nombre,
                                  forzarBn: vista.esBlancoNegro
                                })
                              }
                            >
                              {vista.esBlancoNegro
                                ? f.nombre?.trim()
                                  ? `Abrir B/N · ${f.nombre}`
                                  : `Abrir archivo ${i + 1} en B/N`
                                : f.nombre?.trim()
                                  ? `Abrir · ${f.nombre}`
                                  : `Abrir archivo ${i + 1}`}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="totem-bo-file-link totem-bo-file-link--ghost"
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                          >
                            {expanded ? 'Ocultar ficha' : 'Ver ficha completa'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`totem-bo-badge ${r.estado_pago === 'pagado' ? 'ok' : 'pending'}`}>
                          {r.estado_pago}
                        </span>
                        {r.estado_pago === 'pagado' && (r.valor_venta != null || r.mp_payment_id) ? (
                          <div className="totem-bo-mpReceipt">
                            <div className="totem-bo-mpReceipt-brand">MERCADO PAGO</div>
                            {r.valor_venta != null ? (
                              <div className="totem-bo-mpReceipt-amount">
                                Checkout{' '}
                                {new Intl.NumberFormat('es-AR', {
                                  style: 'currency',
                                  currency: 'ARS',
                                  maximumFractionDigits: 0
                                }).format(r.valor_venta)}
                              </div>
                            ) : null}
                            {r.mp_payment_id ? (
                              <div className="totem-bo-mpReceipt-id">Pago: {r.mp_payment_id}</div>
                            ) : null}
                          </div>
                        ) : null}
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
                    {expanded && (
                      <tr className="totem-bo-detail-row">
                        <td colSpan={8}>
                          <div className="totem-bo-detail">
                            <div className="totem-bo-detail-grid">
                              <div>
                                <h3>Ficha del pedido #{r.id}</h3>
                                <dl className="totem-bo-dl">
                                  <div>
                                    <dt>Cliente</dt>
                                    <dd>
                                      {r.cliente_nombre} · DNI {r.cliente_dni} · Tel {r.cliente_telefono}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Formato</dt>
                                    <dd>{vista.formato}</dd>
                                  </div>
                                  <div>
                                    <dt>Papel</dt>
                                    <dd>{vista.papelLabel || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt>Faz</dt>
                                    <dd>{vista.faz === 'doble' ? 'Doble faz' : 'Simple faz'}</dd>
                                  </div>
                                  <div>
                                    <dt>Color</dt>
                                    <dd>
                                      {vista.esBlancoNegro
                                        ? 'Blanco y negro'
                                        : vista.modoColor === 'auto'
                                          ? 'Automático (según archivo)'
                                          : 'Color'}
                                      {vista.colorPages != null || vista.bwPages != null
                                        ? ` · ${vista.colorPages ?? 0} color / ${vista.bwPages ?? 0} B/N`
                                        : ''}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt>Hojas</dt>
                                    <dd>{r.cantidad_hojas}</dd>
                                  </div>
                                  <div>
                                    <dt>Tipo / etiqueta</dt>
                                    <dd>{vista.tipoLabel}</dd>
                                  </div>
                                  <div>
                                    <dt>Origen archivo</dt>
                                    <dd>{r.origen_archivo}</dd>
                                  </div>
                                  <div>
                                    <dt>Archivos</dt>
                                    <dd>
                                      {vista.archivos.map((f) => f.nombre || f.url).join(' · ') || r.archivo_nombre}
                                    </dd>
                                  </div>
                                  {vista.descripcion ? (
                                    <div>
                                      <dt>Notas del cliente</dt>
                                      <dd>{vista.descripcion}</dd>
                                    </div>
                                  ) : null}
                                  {r.numero_venta_crm ? (
                                    <div>
                                      <dt>Venta CRM</dt>
                                      <dd>
                                        {r.numero_venta_crm}
                                        {r.valor_venta != null
                                          ? ` · ${new Intl.NumberFormat('es-AR', {
                                              style: 'currency',
                                              currency: 'ARS'
                                            }).format(r.valor_venta)}`
                                          : ''}
                                      </dd>
                                    </div>
                                  ) : null}
                                  <div>
                                    <dt>Creado</dt>
                                    <dd>{new Date(r.created_at).toLocaleString()}</dd>
                                  </div>
                                </dl>
                                <p className="totem-bo-detail-hint">
                                  {vista.esBlancoNegro
                                    ? 'Este pedido se cobró / pidió en blanco y negro: al abrir imágenes se genera la versión B/N.'
                                    : 'Este pedido se imprime en color (o según detección). El archivo se abre tal cual se cargó.'}
                                </p>
                              </div>
                              <div className="totem-bo-detail-preview">
                                <TotemPrintPreviewMonitor
                                  sources={vista.archivos.map((a) => ({ source: a.url, name: a.nombre }))}
                                  formatoImpresion={vista.formato}
                                  modoColor={vista.modoColor}
                                  tipoPapel={vista.papelId || undefined}
                                  fazImpresion={vista.faz}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="totem-bo-empty">
                    {fechaFiltro === FECHA_TODOS
                      ? 'No hay solicitudes en este filtro.'
                      : `No hay solicitudes el ${formatFechaLabel(fechaFiltro)} con este filtro.`}
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
