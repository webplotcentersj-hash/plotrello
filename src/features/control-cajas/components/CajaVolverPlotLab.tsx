import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  className?: string
  /** Variante compacta para barras y mensajes de éxito. */
  small?: boolean
  /** Ancho completo en sidebar o barra móvil. */
  block?: boolean
}

export default function CajaVolverPlotLab({ className = '', small = false, block = false }: Props) {
  const navigate = useNavigate()
  const cls = [
    'btn-secondary',
    'caja-cc-back-plotlab',
    small ? 'btn-small' : '',
    block ? 'caja-cc-back-plotlab--block' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={cls}
      onClick={() => navigate('/')}
      title="Volver al tablero principal de PlotLab"
    >
      ← Volver a PlotLab
    </button>
  )
}

/** Mensaje de éxito con acceso rápido al tablero. */
export function CajaMensajeOkPlotLab({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`caja-cc-ok-plotlab-row ${className}`.trim()}>
      <div className="caja-cc-ok-plotlab-msg">{children}</div>
      <CajaVolverPlotLab small />
    </div>
  )
}
