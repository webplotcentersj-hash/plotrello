import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  ADMIN_MODULE_CATALOG,
  CATEGORY_META,
  canUserAccessModule,
  moduleRoleLabels,
  type AdminModuleCategory,
  type AdminModuleDef
} from './adminModuleCatalog'
import './AdminModulePanel.css'

type ModuleActions = {
  onPlotAI?: () => void
  onBackup?: () => void
  onPdf?: () => void
  onRefresh?: () => void
  backupLoading?: boolean
  pdfLoading?: boolean
}

type KpiStrip = {
  fichasActivas: number
  urgentes: number
  atrasadas: number
  pedidosPendientes: number
}

type AdminModulePanelProps = ModuleActions & {
  kpis?: KpiStrip
  /** Navegar dentro de la app (sesión staff). Si es false, abre rutas en pestaña nueva. */
  navigateInApp?: boolean
}

const CATEGORY_ORDER: AdminModuleCategory[] = [
  'produccion',
  'ventas',
  'finanzas',
  'compras',
  'rrhh',
  'logistica',
  'sistemas'
]

export default function AdminModulePanel({
  kpis,
  onPlotAI,
  onBackup,
  onPdf,
  onRefresh,
  backupLoading,
  pdfLoading,
  navigateInApp = true
}: AdminModulePanelProps) {
  const { usuario, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<AdminModuleCategory | 'all'>('all')
  const [onlyAccessible, setOnlyAccessible] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ADMIN_MODULE_CATALOG.filter((m) => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false
      if (onlyAccessible && !canUserAccessModule(usuario?.rol, m)) return false
      if (!q) return true
      const haystack = [
        m.title,
        m.description,
        CATEGORY_META[m.category].label,
        ...moduleRoleLabels(m)
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [search, activeCategory, onlyAccessible, usuario?.rol])

  const grouped = useMemo(() => {
    const map = new Map<AdminModuleCategory, AdminModuleDef[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const m of filtered) {
      map.get(m.category)?.push(m)
    }
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      meta: CATEGORY_META[cat],
      modules: map.get(cat) ?? []
    })).filter((g) => g.modules.length > 0)
  }, [filtered])

  const accessibleCount = useMemo(
    () => ADMIN_MODULE_CATALOG.filter((m) => canUserAccessModule(usuario?.rol, m)).length,
    [usuario?.rol]
  )

  const openModule = (module: AdminModuleDef) => {
    if (!canUserAccessModule(usuario?.rol, module)) return

    if (module.action === 'plotai') {
      onPlotAI?.()
      return
    }
    if (module.action === 'backup') {
      void onBackup?.()
      return
    }
    if (module.action === 'pdf') {
      void onPdf?.()
      return
    }
    if (module.action === 'refresh') {
      onRefresh?.()
      return
    }
    if (navigateInApp && !module.openInNewTab) {
      navigate(module.path)
      return
    }
    window.open(module.path, '_blank', 'noopener,noreferrer')
  }

  const roleLabel = usuario?.rol ? usuario.rol.replace(/-/g, ' ') : 'sin rol'

  return (
    <section className="amp" aria-label="Panel de módulos Plot Lab">
      <div className="amp-hero">
        <div className="amp-hero-text">
          <div className="amp-eyebrow">Plot Lab · Control de acceso por rol</div>
          <h2 className="amp-title">Panel de módulos</h2>
          <p className="amp-desc">
            Accedé a cada área del sistema. Los badges indican qué roles pueden entrar; como{' '}
            {isAdmin ? 'administrador' : 'usuario'} tenés acceso a{' '}
            <strong>{accessibleCount}</strong> de {ADMIN_MODULE_CATALOG.length} módulos.
          </p>
        </div>
        {usuario && (
          <div className="amp-user-card">
            <div className="amp-user-avatar" aria-hidden>
              {usuario.nombre
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="amp-user-name">{usuario.nombre}</div>
              <div className="amp-user-role">{roleLabel}</div>
            </div>
          </div>
        )}
      </div>

      {kpis && (
        <div className="amp-kpis">
          <div className="amp-kpi">
            <span className="amp-kpi-value">{kpis.fichasActivas}</span>
            <span className="amp-kpi-label">Fichas activas</span>
          </div>
          <div className="amp-kpi amp-kpi-urgent">
            <span className="amp-kpi-value">{kpis.urgentes}</span>
            <span className="amp-kpi-label">Urgentes</span>
          </div>
          <div className="amp-kpi amp-kpi-warn">
            <span className="amp-kpi-value">{kpis.atrasadas}</span>
            <span className="amp-kpi-label">Atrasadas</span>
          </div>
          <div className="amp-kpi">
            <span className="amp-kpi-value">{kpis.pedidosPendientes}</span>
            <span className="amp-kpi-label">Pedidos pend.</span>
          </div>
        </div>
      )}

      <div className="amp-toolbar">
        <div className="amp-search-wrap">
          <span className="amp-search-icon" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            className="amp-search"
            placeholder="Buscar módulo, área o rol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar módulos"
          />
        </div>
        <label className="amp-toggle">
          <input
            type="checkbox"
            checked={onlyAccessible}
            onChange={(e) => setOnlyAccessible(e.target.checked)}
          />
          <span>Solo mis módulos</span>
        </label>
      </div>

      <div className="amp-categories" role="tablist" aria-label="Filtrar por área">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === 'all'}
          className={`amp-cat-pill ${activeCategory === 'all' ? 'amp-cat-pill-active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Todos
          <span className="amp-cat-count">{filtered.length}</span>
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = ADMIN_MODULE_CATALOG.filter((m) => {
            if (m.category !== cat) return false
            if (onlyAccessible && !canUserAccessModule(usuario?.rol, m)) return false
            return true
          }).length
          if (count === 0) return null
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`amp-cat-pill ${activeCategory === cat ? 'amp-cat-pill-active' : ''}`}
              style={
                activeCategory === cat
                  ? ({ '--cat-color': CATEGORY_META[cat].color } as CSSProperties)
                  : undefined
              }
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_META[cat].label}
              <span className="amp-cat-count">{count}</span>
            </button>
          )
        })}
      </div>

      {grouped.length === 0 ? (
        <div className="amp-empty">No hay módulos que coincidan con el filtro.</div>
      ) : (
        grouped.map(({ category, meta, modules }) => (
          <div key={category} className="amp-section">
            <div className="amp-section-head">
              <div
                className="amp-section-accent"
                style={{ background: meta.color }}
                aria-hidden
              />
              <div>
                <h3 className="amp-section-title">{meta.label}</h3>
                <p className="amp-section-sub">{meta.description}</p>
              </div>
            </div>
            <div className="amp-grid">
              {modules.map((module) => {
                const allowed = canUserAccessModule(usuario?.rol, module)
                const loading =
                  (module.action === 'backup' && backupLoading) ||
                  (module.action === 'pdf' && pdfLoading)
                const roles = moduleRoleLabels(module)

                return (
                  <article
                    key={module.id}
                    className={`amp-card ${allowed ? '' : 'amp-card-locked'}`}
                    style={{ '--module-accent': module.accent } as CSSProperties}
                  >
                    <div className="amp-card-top">
                      <div className="amp-card-icon" aria-hidden>
                        {module.icon}
                      </div>
                      {!allowed && <span className="amp-lock-badge">🔒 Restringido</span>}
                    </div>
                    <h4 className="amp-card-title">{module.title}</h4>
                    <p className="amp-card-desc">{module.description}</p>
                    <div className="amp-roles" aria-label="Roles con acceso">
                      {roles.slice(0, 4).map((r) => (
                        <span key={r} className="amp-role-chip">
                          {r}
                        </span>
                      ))}
                      {roles.length > 4 && (
                        <span className="amp-role-chip amp-role-more">+{roles.length - 4}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="amp-open-btn"
                      disabled={!allowed || loading}
                      onClick={() => openModule(module)}
                    >
                      {loading
                        ? 'Generando…'
                        : allowed
                          ? 'Abrir módulo →'
                          : 'Sin permiso'}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
