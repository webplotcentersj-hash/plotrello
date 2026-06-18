import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { PlanCuentaRecord } from '../types/api'
import './ErpSectionPage.css'
import './ErpPlanCuentasPage.css'

type CuentaEnriquecida = PlanCuentaRecord & {
  saldo_final: number | null
  plotLink?: { label: string; path: string; hint: string }
}

const PLOT_LAB_CUENTAS: Record<string, { label: string; path: string; hint: string }> = {
  '1.1.1.01': { label: 'Caja', path: '/erp/tesoreria', hint: 'Movimientos de caja Plot Lab' },
  '1.1.1.02': { label: 'Bancos', path: '/erp/tesoreria', hint: 'Cuentas bancarias' },
  '1.1.1.03': { label: 'Clientes', path: '/erp/cuentas-por-cobrar', hint: 'Ventas CRM y CxC' },
  '1.1.2.01': { label: 'IVA ventas', path: '/erp/impuestos', hint: 'Libro IVA ventas / AFIP' },
  '2.1.1.01': { label: 'Proveedores', path: '/erp/cuentas-por-pagar', hint: 'Compras y CxP' },
  '2.1.2.01': { label: 'IVA compras', path: '/erp/impuestos?tab=compras', hint: 'Libro IVA compras' },
  '4.1.1.01': { label: 'Ventas', path: '/erp/facturas', hint: 'Facturación emitida' }
}

const TIPOS = ['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Costo', 'Gasto', 'Cuenta de Orden'] as const

function tipoClass(tipo: string): string {
  const t = tipo.toLowerCase().replace(/\s+/g, '-')
  if (t === 'activo') return 'plan-cuenta-tipo--activo'
  if (t === 'pasivo') return 'plan-cuenta-tipo--pasivo'
  if (t === 'patrimonio') return 'plan-cuenta-tipo--patrimonio'
  if (t === 'ingreso') return 'plan-cuenta-tipo--ingreso'
  if (t === 'costo' || t === 'gasto') return 'plan-cuenta-tipo--costo'
  return 'plan-cuenta-tipo--orden'
}

function treeGlyph(nivel: number): string {
  if (nivel <= 1) return '▣'
  if (nivel === 2) return '▸'
  if (nivel === 3) return '└'
  return '·'
}

