import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { cantidadMaximaVendible } from '../services/commerceCatalogService'
import type { ArticuloEmpresaRecord } from '../types/api'
import {
  getProductosMasVendidos,
  getProductosPorCategoria
} from '../utils/clienteCatalogoProductos'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import ClienteCatalogoProductoModal from '../components/cliente/ClienteCatalogoProductoModal'
import ClienteCatalogoAgregarModal from '../components/cliente/ClienteCatalogoAgregarModal'
import ClienteCatalogoShowcase from '../components/cliente/ClienteCatalogoShowcase'
import ClienteCatalogoRelacionados from '../components/cliente/ClienteCatalogoRelacionados'
import '../components/cliente/ClienteDashboardCatalogoSection.css'
import '../components/cliente/ClienteCatalogoRelacionados.css'
import './ClienteCatalogoPage.css'

const CATEGORIAS_DESTACADAS_MAX = 4

type FiltroCatalogo = 'todos' | 'mas-vendidos' | string

export default function ClienteCatalogoPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [masVendidosIds, setMasVendidosIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartMsg, setCartMsg] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<FiltroCatalogo>('todos')

  const [articuloDetalle, setArticuloDetalle] = useState<ArticuloEmpresaRecord | null>(null)
  const [articuloAgregar, setArticuloAgregar] = useState<ArticuloEmpresaRecord | null>(null)

  const refreshCartCount = useCallback(async () => {
    if (!cliente) return
    const r = await apiService.getCarritoCliente(cliente.id)
    if (r.success && r.data) setCartCount(r.data.cantidad_items)
  }, [cliente])

  const loadArticulos = useCallback(async () => {
    setLoading(true)
    try {
      const [catalogoRes, vendidosRes] = await Promise.all([
        apiService.getCatalogoComercial({ canal: 'portal', limite: 500 }),
        apiService.getArticulosMasVendidosPortal(24)
      ])
      if (catalogoRes.success && catalogoRes.data) {
        setArticulos(catalogoRes.data.items)
      } else {
        setError('Error al cargar catálogo')
      }
      if (vendidosRes.success && vendidosRes.data) {
        setMasVendidosIds(vendidosRes.data)
      }
    } catch {
      setError('Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    void loadArticulos()
    void refreshCartCount()
  }, [cliente, authLoading, navigate, refreshCartCount, loadArticulos])

  const categoriasDestacadas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articulos) {
      if (a.categoria) {
        counts.set(a.categoria, (counts.get(a.categoria) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .slice(0, CATEGORIAS_DESTACADAS_MAX)
      .map(([categoria]) => categoria)
  }, [articulos])

  const masVendidosSet = useMemo(() => new Set(masVendidosIds), [masVendidosIds])

  const mostrarShowcase = !busqueda.trim() && filtroActivo === 'todos'

  const articulosFiltrados = useMemo(() => {
    let lista = articulos.filter((articulo) => {
      const matchBusqueda =
        !busqueda ||
        articulo.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        articulo.descripcion?.toLowerCase().includes(busqueda.toLowerCase())
      return matchBusqueda
    })

    if (filtroActivo === 'mas-vendidos') {
      if (masVendidosIds.length > 0) {
        const orden = new Map(masVendidosIds.map((id, idx) => [id, idx]))
        lista = lista
          .filter((a) => masVendidosSet.has(a.id))
          .sort((a, b) => (orden.get(a.id) ?? 999) - (orden.get(b.id) ?? 999))
      } else {
        lista = [...lista]
          .filter((a) => a.imagen_url)
          .sort((a, b) => (b.precio_base || 0) - (a.precio_base || 0))
          .slice(0, 12)
      }
    } else if (filtroActivo !== 'todos') {
      lista = lista.filter((a) => a.categoria === filtroActivo)
    }

    return lista
  }, [articulos, busqueda, filtroActivo, masVendidosIds, masVendidosSet])

  const sugerenciasCrossSell = useMemo(() => {
    if (
      typeof filtroActivo !== 'string' ||
      filtroActivo === 'todos' ||
      filtroActivo === 'mas-vendidos' ||
      busqueda.trim()
    ) {
      return []
    }
    return getProductosMasVendidos(
      articulos.filter((a) => a.categoria !== filtroActivo),
      masVendidosIds,
      8
    )
  }, [articulos, filtroActivo, masVendidosIds, busqueda])

  const destacadosCategoria = useMemo(() => {
    if (
      typeof filtroActivo !== 'string' ||
      filtroActivo === 'todos' ||
      filtroActivo === 'mas-vendidos'
    ) {
      return []
    }
    return getProductosPorCategoria(articulos, filtroActivo, 10)
  }, [articulos, filtroActivo])

  const abrirDetalle = (articulo: ArticuloEmpresaRecord) => {
    setArticuloDetalle(articulo)
  }

  const abrirAgregar = (articulo: ArticuloEmpresaRecord) => {
    if (cantidadMaximaVendible(articulo) === 0) return
    setArticuloDetalle(null)
    setArticuloAgregar(articulo)
  }

  const onAgregadoAlCarrito = () => {
    if (articuloAgregar) {
      setCartMsg(`${articuloAgregar.nombre} agregado al carrito`)
      setTimeout(() => setCartMsg(''), 2500)
    }
    setArticuloAgregar(null)
    void refreshCartCount()
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-catalogo-page">
      <ClientePageHeader
        eyebrow="Tienda"
        title="Catálogo"
        subtitle="Productos y servicios disponibles para tu pedido"
        actions={
          <>
            <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/carrito')}>
              🛒 Carrito{cartCount > 0 ? ` (${cartCount})` : ''}
            </button>
            <button type="button" className="cliente-btn-primary" onClick={() => navigate('/cliente/nuevo-pedido')}>
              Pedido con brief
            </button>
          </>
        }
      />

      {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}
      {cartMsg && <div className="cliente-page-alert cliente-page-alert--success">{cartMsg}</div>}

      {mostrarShowcase && (
        <ClienteCatalogoShowcase
          articulos={articulos}
          masVendidosIds={masVendidosIds}
          tituloCarrusel="Destacados"
          subtituloCarrusel="Deslizá para explorar el catálogo"
          onProductClick={abrirDetalle}
          onVerMasVendidos={() => setFiltroActivo('mas-vendidos')}
        />
      )}

      <div className="cliente-card filtros-section">
        <div className="search-bar">
          <input
            type="text"
            className="cliente-input search-input"
            placeholder="🔍 Buscar productos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="categorias-filtros" role="tablist" aria-label="Filtros del catálogo">
          <button
            type="button"
            role="tab"
            aria-selected={filtroActivo === 'todos'}
            className={`cliente-page-pill categoria-btn ${filtroActivo === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroActivo('todos')}
          >
            Todos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filtroActivo === 'mas-vendidos'}
            className={`cliente-page-pill categoria-btn categoria-btn--destacado ${filtroActivo === 'mas-vendidos' ? 'active' : ''}`}
            onClick={() => setFiltroActivo('mas-vendidos')}
          >
            ⭐ Más vendidos
          </button>
          {categoriasDestacadas.map((categoria) => (
            <button
              type="button"
              key={categoria}
              role="tab"
              aria-selected={filtroActivo === categoria}
              className={`cliente-page-pill categoria-btn ${filtroActivo === categoria ? 'active' : ''}`}
              onClick={() => setFiltroActivo(categoria)}
            >
              {categoria}
            </button>
          ))}
        </div>
      </div>

      {filtroActivo === 'mas-vendidos' && !busqueda.trim() && (
        <div className="cliente-catalogo-banner cliente-card">
          <strong>⭐ Más vendidos</strong>
          <span>Los productos preferidos por nuestros clientes</span>
        </div>
      )}

      {typeof filtroActivo === 'string' &&
        filtroActivo !== 'todos' &&
        filtroActivo !== 'mas-vendidos' &&
        !busqueda.trim() &&
        destacadosCategoria.length > 0 && (
          <div className="cliente-card cliente-catalogo-categoria-strip">
            <ClienteCatalogoRelacionados
              titulo={`En ${filtroActivo}`}
              productos={destacadosCategoria}
              onProductClick={abrirDetalle}
            />
          </div>
        )}

      {articulosFiltrados.length === 0 ? (
        <div className="cliente-page-empty">
          <p>No se encontraron productos</p>
          {(busqueda || filtroActivo !== 'todos') && (
            <button
              type="button"
              className="cliente-btn-outline"
              onClick={() => {
                setBusqueda('')
                setFiltroActivo('todos')
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="resultados-info">
            <p>
              {articulosFiltrados.length} producto{articulosFiltrados.length !== 1 ? 's' : ''}
              {filtroActivo === 'mas-vendidos' ? ' más vendidos' : ''}
              {typeof filtroActivo === 'string' &&
              filtroActivo !== 'todos' &&
              filtroActivo !== 'mas-vendidos'
                ? ` en ${filtroActivo}`
                : ''}
            </p>
          </div>
          <div className="catalogo-grid">
            {articulosFiltrados.map((articulo) => {
              const sinStock = cantidadMaximaVendible(articulo) === 0
              return (
                <div key={articulo.id} className="cliente-page-card articulo-card">
                  <button
                    type="button"
                    className="articulo-imagen articulo-imagen--clickable"
                    onClick={() => abrirDetalle(articulo)}
                    aria-label={`Ver detalle de ${articulo.nombre}`}
                  >
                    {articulo.imagen_url ? (
                      <img src={articulo.imagen_url} alt={articulo.nombre} />
                    ) : (
                      <span className="articulo-imagen__placeholder">Sin imagen</span>
                    )}
                  </button>
                  <div className="articulo-content">
                    <div className="articulo-header">
                      <h3>{articulo.nombre}</h3>
                      {articulo.categoria && (
                        <span className="articulo-categoria">{articulo.categoria}</span>
                      )}
                    </div>
                    {articulo.descripcion && (
                      <p className="articulo-descripcion articulo-descripcion--truncada">
                        {articulo.descripcion}
                      </p>
                    )}
                    <div className="articulo-footer">
                      <div className="articulo-precio">${articulo.precio_base?.toFixed(2) || '0.00'}</div>
                      {articulo.tiempo_estimado_dias && (
                        <div className="articulo-tiempo">
                          ⏱️ {articulo.tiempo_estimado_dias} día
                          {articulo.tiempo_estimado_dias !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    {cantidadMaximaVendible(articulo) != null && (
                      <p className="articulo-stock-hint">
                        {sinStock ? 'Sin stock' : `Disponible: hasta ${cantidadMaximaVendible(articulo)} u.`}
                      </p>
                    )}
                    <button
                      type="button"
                      className="cliente-btn-primary btn-agregar"
                      disabled={sinStock}
                      onClick={() => abrirAgregar(articulo)}
                    >
                      Agregar al carrito
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {sugerenciasCrossSell.length > 0 && (
            <div className="cliente-card cliente-catalogo-cross-sell">
              <ClienteCatalogoRelacionados
                titulo="También te puede interesar"
                productos={sugerenciasCrossSell}
                onProductClick={abrirDetalle}
              />
            </div>
          )}
        </>
      )}

      {articuloDetalle && (
        <ClienteCatalogoProductoModal
          articulo={articuloDetalle}
          catalogo={articulos}
          masVendidosIds={masVendidosIds}
          onClose={() => setArticuloDetalle(null)}
          onAgregar={() => abrirAgregar(articuloDetalle)}
          onVerProducto={(a) => setArticuloDetalle(a)}
          sinStock={cantidadMaximaVendible(articuloDetalle) === 0}
        />
      )}

      {articuloAgregar && cliente && (
        <ClienteCatalogoAgregarModal
          articulo={articuloAgregar}
          clienteId={cliente.id}
          onClose={() => setArticuloAgregar(null)}
          onConfirmado={onAgregadoAlCarrito}
        />
      )}
    </ClientePageLayout>
  )
}
