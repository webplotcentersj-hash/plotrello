import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Cog,
  GitBranch,
  Layers,
  HardHat,
  Inbox,
  LayoutDashboard,
  Palette,
  RefreshCw,
  Send,
  Users,
  Wallet,
  Wrench
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import type {
  WorkPoolAdminDashboard,
  WorkPoolFreelancerResumen,
  WorkPoolJob,
  WorkPoolProduct,
  WorkPoolSector
} from '../../types/workPool'
import {
  WORK_POOL_ESTADO_LABELS,
  WORK_POOL_SECTOR_LABELS
} from '../../types/workPool'
import {
  defaultSectorForProduct,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import {
  aprobarWorkPoolJob,
  loadWorkPoolAdminDashboard,
  registrarPagoOperario,
  solicitarCambiosWorkPoolJob
} from './workPoolRepository'
import WorkPoolPublicarForm from './WorkPoolPublicarForm'
import WorkPoolSolicitudesPanel from './WorkPoolSolicitudesPanel'
import WorkPoolAvancesPanel from './WorkPoolAvancesPanel'
import WorkPoolContabilidadPanel from './WorkPoolContabilidadPanel'
import WorkPoolFuentesEntrada from './WorkPoolFuentesEntrada'
import './WorkPoolModule.css'
import './WorkPoolAdminPanel.css'

type Props = { product: WorkPoolProduct }

type AdminTab =
  | 'dashboard'
  | 'freelancers'
  | 'aprobados'
  | 'avances'
  | 'contabilidad'
  | 'publicar'
  | 'pipeline'

const ADMIN_TABS: AdminTab[] = [
  'dashboard',
  'freelancers',
  'aprobados',
  'avances',
  'contabilidad',
  'publicar',
  'pipeline'
]

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function sectorIcon(sector: WorkPoolSector) {
  if (sector === 'diseno') return Palette
  if (sector === 'instalaciones') return Wrench
  return Cog
}

function productHeroIcon(product: WorkPoolProduct): LucideIcon {
  return product === 'plot-design' ? Palette : HardHat
}

export default function WorkPoolAdminPanel({ product }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { usuario, canAccessPlotDesign, canAccessBolsaPlot } = useAuth()
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const SECTORS = sectorsForProduct(product)
  const initialTab = (searchParams.get('tab') as AdminTab | null) || 'dashboard'
  const [tab, setTab] = useState<AdminTab>(
    ADMIN_TABS.includes(initialTab) ? initialTab : 'dashboard'
  )
  const [sectorFilter, setSectorFilter] = useState<WorkPoolSector | 'todos'>('todos')
  const [dashboard, setDashboard] = useState<WorkPoolAdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingSolicitudes, setPendingSolicitudes] = useState(0)

  const [payUserId, setPayUserId] = useState<number | null>(null)
  const [payMonto, setPayMonto] = useState('')
  const [payNotas, setPayNotas] = useState('')
  const [paying, setPaying] = useState(false)

  const selectTab = useCallback(
    (next: AdminTab) => {
      setTab(next)
      const nextParams = new URLSearchParams(searchParams)
      if (next === 'dashboard') nextParams.delete('tab')
      else nextParams.set('tab', next)
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError('')
    }
    const res = await loadWorkPoolAdminDashboard(product)
    if (!res.success || !res.data) {
      if (!opts?.silent) {
        setError(res.error || 'No se pudo cargar el panel')
        setDashboard(null)
      }
    } else {
      setDashboard(res.data)
    }
    if (!opts?.silent) setLoading(false)
  }, [product])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = searchParams.get('tab') as AdminTab | null
    if (t && ADMIN_TABS.includes(t) && t !== tab) {
      setTab(t)
    }
  }, [searchParams, tab])

  const filteredFreelancers = useMemo(() => {
    if (!dashboard) return []
    const afines = dashboard.freelancers.filter((f) => f.sectores.some((s) => SECTORS.includes(s)))
    if (sectorFilter === 'todos') return afines
    return afines.filter((f) => f.sectores.includes(sectorFilter))
  }, [dashboard, sectorFilter, SECTORS])

  const aprobadosFreelancers = useMemo(
    () => filteredFreelancers.filter((f) => f.perfil_aprobado),
    [filteredFreelancers]
  )

  const filteredPendientes = useMemo(() => {
    if (!dashboard) return []
    if (sectorFilter === 'todos') return dashboard.pendientes_revision
    return dashboard.pendientes_revision.filter((j) => j.sector === sectorFilter)
  }, [dashboard, sectorFilter])

  const runAction = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError('')
    const res = await fn()
    if (!res.success) setError(res.error || 'Error en la acción')
    else void load()
  }

  const handlePago = async () => {
    if (!usuario || !payUserId) return
    const monto = Number(payMonto)
    if (!monto || monto <= 0) {
      setError('Monto de pago inválido')
      return
    }
    setPaying(true)
    await runAction(() =>
      registrarPagoOperario({
        id_usuario: payUserId,
        monto,
        notas: payNotas.trim() || undefined,
        registrado_por: usuario.id
      })
    )
    setPaying(false)
    setPayUserId(null)
    setPayMonto('')
    setPayNotas('')
  }

  const kpis = dashboard?.kpis
  const isPlotDesign = product === 'plot-design'

  const tabItems: { id: AdminTab; label: string; Icon: LucideIcon }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    {
      id: 'freelancers',
      label: isPlotDesign ? 'Afines · Postulantes' : 'Afines',
      Icon: Users
    },
    { id: 'aprobados', label: 'Aprobados', Icon: CheckCircle2 },
    { id: 'avances', label: 'Avances', Icon: Activity },
    { id: 'contabilidad', label: 'Contabilidad', Icon: Wallet },
    { id: 'publicar', label: 'Publicar', Icon: Send },
    { id: 'pipeline', label: 'Pipeline', Icon: GitBranch }
  ]

  const HeroIcon = productHeroIcon(product)

  const flowCounts = useMemo(() => {
    if (!kpis) return null
    const enCurso = Math.max(
      0,
      kpis.trabajos_abiertos - kpis.disponibles_bolsa - kpis.pendientes_revision
    )
    return {
      disponible: kpis.disponibles_bolsa,
      enCurso,
      revision: kpis.pendientes_revision,
      aprobadoMes: kpis.aprobados_mes
    }
  }, [kpis])

  return (
    <div className={`work-pool-admin ${cfg.themeClass}`}>
      <div className="work-pool-admin__ambient" aria-hidden>
        <span className="work-pool-admin__orb work-pool-admin__orb--1" />
        <span className="work-pool-admin__orb work-pool-admin__orb--2" />
        <span className="work-pool-admin__orb work-pool-admin__orb--3" />
        <span className="work-pool-admin__grid" />
      </div>

      <header className="work-pool-admin__hero">
        <div className="work-pool-admin__hero-glow" aria-hidden />
        <div className="work-pool-admin__hero-inner">
          <div className="work-pool-admin__hero-copy">
            <span className="work-pool-admin__eyebrow">
              {isPlotDesign ? 'phi · administración' : `Administración · ${cfg.label}`}
            </span>
            <h1>
              <span className="work-pool-admin__hero-brand" aria-hidden>
                {isPlotDesign ? <span className="work-pool-admin__phi">φ</span> : <HeroIcon size={26} strokeWidth={1.75} />}
              </span>
              <span className="work-pool-admin__hero-title">
                {isPlotDesign ? (
                  <>
                    <span className="work-pool-admin__hero-title-main">Plot Design</span>
                    <span className="work-pool-admin__hero-title-sub">bolsa creativa</span>
                  </>
                ) : (
                  cfg.label
                )}
              </span>
            </h1>
            <p>{cfg.adminTagline}</p>
            {kpis && !loading ? (
              <div className="work-pool-admin__hero-stats" aria-label="Resumen rápido">
                <div className="work-pool-admin__hero-stat">
                  <span className="work-pool-admin__hero-stat-icon" aria-hidden>
                    <Briefcase size={16} strokeWidth={2} />
                  </span>
                  <span className="work-pool-admin__hero-stat-text">
                    <strong>{kpis.trabajos_abiertos}</strong>
                    <span>Abiertos</span>
                  </span>
                </div>
                <div className="work-pool-admin__hero-stat">
                  <span className="work-pool-admin__hero-stat-icon" aria-hidden>
                    <Layers size={16} strokeWidth={2} />
                  </span>
                  <span className="work-pool-admin__hero-stat-text">
                    <strong>{kpis.disponibles_bolsa}</strong>
                    <span>En bolsa</span>
                  </span>
                </div>
                <div className="work-pool-admin__hero-stat">
                  <span className="work-pool-admin__hero-stat-icon" aria-hidden>
                    <ClipboardCheck size={16} strokeWidth={2} />
                  </span>
                  <span className="work-pool-admin__hero-stat-text">
                    <strong>{kpis.pendientes_revision}</strong>
                    <span>En revisión</span>
                  </span>
                </div>
                {isPlotDesign ? (
                  <div className="work-pool-admin__hero-stat">
                    <span className="work-pool-admin__hero-stat-icon" aria-hidden>
                      <Inbox size={16} strokeWidth={2} />
                    </span>
                    <span className="work-pool-admin__hero-stat-text">
                      <strong>{kpis.trabajos_entrantes ?? 0}</strong>
                      <span>Entrantes</span>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <span className="work-pool-admin__live">
              <i aria-hidden />
              Bolsa en vivo
            </span>
          </div>
          <div className="work-pool-admin__hero-actions">
            {canAccessPlotDesign && canAccessBolsaPlot && (
              <div className="work-pool-admin__product-switch">
                {product === 'bolsa-plot' ? (
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__product-btn" onClick={() => navigate('/plot-design')}>
                    <span className="work-pool-admin__phi-inline" aria-hidden>
                      φ
                    </span>
                    Plot Design
                  </button>
                ) : (
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__product-btn" onClick={() => navigate('/bolsa-plot')}>
                    <HardHat size={16} aria-hidden />
                    Bolsa Plot
                  </button>
                )}
              </div>
            )}
            <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
              ← PlotLab
            </button>
            <button type="button" className="work-pool-admin__refresh" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'work-pool-admin__refresh-spin' : undefined} aria-hidden />
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
      </header>

      <div className="work-pool-admin__toolbar">
        <div className="work-pool-admin__tabs" role="tablist">
          {tabItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`work-pool-admin__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => selectTab(id)}
            >
              <span className="work-pool-admin__tab-icon" aria-hidden>
                <Icon size={16} strokeWidth={2} />
              </span>
              {label}
              {id === 'freelancers' && pendingSolicitudes > 0 ? (
                <span className="work-pool-admin__tab-badge" aria-label={`${pendingSolicitudes} postulaciones`}>
                  {pendingSolicitudes > 99 ? '99+' : pendingSolicitudes}
                </span>
              ) : null}
              {id === 'aprobados' && aprobadosFreelancers.length > 0 ? (
                <span className="work-pool-admin__tab-badge work-pool-admin__tab-badge--ok" aria-label={`${aprobadosFreelancers.length} aprobados`}>
                  {aprobadosFreelancers.length > 99 ? '99+' : aprobadosFreelancers.length}
                </span>
              ) : null}
              {id === 'avances' && (dashboard?.avances_por_operario?.length ?? 0) > 0 ? (
                <span className="work-pool-admin__tab-badge" aria-label="Avances activos">
                  {(dashboard?.avances_por_operario?.length ?? 0) > 99
                    ? '99+'
                    : dashboard?.avances_por_operario?.length}
                </span>
              ) : null}
              {id === 'contabilidad' &&
              filteredFreelancers.some((f) => f.saldo_pendiente > 0) ? (
                <span className="work-pool-admin__tab-badge" aria-label="Deuda pendiente">
                  $
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {SECTORS.length > 1 && (
          <div className="work-pool-admin__sector-filter">
            <span>Filtro sector</span>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value as WorkPoolSector | 'todos')}>
              <option value="todos">Todos</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {WORK_POOL_SECTOR_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div>}

      {loading && !dashboard ? (
        <div className="work-pool-admin__skeleton" aria-busy="true" aria-label="Cargando panel">
          <div className="work-pool-admin__skeleton-kpis">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="work-pool-admin__skeleton-card" />
            ))}
          </div>
          <div className="work-pool-admin__skeleton-wide" />
        </div>
      ) : dashboard && tab === 'dashboard' ? (
        <div className="work-pool-admin__content work-pool-admin__content--dashboard">
          <section className="work-pool-admin__kpi-grid" aria-label="Indicadores">
            <article className="work-pool-admin__kpi work-pool-admin__kpi--deuda">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <Wallet size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>{isPlotDesign ? 'Deuda diseño' : 'Deuda total Plot'}</small>
                <strong>{formatArs(kpis?.deuda_total ?? 0)}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <Briefcase size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>Trabajos abiertos</small>
                <strong>{kpis?.trabajos_abiertos ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi work-pool-admin__kpi--warn">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <ClipboardCheck size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>Pendientes de revisión</small>
                <strong>{kpis?.pendientes_revision ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <Layers size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>En bolsa disponible</small>
                <strong>{kpis?.disponibles_bolsa ?? 0}</strong>
              </div>
            </article>
            {isPlotDesign ? (
              <article
                className="work-pool-admin__kpi work-pool-admin__kpi--entrantes"
                role="button"
                tabIndex={0}
                onClick={() => selectTab('publicar')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectTab('publicar')
                  }
                }}
              >
                <span className="work-pool-admin__kpi-icon" aria-hidden>
                  <Inbox size={22} strokeWidth={1.75} />
                </span>
                <div>
                  <small>Trabajos entrantes</small>
                  <strong>{kpis?.trabajos_entrantes ?? 0}</strong>
                </div>
              </article>
            ) : null}
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <Users size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>{isPlotDesign ? 'Diseñadores activos' : 'Operarios activos'}</small>
                <strong>{kpis?.operarios_activos ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi work-pool-admin__kpi--ok">
              <span className="work-pool-admin__kpi-icon" aria-hidden>
                <CheckCircle2 size={22} strokeWidth={1.75} />
              </span>
              <div>
                <small>Aprobados este mes</small>
                <strong>{kpis?.aprobados_mes ?? 0}</strong>
              </div>
            </article>
          </section>

          {isPlotDesign && flowCounts ? (
            <section className="work-pool-admin__flow" aria-label="Flujo creativo">
              <div className="work-pool-admin__section-head">
                <h2>Flujo creativo</h2>
                <span className="work-pool-admin__pill">Diseño</span>
              </div>
              <div className="work-pool-admin__flow-track">
                <button type="button" className="work-pool-admin__flow-step" onClick={() => selectTab('pipeline')}>
                  <span>Disponible</span>
                  <strong>{flowCounts.disponible}</strong>
                </button>
                <span className="work-pool-admin__flow-arrow" aria-hidden>
                  →
                </span>
                <button type="button" className="work-pool-admin__flow-step" onClick={() => selectTab('pipeline')}>
                  <span>En curso</span>
                  <strong>{flowCounts.enCurso}</strong>
                </button>
                <span className="work-pool-admin__flow-arrow" aria-hidden>
                  →
                </span>
                <button
                  type="button"
                  className={`work-pool-admin__flow-step${flowCounts.revision > 0 ? ' is-alert' : ''}`}
                  onClick={() => selectTab('pipeline')}
                >
                  <span>En revisión</span>
                  <strong>{flowCounts.revision}</strong>
                </button>
                <span className="work-pool-admin__flow-arrow" aria-hidden>
                  →
                </span>
                <div className="work-pool-admin__flow-step work-pool-admin__flow-step--ok">
                  <span>Aprobados mes</span>
                  <strong>{flowCounts.aprobadoMes}</strong>
                </div>
              </div>
            </section>
          ) : (
            <section className="work-pool-admin__sector-board">
              <h2>Por sector</h2>
              <div className="work-pool-admin__sector-cards">
                {(dashboard.resumen_sectores.length > 0
                  ? dashboard.resumen_sectores
                  : SECTORS.map((s) => ({
                      sector: s,
                      trabajos_abiertos: 0,
                      trabajos_aprobados: 0,
                      deuda_operarios: 0
                    }))
                ).map((r) => {
                  const sector = r.sector as WorkPoolSector
                  const SectorIcon = sectorIcon(sector)
                  const max = Math.max(Number(r.trabajos_abiertos), Number(r.trabajos_aprobados), 1)
                  return (
                    <article key={r.sector} className="work-pool-admin__sector-card">
                      <div className="work-pool-admin__sector-card-head">
                        <span className="work-pool-admin__sector-card-icon" aria-hidden>
                          <SectorIcon size={20} strokeWidth={1.75} />
                        </span>
                        <h3>{WORK_POOL_SECTOR_LABELS[sector] ?? r.sector}</h3>
                      </div>
                      <div className="work-pool-admin__sector-metrics">
                        <div>
                          <span>Abiertos</span>
                          <strong>{r.trabajos_abiertos}</strong>
                          <div className="work-pool-admin__bar">
                            <i style={{ width: `${(Number(r.trabajos_abiertos) / max) * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <span>Aprobados</span>
                          <strong>{r.trabajos_aprobados}</strong>
                          <div className="work-pool-admin__bar work-pool-admin__bar--ok">
                            <i style={{ width: `${(Number(r.trabajos_aprobados) / max) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <p className="work-pool-admin__sector-deuda">
                        Deuda sector: <strong>{formatArs(Number(r.deuda_operarios))}</strong>
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {isPlotDesign && usuario ? (
            <section className="work-pool-admin__section work-pool-admin__section--entrantes">
              <div className="work-pool-admin__section-head">
                <h2>Trabajos entrantes</h2>
                <span className="work-pool-admin__pill">{kpis?.trabajos_entrantes ?? 0}</span>
                <button
                  type="button"
                  className="work-pool-module__btn work-pool-module__btn--ghost"
                  onClick={() => selectTab('publicar')}
                >
                  Ir a Publicar →
                </button>
              </div>
              <p className="work-pool-admin__section-lead">
                OPs del tablero, briefs y pedidos del portal listos para publicar en bolsa o asignar.
              </p>
              <WorkPoolFuentesEntrada
                product={product}
                sector={defaultSectorForProduct(product)}
                idUsuarioCreador={usuario.id}
                onSeleccionarOp={() => selectTab('publicar')}
                onAplicarBrief={() => selectTab('publicar')}
                onAplicarPedido={() => selectTab('publicar')}
              />
            </section>
          ) : null}

          <section className="work-pool-admin__section">
            <div className="work-pool-admin__section-head">
              <h2>Entregas pendientes de aprobación</h2>
              <span className="work-pool-admin__pill">{filteredPendientes.length}</span>
            </div>
            {filteredPendientes.length === 0 ? (
              <p className="work-pool-module__empty">No hay entregas esperando revisión.</p>
            ) : (
              <div className="work-pool-admin__review-list">
                {filteredPendientes.map((job) => (
                  <ReviewJobCard
                    key={job.id}
                    job={job}
                    usuarioId={usuario?.id}
                    onAction={runAction}
                    onNavigateOp={(op) => navigate(`/op/${op}`)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="work-pool-admin__section">
            <div className="work-pool-admin__section-head">
              <h2>{isPlotDesign ? 'Diseñadores con saldo' : 'Top freelancers por saldo'}</h2>
            </div>
            <div className="work-pool-admin__freelancer-grid">
              {filteredFreelancers.slice(0, 6).map((f) => (
                <FreelancerCard key={f.id_usuario} f={f} onPay={() => { setPayUserId(f.id_usuario); selectTab('freelancers') }} />
              ))}
              {filteredFreelancers.length === 0 && (
                <p className="work-pool-module__empty">
                  {isPlotDesign
                    ? 'Todavía no hay diseñadores con actividad en la bolsa.'
                    : 'Todavía no hay operarios con actividad en la bolsa.'}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {dashboard && tab === 'freelancers' && (
        <div className="work-pool-admin__content">
        <WorkPoolSolicitudesPanel product={product} onPendingCount={setPendingSolicitudes} />
        <section className="work-pool-admin__section">
          <div className="work-pool-admin__section-head">
            <h2>{isPlotDesign ? 'Diseñadores afines' : 'Operarios afines'}</h2>
            <span className="work-pool-admin__pill">{filteredFreelancers.length}</span>
          </div>
          <div className="work-pool-admin__freelancer-grid work-pool-admin__freelancer-grid--full">
            {filteredFreelancers.map((f) => (
              <FreelancerCard
                key={f.id_usuario}
                f={f}
                detailed
                onPay={() => setPayUserId(f.id_usuario)}
              />
            ))}
          </div>
          {payUserId != null && tab === 'freelancers' && (
            <div className="work-pool-admin__pay-box">
              <h3>Registrar pago</h3>
              <p>
                Operario:{' '}
                <strong>
                  {filteredFreelancers.find((f) => f.id_usuario === payUserId)?.nombre ?? `#${payUserId}`}
                </strong>
              </p>
              <div className="work-pool-module__form-row">
                <label>
                  Monto ARS
                  <input type="number" min="0" value={payMonto} onChange={(e) => setPayMonto(e.target.value)} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Notas
                  <input value={payNotas} onChange={(e) => setPayNotas(e.target.value)} placeholder="Transferencia, fecha…" />
                </label>
              </div>
              <div className="work-pool-admin__pay-actions">
                <button type="button" className="work-pool-module__btn work-pool-module__btn--primary" disabled={paying} onClick={() => void handlePago()}>
                  {paying ? 'Registrando…' : 'Confirmar pago'}
                </button>
                <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={() => setPayUserId(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
        </div>
      )}

      {dashboard && tab === 'aprobados' && (
        <div className="work-pool-admin__content">
          <section className="work-pool-admin__section">
            <div className="work-pool-admin__section-head">
              <h2>{isPlotDesign ? 'Diseñadores aprobados' : 'Operarios aprobados'}</h2>
              <span className="work-pool-admin__pill">{aprobadosFreelancers.length}</span>
            </div>
            <p className="work-pool-admin__form-links">
              {isPlotDesign
                ? 'Perfiles con acceso a la bolsa creativa (postulación aprobada o perfil activo).'
                : 'Operarios externos con perfil aprobado en la bolsa.'}
            </p>
            {aprobadosFreelancers.length === 0 ? (
              <p className="work-pool-module__empty">
                {isPlotDesign
                  ? 'Todavía no hay diseñadores aprobados. Revisá Afines · Postulantes.'
                  : 'Todavía no hay operarios aprobados.'}
              </p>
            ) : (
              <div className="work-pool-admin__freelancer-grid work-pool-admin__freelancer-grid--full">
                {aprobadosFreelancers.map((f) => (
                  <FreelancerCard
                    key={f.id_usuario}
                    f={f}
                    detailed
                    onPay={() => setPayUserId(f.id_usuario)}
                  />
                ))}
              </div>
            )}
            {payUserId != null && (
              <div className="work-pool-admin__pay-box">
                <h3>Registrar pago</h3>
                <p>
                  Operario:{' '}
                  <strong>
                    {aprobadosFreelancers.find((f) => f.id_usuario === payUserId)?.nombre ?? `#${payUserId}`}
                  </strong>
                </p>
                <div className="work-pool-module__form-row">
                  <label>
                    Monto ARS
                    <input type="number" min="0" value={payMonto} onChange={(e) => setPayMonto(e.target.value)} />
                  </label>
                  <label style={{ gridColumn: '1 / -1' }}>
                    Notas
                    <input value={payNotas} onChange={(e) => setPayNotas(e.target.value)} placeholder="Transferencia, fecha…" />
                  </label>
                </div>
                <div className="work-pool-admin__pay-actions">
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--primary" disabled={paying} onClick={() => void handlePago()}>
                    {paying ? 'Registrando…' : 'Confirmar pago'}
                  </button>
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={() => setPayUserId(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {dashboard && tab === 'avances' && (
        <div className="work-pool-admin__content">
          <WorkPoolAvancesPanel
            product={product}
            avances={dashboard.avances_por_operario ?? []}
            canReview={!!usuario}
            onRefreshLive={() => void load({ silent: true })}
            onNavigateOp={(op) => navigate(`/op/${op}`)}
            onAprobar={(job) => {
              if (!usuario) return
              void runAction(() => aprobarWorkPoolJob(job.id, usuario.id))
            }}
            onPedirCambios={(job) => {
              if (!usuario) return
              const motivo = window.prompt('Motivo de cambios') ?? ''
              void runAction(() => solicitarCambiosWorkPoolJob(job.id, usuario.id, motivo || undefined))
            }}
          />
        </div>
      )}

      {dashboard && tab === 'contabilidad' && (
        <div className="work-pool-admin__content">
          <WorkPoolContabilidadPanel
            product={product}
            freelancers={filteredFreelancers}
            deudaTotal={filteredFreelancers.reduce((s, f) => s + f.saldo_pendiente, 0)}
            acreditadoTotal={filteredFreelancers.reduce((s, f) => s + f.acreditado, 0)}
            pagadoTotal={filteredFreelancers.reduce((s, f) => s + f.pagado, 0)}
            payUserId={payUserId}
            payMonto={payMonto}
            payNotas={payNotas}
            paying={paying}
            onPayMonto={setPayMonto}
            onPayNotas={setPayNotas}
            onStartPay={(id) => {
              setPayUserId(id)
              const f = filteredFreelancers.find((x) => x.id_usuario === id)
              setPayMonto(f && f.saldo_pendiente > 0 ? String(Math.round(f.saldo_pendiente)) : '')
              setPayNotas('')
            }}
            onCancelPay={() => {
              setPayUserId(null)
              setPayMonto('')
              setPayNotas('')
            }}
            onConfirmPay={() => void handlePago()}
          />
        </div>
      )}

      {tab === 'publicar' && usuario && (
        <div className="work-pool-admin__content">
        <section className="work-pool-admin__publish">
          <WorkPoolPublicarForm
            product={product}
            idUsuarioCreador={usuario.id}
            onSuccess={() => {
              selectTab('dashboard')
              void load()
            }}
            onError={(msg) => setError(msg)}
          />
        </section>
        </div>
      )}

      {dashboard && tab === 'pipeline' && (
        <div className="work-pool-admin__content">
        <section className="work-pool-admin__section">
          <h2>Pipeline de trabajos</h2>
          <div className="work-pool-admin__table-wrap">
            <table className="work-pool-admin__table">
              <thead>
                <tr>
                  <th>Trabajo</th>
                  <th>Sector</th>
                  <th>OP</th>
                  <th>Estado</th>
                  <th>Monto</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {(sectorFilter === 'todos'
                  ? dashboard.jobs_recientes
                  : dashboard.jobs_recientes.filter((j) => j.sector === sectorFilter)
                ).map((job) => (
                  <tr key={job.id}>
                    <td>{job.titulo}</td>
                    <td>{WORK_POOL_SECTOR_LABELS[job.sector]}</td>
                    <td>{job.numero_op ?? '—'}</td>
                    <td>
                      <span className={`work-pool-module__badge work-pool-module__badge--${job.estado}`}>
                        {WORK_POOL_ESTADO_LABELS[job.estado]}
                      </span>
                    </td>
                    <td>{formatArs(job.monto_final ?? job.monto_presupuestado)}</td>
                    <td>{formatDate(job.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}

function ReviewJobCard({
  job,
  usuarioId,
  onAction,
  onNavigateOp
}: {
  job: WorkPoolJob
  usuarioId?: number
  onAction: (fn: () => Promise<{ success: boolean; error?: string }>) => Promise<void>
  onNavigateOp: (op: string) => void
}) {
  return (
    <article className="work-pool-admin__review-card work-pool-admin__review-card--compact">
      <div className="work-pool-admin__review-card-main">
        <h4>{job.titulo}</h4>
        <div className="work-pool-module__job-meta work-pool-admin__review-card-meta">
          <span>{WORK_POOL_SECTOR_LABELS[job.sector]}</span>
          {job.numero_op && <span>OP {job.numero_op}</span>}
          <span>{formatArs(job.monto_presupuestado)}</span>
        </div>
        {(job.descripcion || job.notas_entrega) && (
          <p className="work-pool-admin__review-card-snippet">
            {job.notas_entrega || job.descripcion}
          </p>
        )}
      </div>
      <div className="work-pool-module__job-actions work-pool-admin__review-card-actions">
        {usuarioId && (
          <>
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--success"
              onClick={() => void onAction(() => aprobarWorkPoolJob(job.id, usuarioId))}
            >
              Aprobar y acreditar
            </button>
            <button
              type="button"
              className="work-pool-module__btn work-pool-module__btn--warn"
              onClick={() => {
                const motivo = window.prompt('Motivo de cambios') ?? ''
                void onAction(() => solicitarCambiosWorkPoolJob(job.id, usuarioId, motivo || undefined))
              }}
            >
              Pedir cambios
            </button>
          </>
        )}
        {job.numero_op && (
          <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={() => onNavigateOp(job.numero_op!)}>
            Ver OP
          </button>
        )}
      </div>
    </article>
  )
}

function FreelancerCard({
  f,
  detailed = false,
  onPay
}: {
  f: WorkPoolFreelancerResumen
  detailed?: boolean
  onPay: () => void
}) {
  return (
    <article
      className={`work-pool-admin__freelancer-card${detailed ? ' is-detailed' : ''}${f.saldo_pendiente > 0 ? ' has-debt' : ''}`}
    >
      <div className="work-pool-admin__freelancer-head">
        {f.foto_url ? (
          <img
            src={f.foto_url}
            alt=""
            className="work-pool-admin__avatar work-pool-admin__avatar--photo"
          />
        ) : (
          <div className="work-pool-admin__avatar" aria-hidden>
            {initials(f.nombre)}
          </div>
        )}
        <div className="work-pool-admin__freelancer-id">
          <h4 title={f.nombre}>{f.nombre}</h4>
          <div className="work-pool-admin__freelancer-tags">
            {f.sectores.map((s) => (
              <span key={s}>{WORK_POOL_SECTOR_LABELS[s]}</span>
            ))}
            {f.perfil_aprobado && <span className="is-ok">OK</span>}
            {f.perfil_activo && <span className="is-live">Activo</span>}
          </div>
        </div>
        <div className="work-pool-admin__freelancer-saldo" title="Saldo pendiente">
          <small>Saldo</small>
          <strong>{formatArs(f.saldo_pendiente)}</strong>
        </div>
      </div>

      <div className="work-pool-admin__freelancer-stats">
        <div>
          <small>Activos</small>
          <strong>{f.trabajos_activos}</strong>
        </div>
        <div>
          <small>Aprob.</small>
          <strong>{f.trabajos_aprobados}</strong>
        </div>
        <div>
          <small>Revisión</small>
          <strong>{f.pendientes_revision}</strong>
        </div>
        <div>
          <small>Acred.</small>
          <strong>{formatArs(f.acreditado)}</strong>
        </div>
      </div>

      <div className="work-pool-admin__freelancer-detail">
        <p>
          <span>Pagado</span> {formatArs(f.pagado)}
        </p>
        <p>
          <span>Último</span> {formatDate(f.ultimo_trabajo_at)}
        </p>
        {f.zona_cobertura ? (
          <p>
            <span>Zona</span> {f.zona_cobertura}
          </p>
        ) : null}
        {f.skills.length > 0 ? (
          <p className="work-pool-admin__freelancer-skills" title={f.skills.join(', ')}>
            <span>Skills</span> {f.skills.slice(0, 4).join(', ')}
            {f.skills.length > 4 ? ` +${f.skills.length - 4}` : ''}
          </p>
        ) : null}
      </div>

      {f.saldo_pendiente > 0 && (
        <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onPay}>
          Registrar pago
        </button>
      )}
    </article>
  )
}
