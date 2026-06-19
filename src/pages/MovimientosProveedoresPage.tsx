import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { MovimientoProveedorEnriquecido } from '../types/api'
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

function fmtFechaHora(iso: string, esSaldoInicial: boolean): string {
  if (esSaldoInicial) return '—'
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function MovimientosProveedoresPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<MovimientoProveedorEnriquecido[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [tipo, setTipo] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [idProveedor, setIdProveedor] = useState<number | ''>(() => {
    const p = searchParams.get('id_proveedor')
    return p ? Number(p) : ''
  })
  const [meta, setMeta] = useState({
    fechaDesde: '31/12/2025',
    fechaHasta: '19/06/2026',
    proveedor: '',
    moneda: 'PESOS'
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
    const r = await apiService.getMovimientosProveedores({
      buscar: buscar || undefined,
      tipo: tipo || undefined,
      idProveedor: idProveedor || undefined
    })
    if (r.success && r.data) {
      setRows(r.data)
      const label = proveedorSel?.razon_social || proveedorSel?.nombre
      if (r.data[0]) {
        const first = r.data[0]
        setMeta({
          fechaDesde: first.fecha_desde ? fmtFecha(first.fecha_desde) : meta.fechaDesde,
          fechaHasta: first.fecha_hasta ? fmtFecha(first.fecha_hasta) : meta.fechaHasta,
          proveedor: label || (r.data.every((x) => x.proveedor_nombre === first.proveedor_nombre)
            ? first.proveedor_nombre
            : 'Todos'),
          moneda: first.moneda || 'PESOS'
        })
      } else if (label) {
        setMeta((m) => ({ ...m, proveedor: label }))
      }
    } else {
      setRows([])
      setError(r.error || 'No se pudieron cargar los movimientos.')
    }
    setLoading(false)
  }, [buscar, tipo, idProveedor, proveedorSel])

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, canManageCompras, navigate, load])

  const movRows = useMemo(() => rows.filter((r) => !r.es_saldo_inicial), [rows])
  const totalDebe = useMemo(() => movRows.reduce((s, r) => s + r.debe, 0), [movRows])
  const totalHaber = useMemo(() => movRows.reduce((s, r) => s + r.haber, 0), [movRows])
  const saldoFinal = useMemo(() => {
    const last = rows[rows.length - 1]
    return last ? last.saldo : 0
  }, [rows])
  const pagosVinculados = useMemo(
    () => movRows.filter((r) => r.enlace_tipo === 'pago' && r.id_pago_proveedor).length,
    [movRows]
  )

  const handleVincular = async () => {
    setSyncing(true)
    const r = await apiService.vincularMovimientosProveedores()
    setSyncing(false)
    if (!r.success) {
      setError(r.error || 'Error al vincular proveedores')
      return
    }
    await load()
  }

  const tiposUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (!r.es_saldo_inicial) set.add(r.tipo_movimiento)
    }
    return Array.from(set).sort()
  }, [rows])

  if (authLoading || loading) {
    return (
      <div className="deudas-prov-page">
        <div className="deudas-prov-loading">Cargando movimientos de proveedores…</div>
      </div>
    )
  }

  return (
    <div className="deudas-prov-page">
      <header className="deudas-prov-header">
        <div>
          <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>Compras · Finanzas</p>
          <h1 style={{ margin: '4px 0 0', color: '#fff' }}>Movimientos de proveedores</h1>
        </div>
        <div className="deudas-prov-header__actions">
          <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
            ← Pedidos
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/deudas-proveedores')}>
            Deudas proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/pagos-proveedores')}>
            Pagos proveedores
          </button>
          <button type="button" className="cp-btn cp-btn--secondary" onClick={() => navigate('/compras/deuda-cc-proveedores')}>
            Deuda CC
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
          <span>Movimientos</span>
          <strong>{movRows.length}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Saldo final</span>
          <strong>{money(saldoFinal)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Pagos vinculados</span>
          <strong>{pagosVinculados}</strong>
        </div>
      </div>

      <div className="deudas-prov-toolbar">
        <label className="deudas-prov-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Comprobante, tipo, proveedor…"
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
        <select
          className="deudas-prov-filter"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          aria-label="Filtrar por tipo de movimiento"
        >
          <option value="">Todos los tipos</option>
          {tiposUnicos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>}

      <div className="deudas-prov-report">
        <div className="deudas-prov-report__title">
          <h1>PLOT CENTER</h1>
          <h2>Listado de Movimientos de Proveedores</h2>
        </div>
        <div className="deudas-prov-report__meta">
          <span>
            <strong>Período:</strong> Desde {meta.fechaDesde} hasta {meta.fechaHasta}
          </span>
          <span>
            <strong>Proveedor:</strong> {meta.proveedor || 'Todos'}
          </span>
          <span>
            <strong>Moneda:</strong> {meta.moneda}
          </span>
        </div>

        <div className="deudas-prov-table-wrap">
          <table className="deudas-prov-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Fecha Comp.</th>
                <th>Movimiento</th>
                <th>Comprobante</th>
                <th className="col-saldo">Debe</th>
                <th className="col-saldo">Haber</th>
                <th className="col-saldo">Saldo</th>
                <th className="col-link">Sistema</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Sin movimientos para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className={r.es_saldo_inicial ? 'deudas-prov-row--inicial' : undefined}>
                    <td>{fmtFechaHora(r.fecha_hora, r.es_saldo_inicial)}</td>
                    <td>{r.es_saldo_inicial ? '—' : fmtFecha(r.fecha_comprobante || '')}</td>
                    <td style={{ fontSize: '0.82rem' }}>{r.tipo_movimiento}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem' }}>{r.comprobante}</td>
                    <td className="col-saldo">{r.debe ? money(r.debe) : '—'}</td>
                    <td className="col-saldo">{r.haber ? money(r.haber) : '—'}</td>
                    <td className="col-saldo deudas-prov-saldo--pos">{money(r.saldo)}</td>
                    <td className="col-link">
                      {r.enlace_tipo === 'pago' && r.id_pago_proveedor ? (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/compras/pagos-proveedores')}
                        >
                          Ver pago
                        </button>
                      ) : r.enlace_tipo === 'pago' ? (
                        <button
                          type="button"
                          className="deudas-prov-link"
                          onClick={() => navigate('/erp/tesoreria')}
                        >
                          Tesorería
                        </button>
                      ) : r.enlace_tipo === 'factura' || r.enlace_tipo === 'nota' ? (
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
            {movRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    <strong>Total:</strong>
                  </td>
                  <td className="col-saldo">
                    <strong>{money(totalDebe)}</strong>
                  </td>
                  <td className="col-saldo">
                    <strong>{money(totalHaber)}</strong>
                  </td>
                  <td className="col-saldo">
                    <strong>{money(saldoFinal)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="deudas-prov-footnote">
        Cuenta corriente migrada desde el listado contable original ({meta.proveedor}). Los pagos con comprobante PA se
        enlazan con la planilla de{' '}
        <button type="button" className="deudas-prov-link" onClick={() => navigate('/compras/pagos-proveedores')}>
          pagos a proveedores
        </button>
        ; facturas y notas con{' '}
        <button type="button" className="deudas-prov-link" onClick={() => navigate('/erp/cuentas-por-pagar')}>
          cuentas por pagar
        </button>
        .
      </p>
    </div>
  )
}
