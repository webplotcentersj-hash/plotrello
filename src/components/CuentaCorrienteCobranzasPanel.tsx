import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CcCobranzasPanelData, CcCobranzaAgingBucket, CcCobranzaVentaItem } from '../types/api'
import {
  CC_AGING_LABELS,
  buildCobranzasOperacionesCsvRows,
  estadoCobroVenta
} from '../utils/cuentaCorrienteCobranzas'
import { downloadCsv } from '../utils/cuentaCorrienteExport'
import { formatMontoArs } from '../utils/cuentaCorrienteLedger'
import { clientesCcPerfil } from '../utils/clientesRoutes'
import './CuentaCorrienteCobranzasPanel.css'

type TabId = 'operaciones' | 'clientes' | 'vendedores' | 'pagos' | 'aging'

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
  const [tab, setTab] = useState<TabId>('operaciones')
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos')
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const vendedoresOpciones = useMemo(() => {
    if (!data) return []
    return data.por_vendedor.map((v) => ({
      key: v.id_vendedor != null ? String(v.id_vendedor) : `n:${v.nombre_vendedor}`,
      label: v.nombre_vendedor
    }))
  }, [data])

  const ventasFiltradas = useMemo(() => {
    if (!data) return []
    let list = data.ventas_abiertas
    if (soloVencidos) list = list.filter((v) => v.dias_vencido > 0)
    if (filtroVendedor !== 'todos') {
      list = list.filter((v) => {
        const key = v.id_vendedor != null ? String(v.id_vendedor) : `n:${v.nombre_vendedor}`
        return key === filtroVendedor
      })
    }
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (v) =>
          v.cliente_nombre.toLowerCase().includes(q) ||
          v.numero_venta.toLowerCase().includes(q) ||
          v.nombre_vendedor.toLowerCase().includes(q)
      )
    }
    return list
  }, [data, filtroVendedor, soloVencidos, busqueda])

  const agingMax = useMemo(() => {
    if (!data) return 1
    return Math.max(1, ...AGING_ORDER.map((b) => data.aging[b].monto))
  }, [data])

  const exportarOperaciones = () => {
    const rows = buildCobranzasOperacionesCsvRows(ventasFiltradas)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`cobranzas-cc-operaciones-${stamp}.csv`, rows)
  }

  return (
    <section className="cc-cobranzas" aria-labelledby="cc-cobranzas-title">
      <header className="cc-cobranzas__head">
        <div>
          <h2 id="cc-cobranzas-title">Cobranzas CC</h2>
          <p>Cuentas por cobrar: quién vendió, qué está pendiente y seguimiento de pagos.</p>
        </div>
        <div className="cc-cobranzas__head-actions">
          <button
            type="button"
            className="cc-cobranzas__export"
            onClick={exportarOperaciones}
            disabled={!ventasFiltradas.length}
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

      {data && (
        <div className="cc-cob-aging-chips" aria-label="Resumen por antigüedad">
          {AGING_ORDER.map((bucket) => {
            const row = data.aging[bucket]
            if (!row.count) return null
            return (
              <button
                key={bucket}
                type="button"
                className="cc-cob-aging-chip"
                style={{ borderColor: AGING_COLORS[bucket] }}
                onClick={() => setTab('aging')}
              >
                <span>{CC_AGING_LABELS[bucket]}</span>
                <strong>{row.count}</strong>
                <em>{formatMontoArs(row.monto)}</em>
              </button>
            )
          })}
        </div>
      )}

      <div className="cc-cobranzas__tabs" role="tablist">
        {(
          [
            ['operaciones', `Operaciones (${data?.ventas_abiertas.length ?? 0})`],
            ['clientes', `Top clientes (${data?.top_clientes.length ?? 0})`],
            ['vendedores', `Por vendedor (${data?.por_vendedor.length ?? 0})`],
            ['pagos', `Pagos del mes (${data?.pagos_recientes.length ?? 0})`],
            ['aging', 'Antigüedad']
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

      {tab === 'operaciones' && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          <div className="cc-cobranzas__filters">
            <label className="cc-cob-filter cc-cob-filter--search">
              <span>Buscar</span>
              <input
                type="search"
                placeholder="Cliente, venta o vendedor…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <label className="cc-cob-filter">
              <span>Vendedor</span>
              <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)}>
                <option value="todos">Todos</option>
                {vendedoresOpciones.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-cob-filter cc-cob-filter--check">
              <input
                type="checkbox"
                checked={soloVencidos}
                onChange={(e) => setSoloVencidos(e.target.checked)}
              />
              Solo vencidos
            </label>
          </div>

          {loading && !data ? (
            <p className="cc-cobranzas__empty">Cargando operaciones…</p>
          ) : ventasFiltradas.length === 0 ? (
            <p className="cc-cobranzas__empty">
              No hay ventas en cuenta corriente pendientes de cobro
              {soloVencidos ? ' vencidas' : ''}.
            </p>
          ) : (
            <OperacionesTable rows={ventasFiltradas} onCobrar={(id) => navigate(clientesCcPerfil(id))} />
          )}
        </div>
      )}

      {tab === 'clientes' && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          {!data?.top_clientes.length ? (
            <p className="cc-cobranzas__empty">Sin clientes con deuda CC.</p>
          ) : (
            <div className="cc-cob-table-wrap">
              <table className="cc-cob-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Ventas abiertas</th>
                    <th>Pendiente</th>
                    <th>Peor atraso</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.top_clientes.map((c) => (
                    <tr key={c.id_cliente} className={c.peor_dias_vencido > 0 ? 'cc-cob-row--late' : ''}>
                      <td>
                        <strong>{c.cliente_nombre}</strong>
                      </td>
                      <td>{c.ventas_abiertas}</td>
                      <td className="cc-cob-monto">{formatMontoArs(c.monto_pendiente)}</td>
                      <td>
                        {c.peor_dias_vencido > 0 ? (
                          <span className="cc-cob-badge cc-cob--vencido">{c.peor_dias_vencido} días</span>
                        ) : (
                          <span className="cc-cob-badge cc-cob--ok">Al día</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cc-cob-link"
                          onClick={() => navigate(clientesCcPerfil(c.id_cliente))}
                        >
                          Ver cuenta →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'vendedores' && (
        <div className="cc-cobranzas__panel" role="tabpanel">
          {!data?.por_vendedor.length ? (
            <p className="cc-cobranzas__empty">Sin ventas CC pendientes por vendedor.</p>
          ) : (
            <div className="cc-cob-vendedores-grid">
              {data.por_vendedor.map((v) => (
                <article key={v.id_vendedor ?? v.nombre_vendedor} className="cc-cob-vendedor-card">
                  <div className="cc-cob-vendedor-card__avatar" aria-hidden>
                    {(v.nombre_vendedor || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3>{v.nombre_vendedor}</h3>
                    <p>
                      {v.ventas_pendientes} venta{v.ventas_pendientes !== 1 ? 's' : ''} abierta
                      {v.ventas_pendientes !== 1 ? 's' : ''}
                    </p>
                    <strong className="cc-cob-vendedor-card__monto">
                      {formatMontoArs(v.monto_pendiente)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="cc-cob-link"
                    onClick={() => {
                      const key =
                        v.id_vendedor != null ? String(v.id_vendedor) : `n:${v.nombre_vendedor}`
                      setFiltroVendedor(key)
                      setTab('operaciones')
                    }}
                  >
                    Ver ventas
                  </button>
                </article>
              ))}
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

function OperacionesTable({
  rows,
  onCobrar
}: {
  rows: CcCobranzaVentaItem[]
  onCobrar: (idCliente: number) => void
}) {
  const grupos = useMemo(() => {
    const map = new Map<
      number,
      {
        id_cliente: number
        cliente_nombre: string
        ventas: CcCobranzaVentaItem[]
        monto_pendiente: number
        peor_dias_vencido: number
      }
    >()
    for (const row of rows) {
      const prev = map.get(row.id_cliente)
      if (!prev) {
        map.set(row.id_cliente, {
          id_cliente: row.id_cliente,
          cliente_nombre: row.cliente_nombre,
          ventas: [row],
          monto_pendiente: row.monto_pendiente,
          peor_dias_vencido: row.dias_vencido
        })
      } else {
        prev.ventas.push(row)
        prev.monto_pendiente += row.monto_pendiente
        prev.peor_dias_vencido = Math.max(prev.peor_dias_vencido, row.dias_vencido)
      }
    }
    return [...map.values()].sort(
      (a, b) => b.peor_dias_vencido - a.peor_dias_vencido || b.monto_pendiente - a.monto_pendiente
    )
  }, [rows])

  const [abiertos, setAbiertos] = useState<Set<number>>(() => new Set())

  const toggle = (id: number) => {
    setAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandirTodos = () => setAbiertos(new Set(grupos.map((g) => g.id_cliente)))
  const colapsarTodos = () => setAbiertos(new Set())

  return (
    <div className="cc-cob-ops">
      <div className="cc-cob-ops__toolbar">
        <span>
          {grupos.length} cliente{grupos.length === 1 ? '' : 's'} · {rows.length} venta
          {rows.length === 1 ? '' : 's'}
        </span>
        <div className="cc-cob-ops__toolbar-actions">
          <button type="button" className="cc-cob-ops__tool-btn" onClick={expandirTodos}>
            Expandir todos
          </button>
          <button type="button" className="cc-cob-ops__tool-btn" onClick={colapsarTodos}>
            Colapsar
          </button>
        </div>
      </div>

      <ul className="cc-cob-ops__list">
        {grupos.map((g) => {
          const open = abiertos.has(g.id_cliente)
          const st = estadoCobroVenta(g.peor_dias_vencido)
          return (
            <li
              key={g.id_cliente}
              className={`cc-cob-ops-group${open ? ' cc-cob-ops-group--open' : ''}${
                g.peor_dias_vencido > 0 ? ' cc-cob-ops-group--late' : ''
              }`}
            >
              <div className="cc-cob-ops-group__head">
                <button
                  type="button"
                  className="cc-cob-ops-group__toggle"
                  aria-expanded={open}
                  onClick={() => toggle(g.id_cliente)}
                >
                  <span className="cc-cob-ops-group__chevron" aria-hidden />
                  <span className="cc-cob-ops-group__cliente">
                    <strong>{g.cliente_nombre}</strong>
                    <em>
                      {g.ventas.length} venta{g.ventas.length === 1 ? '' : 's'}
                    </em>
                  </span>
                  <span className={`cc-cob-badge ${st.cls}`}>{st.label}</span>
                  <span className="cc-cob-ops-group__monto">{formatMontoArs(g.monto_pendiente)}</span>
                </button>
                {g.monto_pendiente > 0.009 ? (
                  <button
                    type="button"
                    className="cc-cob-link cc-cob-ops-group__cobrar"
                    onClick={() => onCobrar(g.id_cliente)}
                  >
                    Cobrar →
                  </button>
                ) : null}
              </div>

              {open && (
                <div className="cc-cob-ops-group__body">
                  <div className="cc-cob-table-wrap">
                    <table className="cc-cob-table cc-cob-table--nested">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Venta</th>
                          <th>Vendedor</th>
                          <th>Total</th>
                          <th>Pendiente</th>
                          <th>Vence</th>
                          <th>Estado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {g.ventas.map((row) => {
                          const rowSt = estadoCobroVenta(row.dias_vencido)
                          return (
                            <tr
                              key={row.id_venta}
                              className={row.dias_vencido > 0 ? 'cc-cob-row--late' : ''}
                            >
                              <td>{row.fecha_venta}</td>
                              <td>
                                <span className="cc-cob-venta-num">#{row.numero_venta}</span>
                              </td>
                              <td>
                                <span className="cc-cob-vendedor" title={row.nombre_vendedor}>
                                  {row.nombre_vendedor}
                                </span>
                              </td>
                              <td>{formatMontoArs(row.valor_total)}</td>
                              <td className="cc-cob-monto">{formatMontoArs(row.monto_pendiente)}</td>
                              <td>{row.fecha_vencimiento}</td>
                              <td>
                                <span className={`cc-cob-badge ${rowSt.cls}`}>{rowSt.label}</span>
                              </td>
                              <td>
                                {row.monto_pendiente > 0.009 ? (
                                  <button
                                    type="button"
                                    className="cc-cob-link"
                                    onClick={() => onCobrar(row.id_cliente)}
                                  >
                                    Cobrar →
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
