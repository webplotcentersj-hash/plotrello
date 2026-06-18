import { useMemo, useState, useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaVentaRecord, CuentaPorCobrarRecord } from '../types/api'
import './ERPDashboardPage.css'

type ErpModuleDef = {
  id: string
  title: string
  description: string
  icon: string
  path: string
  accent: string
  keywords: string[]
}

const CONTABLE_MODULES: ErpModuleDef[] = [
  {
    id: 'tesoreria',
    title: 'Tesorería',
    description: 'Cobros, pagos, vencimientos y flujo de caja',
    icon: '🏦',
    path: '/erp/tesoreria',
    accent: '#0ea5e9',
    keywords: ['tesoreria', 'cobros', 'pagos', 'banco', 'caja', 'vencimientos']
  },
  {
    id: 'contabilidad',
    title: 'Contabilidad',
    description: 'Asientos, plan de cuentas y reportes contables',
    icon: '📚',
    path: '/erp/contabilidad',
    accent: '#8b5cf6',
    keywords: ['contabilidad', 'asientos', 'libro', 'mayor', 'diario']
  },
  {
    id: 'impuestos',
    title: 'Impuestos',
    description: 'AFIP, IVA y reportes impositivos',
    icon: '🏛️',
    path: '/erp/impuestos',
    accent: '#f59e0b',
    keywords: ['impuestos', 'iva', 'afip', 'arca', 'fiscal']
  },
  {
    id: 'facturas',
    title: 'Facturación',
    description: 'Crear y gestionar facturas de venta',
    icon: '🧾',
    path: '/erp/facturas',
    accent: '#059669',
    keywords: ['factura', 'facturacion', 'comprobante', 'cae', 'venta']
  },
  {
    id: 'asientos',
    title: 'Asientos contables',
    description: 'Gestión con partida doble',
    icon: '📝',
    path: '/erp/asientos',
    accent: '#6366f1',
    keywords: ['asiento', 'partida', 'doble', 'contable']
  },
  {
    id: 'plan-cuentas',
    title: 'Plan de cuentas',
    description: 'Estructura contable del negocio',
    icon: '📋',
    path: '/erp/plan-cuentas',
    accent: '#14b8a6',
    keywords: ['plan', 'cuentas', 'rubros', 'estructura']
  },
  {
    id: 'costos',
    title: 'Control de costos',
    description: 'Costos por orden de trabajo',
    icon: '📉',
    path: '/erp/costos',
    accent: '#ec4899',
    keywords: ['costos', 'op', 'orden', 'margen']
  },
  {
    id: 'compras',
    title: 'Compras / Proveedores',
    description: 'Pedidos, recepción y cuentas a pagar',
    icon: '🛒',
    path: '/erp/compras',
    accent: '#f97316',
    keywords: ['compras', 'proveedores', 'orden compra', 'cxp']
  },
  {
    id: 'gastos',
    title: 'Gastos',
    description: 'Gastos corrientes, tickets y estadísticas',
    icon: '💼',
    path: '/erp/gastos',
    accent: '#a855f7',
    keywords: ['gastos', 'ticket', 'rendicion', 'egreso']
  },
  {
    id: 'stock',
    title: 'Stock / Inventario',
    description: 'Existencias, movimientos y reportes',
    icon: '📦',
    path: '/erp/stock',
    accent: '#22c55e',
    keywords: ['stock', 'inventario', 'deposito', 'existencias']
  },
  {
    id: 'reportes',
    title: 'Reportes financieros',
    description: 'Resultados, balance y flujo de caja',
    icon: '📊',
    path: '/erp/reportes',
    accent: '#3b82f6',
    keywords: ['reportes', 'balance', 'resultados', 'kpi', 'informes']
  },
  {
    id: 'admin',
    title: 'Administración',
    description: 'Circuitos, roles y checklist',
    icon: '⚙️',
    path: '/erp/admin',
    accent: '#64748b',
    keywords: ['admin', 'configuracion', 'circuitos', 'roles']
  },
  {
    id: 'config-afip',
    title: 'Configuración AFIP',
    description: 'Facturación electrónica y homologación',
    icon: '🔐',
    path: '/erp/configuracion-afip',
    accent: '#10b981',
    keywords: ['afip', 'cae', 'certificado', 'punto venta', 'homologacion']
  }
]

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
    [module.title, module.description, module.icon, ...module.keywords].join(' ')
  )
  return query.split(/\s+/).every((token) => haystack.includes(token))
}

export default function ERPDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({
    facturasPendientes: 0,
    facturasEmitidas: 0,
    cuentasPorCobrar: 0,
    montoPorCobrar: 0,
    asientosPendientes: 0,
    facturasRecientes: [] as FacturaVentaRecord[],
    cuentasVencidas: [] as CuentaPorCobrarRecord[]
  })

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
              🔍
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
                ✕
              </button>
            )}
          </label>
        </div>

        {filteredModules.length === 0 ? (
          <div className="erp-modules-empty">
            <span className="erp-modules-empty__icon">🔎</span>
            <p>No hay módulos para «{search}»</p>
            <button type="button" className="erp-btn erp-btn--ghost" onClick={() => setSearch('')}>
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="erp-modules-grid">
            {filteredModules.map((module) => (
              <button
                key={module.id}
                type="button"
                className="erp-module-card"
                style={{ '--module-accent': module.accent } as CSSProperties}
                onClick={() => navigate(module.path)}
              >
                <span className="erp-module-card__glow" aria-hidden />
                <span className="erp-module-card__icon">{module.icon}</span>
                <span className="erp-module-card__title">{module.title}</span>
                <span className="erp-module-card__desc">{module.description}</span>
                <span className="erp-module-card__arrow" aria-hidden>
                  →
                </span>
              </button>
            ))}
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
        <section className="erp-recent-section">
          <h2>Facturas recientes</h2>
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
        </section>
      )}
    </div>
  )
}
