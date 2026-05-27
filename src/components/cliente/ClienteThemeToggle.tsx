import { Moon, Sun } from 'lucide-react'
import { useClienteTheme } from '../../hooks/useClienteTheme'
import './ClienteThemeToggle.css'

type Props = {
  className?: string
  compact?: boolean
}

export default function ClienteThemeToggle({ className = '', compact = false }: Props) {
  const { isDark, toggle } = useClienteTheme()

  return (
    <button
      type="button"
      className={`cliente-theme-toggle ${compact ? 'cliente-theme-toggle--compact' : ''} ${className}`.trim()}
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <span className="cliente-theme-toggle__track" aria-hidden>
        <span className={`cliente-theme-toggle__thumb ${isDark ? 'is-dark' : ''}`}>
          {isDark ? <Moon size={14} strokeWidth={2.25} /> : <Sun size={14} strokeWidth={2.25} />}
        </span>
      </span>
      {!compact && <span className="cliente-theme-toggle__label">{isDark ? 'Oscuro' : 'Claro'}</span>}
    </button>
  )
}
