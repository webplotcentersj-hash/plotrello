import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronRight, Radio } from 'lucide-react'
import type { WorkPoolJob, WorkPoolOperarioAvance, WorkPoolProduct } from '../../types/workPool'
import {
  WORK_POOL_AVANCE_PASOS,
  WORK_POOL_ESTADO_LABELS,
  WORK_POOL_SECTOR_LABELS
} from '../../types/workPool'

type Props = {
  product: WorkPoolProduct
  avances: WorkPoolOperarioAvance[]
  onNavigateOp?: (op: string) => void
  onAprobar?: (job: WorkPoolJob) => void
  onPedirCambios?: (job: WorkPoolJob) => void
  canReview?: boolean
  /** Refresco en vivo del dashboard (p. ej. cada 20s). */
  onRefreshLive?: () => void
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function initials(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function estaTrabajando(op: WorkPoolOperarioAvance) {
  return op.trabajos_en_curso > 0
}

export default function WorkPoolAvancesPanel({
  product,
  avances,
  onNavigateOp,
  onAprobar,
  onPedirCambios,
  canReview,
  onRefreshLive
}: Props) {
  const isPlotDesign = product === 'plot-design'
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const didInitExpand = useRef(false)

  const sorted = useMemo(() => {
    return [...avances].sort((a, b) => {
      const aw = estaTrabajando(a) ? 1 : 0
      const bw = estaTrabajando(b) ? 1 : 0
      if (bw !== aw) return bw - aw
      return b.trabajos_en_curso + b.en_revision - (a.trabajos_en_curso + a.en_revision)
    })
  }, [avances])

  const trabajando = useMemo(() => sorted.filter(estaTrabajando), [sorted])
  const totalJobs = useMemo(() => sorted.reduce((s, a) => s + a.jobs.length, 0), [sorted])

  useEffect(() => {
    if (!didInitExpand.current && sorted[0]) {
      setExpandedId(sorted[0].id_usuario)
      didInitExpand.current = true
    }
  }, [sorted])

  const refreshRef = useRef(onRefreshLive)
  refreshRef.current = onRefreshLive

  // Reloj + poll en vivo
  useEffect(() => {
    const clock = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    const poll = window.setInterval(() => refreshRef.current?.(), 20000)
    return () => window.clearInterval(poll)
  }, [])

  const horaViva = new Date(nowTick).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  if (sorted.length === 0) {
    return (
      <section className="work-pool-admin__section work-pool-admin__section--avances">
        <div className="work-pool-avances-hero work-pool-avances-hero--empty">
          <span className="work-pool-live-pill work-pool-live-pill--idle">
            <span className="work-pool-live-pill__dot" aria-hidden />
            En vivo · Nadie trabajando ahora
          </span>
          <h2>{isPlotDesign ? 'Sala creativa' : 'Sala de avances'}</h2>
          <p>Cuando un diseñador tome un trabajo, aparece acá con el marcador «Está trabajando».</p>
        </div>
      </section>
    )
  }

  return (
    <section className="work-pool-admin__section work-pool-admin__section--avances">
      <div className="work-pool-avances-hero">
        <div className="work-pool-avances-hero__top">
          <span className="work-pool-live-pill" role="status">
            <span className="work-pool-live-pill__dot" aria-hidden />
            En vivo
            <time dateTime={new Date(nowTick).toISOString()}>{horaViva}</time>
          </span>
          <span className="work-pool-avances-hero__stats">
            <strong>{trabajando.length}</strong> trabajando · {totalJobs} trabajos activos
          </span>
        </div>
        <h2>{isPlotDesign ? 'Sala creativa' : 'Sala de avances'}</h2>
        <p>
          Marcador en vivo de quién está produciendo ahora y en qué paso va cada trabajo.
        </p>

        {trabajando.length > 0 && (
          <div className="work-pool-avances-now" aria-label="Están trabajando ahora">
            {trabajando.map((op) => (
              <button
                key={op.id_usuario}
                type="button"
                className="work-pool-avances-now__chip"
                onClick={() => setExpandedId(op.id_usuario)}
              >
                <span className="work-pool-avances-now__pulse" aria-hidden />
                <span className="work-pool-avances-now__avatar">{initials(op.nombre)}</span>
                <span className="work-pool-avances-now__text">
                  <strong>{op.nombre}</strong>
                  <em>Está trabajando</em>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ul className="work-pool-avances-list" role="list">
        {sorted.map((op) => {
          const open = expandedId === op.id_usuario
          const live = estaTrabajando(op)
          const currentJob = op.jobs.find((j) =>
            ['asignado', 'en_curso', 'cambios'].includes(j.job.estado)
          )

          return (
            <li
              key={op.id_usuario}
              className={`work-pool-avance-card${open ? ' is-open' : ''}${live ? ' is-live' : ''}`}
            >
              <button
                type="button"
                className="work-pool-avance-card__head"
                onClick={() => setExpandedId(open ? null : op.id_usuario)}
                aria-expanded={open}
              >
                <span className={`work-pool-avance-card__avatar${live ? ' is-live' : ''}`} aria-hidden>
                  {live && <span className="work-pool-avance-card__ring" />}
                  {initials(op.nombre)}
                </span>
                <span className="work-pool-avance-card__title">
                  <strong>{op.nombre}</strong>
                  {live ? (
                    <span className="work-pool-avance-card__working">
                      <span className="work-pool-avance-card__working-dot" aria-hidden />
                      Está trabajando
                      {currentJob ? ` · ${currentJob.job.titulo}` : ''}
                    </span>
                  ) : (
                    <span>
                      {op.en_revision > 0
                        ? `${op.en_revision} en revisión (esperando tu OK)`
                        : `${op.jobs.length} trabajo${op.jobs.length === 1 ? '' : 's'}`}
                    </span>
                  )}
                </span>
                {live ? (
                  <span className="work-pool-live-badge">
                    <Radio size={12} aria-hidden />
                    LIVE
                  </span>
                ) : (
                  <span className="work-pool-avance-card__count">{op.jobs.length}</span>
                )}
                <ChevronRight
                  size={18}
                  className={`work-pool-avance-card__chev${open ? ' is-open' : ''}`}
                  aria-hidden
                />
              </button>

              {open && (
                <ul className="work-pool-avance-card__jobs" role="list">
                  {op.jobs.map(({ job, paso, etiqueta_paso, en_cambios }) => {
                    const jobLive = ['asignado', 'en_curso', 'cambios'].includes(job.estado)
                    return (
                      <li
                        key={job.id}
                        className={`work-pool-avance-job${jobLive ? ' is-live' : ''}`}
                      >
                        <div className="work-pool-avance-job__top">
                          <div>
                            <div className="work-pool-avance-job__title-row">
                              <h4>{job.titulo}</h4>
                              {jobLive && (
                                <span className="work-pool-live-badge work-pool-live-badge--sm">
                                  <span className="work-pool-avance-card__working-dot" aria-hidden />
                                  Está trabajando
                                </span>
                              )}
                            </div>
                            <div className="work-pool-avance-job__meta">
                              <span>{WORK_POOL_SECTOR_LABELS[job.sector]}</span>
                              {job.numero_op && <span>OP {job.numero_op}</span>}
                              <span>{formatArs(job.monto_final ?? job.monto_presupuestado)}</span>
                              <span>Act. {formatDate(job.updated_at)}</span>
                            </div>
                          </div>
                          <span className={`work-pool-module__badge work-pool-module__badge--${job.estado}`}>
                            {WORK_POOL_ESTADO_LABELS[job.estado]}
                          </span>
                        </div>

                        <ol className="work-pool-avance-track" aria-label={`Progreso: ${etiqueta_paso}`}>
                          {WORK_POOL_AVANCE_PASOS.map((step, idx) => {
                            const stepNum = idx + 1
                            const done = paso > stepNum
                            const current = paso === stepNum
                            return (
                              <li
                                key={step.key}
                                className={`work-pool-avance-track__step${done ? ' is-done' : ''}${current ? ' is-current' : ''}${en_cambios && stepNum === 2 ? ' is-cambios' : ''}`}
                              >
                                <span className="work-pool-avance-track__dot" aria-hidden />
                                <span>{step.label}</span>
                              </li>
                            )
                          })}
                        </ol>

                        {(job.notas_entrega || job.motivo_rechazo) && (
                          <p className="work-pool-avance-job__note">
                            {job.motivo_rechazo
                              ? `Cambios: ${job.motivo_rechazo}`
                              : job.notas_entrega}
                          </p>
                        )}

                        <div className="work-pool-avance-job__actions">
                          {canReview &&
                            (job.estado === 'entregado' || job.estado === 'en_revision') &&
                            onAprobar &&
                            onPedirCambios && (
                              <>
                                <button
                                  type="button"
                                  className="work-pool-module__btn work-pool-module__btn--success"
                                  onClick={() => onAprobar(job)}
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="work-pool-module__btn work-pool-module__btn--warn"
                                  onClick={() => onPedirCambios(job)}
                                >
                                  Pedir cambios
                                </button>
                              </>
                            )}
                          {job.numero_op && onNavigateOp && (
                            <button
                              type="button"
                              className="work-pool-module__btn work-pool-module__btn--ghost"
                              onClick={() => onNavigateOp(job.numero_op!)}
                            >
                              Ver OP
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <p className="work-pool-admin__avances-legend">
        <Activity size={14} aria-hidden /> Se actualiza solo cada 20 s · reloj en vivo arriba.
      </p>
    </section>
  )
}
