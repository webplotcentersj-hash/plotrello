import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PagoProveedorEnriquecido } from '../types/api'
import type { Proveedor } from '../types/pedidos'
import './DeudasProveedoresPage.css'

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR')
}

export default function PagosProveedoresPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PagoProveedorEnriquecido[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [idProveedor, setIdProveedor] = useState<number | ''>(() => {
    const p = searchParams.get('id_proveedor')
    return p ? Number(p) : ''
  })
  const [meta, setMeta] = useState({ fechaDesde: '01/01/2026', fechaHasta: '19/06/2026', proveedor: '' })

  useEffect(() => {
    const p = searchParams.get('id_proveedor')
    setIdProveedor(p ? Number(p) : '')
  }, [searchParams])

  useEffect(() => {
    void apiService.getProveedores(true).then((r) => {
      if (r.success && r.data) setProveedores(r.data)
    })
  }, [])

  const proveedorSel = useMemo(
    () => (idProveedor ? proveedores.find((p) => p.id === idProveedor) : null),
    [idProveedor, proveedores]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await apiService.getPagosProveedores({
      buscar: buscar || undefined,
      idProveedor: idProveedor || undefined
    })
    if (r.success && r.data) {
      setRows(r.data)
      const label = proveedorSel?.razon_social || proveedorSel?.nombre
      if (r.data[0]) {
        setMeta({
          fechaDesde: r.data[0].fecha_desde ? fmtFecha(r.data[0].fecha_desde) : meta.fechaDesde,
          fechaHasta: r.data[0].fecha_hasta ? fmtFecha(r.data[0].fecha_hasta) : meta.fechaHasta,
          proveedor: label || (r.data.every((x) => x.proveedor_nombre === r.data![0].proveedor_nombre)
            ? r.data[0].proveedor_nombre
            : 'Todos')
        })
      } else if (label) {
        setMeta((m) => ({ ...m, proveedor: label }))
      }
    } else {
      setRows([])
      setError(r.error || 'No se pudieron cargar los pagos.')
    }
    setLoading(false)
  }, [buscar, idProveedor, proveedorSel])

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, canManageCompras, navigate, load])

  const totalMonto = useMemo(() => rows.reduce((s, r) => s + r.monto, 0), [rows])
  const vinculados = useMemo(() => rows.filter((r) => r.vinculado_sistema).length, [rows])

  const handleVincular = async () => {
    setSyncing(true)
    const r = await apiService.vincularPagosProveedores()
    setSyncing(false)
    if (!r.success) {
      setError(r.error || 'Error al vincular proveedores')
      return
    }
    await load()
  }

  if (authLoading || loading) {
    return (
      <div className="deudas-prov-page">
        <div className="deudas-prov-loading">Cargando planilla de pagos…</div>
      </div>
    )
  }

  return (
    <div className="deudas-prov-page">
      <header className="deudas-prov-header">
        <div>
          <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras · Finanzas</p>
          <h1 style={{ margin: '4px 0 0', color: '#fff' }}>Pagos a proveedores</h1>
        </div>
        <div className="deudas-prov-header__actions">
          <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
            ← Pedidos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/deudas-proveedores')}>
            Deudas proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/movimientos-proveedores')}>
            Movimientos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/proveedores')}>
            Maestro proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/erp/tesoreria')}>
            Tesorería
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" disabled={syncing} onClick={() => void handleVincular()}>
            {syncing ? 'Vinculando…' : 'Vincular proveedores'}
          </button>
        </div>
      </header>

      <div className="deudas-prov-kpis">
        <div className="deudas-prov-kpi">
          <span>Pagos en planilla</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Total pagado</span>
          <strong>{money(totalMonto)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Vinculados en sistema</span>
          <strong>{vinculados}</strong>
        </div>
      </div>

      <div className="deudas-prov-toolbar">
        <label className="deudas-prov-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="N° pago, recibo, proveedor, usuario…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </label>
        <select
          className="deudas-prov-filter"
          value={idProveedor}
          onChange={(e) => setIdProveedor(e.target.value ? Number(e.target.value) : '')}
          aria-label="Filtrar por proveedor del maestro"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>}

      <div className="deudas-prov-report">
        <div className="deudas-prov-report__title">
          <h1>PLOT CENTER</h1>
          <h2>Listado de Pagos a Proveedores</h2>
        </div>
        <div className="deudas-prov-report__meta">
          <span>
            <strong>Fecha:</strong> Desde {meta.fechaDesde} hasta {meta.fechaHasta}
          </span>
          <span>
            <strong>Proveedor:</strong> {meta.proveedor || 'Todos'}
          </span>
        </div>

        <div className="deudas-prov-table-wrap">
          <table className="deudas-prov-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nro. Pago</th>
                <th>Nro. Recibo</th>
                <th>Proveedor</th>
                <th>Usuario</th>
                <th className="col-saldo">Monto</th>
                <th className="col-link">Sistema</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Sin pagos para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtFecha(r.fecha)}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{r.numero_pago}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{r.numero_recibo}</td>
                    <td>{r.proveedor_nombre}</td>
                    <td>{r.usuario || '—'}</td>
                    <td className="col-saldo deudas-prov-saldo--pos">{money(r.monto)}</td>
                    <td className="col-link">
                      {r.vinculado_sistema ? (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/erp/tesoreria')}
                        >
                          Ver pago
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/erp/cuentas-por-pagar')}
                        >
                          Registrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    <strong>Total:</strong>
                  </td>
                  <td className="col-saldo">
                    <strong>{money(totalMonto)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="deudas-prov-footnote">
        Planilla migrada desde el listado contable original. La columna <strong>Sistema</strong> indica si el pago
        coincide con un movimiento en tesorería (tipo Pago). Podés registrar nuevos pagos desde{' '}
        <button type="button" className="deudas-prov-link" onClick={() => navigate('/erp/cuentas-por-pagar')}>
          Cuentas por pagar
        </button>
        .
      </p>
    </div>
  )
}
