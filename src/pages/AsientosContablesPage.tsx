import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { AsientoContableRecord } from '../types/api'
import './ErpSectionPage.css'
import './AsientosContablesPage.css'

type Pendientes = {
  facturas: Array<{
    id: number
    numero_factura: string
    cliente_nombre: string
    total: number
    fecha_emision: string
    id_venta?: number | null
  }>
  cobrosPagos: Array<{
    id: number
    tipo: string
    monto: number
    fecha_pago: string
    metodo_pago?: string | null
  }>
}

export default function AsientosContablesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [asientos, setAsientos] = useState<(AsientoContableRecord & { detalles?: any[] })[]>([])
  const [pendientes, setPendientes] = useState<Pendientes>({ facturas: [], cobrosPagos: [] })
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState({
    estado: searchParams.get('estado') || '',
    tipo: searchParams.get('tipo') || '',
    fechaDesde: '',
    fechaHasta: ''
  })

  const loadPendientes = useCallback(async () => {
    const r = await apiService.getErpPendientesAsientosSync()
    if (r.success && r.data) setPendientes(r.data)
    else setPendientes({ facturas: [], cobrosPagos: [] })
  }, [])

  const loadAsientos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiService.getAsientosContables({
        estado: filtros.estado ? (filtros.estado as 'Borrador' | 'Contabilizado' | 'Anulado') : undefined,
        tipo_asiento: filtros.tipo || undefined,
        fechaDesde: filtros.fechaDesde || undefined,
        fechaHasta: filtros.fechaHasta || undefined
      })

      if (response.success && response.data) setAsientos(response.data)
      else {
        setAsientos([])
        if (!response.success) setError(response.error || 'No se pudieron cargar asientos.')
      }
    } catch (e) {
      setError('Error al cargar asientos')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setSyncing(true)
      setSyncMsg(null)
      try {
        const sync = await apiService.erpSyncAsientosDesdeFacturacion()
        if (!cancelled && sync.success && sync.data) {
          const { facturas_generadas, cobros_generados, errores } = sync.data
          if (facturas_generadas > 0 || cobros_generados > 0) {
            setSyncMsg(
              `Generados ${facturas_generadas} asiento(s) desde facturas y ${cobros_generados} desde cobros/pagos.`
            )
          }
          if (errores.length > 0) {
            setError(
              errores.slice(0, 3).join(' · ') + (errores.length > 3 ? ` (+${errores.length - 3} más)` : '')
            )
          }
        }
        if (!cancelled) await loadPendientes()
      } finally {
        if (!cancelled) setSyncing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadPendientes])

  useEffect(() => {
    if (!syncing) void loadAsientos()
  }, [filtros, loadAsientos, syncing])

  const handleSyncManual = async () => {
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    try {
      const sync = await apiService.erpSyncAsientosDesdeFacturacion()
      if (!sync.success) {
        setError(sync.error || 'Error al sincronizar')
        return
      }
      const d = sync.data!
      setSyncMsg(
        `Sincronización: ${d.facturas_generadas} factura(s), ${d.cobros_generados} cobro(s)/pago(s).` +
          (d.errores.length ? ` Advertencias: ${d.errores.length}.` : '')
      )
      if (d.errores.length) setError(d.errores.slice(0, 2).join(' · '))
      await Promise.all([loadAsientos(), loadPendientes()])
    } finally {
      setSyncing(false)
    }
  }

  const handleContabilizar = async (id: number) => {
    if (!confirm('¿Contabilizar este asiento? No se podrá modificar después.')) return
    const response = await apiService.contabilizarAsiento(id)
    if (response.success) {
      await loadAsientos()
    } else {
      alert('Error al contabilizar: ' + response.error)
    }
  }

  const kpis = useMemo(() => {
    const desdeFacturas = asientos.filter((a) => a.tipo_asiento === 'Facturación' || a.tipo_origen === 'factura').length
    const desdeTesoreria = asientos.filter(
      (a) => a.tipo_asiento === 'Tesorería' || a.tipo_asiento === 'Cobro' || a.tipo_origen === 'pago_cobro'
    ).length
    const contabilizados = asientos.filter((a) => a.estado === 'Contabilizado').length
    return {
      total: asientos.length,
      desdeFacturas,
      desdeTesoreria,
      contabilizados,
      pendientesFacturas: pendientes.facturas.length,
      pendientesCobros: pendientes.cobrosPagos.length
    }
  }, [asientos, pendientes])

  const origenLink = (asiento: AsientoContableRecord) => {
    if (asiento.tipo_origen === 'factura' && asiento.id_origen) {
      return (
        <button type="button" className="asientos-link" onClick={() => navigate(`/erp/facturas/${asiento.id_origen}`)}>
          Factura #{asiento.id_origen}
        </button>
      )
    }
    if (asiento.tipo_origen === 'pago_cobro' && asiento.id_origen) {
      return <span className="erp-muted">Cobro/Pago #{asiento.id_origen}</span>
    }
    return null
  }

  return (
    <div className="erp-section asientos-page">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            📝
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Contable</p>
            <h1>Asientos contables</h1>
            <p className="erp-section-sub">
              Generados automáticamente desde facturación emitida y cobros/pagos de ventas
            </p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            Facturas
          </button>
          <button type="button" className="btn-primary" onClick={handleSyncManual} disabled={syncing}>
            {syncing ? 'Sincronizando…' : '↻ Sincronizar'}
          </button>
        </div>
      </header>

      {syncMsg && (
        <div className="erp-notice">
          <span>{syncMsg}</span>
        </div>
      )}

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Aviso</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">📒</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.total}</div>
            <div className="erp-stat-card__label">Asientos en listado</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--cyan">
          <div className="erp-stat-card__icon">🧾</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.desdeFacturas}</div>
            <div className="erp-stat-card__label">Desde facturación</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">💵</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.desdeTesoreria}</div>
            <div className="erp-stat-card__label">Desde cobros / pagos</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">⏳</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              {kpis.pendientesFacturas + kpis.pendientesCobros}
            </div>
            <div className="erp-stat-card__label">Pendientes de asiento</div>
          </div>
        </article>
      </div>

      {(pendientes.facturas.length > 0 || pendientes.cobrosPagos.length > 0) && (
        <section className="erp-panel asientos-pendientes">
          <div className="erp-panel__head">
            <div>
              <h2>Pendientes de contabilizar</h2>
              <p className="erp-panel__hint">Facturas emitidas y movimientos de tesorería sin asiento vinculado</p>
            </div>
            <button type="button" className="btn-primary btn-sm" onClick={handleSyncManual} disabled={syncing}>
              Generar asientos
            </button>
          </div>
          <div className="asientos-pendientes-grid">
            {pendientes.facturas.length > 0 && (
              <div>
                <h3>Facturas emitidas ({pendientes.facturas.length})</h3>
                <ul className="asientos-pendientes-list">
                  {pendientes.facturas.slice(0, 8).map((f) => (
                    <li key={f.id}>
                      <button type="button" className="asientos-link" onClick={() => navigate(`/erp/facturas/${f.id}`)}>
                        {f.numero_factura}
                      </button>
                      <span className="erp-muted">
                        {f.cliente_nombre} · ${Number(f.total).toLocaleString('es-AR')}
                        {f.id_venta ? ` · Venta #${f.id_venta}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pendientes.cobrosPagos.length > 0 && (
              <div>
                <h3>Cobros y pagos ({pendientes.cobrosPagos.length})</h3>
                <ul className="asientos-pendientes-list">
                  {pendientes.cobrosPagos.slice(0, 8).map((pc) => (
                    <li key={pc.id}>
                      <strong>{pc.tipo}</strong>
                      <span className="erp-muted">
                        ${Number(pc.monto).toLocaleString('es-AR')} · {pc.metodo_pago || '—'} ·{' '}
                        {pc.fecha_pago ? new Date(pc.fecha_pago).toLocaleDateString('es-AR') : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="erp-panel">
        <div className="erp-toolbar">
          <label className="erp-field">
            <span className="erp-field__label">Estado</span>
            <select value={filtros.estado} onChange={(e) => setFiltros((p) => ({ ...p, estado: e.target.value }))}>
              <option value="">Todos</option>
              <option value="Borrador">Borrador</option>
              <option value="Contabilizado">Contabilizado</option>
              <option value="Anulado">Anulado</option>
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Origen</span>
            <select value={filtros.tipo} onChange={(e) => setFiltros((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="">Todos</option>
              <option value="Facturación">Facturación</option>
              <option value="Tesorería">Tesorería (cobros/pagos)</option>
              <option value="Manual">Manual</option>
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Desde</span>
            <input
              type="date"
              value={filtros.fechaDesde}
              onChange={(e) => setFiltros((p) => ({ ...p, fechaDesde: e.target.value }))}
            />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Hasta</span>
            <input
              type="date"
              value={filtros.fechaHasta}
              onChange={(e) => setFiltros((p) => ({ ...p, fechaHasta: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <div className="asientos-list">
        {loading ? (
          <div className="erp-panel">
            <p className="erp-muted">Cargando asientos…</p>
          </div>
        ) : asientos.length === 0 ? (
          <div className="erp-panel asientos-empty">
            <p>No hay asientos en el período seleccionado.</p>
            <p className="erp-muted">
              Emití facturas desde <button type="button" className="asientos-link" onClick={() => navigate('/erp/facturas')}>Facturas</button>
              {' '}o sincronizá cobros de ventas con el botón <strong>Sincronizar</strong>.
            </p>
            {(kpis.pendientesFacturas > 0 || kpis.pendientesCobros > 0) && (
              <button type="button" className="btn-primary" onClick={handleSyncManual} disabled={syncing}>
                Generar {kpis.pendientesFacturas + kpis.pendientesCobros} asiento(s) pendiente(s)
              </button>
            )}
          </div>
        ) : (
          asientos.map((asiento) => (
            <article key={asiento.id} className="erp-panel asiento-card">
              <div className="asiento-card__head">
                <div>
                  <h3>{asiento.numero_asiento}</h3>
                  <p className="asiento-concepto">{asiento.concepto}</p>
                  <div className="asiento-meta">
                    <span>{new Date(asiento.fecha).toLocaleDateString('es-AR')}</span>
                    <span className="separator">•</span>
                    <span className="erp-pill">{asiento.tipo_asiento}</span>
                    <span className={`erp-pill ${asiento.estado === 'Contabilizado' ? 'ok' : asiento.estado === 'Anulado' ? '' : 'warn'}`}>
                      {asiento.estado}
                    </span>
                    {origenLink(asiento)}
                  </div>
                </div>
                <div className="asiento-totales">
                  <div>
                    <span className="erp-muted">Debe</span>{' '}
                    <strong>${asiento.total_debe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div>
                    <span className="erp-muted">Haber</span>{' '}
                    <strong>${asiento.total_haber.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  {Math.abs(asiento.total_debe - asiento.total_haber) > 0.01 && (
                    <div className="asiento-desbalance">Desbalance</div>
                  )}
                </div>
              </div>

              {asiento.detalles && asiento.detalles.length > 0 && (
                <div className="erp-table-wrap">
                  <table className="erp-table">
                    <thead>
                      <tr>
                        <th>Cuenta</th>
                        <th>Concepto</th>
                        <th>Debe</th>
                        <th>Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asiento.detalles.map((detalle: any) => (
                        <tr key={detalle.id}>
                          <td>
                            {detalle.cuenta?.codigo || '—'} — {detalle.cuenta?.nombre || 'Sin cuenta'}
                          </td>
                          <td>{detalle.concepto || '—'}</td>
                          <td className="erp-td-monto">
                            {detalle.debe > 0 ? `$${Number(detalle.debe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="erp-td-monto">
                            {detalle.haber > 0 ? `$${Number(detalle.haber).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="erp-section-actions" style={{ marginTop: 12 }}>
                {asiento.estado === 'Borrador' && (
                  <button type="button" className="btn-primary btn-sm" onClick={() => handleContabilizar(asiento.id)}>
                    Contabilizar
                  </button>
                )}
                {asiento.tipo_origen === 'factura' && asiento.id_origen && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => navigate(`/erp/facturas/${asiento.id_origen}`)}
                  >
                    Ver factura
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
