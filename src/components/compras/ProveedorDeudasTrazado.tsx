import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import type { DeudaProveedorEnriquecida } from '../../types/api'
import type { Proveedor } from '../../types/pedidos'
import '../../pages/DeudasProveedoresPage.css'

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function saldoClass(n: number): string {
  return n < 0 ? 'deudas-prov-saldo--neg' : 'deudas-prov-saldo--pos'
}

export type ProveedorDeudasTrazadoProps = {
  mode?: 'page' | 'embedded' | 'panel'
  showHeader?: boolean
  idProveedor?: number
  proveedorNombre?: string
  codigoDeuda?: string | null
  onClose?: () => void
  onEditar?: () => void
}

export default function ProveedorDeudasTrazado({
  mode = 'page',
  showHeader = mode !== 'panel',
  idProveedor: idProveedorProp,
  proveedorNombre: proveedorNombreProp,
  codigoDeuda,
  onClose,
  onEditar
}: ProveedorDeudasTrazadoProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DeudaProveedorEnriquecida[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [soloConSaldo, setSoloConSaldo] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [fechaCorte, setFechaCorte] = useState('—')
  const [idProveedor, setIdProveedor] = useState<number | ''>(idProveedorProp ?? '')

  useEffect(() => {
    setIdProveedor(idProveedorProp ?? '')
  }, [idProveedorProp])

  useEffect(() => {
    if (mode === 'page') {
      void apiService.getProveedores(true).then((r) => {
        if (r.success && r.data) setProveedores(r.data)
      })
    }
  }, [mode])

  const proveedorSel = useMemo(
    () => (idProveedor ? proveedores.find((p) => p.id === idProveedor) : null),
    [idProveedor, proveedores]
  )

  const labelProveedor =
    proveedorNombreProp ||
    proveedorSel?.razon_social ||
    proveedorSel?.nombre ||
    'Todos'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await apiService.getDeudasProveedores({
      buscar: buscar || undefined,
      soloConSaldo,
      idProveedor: idProveedor || idProveedorProp || undefined,
      proveedor:
        !idProveedor && !idProveedorProp && proveedorNombreProp
          ? proveedorNombreProp
          : undefined
    })
    if (r.success && r.data) {
      setRows(r.data)
      if (r.data[0]?.fecha_corte) {
        setFechaCorte(new Date(r.data[0].fecha_corte).toLocaleDateString('es-AR'))
      }
    } else {
      setRows([])
      setError(r.error || 'No se pudieron cargar las deudas.')
    }
    setLoading(false)
  }, [buscar, soloConSaldo, idProveedor, idProveedorProp, proveedorNombreProp])

  useEffect(() => {
    void load()
  }, [load])

  const totalSaldo = useMemo(() => rows.reduce((s, r) => s + r.saldo, 0), [rows])
  const totalCxp = useMemo(() => rows.reduce((s, r) => s + r.saldo_cxp, 0), [rows])
  const vinculados = useMemo(() => rows.filter((r) => r.id_proveedor).length, [rows])

  const handleVincular = async () => {
    setSyncing(true)
    const r = await apiService.vincularDeudasProveedores()
    setSyncing(false)
    if (!r.success) {
      setError(r.error || 'Error al vincular proveedores')
      return
    }
    await load()
  }

  const rootClass =
    mode === 'panel'
      ? 'deudas-prov-page deudas-prov-page--panel'
      : mode === 'embedded'
        ? 'deudas-prov-page deudas-prov-page--embedded'
        : 'deudas-prov-page'

  if (loading) {
    return (
      <div className={rootClass}>
        <div className="deudas-prov-loading">Cargando listado de deudas…</div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      {showHeader && (
        <header className="deudas-prov-header">
          <div>
            <p style={{ margin: 0, color: 'var(--dp-muted)', fontSize: '0.8rem' }}>
              Compras · Finanzas
              {codigoDeuda ? ` · #${codigoDeuda}` : ''}
            </p>
            <h1 style={{ margin: '4px 0 0', color: '#fff' }}>
              {mode === 'embedded' ? labelProveedor : 'Deudas a proveedores'}
            </h1>
          </div>
          <div className="deudas-prov-header__actions">
            {mode === 'embedded' ? (
              <>
                {onEditar && (
                  <button type="button" className="cp-btn cp-btn--secondary" onClick={onEditar}>
                    ✏️ Ficha
                  </button>
                )}
                {onClose && (
                  <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose}>
                    ✕ Cerrar
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" className="cp-btn cp-btn--ghost" onClick={() => navigate('/compras/dashboard')}>
                  ← Pedidos
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => navigate('/compras/pagos-proveedores')}
                >
                  Pagos
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => navigate('/compras/movimientos-proveedores')}
                >
                  Movimientos
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  onClick={() => navigate('/compras/proveedores')}
                >
                  Maestro
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn--secondary"
                  disabled={syncing}
                  onClick={() => void handleVincular()}
                >
                  {syncing ? 'Vinculando…' : 'Vincular proveedores'}
                </button>
              </>
            )}
          </div>
        </header>
      )}

      <div className="deudas-prov-kpis">
        <div className="deudas-prov-kpi">
          <span>Proveedores en listado</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Total saldo (listado)</span>
          <strong>{money(totalSaldo)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Pendiente CxP sistema</span>
          <strong>{money(totalCxp)}</strong>
        </div>
        <div className="deudas-prov-kpi">
          <span>Vinculados a maestro</span>
          <strong>{vinculados}</strong>
        </div>
      </div>

      <div className="deudas-prov-toolbar">
        <label className="deudas-prov-search">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            placeholder="Código o razón social…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </label>
        {mode === 'page' && (
          <>
            <label className="deudas-prov-check">
              <input type="checkbox" checked={soloConSaldo} onChange={(e) => setSoloConSaldo(e.target.checked)} />
              Solo con saldo distinto de cero
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
          </>
        )}
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>}

      <div className="deudas-prov-report">
        <div className="deudas-prov-report__title">
          <h1>PLOT CENTER</h1>
          <h2>Listado De Deudas A Proveedores</h2>
        </div>
        <div className="deudas-prov-report__meta">
          <span>
            <strong>Código:</strong> {codigoDeuda || 'Todos'}
          </span>
          <span>
            <strong>Razón Social:</strong> {labelProveedor}
          </span>
          <span>
            <strong>Hasta la Fecha:</strong> {fechaCorte}
          </span>
        </div>

        <div className="deudas-prov-table-wrap">
          <table className="deudas-prov-table">
            <thead>
              <tr>
                <th className="col-codigo">Código</th>
                <th className="col-spacer" aria-hidden />
                <th className="col-razon">Razón Social</th>
                <th className="col-spacer" aria-hidden />
                <th className="col-tel">Teléfono</th>
                <th className="col-saldo">Saldo</th>
                <th className="col-cxp">CxP sistema</th>
                <th className="col-link">Deuda</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    Sin registros para mostrar.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="col-codigo">{r.codigo}</td>
                    <td />
                    <td className="col-razon">{r.razon_social}</td>
                    <td />
                    <td className="col-tel">{r.telefono || '-'}</td>
                    <td className={`col-saldo ${saldoClass(r.saldo)}`}>{money(r.saldo)}</td>
                    <td className="col-cxp">{r.saldo_cxp > 0 ? money(r.saldo_cxp) : '—'}</td>
                    <td className="col-link">
                      <button
                        type="button"
                        className="deudas-prov-link"
                        disabled={r.cxp_pendientes === 0 && !r.id_proveedor}
                        onClick={() => {
                          if (r.id_proveedor) {
                            navigate(`/erp/cuentas-por-pagar?id_proveedor=${r.id_proveedor}`)
                          } else {
                            navigate('/erp/cuentas-por-pagar')
                          }
                        }}
                      >
                        {r.cxp_pendientes > 0 ? `Ver (${r.cxp_pendientes})` : r.id_proveedor ? 'CxP' : '—'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>
                    <strong>TOTAL</strong>
                  </td>
                  <td className={`col-saldo ${saldoClass(totalSaldo)}`}>
                    <strong>{money(totalSaldo)}</strong>
                  </td>
                  <td className="col-cxp">
                    <strong>{money(totalCxp)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {mode !== 'panel' && (
        <p className="deudas-prov-footnote">
          Datos migrados desde el listado contable original. La columna <strong>CxP sistema</strong> muestra el
          pendiente en cuentas por pagar vinculado al proveedor.
        </p>
      )}
    </div>
  )
}
