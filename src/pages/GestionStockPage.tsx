import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloStock, Proveedor } from '../types/pedidos'
import './GestionStockPage.css'

const GestionStockPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [articulos, setArticulos] = useState<ArticuloStock[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounce, setBusquedaDebounce] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [articuloEditando, setArticuloEditando] = useState<ArticuloStock | null>(null)
  const [formData, setFormData] = useState({
    codigo: '',
    descripcion: '',
    stock: 0,
    stock_minimo: 0,
    unidad: 'unidad',
    precio: 0,
    categoria: '',
    proveedor: '',
    sector: 'Gral'
  })
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false)
  const [filtroSector, setFiltroSector] = useState<string>('Todos')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loadingProveedores, setLoadingProveedores] = useState(false)
  
  const sectores = ['Todos', 'Gral', 'Imprenta', 'Mostrador', 'Taller', 'Compras']

  useEffect(() => {
    if (authLoading) return
    
    if (!canManageCompras) {
      navigate('/')
      return
    }
    loadArticulos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageCompras, navigate, authLoading, mostrarStockBajo, filtroSector, busquedaDebounce])

  // Debounce para la búsqueda - espera 500ms después de que el usuario deje de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounce(busqueda)
    }, 500)

    return () => clearTimeout(timer)
  }, [busqueda])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const sectorFiltro = filtroSector === 'Todos' ? undefined : filtroSector
      const response = await apiService.getArticulosStock(
        busquedaDebounce.trim() || undefined,
        mostrarStockBajo,
        sectorFiltro
      )
      if (response.success && response.data) {
        setArticulos(response.data)
      } else {
        console.error('Error cargando artículos:', response.error)
        alert(`Error al cargar artículos: ${response.error}`)
        setArticulos([])
      }
    } catch (error) {
      console.error('Error cargando artículos:', error)
      alert(`Error al cargar artículos: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      setArticulos([])
    } finally {
      setLoading(false)
    }
  }

  const loadProveedores = async () => {
    setLoadingProveedores(true)
    try {
      const response = await apiService.getProveedores(true) // Solo activos
      if (response.success && response.data) {
        setProveedores(response.data)
      }
    } catch (error) {
      console.error('Error cargando proveedores:', error)
    } finally {
      setLoadingProveedores(false)
    }
  }

  const abrirModalNuevo = () => {
    setArticuloEditando(null)
    setFormData({
      codigo: '',
      descripcion: '',
      stock: 0,
      stock_minimo: 0,
      unidad: 'unidad',
      precio: 0,
      categoria: '',
      proveedor: '',
      sector: 'Gral'
    })
    loadProveedores()
    setMostrarModal(true)
  }

  const abrirModalEditar = (articulo: ArticuloStock) => {
    setArticuloEditando(articulo)
    setFormData({
      codigo: articulo.codigo || '',
      descripcion: articulo.descripcion,
      stock: articulo.stock || 0,
      stock_minimo: articulo.stock_minimo || 0,
      unidad: articulo.unidad || 'unidad',
      precio: articulo.precio || 0,
      categoria: articulo.categoria || '',
      proveedor: articulo.proveedor || '',
      sector: articulo.sector || 'Gral'
    })
    loadProveedores()
    setMostrarModal(true)
  }

  const cerrarModal = () => {
    setMostrarModal(false)
    setArticuloEditando(null)
  }

  const handleGuardar = async () => {
    if (!formData.descripcion.trim()) {
      alert('La descripción es obligatoria')
      return
    }

    try {
      if (articuloEditando) {
        // Actualizar artículo existente
        const response = await apiService.actualizarArticuloStock(articuloEditando.id, formData)
        if (response.success) {
          alert('Artículo actualizado exitosamente')
          cerrarModal()
          loadArticulos()
        } else {
          alert(`Error: ${response.error}`)
        }
      } else {
        // Crear nuevo artículo
        const response = await apiService.crearArticuloStock(formData)
        if (response.success) {
          alert('Artículo creado exitosamente')
          cerrarModal()
          loadArticulos()
        } else {
          alert(`Error: ${response.error}`)
        }
      }
    } catch (error) {
      console.error('Error guardando artículo:', error)
      alert('Error al guardar el artículo')
    }
  }

  const handleAjustarStock = async (articulo: ArticuloStock, nuevoStock: number | null) => {
    // Convertir null a 0 para cálculos
    const stockValor = nuevoStock !== null && nuevoStock !== undefined ? nuevoStock : 0
    
    if (stockValor < 0) {
      alert('El stock no puede ser negativo')
      return
    }

    const cantidadAnterior = articulo.stock !== null && articulo.stock !== undefined ? articulo.stock : 0
    const diferencia = stockValor - cantidadAnterior
    const tipoMovimiento = diferencia > 0 ? 'Entrada' : diferencia < 0 ? 'Salida' : 'Ajuste'

    try {
      // Actualizar stock - asegurar que sea un número
      const response = await apiService.actualizarArticuloStock(articulo.id, {
        stock: stockValor
      })

      if (response.success) {
        // Registrar movimiento
        await apiService.registrarMovimientoStock({
          id_articulo_stock: articulo.id,
          codigo_articulo: articulo.codigo || undefined,
          descripcion: articulo.descripcion,
          tipo_movimiento: tipoMovimiento,
          cantidad: Math.abs(diferencia),
          cantidad_anterior: cantidadAnterior,
          cantidad_nueva: stockValor,
          motivo: 'Ajuste manual de stock'
        })

        alert('Stock ajustado exitosamente')
        loadArticulos()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error ajustando stock:', error)
      alert('Error al ajustar el stock')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="gestion-stock-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="gestion-stock-page">
        <div className="error-container">
          <p>No tienes permiso para acceder a esta página.</p>
          <button className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="gestion-stock-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>📦 Gestión de Stock</h1>
            <p className="subtitle">Administrar inventario y artículos</p>
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={abrirModalNuevo}>
              + Nuevo Artículo
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/compras/dashboard')}
            >
              ← Volver
            </button>
          </div>
        </div>
      </header>

      {/* Filtros y Búsqueda */}
      <section className="filters-section">
        <div className="filters-grid">
          <div className="search-group">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="search-input"
            />
            {busquedaDebounce !== busqueda && (
              <span className="search-indicator">Buscando...</span>
            )}
          </div>
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={mostrarStockBajo}
                onChange={(e) => setMostrarStockBajo(e.target.checked)}
              />
              Solo Stock Bajo/Agotado
            </label>
          </div>
        </div>
        
        {/* Filtros de Sector */}
        <div className="sector-filters">
          <h3 className="sector-filters-title">Filtrar por Sector:</h3>
          <div className="sector-buttons">
            {sectores.map((sector) => (
              <button
                key={sector}
                className={`sector-btn ${filtroSector === sector ? 'active' : ''}`}
                onClick={() => setFiltroSector(sector)}
              >
                {sector === 'Todos' && '📦'}
                {sector === 'Gral' && '📁'}
                {sector === 'Imprenta' && '🖨️'}
                {sector === 'Mostrador' && '🖥️'}
                {sector === 'Taller' && '🔧'}
                {sector === 'Compras' && '🛒'}
                {sector}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tabla de Artículos */}
      <section className="articulos-section">
        <h2>Artículos ({articulos.length})</h2>
        {articulos.length === 0 ? (
          <div className="empty-state">
            <p>No hay artículos para mostrar</p>
          </div>
        ) : (
          <div className="articulos-table">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Stock</th>
                  <th>Stock Mínimo</th>
                  <th>Unidad</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articulos.map((articulo) => {
                  const stockActual = articulo.stock !== null && articulo.stock !== undefined ? articulo.stock : 0
                  const stockMinimo = articulo.stock_minimo !== null && articulo.stock_minimo !== undefined ? articulo.stock_minimo : 0
                  const estadoStock =
                    stockActual === 0 || stockActual === null
                      ? 'agotado'
                      : stockMinimo > 0 && stockActual <= stockMinimo
                      ? 'bajo'
                      : 'normal'

                  return (
                    <tr key={articulo.id}>
                      <td>{articulo.codigo || '-'}</td>
                      <td>{articulo.descripcion}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={stockActual}
                          onChange={(e) => {
                            const nuevoValor = e.target.value === '' ? null : parseFloat(e.target.value)
                            if (nuevoValor !== null && !isNaN(nuevoValor)) {
                              handleAjustarStock(articulo, nuevoValor)
                            } else if (nuevoValor === null) {
                              handleAjustarStock(articulo, 0)
                            }
                          }}
                          className="stock-input"
                        />
                      </td>
                      <td>{stockMinimo}</td>
                      <td>{articulo.unidad || 'unidad'}</td>
                      <td>
                        {articulo.precio
                          ? `$${articulo.precio.toFixed(2)}`
                          : '-'}
                      </td>
                      <td>
                        <span className={`stock-badge ${estadoStock}`}>
                          {estadoStock === 'agotado'
                            ? 'Agotado'
                            : estadoStock === 'bajo'
                            ? 'Bajo'
                            : 'Normal'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={() => abrirModalEditar(articulo)}
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de Edición/Creación */}
      {mostrarModal && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{articuloEditando ? 'Editar Artículo' : 'Nuevo Artículo'}</h3>
              <button className="close-button" onClick={cerrarModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Código:</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Código del artículo (opcional)"
                />
              </div>
              <div className="form-group">
                <label>Descripción: *</label>
                <input
                  type="text"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  placeholder="Descripción del artículo"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Stock Actual:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Stock Mínimo:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.stock_minimo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stock_minimo: parseFloat(e.target.value) || 0
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unidad:</label>
                  <input
                    type="text"
                    value={formData.unidad}
                    onChange={(e) => setFormData({ ...formData, unidad: e.target.value })}
                    placeholder="unidad, kg, m, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Precio:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) =>
                      setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Categoría:</label>
                  <input
                    type="text"
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    placeholder="Categoría (opcional)"
                  />
                </div>
                <div className="form-group">
                  <label>Proveedor:</label>
                  {loadingProveedores ? (
                    <input
                      type="text"
                      value="Cargando proveedores..."
                      disabled
                      className="form-select"
                    />
                  ) : (
                    <select
                      value={formData.proveedor}
                      onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                      className="form-select"
                    >
                      <option value="">Seleccionar proveedor (opcional)</option>
                      {proveedores.map((proveedor) => (
                        <option key={proveedor.id} value={proveedor.nombre}>
                          {proveedor.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Sector:</label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="form-select"
                >
                  <option value="Gral">General</option>
                  <option value="Imprenta">Imprenta</option>
                  <option value="Mostrador">Mostrador</option>
                  <option value="Taller">Taller</option>
                  <option value="Compras">Compras</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={cerrarModal}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleGuardar}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GestionStockPage

