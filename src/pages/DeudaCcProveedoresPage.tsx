import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { DeudaCcProveedorEnriquecido, DeudaCcProveedorResumen } from '../types/api'
import type { Proveedor } from '../types/pedidos'
import './DeudasProveedoresPage.css'

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-AR')
}

function saldoClass(n: number): string {
  return n < 0 ? 'deudas-prov-saldo--neg' : 'deudas-prov-saldo--pos'
}

export default function DeudaCcProveedoresPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DeudaCcProveedorEnriquecido[]>([])
  const [resumen, setResumen] = useState<DeudaCcProveedorResumen>({
    total_comprobantes: 0,
    total_cheques: 0,
    total_cta_cte: 0
  })
  const [meta, setMeta] = useState({
    proveedor_nombre: '',
    proveedor_codigo: '',
    fecha_corte: '19/06/2026'
  })
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [soloConDeuda, setSoloConDeuda] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [idProveedor, setIdProveedor] = useState<number | ''>(() => {
    const p = searchParams.get('id_proveedor')
    return p ? Number(p) : ''
  })

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
    const r = await apiService.getDeudaCcProveedores({
      buscar: buscar || undefined,
      soloConDeuda,
      idProveedor: idProveedor || undefined
    })
    if (r.success && r.data) {
      setRows(r.data.rows)
      setResumen(r.data.resumen)
      setMeta({
        proveedor_nombre: r.data.meta.proveedor_nombre,
        proveedor_codigo: r.data.meta.proveedor_codigo,
        fecha_corte: fmtFecha(r.data.meta.fecha_corte)
      })
    } else {
      setRows([])
      setError(r.error || 'No se pudo cargar la deuda en cuenta corriente.')
    }
    setLoading(false)
  }, [buscar, soloConDeuda, idProveedor])

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, canManageCompras, navigate, load])

  const totalDeuda = useMemo(() => rows.reduce((s, r) => s + r.deuda, 0), [rows])
  const totalPagado = useMemo(() => rows.reduce((s, r) => s + r.pagado, 0), [rows])
  const vencidos = useMemo(() => rows.filter((r) => (r.dias_vencido ?? 0) > 0 && r.deuda > 0).length, [rows])

  const handleVincular = async () => {
    setSyncing(true)
    const r = await apiService.vincularDeudaCcProveedores()
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
        <div className="deudas-prov-loading">Cargando deuda en cuenta corriente…</div>
      </div>
    )
  }

  return (
    <div className="deudas-prov-page">
      <header className="deudas-prov-header">
        <div>
          <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras · Finanzas</p>
          <h1 style={{ margin: '4px 0 0', color: '#fff' }}>Deuda total en cuenta corriente</h1>
        </div>
        <div className="deudas-prov-header__actions">
          <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
            ← Pedidos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/movimientos-proveedores')}>
            Movimientos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/deudas-proveedores')}>
            Deudas proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/proveedores')}>
            Maestro proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" disabled={syncing} onClick={() => void handleVincular()}>
            {syncing ? 'Vinculando…' : 'Vincular proveedores'}
          </button>
        </div>
      </header>

      <div className="deudas-prov-kpis">
        <div className="deudas-prov-kpi">
          <span>Comprobantes</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Total deuda (listado)</span>
          <strong>{money(resumen.total_comprobantes || totalDeuda)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Total cheques</span>
          <strong>{money(resumen.total_cheques)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Total cta. cte.</span>
          <strong>{money(resumen.total_cta_cte)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Con saldo vencido</span>
          <strong>{vencidos}</strong>
        </div>
      </div>

      <div className="deudas-prov-toolbar">
        <label className="deudas-prov-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Tipo, número, proveedor…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </label>
        <label className="deudas-prov-check">
          <input type="checkbox" checked={soloConDeuda} onChange={(e) => setSoloConDeuda(e.target.checked)} />
          Solo con deuda distinta de cero
        </label>
        <select
          className="deudas-prov-filter"
          value={idProveedor}
          onChange={(e) => setIdProveedor(e.target.value ? Number(e.target.value) : '')}
          aria-label="Filtrar por proveedor"
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
          <h2>Listado de Deuda Total en Cuenta Corriente</h2>
        </div>
        <div className="deudas-prov-report__meta">
          <span>
            <strong>Proveedor:</strong> {proveedorSel?.razon_social || proveedorSel?.nombre || meta.proveedor_codigo ? `${meta.proveedor_codigo} - ${meta.proveedor_nombre}` : meta.proveedor_nombre}
          </span>
          <span>
            <strong>Fecha corte:</strong> {meta.fecha_corte}
          </span>
          <span>
            <strong>División:</strong> Todas
          </span>
        </div>

        <div className="deudas-prov-table-wrap">
          <table className="deudas-prov-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Número</th>
                <th>Fecha Comp.</th>
                <th>Fecha Vto.</th>
                <th className="col-saldo">Total</th>
                <th className="col-saldo">Pagado</th>
                <th className="col-saldo">Deuda</th>
                <th>D. Venc.</th>
                <th className="col-saldo">Tot. Actualizado</th>
                <th className="col-link">Sistema</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Sin comprobantes para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.tipo_comprobante}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{r.numero_comprobante}</td>
                    <td>{fmtFecha(r.fecha_comprobante)}</td>
                    <td>{fmtFecha(r.fecha_vencimiento)}</td>
                    <td className="col-saldo">{money(r.total)}</td>
                    <td className="col-saldo">{r.pagado ? money(r.pagado) : '—'}</td>
                    <td className={`col-saldo ${saldoClass(r.deuda)}`}>{money(r.deuda)}</td>
                    <td>{r.dias_vencido != null ? `${r.dias_vencido} Venc.` : '—'}</td>
                    <td className={`col-saldo ${saldoClass(r.total_actualizado)}`}>{money(r.total_actualizado)}</td>
                    <td className="col-link">
                      {r.enlace_movimiento ? (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/compras/movimientos-proveedores')}
                        >
                          Movimientos
                        </button>
                      ) : r.enlace_cxp ? (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/erp/cuentas-por-pagar')}
                        >
                          CxP
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    <strong>Total comprobantes:</strong>
                  </td>
                  <td className="col-saldo" />
                  <td className="col-saldo">
                    <strong>{money(totalPagado)}</strong>
                  </td>
                  <td className={`col-saldo ${saldoClass(totalDeuda)}`}>
                    <strong>{money(resumen.total_comprobantes || totalDeuda)}</strong>
                  </td>
                  <td />
                  <td className="col-saldo" />
                  <td />
                </tr>
                <tr>
                  <td colSpan={6}>
                    <strong>Total cheques:</strong>
                  </td>
                  <td className={`col-saldo ${saldoClass(resumen.total_cheques)}`}>
                    <strong>{money(resumen.total_cheques)}</strong>
                  </td>
                  <td colSpan={3} />
                </tr>
                <tr>
                  <td colSpan={6}>
                    <strong>Total cta. cte.:</strong>
                  </td>
                  <td className={`col-saldo ${saldoClass(resumen.total_cta_cte)}`}>
                    <strong>{money(resumen.total_cta_cte)}</strong>
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="deudas-prov-footnote">
        Detalle de comprobantes pendientes en cuenta corriente del proveedor (migrado desde el listado contable).
        Los totales de cheques y cuenta corriente provienen del reporte original al {meta.fecha_corte}.
      </p>
    </div>
  )
}
