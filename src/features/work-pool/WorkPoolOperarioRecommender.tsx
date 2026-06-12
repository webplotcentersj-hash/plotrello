import { useEffect, useMemo, useState } from 'react'
import type { UsuarioRecord } from '../../types/api'
import type { WorkPoolSector } from '../../types/workPool'
import { recommendWorkPoolOperarios } from './workPoolRepository'
import type { WorkPoolOperarioRecommendation } from './workPoolOperarioRecommendations'
import { classifyWorkPoolTask, WORK_POOL_TASK_CATEGORY_LABELS } from './workPoolTaskClassifier'
import WorkPoolOperarioDetailModal from './WorkPoolOperarioDetailModal'

type WorkPoolOperarioRecommenderProps = {
  sector: WorkPoolSector
  candidatos: UsuarioRecord[]
  descripcion: string
  codigoTarifa: string
  empleadoQuery: string
  selectedId: number | ''
  onSelect: (id: number) => void
}

const RANK_MEDAL = ['🥇', '🥈', '🥉']

function trendIcon(t: WorkPoolOperarioRecommendation['stats']['tendencia']) {
  if (t === 'subiendo') return '📈'
  if (t === 'bajando') return '📉'
  return '➡️'
}

export default function WorkPoolOperarioRecommender({
  sector,
  candidatos,
  descripcion,
  codigoTarifa,
  empleadoQuery,
  selectedId,
  onSelect
}: WorkPoolOperarioRecommenderProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<WorkPoolOperarioRecommendation[]>([])
  const [detailRec, setDetailRec] = useState<WorkPoolOperarioRecommendation | null>(null)

  const categoria = useMemo(
    () => WORK_POOL_TASK_CATEGORY_LABELS[classifyWorkPoolTask(descripcion, codigoTarifa || null)],
    [descripcion, codigoTarifa]
  )

  useEffect(() => {
    if (candidatos.length === 0) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    const t = window.setTimeout(() => {
      void recommendWorkPoolOperarios({
        sector,
        candidatos,
        descripcion,
        codigoTarifa: codigoTarifa || null
      }).then((res) => {
        setLoading(false)
        if (res.success && res.data) {
          setItems(res.data)
        } else {
          setItems([])
          setError(res.error ?? 'No se pudieron calcular recomendaciones.')
        }
      })
    }, 400)
    return () => window.clearTimeout(t)
  }, [sector, candidatos, descripcion, codigoTarifa])

  const filtered = useMemo(() => {
    const q = empleadoQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => r.nombre.toLowerCase().includes(q))
  }, [items, empleadoQuery])

  const top = filtered.slice(0, 6)

  return (
    <section className="work-pool-ai-recommender" aria-label="Recomendación inteligente de operarios">
      <header className="work-pool-ai-recommender__head">
        <div className="work-pool-ai-recommender__title-row">
          <span className="work-pool-ai-recommender__spark" aria-hidden>
            ✦
          </span>
          <div>
            <h4>Recomendación inteligente</h4>
            <p>
              Ranking por afinidad con <strong>{categoria}</strong>, volumen del mes, velocidad de entrega y
              carga actual.
            </p>
          </div>
        </div>
        {loading && <span className="work-pool-ai-recommender__loading">Analizando historial…</span>}
      </header>

      {error && (
        <p className="work-pool-ai-recommender__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && top.length === 0 && (
        <p className="work-pool-publicar__muted">No hay operarios para recomendar en este sector.</p>
      )}

      <div className="work-pool-ai-recommender__grid">
        {top.map((rec) => {
          const isSelected = selectedId === rec.id_usuario
          const medal = rec.rank <= 3 ? RANK_MEDAL[rec.rank - 1] : `#${rec.rank}`
          const barWidth = Math.max(8, rec.matchPercent)

          return (
            <article
              key={rec.id_usuario}
              className={`work-pool-ai-recommender__card${isSelected ? ' is-selected' : ''}${rec.rank === 1 ? ' is-top' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setDetailRec(rec)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setDetailRec(rec)
                }
              }}
            >
              <div className="work-pool-ai-recommender__card-top">
                <span className="work-pool-ai-recommender__rank" aria-hidden>
                  {medal}
                </span>
                <div className="work-pool-ai-recommender__identity">
                  <strong>{rec.nombre}</strong>
                  <span className="work-pool-ai-recommender__match">{rec.matchPercent}% match</span>
                </div>
                <button
                  type="button"
                  className="work-pool-ai-recommender__pick"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(rec.id_usuario)
                  }}
                >
                  {isSelected ? 'Elegido' : 'Elegir'}
                </button>
              </div>

              <div className="work-pool-ai-recommender__bar" aria-hidden>
                <i style={{ width: `${barWidth}%` }} />
              </div>

              <div className="work-pool-ai-recommender__stats">
                <div>
                  <small>Similares mes</small>
                  <strong>{rec.stats.mes_similares}</strong>
                </div>
                <div>
                  <small>Total mes</small>
                  <strong>{rec.stats.mes_total}</strong>
                </div>
                <div>
                  <small>Entrega prom.</small>
                  <strong>
                    {rec.stats.entrega_promedio_dias != null
                      ? `${rec.stats.entrega_promedio_dias.toFixed(1)} d`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <small>Express</small>
                  <strong>{rec.stats.entrega_rapida_pct > 0 ? `${rec.stats.entrega_rapida_pct}%` : '—'}</strong>
                </div>
                <div>
                  <small>Aprobados</small>
                  <strong>{rec.stats.aprobados_mes}</strong>
                </div>
                <div>
                  <small>Activos</small>
                  <strong>{rec.stats.activos}</strong>
                </div>
                <div>
                  <small>Mes ant.</small>
                  <strong>{rec.stats.mes_anterior_similares}</strong>
                </div>
                <div>
                  <small>Tipo</small>
                  <strong title={rec.stats.categoria_detectada}>
                    {rec.stats.categoria_detectada.split(' ')[0]}
                  </strong>
                </div>
              </div>

              {rec.badges.length > 0 && (
                <div className="work-pool-ai-recommender__badges">
                  {rec.badges.map((b) => (
                    <span key={b} className="work-pool-ai-recommender__badge">
                      {b}
                    </span>
                  ))}
                  <span className="work-pool-ai-recommender__trend" title="Tendencia mensual">
                    {trendIcon(rec.stats.tendencia)} {rec.stats.tendencia}
                  </span>
                </div>
              )}

              <ul className="work-pool-ai-recommender__reasons">
                {rec.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {detailRec ? (
        <WorkPoolOperarioDetailModal
          rec={detailRec}
          sector={sector}
          selected={selectedId === detailRec.id_usuario}
          onClose={() => setDetailRec(null)}
          onSelect={() => onSelect(detailRec.id_usuario)}
        />
      ) : null}
    </section>
  )
}
