import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CcCobranzasPanelData, CcCobranzaAgingBucket } from '../types/api'
import { CC_AGING_LABELS, buildCobranzasOperacionesCsvRows } from '../utils/cuentaCorrienteCobranzas'
import { downloadCsv } from '../utils/cuentaCorrienteExport'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { clientesCcPerfil } from '../utils/clientesRoutes'
import './CuentaCorrienteCobranzasPanel.css'

type TabId = 'vendedores' | 'pagos' | 'aging'

type Props = {
  data: CcCobranzasPanelData | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

const AGING_ORDER: CcCobranzaAgingBucket[] = ['al_dia', '1_30', '31_60', '61_90', '90_mas']

const AGING_COLORS: Record<CcCobranzaAgingBucket, string> = {
  al_dia: '#34d399',
  '1_30': '#fbbf24',
  '31_60': '#fb923c',
  '61_90': '#f87171',
  '90_mas': '#dc2626'
}

export default function CuentaCorrienteCobranzasPanel({ data, loading, error, onRefresh }: Props) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('aging')

  const agingMax = useMemo(() => {
    if (!data) return 1
    return Math.max(1, ...AGING_ORDER.map((b) => data.aging[b].monto))
  }, [data])

  const exportarOperaciones = () => {
    const rows = buildCobranzasOperacionesCsvRows(data?.ventas_abiertas ?? [])
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`cobranzas-cc-operaciones-${stamp}.csv`, rows)
  }

  return (
    <section className="cc-cobranzas" aria-labelledby="cc-cobranzas-title">
      <header className="cc-cobranzas__head">
        <div>
          <h2 id="cc-cobranzas-title">Indicadores de cobranza</h2>
          <p>Resumen por cobrar. El detalle de clientes y ventas está en la tabla unificada.</p>
        </div>
        <div className="cc-cobranzas__head-actions">
          <button
            type="button"
            className="cc-cobranzas__export"
            onClick={exportarOperaciones}
            disabled={!data?.ventas_abiertas.length}
          >
            ↓ Exportar CSV
          </button>
          <button type="button" className="cc-cobranzas__refresh" onClick={onRefresh} disabled={loading}>
            {loading ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div className="cc-cobranzas__error" role="alert">
          {error}
        </div>
      )}

      <div className="cc-cobranzas__kpis">
        <article className="cc-cob-kpi cc-cob-kpi--primary">
          <span className="cc-cob-kpi__label">Por cobrar</span>
          <strong className="cc-cob-kpi__value">{formatMontoArs(data?.total_por_cobrar ?? 0)}</strong>
          <span className="cc-cob-kpi__hint">{data?.ventas_abiertas.length ?? 0} ventas abiertas</span>
        </article>
        <article className="cc-cob-kpi cc-cob-kpi--warn">
          <span className="cc-cob-kpi__label">Vencido</span>
          <strong className="cc-cob-kpi__value">{formatMontoArs(data?.total_vencido ?? 0)}</strong>
        </article>
        <article className="cc-cob-kpi cc-cob-kpi--ok">
          <span className="cc-cob-kpi__label">Cobrado este mes</span>
          <strong className="cc-cob-kpi__value">{formatMontoArs(data?.cobrado_mes ?? 0)}</strong>
          <span className="cc-cob-kpi__hint">{data?.pagos_mes_count ?? 0} pagos</span>
        </article>
        <article className="cc-cob-kpi">
          <span className="cc-cob-kpi__label">Clientes con deuda</span>
          <strong className="cc-cob-kpi__value">{data?.clientes_con_deuda ?? 0}</strong>
        </article>
        <article className="cc-cob-kpi">
          <span className="cc-cob-kpi__label">Tasa cobranza mes</span>
          <strong className="cc-cob-kpi__value">{data?.tasa_cobranza_mes ?? 0}%</strong>
          <span className="cc-cob-kpi__hint">Cobrado / (cobrado + pendiente)</span>
        </article>
        <article className="cc-cob-kpi">
          <span className="cc-cob-kpi__label">Vendedores activos</span>
          <strong className="cc-cob-kpi__value">{data?.por_vendedor.length ?? 0}</strong>
        </article>
      </div>

      <div className="cc-cobranzas__tabs" role="tablist">
        {(
          [
            ['aging', 'Antigüedad'],
            ['vendedores', `Por vendedor (${data?.por_vendedor.length ?? 0})`],
            ['pagos', `Pagos del mes (${data?.pagos_recientes.length ?? 0})`]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`cc-cobranzas__tab${tab === id ? ' cc-cobranzas__tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'vendedores' && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          {!data?.por_vendedor.length ? (
            <p className="cc-cobranzas__empty">Sin ventas CC pendientes por vendedor.</p>
          ) : (
            <div className="cc-cob-table-wrap">
              <table className="cc-cob-table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th>Ventas abiertas</th>
                    <th>Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {data.por_vendedor.map((v) => (
                    <tr key={v.id_vendedor ?? v.nombre_vendedor}>
                      <td>
                        <strong>{v.nombre_vendedor}</strong>
                      </td>
                      <td>{v.ventas_pendientes}</td>
                      <td className="cc-cob-monto">{formatMontoArs(v.monto_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'pagos' && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          {!data?.pagos_recientes.length ? (
            <p className="cc-cobranzas__empty">Sin pagos registrados este mes.</p>
          ) : (
            <div className="cc-cob-table-wrap">
              <table className="cc-cob-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.pagos_recientes.map((p) => (
                    <tr key={p.id_movimiento}>
                      <td>{p.fecha}</td>
                      <td>
                        <strong>{p.cliente_nombre}</strong>
                      </td>
                      <td>{p.concepto || 'Pago cuenta corriente'}</td>
                      <td className="cc-cob-monto cc-cob-monto--ok">{formatMontoArs(p.monto)}</td>
                      <td>
                        <button
                          type="button"
                          className="cc-cob-link"
                          onClick={() => navigate(clientesCcPerfil(p.id_cliente))}
                        >
                          Cuenta →
                        </button>
                        {p.url_comprobante && (
                          <a
                            href={p.url_comprobante}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cc-cob-link cc-cob-link--gap"
                          >
                            Comprobante
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'aging' && data && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          <div className="cc-cob-aging-bars">
            {AGING_ORDER.map((bucket) => {
              const row = data.aging[bucket]
              const pct = Math.round((row.monto / agingMax) * 100)
              return (
                <div key={bucket} className="cc-cob-aging-row">
                  <span className="cc-cob-aging-label">{CC_AGING_LABELS[bucket]}</span>
                  <div className="cc-cob-aging-track">
                    <div
                      className="cc-cob-aging-fill"
                      style={{ width: `${pct}%`, background: AGING_COLORS[bucket] }}
                    />
                  </div>
                  <span className="cc-cob-aging-meta">
                    {row.count} · {formatMontoArs(row.monto)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
