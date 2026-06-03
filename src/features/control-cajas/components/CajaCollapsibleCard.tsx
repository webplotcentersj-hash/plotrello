import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  count?: number
  defaultOpen?: boolean
  toolbar?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function CajaCollapsibleCard({
  title,
  count,
  defaultOpen = false,
  toolbar,
  children,
  className = '',
  bodyClassName = ''
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`caja-cc-card caja-cc-card-collapsible${open ? ' is-open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="caja-cc-card-collapsible-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="caja-cc-card-collapsible-chevron" aria-hidden>
          {open ? '▼' : '▶'}
        </span>
        <h3>{title}</h3>
        {count != null && <span className="caja-cc-card-collapsible-badge">{count}</span>}
      </button>
      {open && (
        <div className={`caja-cc-card-collapsible-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          {toolbar}
          {children}
        </div>
      )}
      {!open && count != null && count > 0 && (
        <p className="caja-cc-card-collapsed-hint">
          {count} registro(s) — expandí para buscar y filtrar.
        </p>
      )}
    </div>
  )
}

export function CajaListSearch({
  value,
  onChange,
  placeholder = 'Buscar…',
  className = ''
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={`caja-cc-search caja-cc-search--inline ${className}`.trim()}>
      <span className="caja-cc-search-icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        className="caja-cc-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
