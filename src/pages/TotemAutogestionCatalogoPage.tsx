import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
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

  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  const [cart, setCart] = useState(() => readTotemCart())
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    void (async () => {
      const r = await apiService.getArticulosEmpresa(true)
      if (r.success && r.data) {
        setArticulos(r.data)
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

  const handleAdd = (articulo: ArticuloEmpresaRecord) => {
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
                  <div className="totem-cat-card-bottom">
                    <div className="totem-cat-price">${a.precio_base?.toFixed(2) || '0.00'}</div>
                    <button type="button" className="totem-cat-add" onClick={() => handleAdd(a)}>
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
                        onClick={() =>
                          setCart((prev) => ({
                            items: setItemCantidad(prev.items, it.id_articulo, (it.cantidad || 1) - 1),
                            updatedAt: Date.now()
                          }))
                        }
                        disabled={(it.cantidad || 1) <= 1}
                      >
                        −
                      </button>
                      <div className="totem-cat-qty">{it.cantidad}</div>
                      <button
                        type="button"
                        className="totem-cat-qty-btn"
                        onClick={() =>
                          setCart((prev) => ({
                            items: setItemCantidad(prev.items, it.id_articulo, (it.cantidad || 1) + 1),
                            updatedAt: Date.now()
                          }))
                        }
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

