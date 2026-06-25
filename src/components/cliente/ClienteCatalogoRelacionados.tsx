import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ArticuloEmpresaRecord } from '../../types/api'
import './ClienteCatalogoRelacionados.css'

type Props = {
  titulo?: string
  productos: ArticuloEmpresaRecord[]
  onProductClick: (articulo: ArticuloEmpresaRecord) => void
  compact?: boolean
}

export default function ClienteCatalogoRelacionados({
  titulo = 'Productos relacionados',
  productos,
  onProductClick,
  compact = false
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  if (productos.length === 0) return null

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  return (
    <section
      className={`cliente-relacionados${compact ? ' cliente-relacionados--compact' : ''}`}
      aria-label={titulo}
    >
      <div className="cliente-relacionados__head">
        <h3>{titulo}</h3>
        <div className="cliente-relacionados__nav">
          <button type="button" onClick={() => scroll(-1)} aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label="Siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cliente-relacionados__track" ref={trackRef}>
        {productos.map((a) => (
          <button
            key={a.id}
            type="button"
            className="cliente-relacionados__card"
            onClick={() => onProductClick(a)}
          >
            <div className="cliente-relacionados__img">
              {a.imagen_url ? <img src={a.imagen_url} alt="" /> : <span>—</span>}
            </div>
            <span className="cliente-relacionados__nombre">{a.nombre}</span>
            <span className="cliente-relacionados__precio">${a.precio_base?.toFixed(2) || '0.00'}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
