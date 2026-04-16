import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import './ErpSectionPage.css'

export default function ErpCuentasPorPagarPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || ''

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<any[]>([])
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getCuentasPorPagar(estado ? ({ estado } as any) : undefined)
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data) setRows(Array.isArray(r.data) ? r.data : [])
        else {
          setRows([])
          if (!r.success) setError(r.error || 'No se pudieron cargar cuentas.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [estado])

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
    return { total: rows.length, pendientes: pending.length, monto }
  }, [rows])

  const openPago = (id: number, pendiente: number) => {
    setShowPagoFor(id)
    setPagoForm((p) => ({ ...p, monto: String(Number(pendiente || 0).toFixed(2)) }))
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
      // recargar
      const rr = await apiService.getCuentasPorPagar(estado ? ({ estado } as any) : undefined)
      if (rr.success && rr.data) setRows(Array.isArray(rr.data) ? rr.data : [])
    } catch (e) {
      console.error(e)
      alert('Error registrando pago.')
    } finally {
      setLoadingPago(false)
    }
  }

  return (
    <div className="erp-section">
      <div className="erp-section-header">
        <div>
          <h1>💸 Cuentas por Pagar</h1>
          <p className="erp-section-sub">Filtro: {estado || 'todas'}</p>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Volver a ERP
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria')}>
            Ir a Tesorería
          </button>
        </div>
      </div>

      {error && <div className="erp-panel"><span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span></div>}

      <div className="erp-section-grid">
        <div className="erp-panel">
          <h2>KPIs</h2>
          <div className="erp-kpi">
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.total}</div>
              <div className="erp-kpi-label">Cuentas</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">{kpis.pendientes}</div>
              <div className="erp-kpi-label">Pendientes / parcial</div>
            </div>
            <div className="erp-kpi-item">
              <div className="erp-kpi-value">
                ${kpis.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div className="erp-kpi-label">Monto pendiente</div>
            </div>
          </div>
        </div>
      </div>

      <div className="erp-panel">
        <h2>Listado</h2>
        {loading ? (
          <p className="erp-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="erp-muted">Sin datos para el filtro.</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th>Monto pendiente</th>
                  <th>Comprobante</th>
                  <th>IVA compras</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((c: any) => (
                  <tr key={c.id}>
                    <td>{c.proveedor_nombre || '—'}</td>
                    <td>{c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</td>
                    <td>{c.estado || '—'}</td>
                    <td>${Number(c.monto_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{c.numero_comprobante || c.comprobante || '—'}</td>
                    <td>
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
                        Factura compra
                      </button>
                    </td>
                    <td>
                      {Number(c.monto_pendiente || 0) > 0 ? (
                        <button type="button" className="btn-primary" onClick={() => openPago(c.id, c.monto_pendiente)}>
                          Registrar pago
                        </button>
                      ) : (
                        <span className="erp-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPagoFor && (
        <div className="erp-panel">
          <h2>Registrar pago</h2>
          <div className="erp-kpi">
            <div className="erp-kpi-item">
              <div className="erp-kpi-label">Cuenta por pagar</div>
              <div className="erp-kpi-value">#{showPagoFor}</div>
            </div>
          </div>

          <div className="erp-section-actions" style={{ marginTop: 10 }}>
            <label className="erp-muted">
              Monto{' '}
              <input
                type="number"
                min="0"
                step="0.01"
                value={pagoForm.monto}
                onChange={(e) => setPagoForm((p) => ({ ...p, monto: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className="erp-muted">
              Fecha{' '}
              <input
                type="date"
                value={pagoForm.fecha_pago}
                onChange={(e) => setPagoForm((p) => ({ ...p, fecha_pago: e.target.value }))}
                style={{ marginLeft: 8 }}
              />
            </label>
            <label className="erp-muted">
              Método{' '}
              <select
                value={pagoForm.metodo_pago}
                onChange={(e) => setPagoForm((p) => ({ ...p, metodo_pago: e.target.value as any }))}
                style={{ marginLeft: 8 }}
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Cheque">Cheque</option>
                <option value="Depósito">Depósito</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            <label className="erp-muted">
              Cuenta{' '}
              <select
                value={pagoForm.id_cuenta_bancaria}
                onChange={(e) => setPagoForm((p) => ({ ...p, id_cuenta_bancaria: e.target.value }))}
                style={{ marginLeft: 8 }}
              >
                <option value="">(sin asignar)</option>
                {cuentas.map((c: any) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="erp-section-actions" style={{ marginTop: 10 }}>
            <label className="erp-muted" style={{ flex: 1 }}>
              Comprobante{' '}
              <input
                type="text"
                value={pagoForm.numero_comprobante}
                onChange={(e) => setPagoForm((p) => ({ ...p, numero_comprobante: e.target.value }))}
                style={{ marginLeft: 8, width: 320, maxWidth: '100%' }}
              />
            </label>
          </div>
          <div className="erp-section-actions" style={{ marginTop: 10 }}>
            <label className="erp-muted" style={{ flex: 1 }}>
              Observaciones{' '}
              <input
                type="text"
                value={pagoForm.observaciones}
                onChange={(e) => setPagoForm((p) => ({ ...p, observaciones: e.target.value }))}
                style={{ marginLeft: 8, width: 520, maxWidth: '100%' }}
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
        </div>
      )}
    </div>
  )
}