export default function ErpPlanCuentasPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CuentaEnriquecida[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saldosOk, setSaldosOk] = useState(true)
  const [fechaCorte, setFechaCorte] = useState(() => new Date().toISOString().split('T')[0])
  const [filtros, setFiltros] = useState({
    buscar: '',
    tipo: '',
    soloActivas: true,
    soloConSaldo: false,
    soloImputables: false
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [cuentasRes, balanceRes] = await Promise.all([
        apiService.getPlanCuentas(filtros.soloActivas ? true : undefined),
        apiService.getBalanceGeneral(fechaCorte)
      ])

      if (!cuentasRes.success || !cuentasRes.data) {
        setRows([])
        setError(cuentasRes.error || 'No se pudo cargar el plan de cuentas.')
        return
      }

      const saldoMap = new Map<string, number>()
      if (balanceRes.success && balanceRes.data) {
        setSaldosOk(true)
        for (const b of balanceRes.data) {
          saldoMap.set(String(b.codigo_cuenta), Number(b.saldo_final) || 0)
        }
      } else {
        setSaldosOk(false)
      }

      const enriched: CuentaEnriquecida[] = cuentasRes.data.map((c) => ({
        ...c,
        saldo_final: saldoMap.has(c.codigo) ? saldoMap.get(c.codigo)! : null,
        plotLink: PLOT_LAB_CUENTAS[c.codigo]
      }))

      setRows(enriched)
    } catch (e) {
      setError('Error al cargar plan de cuentas')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [fechaCorte, filtros.soloActivas])

  const filtradas = useMemo(() => {
    const q = filtros.buscar.trim().toLowerCase()
    return rows.filter((c) => {
      if (filtros.tipo && c.tipo !== filtros.tipo) return false
      if (filtros.soloImputables && c.nivel < 4) return false
      if (filtros.soloConSaldo && (c.saldo_final == null || Math.abs(c.saldo_final) < 0.01)) return false
      if (!q) return true
      return c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q)
    })
  }, [rows, filtros])

  const kpis = useMemo(() => {
    const activas = rows.filter((c) => c.activa).length
    const imputables = rows.filter((c) => c.nivel >= 4).length
    const conSaldo = rows.filter((c) => c.saldo_final != null && Math.abs(c.saldo_final) > 0.01).length
    const saldoActivo = rows
      .filter((c) => c.tipo === 'Activo' && c.nivel === 1)
      .reduce((s, c) => s + (c.saldo_final || 0), 0)
    const saldoIngresos = rows
      .filter((c) => c.tipo === 'Ingreso')
      .reduce((s, c) => s + Math.abs(c.saldo_final || 0), 0)
    return { total: rows.length, activas, imputables, conSaldo, saldoActivo, saldoIngresos }
  }, [rows])

  const porTipo = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of TIPOS) m[t] = 0
    for (const c of rows) m[c.tipo] = (m[c.tipo] || 0) + 1
    return m
  }, [rows])

  return (
    <div className="erp-section plan-cuentas-page">
      <header className="erp-section-header">
        <div className="erp-section-header__brand">
          <div className="erp-section-header__icon" aria-hidden>
            📋
          </div>
          <div>
            <p className="erp-section-header__eyebrow">Plot Lab · Contable</p>
            <h1>Plan de cuentas</h1>
            <p className="erp-section-sub">
              Estructura contable vinculada a facturación, ventas CRM, tesorería e impuestos
            </p>
          </div>
        </div>
        <div className="erp-section-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp')}>
            ← Contable
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/erp/asientos')}>
            Asientos
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/erp/contabilidad')}>
            Reportes
          </button>
        </div>
      </header>

      {error && (
        <div className="erp-panel">
          <span className="erp-pill danger">Error</span> <span className="erp-muted">{error}</span>
        </div>
      )}

      {!saldosOk && (
        <div className="erp-notice">
          <span>
            Los saldos no están disponibles (falta la función <code>obtener_balance_general</code> en Supabase). El
            árbol de cuentas se muestra igual; aplicá el patch ERP contable para ver movimientos.
          </span>
        </div>
      )}

      <div className="erp-stats-row">
        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">🌳</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.total}</div>
            <div className="erp-stat-card__label">Cuentas en el plan</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--cyan">
          <div className="erp-stat-card__icon">✓</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.imputables}</div>
            <div className="erp-stat-card__label">Imputables (nivel 4+)</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">📊</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{loading ? '…' : kpis.conSaldo}</div>
            <div className="erp-stat-card__label">Con saldo al corte</div>
          </div>
        </article>
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">🔗</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{Object.keys(PLOT_LAB_CUENTAS).length}</div>
            <div className="erp-stat-card__label">Cuentas Plot Lab</div>
          </div>
        </article>
      </div>

      <div className="erp-quick-grid plan-cuentas-quick">
        <button type="button" className="erp-quick-card" style={{ '--quick-accent': '#059669' } as CSSProperties} onClick={() => navigate('/erp/facturas')}>
          <span className="erp-quick-card__glow" />
          <span className="erp-quick-card__icon">🧾</span>
          <span className="erp-quick-card__title">Facturación</span>
          <span className="erp-quick-card__desc">4.1.1.01 Ventas · asientos automáticos</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button type="button" className="erp-quick-card" style={{ '--quick-accent': '#0ea5e9' } as CSSProperties} onClick={() => navigate('/erp/tesoreria')}>
          <span className="erp-quick-card__glow" />
          <span className="erp-quick-card__icon">🏦</span>
          <span className="erp-quick-card__title">Tesorería</span>
          <span className="erp-quick-card__desc">1.1.1.01 Caja · 1.1.1.02 Bancos</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button type="button" className="erp-quick-card" style={{ '--quick-accent': '#6366f1' } as CSSProperties} onClick={() => navigate('/erp/cuentas-por-cobrar')}>
          <span className="erp-quick-card__glow" />
          <span className="erp-quick-card__icon">💳</span>
          <span className="erp-quick-card__title">CxC / Ventas</span>
          <span className="erp-quick-card__desc">1.1.1.03 Clientes desde CRM</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
        <button type="button" className="erp-quick-card" style={{ '--quick-accent': '#f59e0b' } as CSSProperties} onClick={() => navigate('/erp/impuestos')}>
          <span className="erp-quick-card__glow" />
          <span className="erp-quick-card__icon">🏛️</span>
          <span className="erp-quick-card__title">Impuestos</span>
          <span className="erp-quick-card__desc">IVA débito / crédito fiscal</span>
          <span className="erp-quick-card__arrow">→</span>
        </button>
      </div>

      <section className="erp-panel">
        <div className="erp-toolbar">
          <label className="erp-field" style={{ flex: 1, minWidth: 180 }}>
            <span className="erp-field__label">Buscar</span>
            <input
              type="search"
              placeholder="Código o nombre…"
              value={filtros.buscar}
              onChange={(e) => setFiltros((p) => ({ ...p, buscar: e.target.value }))}
            />
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Tipo</span>
            <select value={filtros.tipo} onChange={(e) => setFiltros((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-field">
            <span className="erp-field__label">Saldo al</span>
            <input type="date" value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
          </label>
          <label className="erp-field erp-field--check">
            <span className="erp-field__label">&nbsp;</span>
            <label className="plan-cuentas-check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={filtros.soloActivas}
                onChange={(e) => setFiltros((p) => ({ ...p, soloActivas: e.target.checked }))}
              />
              Solo activas
            </label>
          </label>
          <label className="erp-field erp-field--check">
            <span className="erp-field__label">&nbsp;</span>
            <label className="plan-cuentas-check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={filtros.soloImputables}
                onChange={(e) => setFiltros((p) => ({ ...p, soloImputables: e.target.checked }))}
              />
              Solo imputables
            </label>
          </label>
          <label className="erp-field erp-field--check">
            <span className="erp-field__label">&nbsp;</span>
            <label className="plan-cuentas-check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={filtros.soloConSaldo}
                onChange={(e) => setFiltros((p) => ({ ...p, soloConSaldo: e.target.checked }))}
              />
              Con saldo
            </label>
          </label>
        </div>

        <div className="plan-cuentas-resumen-tipos">
          {TIPOS.filter((t) => porTipo[t] > 0).map((t) => (
            <div key={t} className="plan-cuentas-tipo-chip">
              <strong>{porTipo[t]}</strong>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="erp-panel plan-cuentas-tree-panel">
        <div className="erp-panel__head">
          <div>
            <h2>Árbol contable</h2>
            <p className="erp-panel__hint">
              {filtradas.length} cuenta{filtradas.length !== 1 ? 's' : ''} · saldos desde asientos Plot Lab
            </p>
          </div>
        </div>

        {loading ? (
          <p className="erp-muted">Cargando plan de cuentas…</p>
        ) : filtradas.length === 0 ? (
          <p className="erp-muted">No hay cuentas que coincidan con los filtros.</p>
        ) : (
          <>
            <div className="plan-cuentas-tree-head">
              <span>Cuenta</span>
              <span>Código</span>
              <span>Tipo</span>
              <span>Naturaleza</span>
              <span>Saldo</span>
              <span>Plot Lab</span>
            </div>
            <div className="plan-cuentas-tree-body">
              {filtradas.map((c) => {
                const saldo = c.saldo_final
                const saldoCls =
                  saldo == null || Math.abs(saldo) < 0.01
                    ? 'plan-cuenta-saldo plan-cuenta-saldo--zero'
                    : saldo < 0
                      ? 'plan-cuenta-saldo plan-cuenta-saldo--neg'
                      : 'plan-cuenta-saldo'
                return (
                  <div
                    key={c.id}
                    className={`plan-cuenta-row plan-cuenta-row--n${Math.min(c.nivel, 4)}${c.nivel >= 4 ? ' plan-cuenta-row--imputable' : ''}`}
                  >
                    <div className="plan-cuenta-nombre" style={{ paddingLeft: `${(c.nivel - 1) * 14}px` }}>
                      <span className="plan-cuenta-nombre__indent" aria-hidden>
                        {treeGlyph(c.nivel)}
                      </span>
                      <span className="plan-cuenta-nombre__text">{c.nombre}</span>
                      {!c.activa && <span className="erp-pill warn">Inactiva</span>}
                    </div>
                    <span className="plan-cuenta-codigo">{c.codigo}</span>
                    <span className={`plan-cuenta-tipo ${tipoClass(c.tipo)}`}>{c.tipo}</span>
                    <span className="erp-muted">{c.naturaleza}</span>
                    <span className={saldoCls}>
                      {saldo != null
                        ? `$${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </span>
                    <span>
                      {c.plotLink ? (
                        <button
                          type="button"
                          className="plan-cuenta-link"
                          title={c.plotLink.hint}
                          onClick={() => navigate(c.plotLink!.path)}
                        >
                          {c.plotLink.label} →
                        </button>
                      ) : (
                        <span className="erp-muted">—</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
