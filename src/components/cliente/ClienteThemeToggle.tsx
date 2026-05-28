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
      role="switch"
      aria-checked={isDark}
      className={[
        'cliente-theme-toggle',
        isDark ? 'is-dark' : '',
        compact ? 'cliente-theme-toggle--compact' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      <Sun className="cliente-theme-toggle__icon cliente-theme-toggle__icon--sun" size={compact ? 15 : 16} strokeWidth={2} aria-hidden />
      <span className="cliente-theme-toggle__track" aria-hidden>
        <span className="cliente-theme-toggle__thumb" />
      </span>
      <Moon className="cliente-theme-toggle__icon cliente-theme-toggle__icon--moon" size={compact ? 15 : 16} strokeWidth={2} aria-hidden />
    </button>
  )
}
