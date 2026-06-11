import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolProduct, WorkPoolJob, WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS, WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import {
  defaultSectorForProduct,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import {
  entregarWorkPoolJob,
  getSaldoOperario,
  listWorkPoolJobs,
  tomarWorkPoolJob
} from './workPoolRepository'
import './WorkPoolModule.css'

type ViewTab = 'bolsa' | 'mis' | 'cuenta'

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type Props = { product: WorkPoolProduct }

export default function WorkPoolOperarioView({ product }: Props) {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]
  const sectors = sectorsForProduct(product)

  const [sector, setSector] = useState<WorkPoolSector>(() =>
    defaultSectorForProduct(product, usuario?.rol)
  )
  const [view, setView] = useState<ViewTab>('bolsa')
  const [jobs, setJobs] = useState<WorkPoolJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saldo, setSaldo] = useState({ acreditado: 0, pagado: 0, saldo_pendiente: 0 })

  const load = useCallback(async () => {
    if (!usuario) return
    setLoading(true)
    setError('')

    const jobsRes = await listWorkPoolJobs({
      sector,
      soloDisponibles: view === 'bolsa',
      idUsuario: view === 'mis' ? usuario.id : undefined
    })

    if (!jobsRes.success) {
      setError(jobsRes.error || 'Error al cargar trabajos')
      setJobs([])
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

    setLoading(false)
  }, [usuario, sector, view])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError('')
    const res = await fn()
    if (!res.success) setError(res.error || 'Error en la acción')
    else void load()
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
        <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
          ← PlotLab
        </button>
      </header>

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
        <button
          type="button"
          className={`work-pool-module__tab${view === 'bolsa' ? ' is-active' : ''}`}
          onClick={() => setView('bolsa')}
        >
          Bolsa disponible
        </button>
        <button
          type="button"
          className={`work-pool-module__tab${view === 'mis' ? ' is-active' : ''}`}
          onClick={() => setView('mis')}
        >
          Mis trabajos
        </button>
        <button
          type="button"
          className={`work-pool-module__tab${view === 'cuenta' ? ' is-active' : ''}`}
          onClick={() => setView('cuenta')}
        >
          Mi cuenta
        </button>
      </div>

      {error && <div className="work-pool-module__alert work-pool-module__alert--error">{error}</div>}

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

      {view !== 'cuenta' && (
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
              {jobs.map((job) => (
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
                    {job.numero_op && <span>OP {job.numero_op}</span>}
                    <span>{formatArs(job.monto_presupuestado)}</span>
                    {job.plazo && <span>Plazo {job.plazo}</span>}
                  </div>
                  <div className="work-pool-module__job-actions">
                    {view === 'bolsa' && job.estado === 'disponible' && usuario && (
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
                        onClick={() => {
                          const notas = window.prompt('Notas de entrega (opcional)') ?? ''
                          void runAction(() => entregarWorkPoolJob(job.id, usuario.id, notas || undefined))
                        }}
                      >
                        Marcar entregado
                      </button>
                    )}
                    {job.numero_op && (
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
              ))}
            </div>
          )}
        </>
      )}

      {!loading && view === 'bolsa' && jobs.length === 0 && (
        <div className="work-pool-module__alert work-pool-module__alert--info">
          Cuando Plot publique trabajos desde una OP, van a aparecer acá para que los tomes.
        </div>
      )}
    </div>
  )
}
