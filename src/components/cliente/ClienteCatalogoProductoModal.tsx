import { useEffect, useMemo, useState } from 'react'
import type { ArticuloEmpresaRecord, ArticuloEmpresaImagenRecord } from '../../types/api'
import apiService from '../../services/api'
import { getProductosRelacionados } from '../../utils/clienteCatalogoProductos'
import { useClienteModalLock } from '../../hooks/useClienteModalLock'
import ClienteCatalogoRelacionados from './ClienteCatalogoRelacionados'
import ClienteModalPortal from './ClienteModalPortal'
import './ClienteCatalogoProductoModal.css'

type Props = {
  articulo: ArticuloEmpresaRecord
  catalogo: ArticuloEmpresaRecord[]
  masVendidosIds?: number[]
  onClose: () => void
  onAgregar: () => void
  onVerProducto?: (articulo: ArticuloEmpresaRecord) => void
  agregando?: boolean
  sinStock?: boolean
}

export default function ClienteCatalogoProductoModal({
  articulo,
  catalogo,
  masVendidosIds = [],
  onClose,
  onAgregar,
  onVerProducto,
  agregando,
  sinStock
}: Props) {
  const [galeria, setGaleria] = useState<ArticuloEmpresaImagenRecord[]>([])
  const [imagenActiva, setImagenActiva] = useState(0)
  const [cargandoGaleria, setCargandoGaleria] = useState(true)

  useClienteModalLock(true)

  useEffect(() => {
    let cancel = false
    void (async () => {
      setCargandoGaleria(true)
      const r = await apiService.obtenerImagenesArticuloPortal(articulo.id)
      if (!cancel) {
        setGaleria(r.success && r.data ? r.data : [])
        setCargandoGaleria(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [articulo.id])

  const imagenes = useMemo(() => {
    const urls: string[] = []
    if (articulo.imagen_url) urls.push(articulo.imagen_url)
    for (const img of galeria) {
      if (img.imagen_url && !urls.includes(img.imagen_url)) {
        urls.push(img.imagen_url)
      }
    }
    return urls
  }, [articulo.imagen_url, galeria])

  useEffect(() => {
    setImagenActiva(0)
  }, [articulo.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const imgPrincipal = imagenes[imagenActiva] || null

  const relacionados = useMemo(
    () => getProductosRelacionados(articulo, catalogo, masVendidosIds, 6),
    [articulo, catalogo, masVendidosIds]
  )

  const modal = (
    <div className="ccp-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="ccp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ccp-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ccp-modal__close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="ccp-modal__grid">
          <div className="ccp-modal__media">
            {imgPrincipal ? (
              <img src={imgPrincipal} alt={articulo.nombre} className="ccp-modal__hero" />
            ) : (
              <div className="ccp-modal__hero ccp-modal__hero--empty">Sin imagen</div>
            )}

            {imagenes.length > 1 && (
              <div className="ccp-modal__thumbs" aria-label="Galería de imágenes">
                {imagenes.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    className={`ccp-modal__thumb ${idx === imagenActiva ? 'is-active' : ''}`}
                    onClick={() => setImagenActiva(idx)}
                  >
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}

            {cargandoGaleria && imagenes.length <= 1 && (
              <p className="ccp-modal__galeria-hint">Cargando galería…</p>
            )}
          </div>

          <div className="ccp-modal__info">
            {articulo.categoria && (
              <span className="ccp-modal__categoria">{articulo.categoria}</span>
            )}
            <h2 id="ccp-modal-title">{articulo.nombre}</h2>

            <div className="ccp-modal__precio-row">
              <span className="ccp-modal__precio">
                ${articulo.precio_base?.toFixed(2) || '0.00'}
              </span>
              {articulo.tiempo_estimado_dias ? (
                <span className="ccp-modal__tiempo">
                  ⏱️ {articulo.tiempo_estimado_dias} día
                  {articulo.tiempo_estimado_dias !== 1 ? 's' : ''}
                </span>
              ) : null}
            </div>

            {articulo.descripcion ? (
              <div className="ccp-modal__descripcion">
                <h3>Descripción</h3>
                <p title={articulo.descripcion}>{articulo.descripcion}</p>
              </div>
            ) : (
              <p className="ccp-modal__sin-desc">Sin descripción detallada.</p>
            )}

            <button
              type="button"
              className="cliente-btn-primary ccp-modal__btn-agregar"
              disabled={agregando || sinStock}
              onClick={onAgregar}
            >
              {sinStock ? 'Sin stock' : agregando ? 'Agregando…' : 'Agregar al carrito'}
            </button>
          </div>
        </div>

        {relacionados.length > 0 && onVerProducto && (
          <ClienteCatalogoRelacionados
            productos={relacionados}
            onProductClick={onVerProducto}
            compact
          />
        )}
      </div>
    </div>
  )

  return <ClienteModalPortal>{modal}</ClienteModalPortal>
}
