import { useEffect, useRef, useState } from 'react'
import './CcExportMenu.css'

export type CcExportMenuItem = {
  id: string
  label: string
  onClick: () => void
}

type Props = {
  label?: string
  items: CcExportMenuItem[]
  disabled?: boolean
  className?: string
}

export default function CcExportMenu({
  label = 'Descargar',
  items,
  disabled = false,
  className = ''
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className={`cc-export-menu ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="cc-export-menu__trigger cc-btn cc-btn--secondary"
        disabled={disabled || items.length === 0}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="cc-export-menu__caret" aria-hidden />
      </button>
      {open && (
        <ul className="cc-export-menu__list" role="menu">
          {items.map((it) => (
            <li key={it.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="cc-export-menu__item"
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
