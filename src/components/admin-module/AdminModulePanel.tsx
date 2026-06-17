import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  ADMIN_MODULE_CATALOG,
  CATEGORY_META,
  canUserAccessModule,
  moduleRoleLabels,
  resolveModuleNavigatePath,
  type AdminModuleCategory,
  type AdminModuleDef
} from './adminModuleCatalog'
import AdminPanelUtilBar from './AdminPanelUtilBar'
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
  navigateInApp?: boolean
  onNavigateTablero?: () => void
  onNavigateToMensajeria?: () => void
  onNavigateToChat?: () => void
  onLogout?: () => void
  onRefreshData?: () => void
}

const PLOT_LAB_LOGO = 'https://trello.plotcenter.com.ar/Group%20187.png'

const CATEGORY_ORDER: AdminModuleCategory[] = [
  'produccion',
  'ventas',
  'finanzas',
  'compras',
  'rrhh',
  'logistica',
  'sistemas'
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export default function AdminModulePanel({
  kpis,
  onPlotAI,
  onBackup,
  onPdf,
  onRefresh,
  backupLoading,
  pdfLoading,
  navigateInApp = true,
  onNavigateTablero,
  onNavigateToMensajeria,
  onNavigateToChat,
  onLogout,
  onRefreshData
}: AdminModulePanelProps) {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<AdminModuleCategory | 'all'>('all')

  const tableroModule = useMemo(
    () => ADMIN_MODULE_CATALOG.find((m) => m.id === 'tablero') ?? null,
    []
  )

  const featuredModules = useMemo(
    () =>
      ADMIN_MODULE_CATALOG.filter(
        (m) => m.featured && m.id !== 'tablero' && canUserAccessModule(usuario?.rol, m)
      ),
    [usuario?.rol]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ADMIN_MODULE_CATALOG.filter((m) => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false
      if (!q) return true
      const haystack = [
        m.title,
        m.description,
        m.path,
        CATEGORY_META[m.category].label,
        ...moduleRoleLabels(m)
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [search, activeCategory])

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

  const goToModule = (module: AdminModuleDef) => {
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

    const external = module.openInNewTab || module.path.includes('.html')
    if (external) {
      const url = module.path.startsWith('http')
        ? module.path
        : `${window.location.origin}${module.path.startsWith('/') ? module.path : `/${module.path}`}`
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    const target = resolveModuleNavigatePath(module)
    if (module.id === 'tablero' && onNavigateTablero) {
      onNavigateTablero()
      return
    }
    if (navigateInApp) {
      navigate(target)
    } else {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
  }

  const roleLabel = usuario?.rol
    ? usuario.rol.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Sin rol'

  const firstName = usuario?.nombre?.split(' ')[0] ?? 'equipo'

  const initials = usuario?.nombre
    ? usuario.nombre
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??'

  const renderMachineButton = (module: AdminModuleDef) => {
    const allowed = canUserAccessModule(usuario?.rol, module)
    const loading =
      (module.action === 'backup' && backupLoading) ||
      (module.action === 'pdf' && pdfLoading)

    const onKeyDown = (e: KeyboardEvent) => {
      if (!allowed || loading) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goToModule(module)
      }
    }

    return (
      <button
        key={module.id}
        type="button"
        className={[
          'amp-machine-btn',
          !allowed && 'amp-machine-btn--locked',
          loading && 'amp-machine-btn--loading'
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--module-accent': module.accent } as CSSProperties}
        disabled={!allowed || loading}
        title={module.description}
        onClick={() => {
          if (allowed && !loading) goToModule(module)
        }}
        onKeyDown={onKeyDown}
      >
        <span className="amp-machine-btn__bezel" aria-hidden />
        <span className="amp-machine-btn__indicator" aria-hidden />
        <span className="amp-machine-btn__icon" aria-hidden>
          {module.icon}
        </span>
        <span className="amp-machine-btn__label">{module.title}</span>
      </button>
    )
  }

  const renderModuleCard = (
    module: AdminModuleDef,
    opts: { compact?: boolean; wide?: boolean } = {}
  ) => {
    const { compact = false, wide = false } = opts
    const allowed = canUserAccessModule(usuario?.rol, module)
    const loading =
      (module.action === 'backup' && backupLoading) ||
      (module.action === 'pdf' && pdfLoading)
    const roles = moduleRoleLabels(module)

    const onKeyDown = (e: KeyboardEvent) => {
      if (!allowed || loading) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goToModule(module)
      }
    }

    return (
      <article
        key={module.id}
        className={[
          'amp-card',
          compact && 'amp-card--compact',
          wide && 'amp-card--wide',
          !allowed && 'amp-card--locked'
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--module-accent': module.accent } as CSSProperties}
        role="button"
        tabIndex={allowed && !loading ? 0 : -1}
        aria-disabled={!allowed || loading}
        onClick={() => {
          if (allowed && !loading) goToModule(module)
        }}
        onKeyDown={onKeyDown}
      >
        <div className="amp-card-shine" aria-hidden />
        <div className="amp-card-inner">
          <div className="amp-card-top">
            <div className="amp-card-icon" aria-hidden>
              {module.icon}
            </div>
            {!allowed && <span className="amp-lock-badge">Bloqueado</span>}
          </div>
          <h4 className="amp-card-title">{module.title}</h4>
          <p className="amp-card-desc">{module.description}</p>
          <div className="amp-roles" aria-label="Roles con acceso">
            {roles.map((r) => (
              <span key={r} className="amp-role-chip">
                {r}
              </span>
            ))}
          </div>
          <div className="amp-card-footer">
            <span className="amp-card-cta">
              {loading ? 'Procesando…' : allowed ? 'Abrir' : 'Sin acceso'}
            </span>
            {allowed && !loading && <span className="amp-card-arrow" aria-hidden>↗</span>}
          </div>
        </div>
      </article>
    )
  }

  const renderKanbanHero = () => {
    if (!tableroModule) return null
    const allowed = canUserAccessModule(usuario?.rol, tableroModule)

    return (
      <article
        className={`amp-kanban-hero${allowed ? '' : ' amp-kanban-hero--locked'}`}
        role="button"
        tabIndex={allowed ? 0 : -1}
        onClick={() => allowed && goToModule(tableroModule)}
        onKeyDown={(e) => {
          if (!allowed) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            goToModule(tableroModule)
          }
        }}
      >
        <div className="amp-kanban-hero-bg" aria-hidden />
        <div className="amp-kanban-hero-content">
          <div className="amp-kanban-hero-copy">
            <span className="amp-kanban-badge">Producción · Principal</span>
            <h2 className="amp-kanban-title">Tablero Kanban</h2>
            <p className="amp-kanban-desc">
              Arrastrá fichas entre columnas, filtrá por sector y seguí cada OP en tiempo real.
            </p>
            {kpis && (
              <div className="amp-kanban-stats">
                <span>
                  <strong>{kpis.fichasActivas}</strong> activas
                </span>
                <span>
                  <strong>{kpis.urgentes}</strong> urgentes
                </span>
                <span>
                  <strong>{kpis.atrasadas}</strong> atrasadas
                </span>
              </div>
            )}
            <span className="amp-kanban-cta">
              Entrar al tablero <span aria-hidden>→</span>
            </span>
          </div>
          <div className="amp-kanban-preview" aria-hidden>
            <div className="amp-kanban-col">
              <span className="amp-kanban-col-head" />
              <span className="amp-kanban-card" />
              <span className="amp-kanban-card amp-kanban-card--accent" />
            </div>
            <div className="amp-kanban-col">
              <span className="amp-kanban-col-head" />
              <span className="amp-kanban-card" />
              <span className="amp-kanban-card" />
              <span className="amp-kanban-card amp-kanban-card--short" />
            </div>
            <div className="amp-kanban-col">
              <span className="amp-kanban-col-head" />
              <span className="amp-kanban-card amp-kanban-card--short" />
            </div>
            <div className="amp-kanban-col amp-kanban-col--dim">
              <span className="amp-kanban-col-head" />
              <span className="amp-kanban-card" />
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="amp-shell" aria-label="Panel de módulos Plot Lab">
      <div className="amp-bg" aria-hidden>
        <div className="amp-bg-grid" />
        <div className="amp-bg-orb amp-bg-orb--1" />
        <div className="amp-bg-orb amp-bg-orb--2" />
        <div className="amp-bg-orb amp-bg-orb--3" />
      </div>

      <header className="amp-hero-header">
        <div className="amp-hero-header__shine" aria-hidden />
        <div className="amp-hero-header__inner">
          <div className="amp-hero-header__row">
            <div className="amp-hero-brand">
              <div className="amp-hero-logo-frame">
                <img src={PLOT_LAB_LOGO} alt="Plot Lab" className="amp-hero-logo" />
              </div>
              <div className="amp-hero-brand-text">
                <span className="amp-hero-brand-name">Plot Lab</span>
                <span className="amp-hero-brand-tag">Sesión de administración</span>
              </div>
            </div>

            <div className="amp-hero-header__end">
              <AdminPanelUtilBar
                onNavigateToMensajeria={onNavigateToMensajeria}
                onNavigateToChat={onNavigateToChat}
              />

              <div className="amp-hero-actions">
                <button type="button" className="amp-hero-btn" onClick={onRefreshData}>
                  Actualizar
                </button>
                <button type="button" className="amp-hero-btn amp-hero-btn--out" onClick={onLogout}>
                  Salir
                </button>
              </div>

              {usuario && (
                <div className="amp-hero-user">
                  <div className="amp-hero-user-avatar">{initials}</div>
                  <div className="amp-hero-user-meta">
                    <span className="amp-hero-user-name">{usuario.nombre}</span>
                    <span className="amp-hero-user-role">{roleLabel}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="amp-hero">
            <div className="amp-hero-copy">
              <span className="amp-hero-eyebrow">Plot Lab · control de acceso por rol</span>
              <h1 className="amp-hero-title">
                {greeting()}, <em>{firstName}</em>
              </h1>
              <p className="amp-hero-desc">
                Elegí un módulo para entrar. Como administrador tenés acceso a{' '}
                <strong>{accessibleCount}</strong> de {ADMIN_MODULE_CATALOG.length} áreas.
              </p>
              <div className="amp-hero-badges">
                <span className="amp-hero-badge amp-hero-badge--live">
                  <span className="amp-hero-pulse" aria-hidden />
                  Sistema activo
                </span>
                <span className="amp-hero-badge">{accessibleCount} módulos disponibles</span>
              </div>
            </div>

            {kpis && (
              <div className="amp-hero-stats">
                <div className="amp-hero-stat">
                  <span className="amp-hero-stat-val">{kpis.fichasActivas}</span>
                  <span className="amp-hero-stat-lbl">Fichas activas</span>
                </div>
                <div className="amp-hero-stat amp-hero-stat--hot">
                  <span className="amp-hero-stat-val">{kpis.urgentes}</span>
                  <span className="amp-hero-stat-lbl">Urgentes</span>
                </div>
                <div className="amp-hero-stat amp-hero-stat--warn">
                  <span className="amp-hero-stat-val">{kpis.atrasadas}</span>
                  <span className="amp-hero-stat-lbl">Atrasadas</span>
                </div>
                <div className="amp-hero-stat">
                  <span className="amp-hero-stat-val">{kpis.pedidosPendientes}</span>
                  <span className="amp-hero-stat-lbl">Pedidos pend.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="amp-main">
          {!search && activeCategory === 'all' && (
            <section className="amp-bento">
              {renderKanbanHero()}
              <div className="amp-machine-panel">
                <div className="amp-machine-panel__chassis">
                  <div className="amp-machine-panel__head">
                    <span className="amp-machine-panel__led" aria-hidden />
                    <span className="amp-machine-panel__title">Accesos rápidos</span>
                    <span className="amp-machine-panel__screw amp-machine-panel__screw--r" aria-hidden />
                  </div>
                  <div className="amp-machine-grid">
                    {featuredModules.map((m) => renderMachineButton(m))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <div className="amp-toolbar">
            <div className="amp-search-wrap">
              <svg className="amp-search-svg" viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M20 20l-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                className="amp-search"
                placeholder="Buscar módulo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar módulos"
              />
              {search && (
                <button
                  type="button"
                  className="amp-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="amp-machine-panel amp-machine-panel--filters">
            <div className="amp-machine-panel__chassis">
              <div className="amp-machine-panel__head">
                <span className="amp-machine-panel__led" aria-hidden />
                <span className="amp-machine-panel__title">Filtrar por área</span>
                <span className="amp-machine-panel__screw amp-machine-panel__screw--r" aria-hidden />
              </div>
              <div className="amp-machine-grid amp-machine-grid--categories" role="tablist" aria-label="Filtrar por área">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'all'}
                  className={`amp-machine-btn amp-machine-btn--filter${activeCategory === 'all' ? ' amp-machine-btn--active' : ''}`}
                  style={{ '--module-accent': '#eb671b' } as CSSProperties}
                  onClick={() => setActiveCategory('all')}
                >
                  <span className="amp-machine-btn__bezel" aria-hidden />
                  <span className="amp-machine-btn__indicator" aria-hidden />
                  <span className="amp-machine-btn__icon" aria-hidden>
                    ◎
                  </span>
                  <span className="amp-machine-btn__label">Todos</span>
                </button>
                {CATEGORY_ORDER.map((cat) => {
                  const count = ADMIN_MODULE_CATALOG.filter((m) => m.category === cat).length
                  if (count === 0) return null
                  const meta = CATEGORY_META[cat]
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === cat}
                      className={`amp-machine-btn amp-machine-btn--filter${activeCategory === cat ? ' amp-machine-btn--active' : ''}`}
                      style={{ '--module-accent': meta.color } as CSSProperties}
                      onClick={() => setActiveCategory(cat)}
                    >
                      <span className="amp-machine-btn__bezel" aria-hidden />
                      <span className="amp-machine-btn__indicator" aria-hidden />
                      <span className="amp-machine-btn__icon amp-machine-btn__dot" aria-hidden>
                        ●
                      </span>
                      <span className="amp-machine-btn__label">{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="amp-body">
            {grouped.length === 0 ? (
              <div className="amp-empty">
                <div className="amp-empty-icon">🔎</div>
                <p>Sin resultados para “{search}”</p>
                <button type="button" className="amp-empty-btn" onClick={() => setSearch('')}>
                  Ver todos los módulos
                </button>
              </div>
            ) : (
              grouped.map(({ category, meta, modules }) => (
                <section key={category} className="amp-section">
                  <header className="amp-section-head">
                    <div
                      className="amp-section-icon"
                      style={{
                        background: `${meta.color}18`,
                        borderColor: `${meta.color}44`,
                        color: meta.color
                      }}
                    >
                      ●
                    </div>
                    <div>
                      <h3 className="amp-section-title">{meta.label}</h3>
                      <p className="amp-section-sub">{meta.description}</p>
                    </div>
                    <span className="amp-section-count">{modules.length}</span>
                  </header>
                  <div className="amp-grid">{modules.map((m) => renderModuleCard(m))}</div>
                </section>
              ))
            )}
          </div>
        </main>
    </div>
  )
}
