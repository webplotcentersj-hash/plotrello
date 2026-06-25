import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import {
  cantidadMaximaVendible,
  validarCantidadVentaComercial
} from '../services/commerceCatalogService'
import type { ArticuloEmpresaRecord } from '../types/api'
import {
  addArticuloToCart,
  cartItemCount,
  cartTotal,
  readTotemCart,
  removeItem,
  setItemCantidad,
  writeTotemCart
} from './totemAutogestionCart'
import './TotemAutogestionCatalogoPage.css'

/** Mismo catálogo que el portal de clientes (`visible_portal`). */
const CANAL_CATALOGO = 'portal' as const
const BUSQUEDA_DEBOUNCE_MS = 350

type CatalogoLocationState = {
  returnTo?: string
}

export default function TotemAutogestionCatalogoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo =
    (location.state as CatalogoLocationState | null)?.returnTo ?? '/totem/autogestion'

  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [cartHint, setCartHint] = useState<string>('')

  const [busqueda, setBusqueda] = useState('')
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  const [cart, setCart] = useState(() => readTotemCart())
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBusqueda(busqueda.trim()), BUSQUEDA_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    void (async () => {
      const r = await apiService.getCatalogoComercial({ canal: CANAL_CATALOGO, limite: 500 })
      if (r.success && r.data) {
        setCategorias(
          Array.from(new Set(r.data.items.map((a) => a.categoria).filter(Boolean))) as string[]
        )
      }
    })()
  }, [])

  const loadCatalogo = useCallback(async () => {
    setLoading(true)
    setError('')
    const r = await apiService.getCatalogoComercial({
      canal: CANAL_CATALOGO,
      limite: 500,
      busqueda: debouncedBusqueda || undefined,
      categoria: categoriaFiltro || undefined
    })
    if (r.success && r.data) {
      setArticulos(r.data.items)
      setTotal(r.data.total)
    } else {
      setArticulos([])
      setTotal(0)
      setError(r.error || 'Error al cargar catálogo')
    }
    setLoading(false)
  }, [debouncedBusqueda, categoriaFiltro])

  useEffect(() => {
    void loadCatalogo()
  }, [loadCatalogo])

  useEffect(() => {
    writeTotemCart(cart)
  }, [cart])

  const itemsCount = cartItemCount(cart.items)
  const totalCart = cartTotal(cart.items)

  const articuloById = useMemo(() => {
    const m = new Map<number, ArticuloEmpresaRecord>()
    for (const a of articulos) m.set(a.id, a)
    return m
  }, [articulos])

  const trySetCantidad = (id_articulo: number, cantidad: number) => {
    const articulo = articuloById.get(id_articulo)
    if (!articulo) return false
    const v = validarCantidadVentaComercial(articulo, cantidad)
    if (!v.ok) {
      setCartHint(v.error)
      return false
    }
    setCartHint('')
    setCart((prev) => ({
      items: setItemCantidad(prev.items, id_articulo, cantidad),
      updatedAt: Date.now()
    }))
    return true
  }

  const handleAdd = (articulo: ArticuloEmpresaRecord) => {
    const enCarrito = cart.items.find((i) => i.id_articulo === articulo.id)
    const nuevaCantidad = (enCarrito?.cantidad || 0) + 1
    const v = validarCantidadVentaComercial(articulo, nuevaCantidad)
    if (!v.ok) {
      setCartHint(v.error)
      return
    }
    setCartHint('')
    setCart((prev) => ({ items: addArticuloToCart(prev.items, articulo), updatedAt: Date.now() }))
  }

  const goCheckout = () => {
    if (cart.items.length === 0) return
    navigate('/totem/autogestion/checkout')
  }

  return (
    <div className="totem-cat-page">
        <header className="totem-cat-header">
          <div className="totem-cat-title">
            <button type="button" className="totem-cat-back" onClick={() => navigate(returnTo)}>
              ← Volver
            </button>
            <h1>Catálogo</h1>
            <p>Productos y servicios del Portal de Clientes — buscá por nombre, código o categoría.</p>
          </div>

          <button
            type="button"
            className="totem-cat-cart-btn"
            onClick={() => setCartOpen(true)}
            disabled={itemsCount === 0}
            title={itemsCount === 0 ? 'Carrito vacío' : 'Ver carrito'}
          >
            🛒 Carrito ({itemsCount})
          </button>
        </header>

        <main className="totem-cat-main">
          {error && <div className="totem-cat-error">{error}</div>}
          {cartHint && <div className="totem-cat-error totem-cat-error--hint">{cartHint}</div>}

          <div className="totem-cat-filters">
            <input
              className="totem-cat-search"
              type="search"
              placeholder="🔍 Buscar productos…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoComplete="off"
            />
            {categorias.length > 0 && (
              <div className="totem-cat-cats">
                <button
                  type="button"
                  className={`totem-cat-cat ${!categoriaFiltro ? 'active' : ''}`}
                  onClick={() => setCategoriaFiltro('')}
                >
                  Todas
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`totem-cat-cat ${categoriaFiltro === c ? 'active' : ''}`}
                    onClick={() => setCategoriaFiltro(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="totem-cat-loading">Cargando catálogo…</div>
          ) : articulos.length === 0 ? (
            <div className="totem-cat-empty">
              <p>No se encontraron productos.</p>
              {(busqueda || categoriaFiltro) && (
                <button
                  type="button"
                  className="totem-cat-secondary"
                  onClick={() => {
                    setBusqueda('')
                    setCategoriaFiltro('')
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="totem-cat-results">
                {articulos.length} producto{articulos.length !== 1 ? 's' : ''} encontrado
                {articulos.length !== 1 ? 's' : ''}
                {total > articulos.length ? ` de ${total}` : ''}
              </p>
              <div className="totem-cat-grid">
                {articulos.map((a) => (
                  <div key={a.id} className="totem-cat-card">
                    {a.imagen_url ? (
                      <div className="totem-cat-img">
                        <img src={a.imagen_url} alt={a.nombre} loading="lazy" />
                      </div>
                    ) : (
                      <div className="totem-cat-img totem-cat-img--empty" aria-hidden>
                        📦
                      </div>
                    )}
                    <div className="totem-cat-card-body">
                      <div className="totem-cat-card-top">
                        <h3>{a.nombre}</h3>
                        {a.categoria && <span className="totem-cat-pill">{a.categoria}</span>}
                      </div>
                      {a.descripcion && <p className="totem-cat-desc">{a.descripcion}</p>}
                      <div className="totem-cat-card-meta">
                        {a.tiempo_estimado_dias != null && a.tiempo_estimado_dias > 0 && (
                          <span className="totem-cat-time">
                            ⏱️ {a.tiempo_estimado_dias} día{a.tiempo_estimado_dias !== 1 ? 's' : ''}
                          </span>
                        )}
                        {cantidadMaximaVendible(a) != null && (
                          <span className="totem-cat-stock">
                            {cantidadMaximaVendible(a) === 0
                              ? 'Sin stock'
                              : `Hasta ${cantidadMaximaVendible(a)} u.`}
                          </span>
                        )}
                      </div>
                      <div className="totem-cat-card-bottom">
                        <div className="totem-cat-price">${a.precio_base?.toFixed(2) || '0.00'}</div>
                        <button
                          type="button"
                          className="totem-cat-add"
                          onClick={() => handleAdd(a)}
                          disabled={cantidadMaximaVendible(a) === 0}
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        <footer className="totem-cat-footer">
          <div className="totem-cat-summary">
            <span>
              {itemsCount} ítem{itemsCount === 1 ? '' : 's'}
            </span>
            <strong>${totalCart.toFixed(2)}</strong>
          </div>
          <button type="button" className="totem-cat-primary" onClick={goCheckout} disabled={itemsCount === 0}>
            Continuar
          </button>
        </footer>

        {cartOpen && (
          <div className="totem-cat-modal" role="presentation" onClick={() => setCartOpen(false)}>
            <div
              className="totem-cat-modal-card"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="totem-cat-modal-head">
                <h2>Carrito</h2>
                <button
                  type="button"
                  className="totem-cat-close"
                  onClick={() => setCartOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              {cart.items.length === 0 ? (
                <p className="totem-cat-modal-empty">No hay productos todavía.</p>
              ) : (
                <div className="totem-cat-cart-list">
                  {cart.items.map((it) => (
                    <div key={it.id_articulo} className="totem-cat-cart-row">
                      <div className="totem-cat-cart-main">
                        <div className="totem-cat-cart-name">
                          {it.nombre_articulo ?? `Artículo #${it.id_articulo}`}
                        </div>
                        <div className="totem-cat-cart-sub">
                          ${Number(it.precio_unitario || 0).toFixed(2)} c/u · $
                          {Number(it.precio_total || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="totem-cat-cart-actions">
                        <button
                          type="button"
                          className="totem-cat-qty-btn"
                          onClick={() => trySetCantidad(it.id_articulo, (it.cantidad || 1) - 1)}
                          disabled={(it.cantidad || 1) <= 1}
                        >
                          −
                        </button>
                        <div className="totem-cat-qty">{it.cantidad}</div>
                        <button
                          type="button"
                          className="totem-cat-qty-btn"
                          onClick={() => trySetCantidad(it.id_articulo, (it.cantidad || 1) + 1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="totem-cat-remove"
                          onClick={() =>
                            setCart((prev) => ({
                              items: removeItem(prev.items, it.id_articulo),
                              updatedAt: Date.now()
                            }))
                          }
                          aria-label="Quitar"
                          title="Quitar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="totem-cat-modal-foot">
                <div className="totem-cat-modal-total">
                  Total: <strong>${totalCart.toFixed(2)}</strong>
                </div>
                <button
                  type="button"
                  className="totem-cat-primary"
                  onClick={goCheckout}
                  disabled={itemsCount === 0}
                >
                  Ir a confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
