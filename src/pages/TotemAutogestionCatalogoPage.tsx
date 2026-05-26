import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './TotemAutogestionCatalogoPage.css'

export default function TotemAutogestionCatalogoPage() {
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [cartHint, setCartHint] = useState<string>('')

  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  const [cart, setCart] = useState(() => readTotemCart())
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    void (async () => {
      const r = await apiService.getCatalogoComercial({ canal: 'totem', limite: 500 })
      if (r.success && r.data) {
        setArticulos(r.data.items)
      } else {
        setError(r.error || 'Error al cargar catálogo')
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    writeTotemCart(cart)
  }, [cart])

  const categorias = useMemo(
    () => Array.from(new Set(articulos.map((a) => a.categoria).filter(Boolean))) as string[],
    [articulos]
  )

  const articulosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return articulos.filter((a) => {
      const matchBusqueda =
        !q ||
        a.nombre.toLowerCase().includes(q) ||
        (a.descripcion ? a.descripcion.toLowerCase().includes(q) : false)
      const matchCategoria = !categoriaFiltro || a.categoria === categoriaFiltro
      return matchBusqueda && matchCategoria
    })
  }, [articulos, busqueda, categoriaFiltro])

  const itemsCount = cartItemCount(cart.items)
  const total = cartTotal(cart.items)

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
    <TotemAutogestionKioskShell>
    <div className="totem-cat-page">
      <header className="totem-cat-header">
        <div className="totem-cat-title">
          <button type="button" className="totem-cat-back" onClick={() => navigate('/totem/autogestion')}>
            ← Inicio
          </button>
          <h1>Catálogo</h1>
          <p>Mismo catálogo que el Portal de Clientes.</p>
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
            placeholder="Buscar productos…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
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
        ) : articulosFiltrados.length === 0 ? (
          <div className="totem-cat-empty">
            <p>No se encontraron productos.</p>
            {busqueda && (
              <button type="button" className="totem-cat-secondary" onClick={() => setBusqueda('')}>
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="totem-cat-grid">
            {articulosFiltrados.map((a) => (
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
                  {cantidadMaximaVendible(a) != null && (
                    <p className="totem-cat-stock">
                      Stock: {cantidadMaximaVendible(a) === 0 ? 'agotado' : `hasta ${cantidadMaximaVendible(a)} u.`}
                    </p>
                  )}
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
        )}
      </main>

      <footer className="totem-cat-footer">
        <div className="totem-cat-summary">
          <span>{itemsCount} ítem{itemsCount === 1 ? '' : 's'}</span>
          <strong>${total.toFixed(2)}</strong>
        </div>
        <button type="button" className="totem-cat-primary" onClick={goCheckout} disabled={itemsCount === 0}>
          Continuar
        </button>
      </footer>

      {cartOpen && (
        <div className="totem-cat-modal" role="presentation" onClick={() => setCartOpen(false)}>
          <div className="totem-cat-modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="totem-cat-modal-head">
              <h2>Carrito</h2>
              <button type="button" className="totem-cat-close" onClick={() => setCartOpen(false)} aria-label="Cerrar">
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
                      <div className="totem-cat-cart-name">{it.nombre_articulo ?? `Artículo #${it.id_articulo}`}</div>
                      <div className="totem-cat-cart-sub">
                        ${Number(it.precio_unitario || 0).toFixed(2)} c/u · ${Number(it.precio_total || 0).toFixed(2)}
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
                          setCart((prev) => ({ items: removeItem(prev.items, it.id_articulo), updatedAt: Date.now() }))
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
                Total: <strong>${total.toFixed(2)}</strong>
              </div>
              <button type="button" className="totem-cat-primary" onClick={goCheckout} disabled={itemsCount === 0}>
                Ir a confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </TotemAutogestionKioskShell>
  )
}

