import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import NotificationsDropdown from '../../components/NotificationsDropdown'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct, WorkPoolJob, WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import {
  defaultSectorForProduct,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import {
  isOperarioExternoRol,
  jobPedidoLabel,
  maskJobForOperarioExterno,
  OPERARIO_EXTERNO_LOGIN
} from './workPoolOperarioExterno'
import { clearPlotlabAuthStorage } from '../../utils/plotlabSession'
import {
  contarMensajesOperarioNoLeidos,
  entregarWorkPoolJob,
  getSaldoOperario,
  listWorkPoolJobs,
  listWorkPoolJobsForOperario,
  tomarWorkPoolJob
} from './workPoolRepository'
import WorkPoolOperarioMensajes from './WorkPoolOperarioMensajes'
import WorkPoolOperarioDashboard from './WorkPoolOperarioDashboard'
import WorkPoolEntregaModal from './WorkPoolEntregaModal'
import './WorkPoolModule.css'
import './WorkPoolEntregaModal.css'

type ViewTab = 'bolsa' | 'mis' | 'cuenta' | 'mensajes'

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type Props = { product: WorkPoolProduct }

export default function WorkPoolOperarioView({ product }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { usuario, isOperarioExterno, setUsuario } = useAuth()
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const sectors = sectorsForProduct(product)
  const externo = isOperarioExterno || isOperarioExternoRol(usuario?.rol)

  const parseInitialView = (): ViewTab => {
    const v = searchParams.get('view')
    if (v === 'mensajes' && externo) return 'mensajes'
    if (v === 'cuenta') return 'cuenta'
    if (v === 'mis') return 'mis'
    if (v === 'bolsa' && !externo) return 'bolsa'
    return externo ? 'mis' : 'bolsa'
  }

  const [sector, setSector] = useState<WorkPoolSector>(() =>
    defaultSectorForProduct(product, usuario?.rol)
  )
  const [view, setView] = useState<ViewTab>(parseInitialView)
  const [jobs, setJobs] = useState<WorkPoolJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saldo, setSaldo] = useState({ acreditado: 0, pagado: 0, saldo_pendiente: 0 })
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(() => new Date())

  const pedidoMensajesParam = searchParams.get('pedido')
  const pedidoMensajesInicial = pedidoMensajesParam ? parseInt(pedidoMensajesParam, 10) : null

  const load = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    setError('')

    const jobsRes = externo
      ? await listWorkPoolJobsForOperario(usuario.id, product)
      : await listWorkPoolJobs({
          sector,
          soloDisponibles: view === 'bolsa',
          idUsuario: view === 'mis' ? usuario.id : undefined
        })

    if (!jobsRes.success) {
      setError(jobsRes.error || 'Error al cargar trabajos')
      setJobs([])
    } else if (externo) {
      // Entrantes: bolsa disponible + trabajos propios (no cancelados)
      setJobs(
        (jobsRes.data ?? []).filter((j) =>
          j.estado === 'disponible' ||
          ['asignado', 'en_curso', 'entregado', 'en_revision', 'cambios', 'aprobado'].includes(j.estado)
        )
      )
    } else if (view === 'mis') {
      setJobs(
        (jobsRes.data ?? []).filter((j) =>
          ['asignado', 'en_curso', 'entregado', 'en_revision', 'cambios', 'aprobado'].includes(j.estado)
        )
      )
    } else {
      setJobs(jobsRes.data ?? [])
    }

    const saldoRes = await getSaldoOperario(usuario.id)
    if (saldoRes.success && saldoRes.data) setSaldo(saldoRes.data)

    setLastUpdated(new Date())
    setLoading(false)
  }, [usuario, sector, view, externo, product])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!externo || !usuario) return
    void contarMensajesOperarioNoLeidos(usuario.id, product).then((res) => {
      if (res.success && res.data != null) setMensajesNoLeidos(res.data)
    })
  }, [externo, usuario, view, product])

  const changeView = (next: ViewTab) => {
    setView(next)
    const params = new URLSearchParams(searchParams)
    params.set('view', next)
    if (next !== 'mensajes') params.delete('pedido')
    setSearchParams(params, { replace: true })
  }

  const handleLogout = () => {
    clearPlotlabAuthStorage()
    flushSync(() => setUsuario(null))
    navigate(OPERARIO_EXTERNO_LOGIN, { replace: true })
    void import('../../services/staffAuthApi')
      .then((m) => m.staffLogout())
      .catch(() => {
        clearPlotlabAuthStorage()
      })
  }

  const runAction = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError('')
    const res = await fn()
    if (!res.success) setError(res.error || 'Error en la acción')
    else void load()
    return res
  }

  const [entregaJob, setEntregaJob] = useState<WorkPoolJob | null>(null)
  const [entregaBusy, setEntregaBusy] = useState(false)

  const handleEntregar = (jobId: number) => {
    const job = jobs.find((j) => j.id === jobId) ?? null
    if (!job) return
    setEntregaJob(job)
  }

  const handleTomar = (jobId: number) => {
    if (!usuario) return
    void runAction(() => tomarWorkPoolJob(jobId, usuario.id))
  }

  const confirmEntrega = async (payload: { driveUrl: string; notas: string }) => {
    if (!usuario || !entregaJob) return
    setEntregaBusy(true)
    const res = await runAction(() =>
      entregarWorkPoolJob(entregaJob.id, usuario.id, payload.notas || undefined, payload.driveUrl)
    )
    setEntregaBusy(false)
    if (res.success) setEntregaJob(null)
  }

  if (externo && usuario) {
    const dashView =
      view === 'bolsa' ? 'mis' : (view as 'mis' | 'mensajes' | 'cuenta')

    return (
      <>
        <WorkPoolOperarioDashboard
          product={product}
          usuario={usuario}
          view={dashView}
          onChangeView={(v) => changeView(v)}
          onLogout={handleLogout}
          jobs={jobs}
          loading={loading}
          error={error}
          saldo={saldo}
          mensajesNoLeidos={mensajesNoLeidos}
          onEntregar={handleEntregar}
          onTomar={handleTomar}
          pedidoMensajesInicial={Number.isNaN(pedidoMensajesInicial ?? NaN) ? null : pedidoMensajesInicial}
          onUnreadChange={setMensajesNoLeidos}
          lastUpdated={lastUpdated}
        />
        <WorkPoolEntregaModal
          open={Boolean(entregaJob)}
          jobTitle={entregaJob?.titulo ?? ''}
          busy={entregaBusy}
          onClose={() => {
            if (!entregaBusy) setEntregaJob(null)
          }}
          onConfirm={(payload) => void confirmEntrega(payload)}
        />
      </>
    )
  }

  return (
    <div className={`work-pool-module work-pool-module--operario ${cfg.themeClass}`}>
      <header className="work-pool-module__head">
        <div>
          <h1>
            {cfg.icon} {cfg.label}
          </h1>
          <p>{cfg.tagline}</p>
        </div>
        <div className="work-pool-module__head-actions">
          {externo && <NotificationsDropdown />}
          {externo ? (
            <button type="button" className="work-pool-module__back" onClick={handleLogout}>
              Cerrar sesión
            </button>
          ) : (
            <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
              ← PlotLab
            </button>
          )}
        </div>
      </header>

      {externo && (
        <div className="work-pool-module__alert work-pool-module__alert--info">
          En bolsa ves trabajos publicados por Plot Design. Podés tomarlos. No ves datos de contacto del
          cliente ni número de OP; solo el pedido portal cuando corresponde.
        </div>
      )}

      {sectors.length > 1 && (
        <div className="work-pool-module__tabs" role="tablist" aria-label="Sector">
          {sectors.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              className={`work-pool-module__tab${sector === s ? ' is-active' : ''}`}
              onClick={() => setSector(s)}
            >
              {WORK_POOL_SECTOR_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="work-pool-module__view-tabs" role="tablist" aria-label="Vista">
        {!externo && (
          <button
            type="button"
            className={`work-pool-module__tab${view === 'bolsa' ? ' is-active' : ''}`}
            onClick={() => changeView('bolsa')}
          >
            Bolsa disponible
          </button>
        )}
        <button
          type="button"
          className={`work-pool-module__tab${view === 'mis' ? ' is-active' : ''}`}
          onClick={() => changeView('mis')}
        >
          {externo ? 'Entrantes' : 'Mis trabajos'}
        </button>
        {externo && (
          <button
            type="button"
            className={`work-pool-module__tab${view === 'mensajes' ? ' is-active' : ''}`}
            onClick={() => changeView('mensajes')}
          >
            Mensajes
            {mensajesNoLeidos > 0 && (
              <span className="work-pool-module__tab-badge">{mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}</span>
            )}
          </button>
        )}
        <button
          type="button"
          className={`work-pool-module__tab${view === 'cuenta' ? ' is-active' : ''}`}
          onClick={() => changeView('cuenta')}
        >
          Mi cuenta
        </button>
      </div>

      {error && <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div>}

      {view === 'mensajes' && externo && usuario && (
        <WorkPoolOperarioMensajes
          idUsuario={usuario.id}
          product={product}
          pedidoInicial={Number.isNaN(pedidoMensajesInicial ?? NaN) ? null : pedidoMensajesInicial}
          onUnreadChange={setMensajesNoLeidos}
        />
      )}

      {view === 'cuenta' && (
        <div className="work-pool-module__stats">
          <div className="work-pool-module__stat">
            <span>Acreditado</span>
            <strong>{formatArs(saldo.acreditado)}</strong>
          </div>
          <div className="work-pool-module__stat">
            <span>Pagado</span>
            <strong>{formatArs(saldo.pagado)}</strong>
          </div>
          <div className="work-pool-module__stat work-pool-module__stat--highlight">
            <span>Saldo pendiente</span>
            <strong>{formatArs(saldo.saldo_pendiente)}</strong>
          </div>
        </div>
      )}

      {view !== 'cuenta' && view !== 'mensajes' && (
        <>
          {loading ? (
            <p className="work-pool-module__empty">Cargando…</p>
          ) : jobs.length === 0 ? (
            <p className="work-pool-module__empty">
              {view === 'bolsa'
                ? 'No hay trabajos disponibles en este sector.'
                : 'No tenés trabajos asignados en este sector.'}
            </p>
          ) : (
            <div className="work-pool-module__jobs">
              {jobs.map((raw) => {
                const job = externo ? maskJobForOperarioExterno(raw) : raw
                const pedidoLabel = jobPedidoLabel(job)
                return (
                <article key={job.id} className="work-pool-module__job">
                  <div className="work-pool-module__job-head">
                    <h4>{job.titulo}</h4>
                    <span className={`work-pool-module__badge work-pool-module__badge--${job.estado}`}>
                      {WORK_POOL_ESTADO_LABELS[job.estado]}
                      {job.modo === 'asignado' && job.estado === 'asignado' ? ' · directo' : ''}
                    </span>
                  </div>
                  {job.descripcion && <p className="work-pool-module__job-desc">{job.descripcion}</p>}
                  <div className="work-pool-module__job-meta">
                    {pedidoLabel ? <span>Pedido {pedidoLabel}</span> : null}
                    {!externo && job.numero_op ? <span>OP {job.numero_op}</span> : null}
                    <span>{formatArs(job.monto_presupuestado)}</span>
                    {job.plazo && <span>Plazo {job.plazo}</span>}
                  </div>
                  <div className="work-pool-module__job-actions">
                    {!externo && view === 'bolsa' && job.estado === 'disponible' && usuario && (
                      <button
                        type="button"
                        className="work-pool-module__btn work-pool-module__btn--primary"
                        onClick={() => void runAction(() => tomarWorkPoolJob(job.id, usuario.id))}
                      >
                        Tomar trabajo
                      </button>
                    )}
                    {view === 'mis' && usuario && ['en_curso', 'asignado', 'cambios'].includes(job.estado) && (
                      <button
                        type="button"
                        className="work-pool-module__btn work-pool-module__btn--success"
                        onClick={() => handleEntregar(job.id)}
                      >
                        Marcar entregado
                      </button>
                    )}
                    {!externo && job.numero_op && (
                      <button
                        type="button"
                        className="work-pool-module__btn work-pool-module__btn--ghost"
                        onClick={() => navigate(`/op/${job.numero_op}`)}
                      >
                        Ver OP
                      </button>
                    )}
                  </div>
                </article>
              )})}
            </div>
          )}
        </>
      )}

      {!loading && !externo && view === 'bolsa' && jobs.length === 0 && (
        <div className="work-pool-module__alert work-pool-module__alert--info">
          Cuando Plot publique trabajos desde una OP, van a aparecer acá para que los tomes.
        </div>
      )}
      {!loading && externo && view === 'mis' && jobs.length === 0 && (
        <div className="work-pool-module__alert work-pool-module__alert--info">
          Todavía no tenés trabajos asignados. El equipo de Plot Design te enviará pedidos desde el panel
          de publicación.
        </div>
      )}
      <WorkPoolEntregaModal
        open={Boolean(entregaJob)}
        jobTitle={entregaJob?.titulo ?? ''}
        busy={entregaBusy}
        onClose={() => {
          if (!entregaBusy) setEntregaJob(null)
        }}
        onConfirm={(payload) => void confirmEntrega(payload)}
      />
    </div>
  )
}
