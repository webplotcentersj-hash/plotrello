import type { ReactNode } from 'react'
import './ClientePageHeader.css'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  align?: 'center' | 'left'
}

export default function ClientePageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  align = 'left'
}: Props) {
  return (
    <header className={`cliente-page-header cliente-page-header--${align}`}>
      <div className="cliente-page-header-text">
        {eyebrow ? <p className="cliente-eyebrow">{eyebrow}</p> : null}
        <h1 className="cliente-heading-display cliente-page-header-title">{title}</h1>
        {subtitle ? <p className="cliente-page-header-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="cliente-page-header-actions">{actions}</div> : null}
    </header>
  )
}
