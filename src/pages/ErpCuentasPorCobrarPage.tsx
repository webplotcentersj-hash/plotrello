import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CuentaCorrienteCobranzasPanel from '../components/CuentaCorrienteCobranzasPanel'
import apiService from '../services/api'
import type { CcCobranzasPanelData } from '../types/api'
import { labelVencimientoErp, estadoVencimientoErp } from '../utils/erpVencimiento'
import './ErpSectionPage.css'

type TabId = 'facturas' | 'cuenta_corriente'

export default function ErpCuentasPorCobrarPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const estado = (searchParams.get('estado') || '').trim() || ''
  const tabInicial = (searchParams.get('tab') || 'facturas') as TabId

  const [tab, setTab] = useState<TabId>(tabInicial === 'cuenta_corriente' ? 'cuenta_corriente' : 'facturas')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ccData, setCcData] = useState<CcCobranzasPanelData | null>(null)
  const [ccLoading, setCcLoading] = useState(false)
  const [ccError, setCcError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void apiService
      .getCuentasPorCobrar(estado ? ({ estado } as any) : undefined)
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

  const loadCc = async () => {
    setCcLoading(true)
    setCcError(null)
    try {
      const res = await apiService.listCobranzasCcPanel()
      if (res.success && res.data) setCcData(res.data)
      else setCcError(res.error || 'No se pudo cargar cuenta corriente')
    } catch {
      setCcError('Error de conexión al cargar cuenta corriente')
    } finally {
      setCcLoading(false)
    }
  }

  useEffect(() => {
    void loadCc()
  }, [])

  useEffect(() => {
    if (tab === 'cuenta_corriente') void loadCc()
  }, [tab])

  const kpis = useMemo(() => {
    const pending = rows.filter((c: any) => c?.estado === 'Pendiente' || c?.estado === 'Parcial')
    const montoFacturas = pending.reduce((sum: number, c: any) => sum + (Number(c?.monto_pendiente) || 0), 0)
    const montoCc = ccData?.total_por_cobrar ?? 0
    return {
      totalFacturas: rows.length,
      pendientesFacturas: pending.length,
      montoFacturas,
      montoCc,
      montoTotal: montoFacturas + (tab === 'cuenta_corriente' ? 0 : 0)
    }
  }, [rows, ccData, tab])

  const pillClass = (fecha: string | null | undefined) => {
    const e = estadoVencimientoErp(fecha)
    if (e === 'vencido') return 'erp-pill danger'
    if (e === 'proximo') return 'erp-pill warn'
    if (e === 'al_dia') return 'erp-pill ok'
    return 'erp-pill'
  }

  return (
    <div className="erp-section">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            💳
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Tesorería</p>
            <h1>Cuentas por cobrar</h1>
            <p className="erp-section-sub">Facturas emitidas y deudas de cuenta corriente</p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/tesoreria')}>
            Tesorería
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/clientes/cuenta-corriente')}>
            Gestión CC
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      <div className="erp-tabs">
        <button
          type="button"
          className={`erp-tab ${tab === 'facturas' ? 'erp-tab--active' : ''}`}
          onClick={() => setTab('facturas')}
        >
          Facturas ERP
        </button>
        <button
          type="button"
          className={`erp-tab ${tab === 'cuenta_corriente' ? 'erp-tab--active' : ''}`}
          onClick={() => setTab('cuenta_corriente')}
        >
          Cuenta corriente
        </button>
      </div>

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">📄</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{kpis.pendientesFacturas}</div>
            <div className="erp-stat-card__label">Facturas pendientes</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--cyan">
          <div className="erp-stat-card__icon">💰</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${kpis.montoFacturas.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Monto facturas</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">👥</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{ccData?.clientes_con_deuda ?? '—'}</div>
            <div className="erp-stat-card__label">Clientes con deuda CC</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--sky">
          <div className="erp-stat-card__icon">🤝</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${(ccData?.total_por_cobrar ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Saldo cuenta corriente</div>
          </div>
        </article>
      </div>

      {tab === 'facturas' ? (
        <section className="erp-panel">
          <div className="erp-panel__head">
            <div>
              <h2>Facturas por cobrar</h2>
              <p className="erp-panel__hint">{estado ? `Filtro: ${estado}` : 'Todas las cuentas'}</p>
            </div>
          </div>
          {loading ? (
            <div className="erp-loading-inline">
              <div className="erp-loading-inline__spinner" aria-hidden />
              <span>Cargando…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="erp-empty">
              <span className="erp-empty__icon">📭</span>
              Sin cuentas por cobrar de facturas
            </div>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Emisión</th>
                    <th>Vencimiento</th>
                    <th>Estado</th>
                    <th>Pendiente</th>
                    <th>Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((c: any) => (
                    <tr key={c.id}>
                      <td>{c.cliente_nombre || '—'}</td>
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
                      <td>{c.factura?.numero_factura || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="erp-panel">
          <CuentaCorrienteCobranzasPanel
            data={ccData}
            loading={ccLoading}
            error={ccError}
            onRefresh={() => void loadCc()}
          />
        </section>
      )}
    </div>
  )
}
