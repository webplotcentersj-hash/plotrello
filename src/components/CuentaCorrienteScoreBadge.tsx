import {
  CC_SCORE_NIVEL_LABELS,
  type CcScoreNivel
} from '../constants/cuentaCorrienteScoring'
import './CuentaCorrienteScoreBadge.css'

type Props = {
  score: number | null | undefined
  nivel?: CcScoreNivel | string | null
  compact?: boolean
  onClick?: () => void
}

export default function CuentaCorrienteScoreBadge({ score, nivel, compact, onClick }: Props) {
  const n = score != null && nivel && nivel in CC_SCORE_NIVEL_LABELS ? (nivel as CcScoreNivel) : null
  const titulo = n ? CC_SCORE_NIVEL_LABELS[n] : 'Sin calcular'
  const label = score != null ? String(score) : '—'
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`cc-score-badge cc-score-badge--${n ?? 'sin'}${compact ? ' cc-score-badge--compact' : ''}`}
      onClick={onClick}
      title={titulo}
    >
      <span className="cc-score-badge__num">{label}</span>
      {!compact && <span className="cc-score-badge__lbl">{titulo}</span>}
    </Tag>
  )
}
