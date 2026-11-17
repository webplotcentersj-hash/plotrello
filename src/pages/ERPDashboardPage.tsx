import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord, CuentaPorCobrarRecord } from '../types/api'
import { ChevronRight, ExternalLink, Search, X } from 'lucide-react'
import { CONTABLE_MODULES, ERP_GROUPS, GROUP_BY_ID, type ErpModuleDef } from './erpDashboardModules'
import {
  DIAS_VENTA_ATRASADA,
  cargarFacturasConProblema,
  cargarVentasPorFacturar,
  resumirPorFacturar
} from '../services/facturacionResumen'
import { getArgentinaDateString } from '../utils/dateUtils'
import './ERPDashboardPage.css'

type ModuleStat = { texto: string; tono: 'ok' | 'warn' | 'danger' | 'neutral' }

/** $1,3 M · $820 k · $950 */
function fmtMoneyCorto(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (v >= 10_000) return `$${Math.round(n / 1000).toLocaleString('es-AR')} k`
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function moduleMatchesQuery(module: ErpModuleDef, query: string): boolean {
  if (!query) return true
  const haystack = normalizeSearch(
    [module.title, module.description, GROUP_BY_ID[module.group].title, ...module.keywords].join(' ')
  )
  return query.split(/\s+/).every((token) => haystack.includes(token))
}

export default function ERPDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [recientesOpen, setRecientesOpen] = useState(false)
  const [stats, setStats] = useState({
    facturasPendientes: 0,
    facturasEmitidas: 0,
    cuentasPorCobrar: 0,
    montoPorCobrar: 0,
    asientosPendientes: 0,
    facturasRecientes: [] as FacturaVentaRecord[],
    cuentasVencidas: [] as CuentaPorCobrarRecord[]
  })

  /** Indicadores en vivo que se muestran dentro de algunas tarjetas de módulo. */
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStat[]>>({})

  useEffect(() => {
    let cancelled = false
    const hoy = getArgentinaDateString()
    void Promise.all([cargarVentasPorFacturar(), cargarFacturasConProblema()]).then(([ventasRes, problemasRes]) => {
      if (cancelled) return
      const items: ModuleStat[] = []
      if (ventasRes.ok) {
        const r = resumirPorFacturar(ventasRes.ventas, hoy)
        items.push(
          r.cantidad === 0
            ? { texto: 'Todas las ventas facturadas', tono: 'ok' }
            : {
                texto: `${r.cantidad} por facturar · ${fmtMoneyCorto(r.monto)}`,
                tono: r.atrasadas > 0 ? 'warn' : 'neutral'
              }
        )
        if (r.atrasadas > 0) items.push({ texto: `${r.atrasadas} con más de ${DIAS_VENTA_ATRASADA} días`, tono: 'warn' })
      }
      if (problemasRes.ok && problemasRes.facturas.length > 0) {
        items.push({ texto: `${problemasRes.facturas.length} con problema en ARCA`, tono: 'danger' })
      }
      setModuleStats((prev) => ({ ...prev, facturas: items }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const searchNorm = normalizeSearch(search)
  const filteredModules = useMemo(
    () => CONTABLE_MODULES.filter((m) => moduleMatchesQuery(m, searchNorm)),
    [searchNorm]
  )

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const facturasResponse = await apiService.getFacturas({
        fechaDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      })

      const cxcResponse = await apiService.getCuentasPorCobrar()

      const asientosResponse = await apiService.getAsientosContables({
        estado: 'Borrador'
      })

      if (facturasResponse.success && facturasResponse.data) {
        const facturas = facturasResponse.data
        const pendientes = facturas.filter((f) => f.estado === 'Borrador').length
        const emitidas = facturas.filter((f) => f.estado === 'Emitida').length
        const recientes = facturas.slice(0, 5)

        setStats((prev) => ({
          ...prev,
          facturasPendientes: pendientes,
          facturasEmitidas: emitidas,
          facturasRecientes: recientes
        }))
      }

      if (cxcResponse.success && cxcResponse.data) {
        const cuentas = cxcResponse.data
        const pendientes = cuentas.filter((c) => c.estado === 'Pendiente' || c.estado === 'Parcial')
        const montoTotal = pendientes.reduce((sum, c) => sum + c.monto_pendiente, 0)
        const vencidas = cuentas.filter((c) => {
          if (!c.fecha_vencimiento) return false
          return new Date(c.fecha_vencimiento) < new Date() && c.estado !== 'Pagado'
        })

        setStats((prev) => ({
          ...prev,
          cuentasPorCobrar: pendientes.length,
          montoPorCobrar: montoTotal,
          cuentasVencidas: vencidas
        }))
      }

      if (asientosResponse.success && asientosResponse.data) {
        setStats((prev) => ({
          ...prev,
          asientosPendientes: asientosResponse.data?.length || 0
        }))
      }
    } catch (error) {
      console.error('Error cargando estadísticas Contable:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="erp-dashboard">
        <div className="erp-loading">
          <div className="erp-loading__spinner" aria-hidden />
          <span>Cargando módulo contable…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="erp-dashboard">
      <header className="erp-header">
        <div className="erp-header__brand">
          <div className="erp-header__icon" aria-hidden>
            🏭
          </div>
          <div>
            <p className="erp-header__eyebrow">Plot Center</p>
            <h1>Contable</h1>
            <p className="erp-header__sub">Facturación, contabilidad, impuestos y tesorería</p>
          </div>
        </div>
        <button type="button" className="erp-btn erp-btn--ghost" onClick={() => navigate('/')}>
          ← Volver
        </button>
      </header>

      <div className="erp-stats-grid">
        <article className="erp-stat-card erp-stat-card--amber">
          <div className="erp-stat-card__icon">📄</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{stats.facturasPendientes}</div>
            <div className="erp-stat-card__label">Facturas pendientes</div>
          </div>
          <button type="button" className="erp-stat-card__action" onClick={() => navigate('/erp/facturas?estado=Borrador')}>
            Ver
          </button>
        </article>

        <article className="erp-stat-card erp-stat-card--green">
          <div className="erp-stat-card__icon">✅</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{stats.facturasEmitidas}</div>
            <div className="erp-stat-card__label">Emitidas este mes</div>
          </div>
          <button type="button" className="erp-stat-card__action" onClick={() => navigate('/erp/facturas?estado=Emitida')}>
            Ver
          </button>
        </article>

        <article className="erp-stat-card erp-stat-card--sky">
          <div className="erp-stat-card__icon">💵</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">
              ${stats.montoPorCobrar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <div className="erp-stat-card__label">Por cobrar</div>
          </div>
          <button type="button" className="erp-stat-card__action" onClick={() => navigate('/erp/cuentas-por-cobrar')}>
            Ver
          </button>
        </article>

        <article className="erp-stat-card erp-stat-card--violet">
          <div className="erp-stat-card__icon">📊</div>
          <div className="erp-stat-card__body">
            <div className="erp-stat-card__value">{stats.asientosPendientes}</div>
            <div className="erp-stat-card__label">Asientos pendientes</div>
          </div>
          <button type="button" className="erp-stat-card__action" onClick={() => navigate('/erp/asientos?estado=Borrador')}>
            Ver
          </button>
        </article>
      </div>

      {stats.cuentasVencidas.length > 0 && (
        <div className="erp-alert">
          <div className="erp-alert__icon">⚠️</div>
          <div className="erp-alert__content">
            <strong>Cuentas vencidas</strong>
            <p>{stats.cuentasVencidas.length} cuenta(s) con vencimiento superado</p>
          </div>
          <button type="button" className="erp-btn erp-btn--warn" onClick={() => navigate('/erp/cuentas-por-cobrar?estado=Vencido')}>
            Revisar
          </button>
        </div>
      )}

      <section className="erp-modules-section" aria-label="Módulos contables">
        <div className="erp-modules-toolbar">
          <div>
            <h2 className="erp-modules-title">Módulos</h2>
            <p className="erp-modules-hint">
              {filteredModules.length} de {CONTABLE_MODULES.length} accesos
            </p>
          </div>
          <label className="erp-search" htmlFor="erp-module-search">
            <span className="erp-search__icon" aria-hidden>
              <Search size={17} />
            </span>
            <input
              id="erp-module-search"
              type="search"
              className="erp-search__input"
              placeholder="Buscar módulo… (factura, IVA, tesorería…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {search && (
              <button
                type="button"
                className="erp-search__clear"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </label>
        </div>

        {filteredModules.length === 0 ? (
          <div className="erp-modules-empty">
            <span className="erp-modules-empty__icon">
              <Search size={28} />
            </span>
            <p>No hay módulos para «{search}»</p>
            <button type="button" className="erp-btn erp-btn--ghost" onClick={() => setSearch('')}>
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="erp-module-groups">
            {ERP_GROUPS.map((group) => {
              const mods = filteredModules.filter((m) => m.group === group.id)
              if (mods.length === 0) return null
              return (
                <div
                  key={group.id}
                  className="erp-module-group"
                  style={{ '--module-accent': group.accent } as CSSProperties}
                >
                  <div className="erp-module-group__head">
                    <span className="erp-module-group__dot" aria-hidden />
                    <h3 className="erp-module-group__title">{group.title}</h3>
                    <span className="erp-module-group__desc">{group.description}</span>
                  </div>
                  <div className="erp-modules-grid">
                    {mods.map((module) => {
                      const Icon = module.icon
                      return (
                        <button
                          key={module.id}
                          type="button"
                          className="erp-module-card"
                          onClick={() => {
                            if (module.openInNewTab) {
                              window.open(module.path, '_blank', 'noopener,noreferrer')
                              return
                            }
                            navigate(module.path)
                          }}
                        >
                          <span className="erp-module-card__icon" aria-hidden>
                            <Icon size={22} strokeWidth={1.75} />
                          </span>
                          <span className="erp-module-card__body">
                            <span className="erp-module-card__title">{module.title}</span>
                            <span className="erp-module-card__desc">{module.description}</span>
                            {moduleStats[module.id]?.length ? (
                              <span className="erp-module-card__stats">
                                {moduleStats[module.id].map((s) => (
                                  <span key={s.texto} className={`erp-module-card__stat is-${s.tono}`}>
                                    {s.texto}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          <span className="erp-module-card__arrow" aria-hidden>
                            {module.openInNewTab ? <ExternalLink size={16} /> : <ChevronRight size={18} />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="erp-guide">
        <details className="erp-guide-card">
          <summary className="erp-guide-summary">
            <span className="erp-guide-title">📌 Guía rápida: qué incluye el área contable</span>
            <span className="erp-guide-hint">Ver / ocultar</span>
          </summary>

          <div className="erp-guide-body">
            <div className="erp-guide-grid">
              <div className="erp-guide-item">
                <h3>Facturación electrónica</h3>
                <p>Comprobantes, notas de crédito, CAE y cumplimiento ARCA/AFIP.</p>
              </div>
              <div className="erp-guide-item">
                <h3>Contable y fiscal</h3>
                <p>Asientos, balances, IVA, conciliaciones y cierres mensuales.</p>
              </div>
              <div className="erp-guide-item">
                <h3>Tesorería</h3>
                <p>Cobros, pagos, vencimientos, cuentas corrientes y flujo de caja.</p>
              </div>
              <div className="erp-guide-item">
                <h3>Compras y stock</h3>
                <p>Proveedores, recepción, inventario y cuentas a pagar integradas.</p>
              </div>
            </div>

            <div className="erp-guide-foot">
              <div className="erp-guide-foot-col">
                <h4>Atajos frecuentes</h4>
                <div className="erp-guide-actions">
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => navigate('/erp/facturas')}>
                    Facturas
                  </button>
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => navigate('/erp/tesoreria')}>
                    Tesorería
                  </button>
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => navigate('/erp/configuracion-afip')}>
                    AFIP
                  </button>
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => navigate('/erp/reportes')}>
                    Reportes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>

      {stats.facturasRecientes.length > 0 && (
        <section className={`erp-recent-section${recientesOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="erp-recent-section__toggle"
            aria-expanded={recientesOpen}
            onClick={() => setRecientesOpen((v) => !v)}
          >
            <span aria-hidden>{recientesOpen ? '▼' : '▶'}</span>
            <h2>Facturas recientes</h2>
            <span className="erp-recent-section__meta">{stats.facturasRecientes.length} del mes</span>
          </button>
          {recientesOpen && (
          <div className="erp-table">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stats.facturasRecientes.map((factura) => (
                  <tr key={factura.id}>
                    <td>{factura.numero_factura}</td>
                    <td>{factura.cliente_nombre}</td>
                    <td>{new Date(factura.fecha_emision).toLocaleDateString('es-AR')}</td>
                    <td>${factura.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`estado-badge estado-${factura.estado.toLowerCase()}`}>{factura.estado}</span>
                    </td>
                    <td>
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => navigate(`/erp/facturas/${factura.id}`)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      )}
    </div>
  )
}
