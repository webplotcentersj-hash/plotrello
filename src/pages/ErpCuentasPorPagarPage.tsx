import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { estadoVencimientoErp, labelVencimientoErp } from '../utils/erpVencimiento'
import './ErpSectionPage.css'

type AlertaCxp = {
  id: number
  id_cuenta_por_pagar: number
  nivel: 'proximo' | 'vencido'
  dias_restantes: number | null
  mensaje: string | null
  leida: boolean
  proveedor_nombre?: string
  monto_pendiente?: number
  fecha_vencimiento?: string
}

export default function ErpCuentasPorPagarPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || ''

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
  const [alertas, setAlertas] = useState<AlertaCxp[]>([])
  const [showPagoFor, setShowPagoFor] = useState<number | null>(null)
  const [loadingPago, setLoadingPago] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagoForm, setPagoForm] = useState({
    monto: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'Transferencia' as 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Cheque' | 'Depósito' | 'Otro',
    numero_comprobante: '',
    id_cuenta_bancaria: '',
    observaciones: ''
  })

  const loadRows = async () => {
    const r = await apiService.getCuentasPorPagar(estado ? ({ estado } as any) : undefined)
    if (r.success && r.data) setRows(Array.isArray(r.data) ? r.data : [])
    else {
      setRows([])
      if (!r.success) setError(r.error || 'No se pudieron cargar cuentas.')
    }
  }

  const loadAlertas = async () => {
    await apiService.erpRefreshAlertasCxp(7)
    const r = await apiService.getErpAlertasCxp({ soloNoLeidas: false })
    if (r.success && r.data) setAlertas(r.data)
  }

  const bootstrap = async () => {
    setLoading(true)
    setError(null)
    setSyncing(true)
    try {
      await apiService.erpSyncCxpDesdeFacturasCompra()
      await loadRows()
      if (isAdmin) await loadAlertas()
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    void bootstrap()
  }, [estado, isAdmin])

  useEffect(() => {
    let cancelled = false
    void apiService.getCuentasBancarias({ activa: true }).then((r) => {
      if (cancelled) return
      if (r.success && r.data) setCuentas(Array.isArray(r.data) ? r.data : [])
      else setCuentas([])
    })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = useMemo(() => {
    const pending = rows.filter((c: any) => c?.estado === 'Pendiente' || c?.estado === 'Parcial')
    const monto = pending.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0)
    const proximas = rows.filter((c: any) => estadoVencimientoErp(c.fecha_vencimiento) === 'proximo').length
    const vencidas = rows.filter((c: any) => estadoVencimientoErp(c.fecha_vencimiento) === 'vencido').length
    const alertasActivas = alertas.filter((a) => !a.leida).length
    return { total: rows.length, pendientes: pending.length, monto, proximas, vencidas, alertasActivas }
  }, [rows, alertas])

  const alertasNoLeidas = alertas.filter((a) => !a.leida)

  const pillClass = (fecha: string | null | undefined) => {
    const e = estadoVencimientoErp(fecha)
    if (e === 'vencido') return 'erp-pill danger'
    if (e === 'proximo') return 'erp-pill warn'
    if (e === 'al_dia') return 'erp-pill ok'
    return 'erp-pill'
  }

  const openPago = (id: number, pendiente: number) => {
    setShowPagoFor(id)
    setPagoForm((p) => ({ ...p, monto: String(Number(pendiente || 0).toFixed(2)) }))
  }

  const handleMarcarLeida = async (id: number) => {
    await apiService.marcarErpAlertaCxpLeida(id)
    await loadAlertas()
  }

  const handleRegistrarPago = async () => {
    if (!showPagoFor) return
    const cuenta = rows.find((r: any) => r?.id === showPagoFor)
    if (!cuenta) return
    const monto = Number(String(pagoForm.monto || '').replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      alert('Ingresá un monto válido.')
      return
    }
    if (monto > Number(cuenta.monto_pendiente || 0) + 0.00001) {
      alert('El monto no puede superar el pendiente.')
      return
    }
    if (!pagoForm.fecha_pago) {
      alert('Seleccioná la fecha de pago.')
      return
    }

    setLoadingPago(true)
    try {
      const r = await apiService.registrarPago({
        id_cuenta_por_pagar: cuenta.id,
        monto,
        fecha_pago: pagoForm.fecha_pago,
        metodo_pago: pagoForm.metodo_pago,
        numero_comprobante: pagoForm.numero_comprobante?.trim() || null,
        id_cuenta_bancaria: pagoForm.id_cuenta_bancaria ? Number(pagoForm.id_cuenta_bancaria) : null,
        observaciones: pagoForm.observaciones?.trim() || null
      })
      if (!r.success) {
        alert('Error registrando pago: ' + (r.error || 'desconocido'))
        return
      }
      alert('Pago registrado.')
      setShowPagoFor(null)
      setPagoForm((p) => ({ ...p, monto: '', numero_comprobante: '', observaciones: '', id_cuenta_bancaria: '' }))
      await loadRows()
      if (isAdmin) await loadAlertas()
    } catch (e) {
      console.error(e)
      alert('Error registrando pago.')
    } finally {
      setLoadingPago(false)
    }
  }

  return (
    <div className="erp-section">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            💸
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Tesorería</p>
            <h1>Cuentas por pagar</h1>
            <p className="erp-section-sub">
              Deudas con proveedores {syncing ? '· sincronizando…' : '· desde facturas de compra'}
            </p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria')}>
            Tesorería
          </button>
          <button type="button" className="btn-primary" onClick={() => void bootstrap()} disabled={loading}>
            Actualizar
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      {isAdmin && alertasNoLeidas.length > 0 && (
        <div className={`erp-alertas-panel ${kpis.vencidas > 0 ? 'erp-alertas-panel--danger' : ''}`}>
          <h3>⚠️ Alertas de vencimiento ({alertasNoLeidas.length})</h3>
          <ul className="erp-alertas-list">
            {alertasNoLeidas.slice(0, 8).map((a) => (
              <li key={a.id} className="erp-alerta-item">
                <div>
                  <span className={a.nivel === 'vencido' ? 'erp-pill danger' : 'erp-pill warn'}>
                    {a.nivel === 'vencido' ? 'Vencida' : 'Próxima'}
                  </span>{' '}
                  <span>{a.mensaje || a.proveedor_nombre}</span>
                </div>
                <div className="erp-section-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(`/erp/cuentas-por-pagar?estado=${a.nivel === 'vencido' ? 'Vencido' : 'Pendiente'}`)}
                  >
                    Ver
                  </button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => void handleMarcarLeida(a.id)}>
                    Marcar leída
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--rose">
          <div className="erp-stat-card__icon">📋</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.pendientes}</div>
            <div className="erp-stat-card__label">Pendientes</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">💰</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${kpis.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Monto pendiente</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">⏳</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.proximas}</div>
            <div className="erp-stat-card__label">Por vencer (7 d)</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--sky">
          <div className="erp-stat-card__icon">🔔</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.alertasActivas}</div>
            <div className="erp-stat-card__label">Alertas activas</div>
          </div>
        </article>
      </div>

      <section className="erp-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Listado de deudas</h2>
            <p className="erp-panel__hint">{estado ? `Filtro: ${estado}` : 'Todas las cuentas por pagar'}</p>
          </div>
        </div>
        {loading ? (
          <div className="erp-loading-inline">
            <div className="erp-loading-inline__spinner" aria-hidden />
            <span>Cargando deudas…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="erp-empty">
            <span className="erp-empty__icon">✅</span>
            Sin cuentas por pagar. Las facturas de compra generan deuda automáticamente.
          </div>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Pendiente</th>
                  <th>Comprobante</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.proveedor_nombre || '—'}</td>
                    <td>{c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-AR') : '—'}</td>
                    <td>
                      {c.fecha_vencimiento ? (
                        <>
                          {new Date(c.fecha_vencimiento).toLocaleDateString('es-AR')}{' '}
                          <span className={pillClass(c.fecha_vencimiento)}>
                            {labelVencimientoErp(c.fecha_vencimiento)}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{c.estado || '—'}</td>
                      <td className="erp-td-monto">
                        ${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    <td>{c.numero_documento || '—'}</td>
                    <td>
                      <div className="erp-section-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            navigate(
                              `/erp/impuestos?tab=compras&cxp=${c.id}${
                                c.id_pedido_compra != null ? `&pedido=${c.id_pedido_compra}` : ''
                              }`
                            )
                          }
                        >
                          Factura
                        </button>
                        {Number(c.monto_pendiente || 0) > 0 ? (
                          <button type="button" className="btn-primary btn-sm" onClick={() => openPago(c.id, c.monto_pendiente)}>
                            Pagar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPagoFor && (
        <section className="erp-panel">
          <div className="erp-panel__head">
            <div>
              <h2>Registrar pago</h2>
              <p className="erp-panel__hint">Cuenta por pagar #{showPagoFor}</p>
            </div>
          </div>
          <div className="erp-toolbar">
            <label className="erp-field">
              <span className="erp-field__label">Monto</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Fecha</span>
              <input
                type="date"
                value={pagoForm.fecha_pago}
                onChange={(e) => setPagoForm((p) => ({ ...p, fecha_pago: e.target.value }))}
              />
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Método</span>
              <select
                value={pagoForm.metodo_pago}
                onChange={(e) => setPagoForm((p) => ({ ...p, metodo_pago: e.target.value as any }))}
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Cheque">Cheque</option>
                <option value="Depósito">Depósito</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label className="erp-field">
              <span className="erp-field__label">Cuenta bancaria</span>
              <select
                value={pagoForm.id_cuenta_bancaria}
                onChange={(e) => setPagoForm((p) => ({ ...p, id_cuenta_bancaria: e.target.value }))}
              >
                <option value="">(sin asignar)</option>
                {cuentas.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="erp-field" style={{ flex: 1, minWidth: 180 }}>
              <span className="erp-field__label">Comprobante</span>
              <input
                type="text"
                value={pagoForm.numero_comprobante}
                onChange={(e) => setPagoForm((p) => ({ ...p, numero_comprobante: e.target.value }))}
              />
            </label>
          </div>
          <div className="erp-section-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn-secondary" onClick={() => setShowPagoFor(null)} disabled={loadingPago}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleRegistrarPago} disabled={loadingPago}>
              {loadingPago ? 'Registrando…' : 'Confirmar pago'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
