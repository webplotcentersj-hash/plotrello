import './BriefMockupCard.css'

type Props = {
  mockupUrl?: string | null
  alt?: string
  compact?: boolean
  className?: string
}

export default function BriefMockupCard({
  mockupUrl,
  alt = 'Mockup del brief',
  compact = false,
  className = ''
}: Props) {
  if (!mockupUrl?.trim()) {
    return (
      <div className={`brief-mockup-card brief-mockup-card--empty ${compact ? 'brief-mockup-card--compact' : ''} ${className}`.trim()}>
        <span className="brief-mockup-card__placeholder">Sin mockup guardado</span>
      </div>
    )
  }

  return (
    <div className={`brief-mockup-card ${compact ? 'brief-mockup-card--compact' : ''} ${className}`.trim()}>
      <a href={mockupUrl} target="_blank" rel="noopener noreferrer" className="brief-mockup-card__link">
        <img src={mockupUrl} alt={alt} className="brief-mockup-card__img" loading="lazy" />
        <span className="brief-mockup-card__zoom">Ver tamaño completo</span>
      </a>
    </div>
  )
}
