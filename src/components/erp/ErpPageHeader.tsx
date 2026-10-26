import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  icon: string
  titulo: string
  subtitulo: string
  volverA: string
  volverTexto: string
  children?: ReactNode
}

/** Encabezado común de las pantallas contables avanzadas. */
export default function ErpPageHeader({ icon, titulo, subtitulo, volverA, volverTexto, children }: Props) {
  const navigate = useNavigate()
  return (
    <div className="erp-section-header erpx-noprint">
      <div>
        <h1>
          {icon} {titulo}
        </h1>
        <p className="erp-section-sub">{subtitulo}</p>
      </div>
      <div className="erp-section-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate(volverA)}>
          ← {volverTexto}
        </button>
        {children}
      </div>
    </div>
  )
}
