import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { WorkPoolJob, WorkPoolPricingRule, WorkPoolSector } from '../../types/workPool'
import {
  WORK_POOL_ESTADO_LABELS,
  WORK_POOL_SECTOR_LABELS
} from '../../types/workPool'
import {
  aprobarWorkPoolJob,
  crearWorkPoolJob,
  entregarWorkPoolJob,
  getResumenPlot,
  getSaldoOperario,
  listPricingRules,
  listWorkPoolJobs,
  solicitarCambiosWorkPoolJob,
  tomarWorkPoolJob
} from './workPoolRepository'
import './WorkPoolModule.css'

const SECTORS: WorkPoolSector[] = ['diseno', 'instalaciones', 'metalurgica']

type ViewTab = 'bolsa' | 'mis' | 'cuenta'

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function WorkPoolModule() {
  const navigate = useNavigate()
  const { usuario, isAdmin } = useAuth()
  const [sector, setSector] = useState<WorkPoolSector>('diseno')
  const [view, setView] = useState<ViewTab>('bolsa')
  const [jobs, setJobs] = useState<WorkPoolJob[]>([])
  const [tarifas, setTarifas] = useState<WorkPoolPricingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saldo, setSaldo] = useState({ acreditado: 0, pagado: 0, saldo_pendiente: 0 })
  const [resumen, setResumen] = useState<
    Array<{ sector: string; trabajos_abiertos: number; trabajos_aprobados: number; deuda_operarios: number }>
  >([])

  const [createOp, setCreateOp] = useState('')
  const [createTarifa, setCreateTarifa] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createMonto, setCreateMonto] = useState('')
  const [creating, setCreating] = useState(false)

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

    const tarifasRes = await listPricingRules(sector)
    if (tarifasRes.success) setTarifas(tarifasRes.data ?? [])

    const saldoRes = await getSaldoOperario(usuario.id)
    if (saldoRes.success && saldoRes.data) setSaldo(saldoRes.data)

    if (isAdmin && view === 'cuenta') {
      const resRes = await getResumenPlot()
      if (resRes.success) setResumen(resRes.data ?? [])
    }

    setLoading(false)
  }, [usuario, sector, view, isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const montoFromTarifa = useMemo(() => {
    const t = tarifas.find((x) => x.codigo === createTarifa)
    return t?.monto_base ?? 0
  }, [tarifas, createTarifa])

  const handleCrear = async () => {
    if (!usuario || !createOp.trim()) {
      setError('Indicá el número de OP')
      return
    }
    setCreating(true)
    setError('')
    const res = await crearWorkPoolJob({
      sector,
      numero_op: createOp.trim(),
      descripcion: createDesc.trim() || undefined,
      codigo_tarifa: createTarifa || undefined,
      monto: createMonto ? Number(createMonto) : undefined,
      id_usuario_creador: usuario.id,
      modo: 'bolsa'
    })
    setCreating(false)
    if (!res.success) {
      setError(res.error || 'No se pudo crear el trabajo')
      return
    }
    setCreateOp('')
    setCreateDesc('')
    setCreateTarifa('')
    setCreateMonto('')
    setView('bolsa')
    void load()
  }

  const runAction = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError('')
    const res = await fn()
    if (!res.success) setError(res.error || 'Error en la acción')
    else void load()
  }

  return (
    <div className="work-pool-module">
      <header className="work-pool-module__head">
        <div>
          <h1>PlotBolsa</h1>
          <p>
            Bolsa de trabajos para diseño, instalaciones y metalúrgica. Tomá trabajos, entregá y
            acumulá tu cuenta.
          </p>
        </div>
        <button type="button" className="work-pool-module__back" onClick={() => navigate('/')}>
          ← PlotLab
        </button>
      </header>

      <div className="work-pool-module__tabs" role="tablist" aria-label="Sector">
        {SECTORS.map((s) => (
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
        <>
          <div className="work-pool-module__stats">
            <div className="work-pool-module__stat">
              <span>Acreditado</span>
              <strong>{formatArs(saldo.acreditado)}</strong>
            </div>
            <div className="work-pool-module__stat">
              <span>Pagado</span>
              <strong>{formatArs(saldo.pagado)}</strong>
            </div>
            <div className="work-pool-module__stat">
              <span>Saldo pendiente</span>
              <strong>{formatArs(saldo.saldo_pendiente)}</strong>
            </div>
          </div>
          {isAdmin && resumen.length > 0 && (
            <div className="work-pool-module__create">
              <h3>Cuenta general Plot</h3>
              <div className="work-pool-module__jobs">
                {resumen.map((r) => (
                  <div key={r.sector} className="work-pool-module__job">
                    <h4>{WORK_POOL_SECTOR_LABELS[r.sector as WorkPoolSector] ?? r.sector}</h4>
                    <div className="work-pool-module__job-meta">
                      <span>Abiertos: {r.trabajos_abiertos}</span>
                      <span>Aprobados: {r.trabajos_aprobados}</span>
                      <span>Deuda: {formatArs(Number(r.deuda_operarios))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(isAdmin || usuario?.rol === 'gerencia') && view === 'bolsa' && (
        <section className="work-pool-module__create">
          <h3>Publicar trabajo en bolsa ({WORK_POOL_SECTOR_LABELS[sector]})</h3>
          <div className="work-pool-module__form-row">
            <label>
              Nº OP
              <input
                value={createOp}
                onChange={(e) => setCreateOp(e.target.value)}
                placeholder="Ej. 100660"
              />
            </label>
            <label>
              Tarifario
              <select value={createTarifa} onChange={(e) => setCreateTarifa(e.target.value)}>
                <option value="">— Elegir —</option>
                {tarifas.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.nombre} ({formatArs(t.monto_base)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto manual (opcional)
              <input
                type="number"
                min="0"
                value={createMonto}
                onChange={(e) => setCreateMonto(e.target.value)}
                placeholder={createTarifa ? String(montoFromTarifa) : '0'}
              />
            </label>
          </div>
          <div className="work-pool-module__form-row">
            <label style={{ gridColumn: '1 / -1' }}>
              Descripción / brief
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="Qué debe hacer el operario…"
              />
            </label>
          </div>
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--primary"
            disabled={creating}
            onClick={() => void handleCrear()}
          >
            {creating ? 'Publicando…' : 'Publicar en bolsa'}
          </button>
        </section>
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
                    </span>
                  </div>
                  {job.descripcion && <p style={{ margin: 0, fontSize: '0.84rem' }}>{job.descripcion}</p>}
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
                        onClick={() =>
                          void runAction(() => tomarWorkPoolJob(job.id, usuario.id))
                        }
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
                          void runAction(() =>
                            entregarWorkPoolJob(job.id, usuario.id, notas || undefined)
                          )
                        }}
                      >
                        Marcar entregado
                      </button>
                    )}
                    {isAdmin && job.estado === 'entregado' && usuario && (
                      <>
                        <button
                          type="button"
                          className="work-pool-module__btn work-pool-module__btn--success"
                          onClick={() =>
                            void runAction(() => aprobarWorkPoolJob(job.id, usuario.id))
                          }
                        >
                          Aprobar y acreditar
                        </button>
                        <button
                          type="button"
                          className="work-pool-module__btn work-pool-module__btn--warn"
                          onClick={() => {
                            const motivo = window.prompt('Motivo de cambios') ?? ''
                            void runAction(() =>
                              solicitarCambiosWorkPoolJob(job.id, usuario.id, motivo || undefined)
                            )
                          }}
                        >
                          Pedir cambios
                        </button>
                      </>
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

      {!loading && view === 'bolsa' && jobs.length === 0 && !isAdmin && (
        <div className="work-pool-module__alert work-pool-module__alert--info">
          Si no ves trabajos, un responsable de Plot debe publicarlos desde acá vinculando el nº de OP.
        </div>
      )}
    </div>
  )
}
