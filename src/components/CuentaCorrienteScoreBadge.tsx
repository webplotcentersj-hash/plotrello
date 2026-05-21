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
  const n = (nivel ?? 'regular') as CcScoreNivel
  const label = score != null ? String(score) : '—'
  const Tag = onClick ? 'button' : 'span'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`cc-score-badge cc-score-badge--${n}${compact ? ' cc-score-badge--compact' : ''}`}
      onClick={onClick}
      title={CC_SCORE_NIVEL_LABELS[n]}
    >
      <span className="cc-score-badge__num">{label}</span>
      {!compact && <span className="cc-score-badge__lbl">{CC_SCORE_NIVEL_LABELS[n]}</span>}
    </Tag>
  )
}
