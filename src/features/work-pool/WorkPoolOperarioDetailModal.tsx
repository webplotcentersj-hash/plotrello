import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_ESTADO_LABELS } from '../../types/workPool'
import type { WorkPoolOperarioRecommendation } from './workPoolOperarioRecommendations'
import { loadOperarioWorkPoolDetail, type WorkPoolOperarioDetail } from './workPoolRepository'

const RANK_MEDAL = ['🥇', '🥈', '🥉']

type Props = {
  rec: WorkPoolOperarioRecommendation
  sector: WorkPoolSector
  selected: boolean
  onClose: () => void
  onSelect: () => void
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function estadoLabel(estado: string) {
  return WORK_POOL_ESTADO_LABELS[estado as keyof typeof WORK_POOL_ESTADO_LABELS] ?? estado
}

export default function WorkPoolOperarioDetailModal({
  rec,
  sector,
  selected,
  onClose,
  onSelect
}: Props) {
  const [detail, setDetail] = useState<WorkPoolOperarioDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const medal = rec.rank <= 3 ? RANK_MEDAL[rec.rank - 1] : `#${rec.rank}`

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadOperarioWorkPoolDetail({
      idUsuario: rec.id_usuario,
      nombre: rec.nombre,
      sector
    }).then((res) => {
      setLoading(false)
      if (res.success && res.data) setDetail(res.data)
      else setError(res.error ?? 'No se pudo cargar el perfil.')
    })
  }, [rec.id_usuario, rec.nombre, sector])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const initials = rec.nombre
    .split(/[@.\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return createPortal(
    <div className="work-pool-op-modal" role="dialog" aria-modal="true" aria-label={`Perfil de ${rec.nombre}`}>
      <button type="button" className="work-pool-op-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="work-pool-op-modal__panel">
        <button type="button" className="work-pool-op-modal__close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>

        <header className="work-pool-op-modal__hero">
          <div className="work-pool-op-modal__avatar-wrap">
            {detail?.foto_url ? (
              <img src={detail.foto_url} alt="" className="work-pool-op-modal__avatar" />
            ) : (
              <span className="work-pool-op-modal__avatar work-pool-op-modal__avatar--fallback">{initials}</span>
            )}
            <span className="work-pool-op-modal__rank-badge" aria-hidden>
              {medal}
            </span>
          </div>
          <div className="work-pool-op-modal__hero-copy">
            <p className="work-pool-op-modal__kicker">Operario · {rec.stats.categoria_detectada}</p>
            <h3>{rec.nombre}</h3>
            {detail?.legajo_sector ? <span className="work-pool-op-modal__sector">{detail.legajo_sector}</span> : null}
            <div className="work-pool-op-modal__match-row">
              <div className="work-pool-op-modal__match-bar" aria-hidden>
                <i style={{ width: `${Math.max(8, rec.matchPercent)}%` }} />
              </div>
              <strong>{rec.matchPercent}% match</strong>
            </div>
          </div>
        </header>

        <div className="work-pool-op-modal__kpis">
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
            <small>Acreditado</small>
            <strong>{detail ? formatArs(detail.acreditado) : '—'}</strong>
          </div>
          <div>
            <small>Saldo pend.</small>
            <strong>{detail ? formatArs(detail.saldo_pendiente) : '—'}</strong>
          </div>
        </div>

        {rec.badges.length > 0 && (
          <div className="work-pool-op-modal__badges">
            {rec.badges.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        )}

        {rec.reasons.length > 0 && (
          <ul className="work-pool-op-modal__reasons">
            {rec.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        <section className="work-pool-op-modal__trabajos">
          <h4>Trabajos recientes</h4>
          {loading ? (
            <p className="work-pool-op-modal__muted">Cargando historial…</p>
          ) : error ? (
            <p className="work-pool-op-modal__error" role="alert">
              {error}
            </p>
          ) : !detail?.trabajos.length ? (
            <p className="work-pool-op-modal__muted">Sin trabajos registrados aún.</p>
          ) : (
            <ul className="work-pool-op-modal__trabajos-list">
              {detail.trabajos.map((t) => (
                <li key={t.id} className={`work-pool-op-modal__trabajo work-pool-op-modal__trabajo--${t.tipo}`}>
                  <div className="work-pool-op-modal__trabajo-icon" aria-hidden>
                    {t.tipo === 'bolsa' ? '✦' : '🎨'}
                  </div>
                  <div className="work-pool-op-modal__trabajo-body">
                    <strong>{t.titulo}</strong>
                    {t.subtitulo ? <span>{t.subtitulo}</span> : null}
                    <div className="work-pool-op-modal__trabajo-meta">
                      <span>{estadoLabel(t.estado)}</span>
                      <span>{formatFecha(t.fecha)}</span>
                      {t.monto != null && t.monto > 0 ? <span>{formatArs(t.monto)}</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="work-pool-op-modal__footer">
          <button type="button" className="work-pool-module__btn" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--primary"
            onClick={() => {
              onSelect()
              onClose()
            }}
          >
            {selected ? 'Ya elegido' : 'Elegir operario'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
