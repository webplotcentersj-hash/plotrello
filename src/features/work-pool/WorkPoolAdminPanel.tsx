import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import './WorkPoolModule.css'
import './WorkPoolAdminPanel.css'

type Props = { product: WorkPoolProduct }

type AdminTab = 'dashboard' | 'freelancers' | 'publicar' | 'pipeline'

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
  if (sector === 'diseno') return '🎨'
  if (sector === 'instalaciones') return '🪜'
  return '🔧'
}

export default function WorkPoolAdminPanel({ product }: Props) {
  const navigate = useNavigate()
  const { usuario, canAccessPlotDesign, canAccessBolsaPlot } = useAuth()
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const SECTORS = sectorsForProduct(product)
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [sectorFilter, setSectorFilter] = useState<WorkPoolSector | 'todos'>('todos')
  const [dashboard, setDashboard] = useState<WorkPoolAdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [payUserId, setPayUserId] = useState<number | null>(null)
  const [payMonto, setPayMonto] = useState('')
  const [payNotas, setPayNotas] = useState('')
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const res = await loadWorkPoolAdminDashboard(product)
    if (!res.success || !res.data) {
      setError(res.error || 'No se pudo cargar el panel')
      setDashboard(null)
    } else {
      setDashboard(res.data)
    }
    setLoading(false)
  }, [product])

  useEffect(() => {
    void load()
  }, [load])

  const filteredFreelancers = useMemo(() => {
    if (!dashboard) return []
    if (sectorFilter === 'todos') return dashboard.freelancers
    return dashboard.freelancers.filter((f) => f.sectores.includes(sectorFilter))
  }, [dashboard, sectorFilter])

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

  const tabItems: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'freelancers', label: 'Freelancers', icon: '👥' },
    { id: 'publicar', label: 'Publicar', icon: '✦' },
    { id: 'pipeline', label: 'Pipeline', icon: '🔀' }
  ]

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
            <span className="work-pool-admin__eyebrow">Administración · {cfg.label}</span>
            <h1>
              <span className="work-pool-admin__hero-icon" aria-hidden>
                {cfg.icon}
              </span>
              {cfg.label}
            </h1>
            <p>{cfg.adminTagline}</p>
            {kpis && !loading ? (
              <div className="work-pool-admin__hero-stats" aria-label="Resumen rápido">
                <span>
                  <strong>{kpis.trabajos_abiertos}</strong> abiertos
                </span>
                <span>
                  <strong>{kpis.disponibles_bolsa}</strong> en bolsa
                </span>
                <span>
                  <strong>{kpis.pendientes_revision}</strong> en revisión
                </span>
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
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={() => navigate('/plot-design')}>
                    🎨 Plot Design
                  </button>
                ) : (
                  <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={() => navigate('/bolsa-plot')}>
                    🧰 Bolsa Plot
                  </button>
                )}
              </div>
            )}
            <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
              ← PlotLab
            </button>
            <button type="button" className="work-pool-admin__refresh" onClick={() => void load()} disabled={loading}>
              {loading ? 'Actualizando…' : '↻ Actualizar'}
            </button>
          </div>
        </div>
      </header>

      <div className="work-pool-admin__toolbar">
        <div className="work-pool-admin__tabs" role="tablist">
          {tabItems.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`work-pool-admin__tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span className="work-pool-admin__tab-icon" aria-hidden>
                {icon}
              </span>
              {label}
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
          <section className="work-pool-admin__kpi-grid">
            <article className="work-pool-admin__kpi work-pool-admin__kpi--deuda">
              <span className="work-pool-admin__kpi-icon">💳</span>
              <div>
                <small>Deuda total Plot</small>
                <strong>{formatArs(kpis?.deuda_total ?? 0)}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon">📋</span>
              <div>
                <small>Trabajos abiertos</small>
                <strong>{kpis?.trabajos_abiertos ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi work-pool-admin__kpi--warn">
              <span className="work-pool-admin__kpi-icon">⏳</span>
              <div>
                <small>Pendientes de revisión</small>
                <strong>{kpis?.pendientes_revision ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon">🧰</span>
              <div>
                <small>En bolsa disponible</small>
                <strong>{kpis?.disponibles_bolsa ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi">
              <span className="work-pool-admin__kpi-icon">👷</span>
              <div>
                <small>Operarios activos</small>
                <strong>{kpis?.operarios_activos ?? 0}</strong>
              </div>
            </article>
            <article className="work-pool-admin__kpi work-pool-admin__kpi--ok">
              <span className="work-pool-admin__kpi-icon">✓</span>
              <div>
                <small>Aprobados este mes</small>
                <strong>{kpis?.aprobados_mes ?? 0}</strong>
              </div>
            </article>
          </section>

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
                const max = Math.max(
                  Number(r.trabajos_abiertos),
                  Number(r.trabajos_aprobados),
                  1
                )
                return (
                  <article key={r.sector} className="work-pool-admin__sector-card">
                    <div className="work-pool-admin__sector-card-head">
                      <span>{sectorIcon(sector)}</span>
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
              <h2>Top freelancers por saldo</h2>
            </div>
            <div className="work-pool-admin__freelancer-grid">
              {filteredFreelancers.slice(0, 6).map((f) => (
                <FreelancerCard key={f.id_usuario} f={f} onPay={() => { setPayUserId(f.id_usuario); setTab('freelancers') }} />
              ))}
              {filteredFreelancers.length === 0 && (
                <p className="work-pool-module__empty">Todavía no hay operarios con actividad en la bolsa.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {dashboard && tab === 'freelancers' && (
        <div className="work-pool-admin__content">
        <section className="work-pool-admin__section">
          <div className="work-pool-admin__section-head">
            <h2>Freelancers y operarios externos</h2>
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
          {payUserId != null && (
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

      {tab === 'publicar' && usuario && (
        <div className="work-pool-admin__content">
        <section className="work-pool-admin__publish">
          <WorkPoolPublicarForm
            product={product}
            idUsuarioCreador={usuario.id}
            onSuccess={() => {
              setTab('dashboard')
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
    <article className="work-pool-admin__review-card">
      <div>
        <h4>{job.titulo}</h4>
        <p>{job.descripcion || 'Sin descripción'}</p>
        <div className="work-pool-module__job-meta">
          <span>{WORK_POOL_SECTOR_LABELS[job.sector]}</span>
          {job.numero_op && <span>OP {job.numero_op}</span>}
          <span>{formatArs(job.monto_presupuestado)}</span>
          {job.notas_entrega && <span>Entrega: {job.notas_entrega}</span>}
        </div>
      </div>
      <div className="work-pool-module__job-actions">
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
    <article className={`work-pool-admin__freelancer-card${f.saldo_pendiente > 0 ? ' has-debt' : ''}`}>
      <div className="work-pool-admin__freelancer-head">
        <div className="work-pool-admin__avatar">{initials(f.nombre)}</div>
        <div>
          <h4>{f.nombre}</h4>
          <div className="work-pool-admin__freelancer-tags">
            {f.sectores.map((s) => (
              <span key={s}>{WORK_POOL_SECTOR_LABELS[s]}</span>
            ))}
            {f.perfil_aprobado && <span className="is-ok">Perfil OK</span>}
            {f.perfil_activo && <span className="is-live">Activo</span>}
          </div>
        </div>
      </div>
      <div className="work-pool-admin__freelancer-stats">
        <div>
          <small>Saldo</small>
          <strong>{formatArs(f.saldo_pendiente)}</strong>
        </div>
        <div>
          <small>Activos</small>
          <strong>{f.trabajos_activos}</strong>
        </div>
        <div>
          <small>Aprobados</small>
          <strong>{f.trabajos_aprobados}</strong>
        </div>
        <div>
          <small>En revisión</small>
          <strong>{f.pendientes_revision}</strong>
        </div>
      </div>
      {detailed && (
        <div className="work-pool-admin__freelancer-detail">
          <p>
            <span>Acreditado</span> {formatArs(f.acreditado)}
          </p>
          <p>
            <span>Pagado</span> {formatArs(f.pagado)}
          </p>
          <p>
            <span>Último trabajo</span> {formatDate(f.ultimo_trabajo_at)}
          </p>
          {f.zona_cobertura && (
            <p>
              <span>Zona</span> {f.zona_cobertura}
            </p>
          )}
          {f.skills.length > 0 && (
            <p>
              <span>Skills</span> {f.skills.join(', ')}
            </p>
          )}
        </div>
      )}
      {f.saldo_pendiente > 0 && (
        <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost" onClick={onPay}>
          Registrar pago
        </button>
      )}
    </article>
  )
}
