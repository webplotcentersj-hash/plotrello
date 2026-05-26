import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { cantidadMaximaVendible } from '../services/commerceCatalogService'
import type { ArticuloEmpresaRecord } from '../types/api'
import './ClienteCatalogoPage.css'

export default function ClienteCatalogoPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartMsg, setCartMsg] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')

  const refreshCartCount = useCallback(async () => {
    if (!cliente) return
    const r = await apiService.getCarritoCliente(cliente.id)
    if (r.success && r.data) setCartCount(r.data.cantidad_items)
  }, [cliente])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadArticulos()
    void refreshCartCount()
  }, [cliente, authLoading, navigate, refreshCartCount])

  const agregarAlCarrito = async (articulo: ArticuloEmpresaRecord) => {
    if (!cliente) return
    setAddingId(articulo.id)
    setCartMsg('')
    setError('')
    const carrito = await apiService.getCarritoCliente(cliente.id)
    const enCarrito = carrito.data?.items.find((i) => i.id_articulo === articulo.id)
    const nuevaCantidad = (enCarrito?.cantidad || 0) + 1
    const r = await apiService.setCarritoItemCliente(cliente.id, articulo.id, nuevaCantidad)
    setAddingId(null)
    if (r.success && r.data) {
      setCartCount(r.data.cantidad_items)
      setCartMsg(`${articulo.nombre} agregado al carrito`)
      setTimeout(() => setCartMsg(''), 2500)
    } else {
      setError(r.error || 'No se pudo agregar')
    }
  }

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getCatalogoComercial({ canal: 'portal', limite: 500 })
      if (response.success && response.data) {
        setArticulos(response.data.items)
      } else {
        setError('Error al cargar catálogo')
      }
    } catch (err) {
      setError('Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }

  const categorias = Array.from(new Set(articulos.map(a => a.categoria).filter(Boolean))) as string[]

  const articulosFiltrados = articulos.filter(articulo => {
    const matchBusqueda = !busqueda || 
      articulo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      articulo.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
    const matchCategoria = !categoriaFiltro || articulo.categoria === categoriaFiltro
    return matchBusqueda && matchCategoria
  })

  if (authLoading || loading) {
    return (
      <div className="cliente-catalogo-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-catalogo-page">
      <header className="cliente-catalogo-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <h1>Catálogo de Productos</h1>
          </div>
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate('/cliente/dashboard')}
            >
              ← Volver
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/cliente/carrito')}
            >
              🛒 Carrito{cartCount > 0 ? ` (${cartCount})` : ''}
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/cliente/nuevo-pedido')}>
              Pedido con brief
            </button>
          </div>
        </div>
      </header>

      <main className="cliente-catalogo-main">
        {error && <div className="error-message">{error}</div>}
        {cartMsg && <div className="cart-toast">{cartMsg}</div>}

        {/* Filtros y Búsqueda */}
        <div className="filtros-section">
          <div className="search-bar">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {categorias.length > 0 && (
            <div className="categorias-filtros">
              <button
                className={`categoria-btn ${!categoriaFiltro ? 'active' : ''}`}
                onClick={() => setCategoriaFiltro('')}
              >
                Todas
              </button>
              {categorias.map((categoria) => (
                <button
                  key={categoria}
                  className={`categoria-btn ${categoriaFiltro === categoria ? 'active' : ''}`}
                  onClick={() => setCategoriaFiltro(categoria)}
                >
                  {categoria}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid de Artículos */}
        {articulosFiltrados.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron productos</p>
            {busqueda && (
              <button 
                className="btn-secondary"
                onClick={() => setBusqueda('')}
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="resultados-info">
              <p>{articulosFiltrados.length} producto{articulosFiltrados.length !== 1 ? 's' : ''} encontrado{articulosFiltrados.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="catalogo-grid">
              {articulosFiltrados.map((articulo) => (
                <div key={articulo.id} className="articulo-card">
                  {articulo.imagen_url && (
                    <div className="articulo-imagen">
                      <img src={articulo.imagen_url} alt={articulo.nombre} />
                    </div>
                  )}
                  <div className="articulo-content">
                    <div className="articulo-header">
                      <h3>{articulo.nombre}</h3>
                      {articulo.categoria && (
                        <span className="articulo-categoria">{articulo.categoria}</span>
                      )}
                    </div>
                    {articulo.descripcion && (
                      <p className="articulo-descripcion">{articulo.descripcion}</p>
                    )}
                    <div className="articulo-footer">
                      <div className="articulo-precio">
                        ${articulo.precio_base?.toFixed(2) || '0.00'}
                      </div>
                      {articulo.tiempo_estimado_dias && (
                        <div className="articulo-tiempo">
                          ⏱️ {articulo.tiempo_estimado_dias} día{articulo.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    {cantidadMaximaVendible(articulo) != null && (
                      <p className="articulo-stock-hint">
                        {cantidadMaximaVendible(articulo) === 0
                          ? 'Sin stock'
                          : `Disponible: hasta ${cantidadMaximaVendible(articulo)} u.`}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn-agregar"
                      disabled={
                        addingId === articulo.id ||
                        cantidadMaximaVendible(articulo) === 0
                      }
                      onClick={() => void agregarAlCarrito(articulo)}
                    >
                      {addingId === articulo.id ? 'Agregando…' : 'Agregar al carrito'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

