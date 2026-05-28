import type { CSSProperties } from 'react'
import '../../styles/clienteStatusBadge.css'

type Props = {
  label: string
  accent: string
  size?: 'sm' | 'md'
  uppercase?: boolean
  className?: string
}

export default function ClienteStatusBadge({
  label,
  accent,
  size = 'md',
  uppercase = false,
  className = ''
}: Props) {
  const style = { '--badge-accent': accent } as CSSProperties

  return (
    <span
      className={[
        'cliente-status-badge',
        size === 'sm' ? 'cliente-status-badge--sm' : '',
        uppercase ? 'cliente-status-badge--uppercase' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <span className="cliente-status-badge__dot" aria-hidden />
      <span className="cliente-status-badge__text">{label}</span>
    </span>
  )
}
