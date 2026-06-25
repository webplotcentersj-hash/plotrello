import { useEffect, useMemo, useRef } from 'react'
import type { ArticuloEmpresaRecord } from '../../types/api'
import {
  getProductosDestacados,
  getProductosMasVendidos
} from '../../utils/clienteCatalogoProductos'
import './ClienteDashboardCatalogoSection.css'

const AUTO_SCROLL_MS = 4500

type Props = {
  articulos: ArticuloEmpresaRecord[]
  masVendidosIds: number[]
  onProductClick: (articulo: ArticuloEmpresaRecord) => void
  onVerMasVendidos?: () => void
  tituloCarrusel?: string
  subtituloCarrusel?: string
  ocultarMasVendidos?: boolean
}

export default function ClienteCatalogoShowcase({
  articulos,
  masVendidosIds,
  onProductClick,
  onVerMasVendidos,
  tituloCarrusel = 'Destacados',
  subtituloCarrusel = 'Explorá nuestros productos y servicios',
  ocultarMasVendidos = false
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pauseAutoRef = useRef(false)

  const destacados = useMemo(() => getProductosDestacados(articulos, 14), [articulos])
  const masVendidos = useMemo(
    () => getProductosMasVendidos(articulos, masVendidosIds, 8),
    [articulos, masVendidosIds]
  )

  const scrollTrack = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const step = Math.min(el.clientWidth * 0.85, 320)
    const atStart = el.scrollLeft <= 4
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8

    if (dir > 0 && atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    if (dir < 0 && atStart) {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
      return
    }
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  useEffect(() => {
    if (destacados.length < 2) return

    const id = window.setInterval(() => {
      if (pauseAutoRef.current) return
      scrollTrack(1)
    }, AUTO_SCROLL_MS)

    return () => window.clearInterval(id)
  }, [destacados.length])

  if (articulos.length === 0) return null

  return (
    <>
      <section className="cliente-dash-catalogo cliente-card" aria-label={tituloCarrusel}>
        <div className="cliente-dash-catalogo__head">
          <div>
            <h2>{tituloCarrusel}</h2>
            <p className="section-desc">{subtituloCarrusel}</p>
          </div>
        </div>

        <div
          className="cliente-dash-catalogo__track-wrap"
          onMouseEnter={() => {
            pauseAutoRef.current = true
          }}
          onMouseLeave={() => {
            pauseAutoRef.current = false
          }}
        >
          <div className="cliente-dash-catalogo__track" ref={trackRef}>
            {destacados.map((a) => (
              <button
                key={a.id}
                type="button"
                className="cliente-dash-producto-slide"
                onClick={() => onProductClick(a)}
              >
                <div className="cliente-dash-producto-slide__img">
                  {a.imagen_url ? <img src={a.imagen_url} alt="" /> : <span>Sin imagen</span>}
                </div>
                <div className="cliente-dash-producto-slide__body">
                  <strong>{a.nombre}</strong>
                  <span>${a.precio_base?.toFixed(2) || '0.00'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {!ocultarMasVendidos && masVendidos.length > 0 && (
        <section className="cliente-dash-mas-vendidos cliente-card" aria-label="Productos más vendidos">
          <div className="cliente-dash-catalogo__head">
            <div>
              <h2>Productos más vendidos</h2>
              <p className="section-desc">Los favoritos de nuestros clientes</p>
            </div>
            {onVerMasVendidos && (
              <button type="button" className="cliente-catalogo-link-btn" onClick={onVerMasVendidos}>
                Ver todos
              </button>
            )}
          </div>
          <div className="cliente-dash-mas-vendidos__grid">
            {masVendidos.map((a) => (
              <button
                key={a.id}
                type="button"
                className="cliente-dash-producto-card"
                onClick={() => onProductClick(a)}
              >
                <div className="cliente-dash-producto-card__img">
                  {a.imagen_url ? <img src={a.imagen_url} alt="" /> : <span>—</span>}
                </div>
                <div className="cliente-dash-producto-card__body">
                  <strong>{a.nombre}</strong>
                  <span>${a.precio_base?.toFixed(2) || '0.00'}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
