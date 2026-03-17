import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { ArticuloStock } from '../types/pedidos'
import './SeleccionarProductoStockModal.css'

interface SeleccionarProductoStockModalProps {
  onClose: () => void
  onSelect: (articulo: ArticuloStock) => void
}

const SeleccionarProductoStockModal = ({ onClose, onSelect }: SeleccionarProductoStockModalProps) => {
  const [busqueda, setBusqueda] = useState('')
  const [articulos, setArticulos] = useState<ArticuloStock[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarStockBajo, setMostrarStockBajo] = useState(false)

  useEffect(() => {
    if (mostrarStockBajo) {
      loadArticulosStockBajo()
    }
  }, [mostrarStockBajo])

  const buscarArticulos = async () => {
    if (!busqueda.trim() || busqueda.trim().length < 2) {
      setArticulos([])
      return
    }

    setBuscando(true)
    try {
      const response = await apiService.getArticulosStock(busqueda.trim(), false)
      if (response.success && response.data) {
        setArticulos(response.data)
      } else {
        console.error('Error buscando artículos:', response.error)
        setArticulos([])
      }
    } catch (error) {
      console.error('Error buscando artículos:', error)
      setArticulos([])
    } finally {
      setBuscando(false)
    }
  }

  const loadArticulosStockBajo = async () => {
    setBuscando(true)
    try {
      const response = await apiService.getArticulosStock(undefined, true)
      if (response.success && response.data) {
        setArticulos(response.data)
      } else {
        console.error('Error cargando artículos con stock bajo:', response.error)
        setArticulos([])
      }
    } catch (error) {
      console.error('Error cargando artículos con stock bajo:', error)
      setArticulos([])
    } finally {
      setBuscando(false)
    }
  }

  const handleSelect = (articulo: ArticuloStock) => {
    onSelect(articulo)
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content seleccionar-producto-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 Seleccionar Producto del Stock</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="busqueda-controls">
            <div className="busqueda-input-group">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  if (e.target.value.trim().length >= 2) {
                    buscarArticulos()
                  } else {
                    setArticulos([])
                  }
                }}
                placeholder="Buscar por código o descripción (mínimo 2 caracteres)..."
                className="busqueda-input"
              />
              {buscando && <div className="spinner-small"></div>}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMostrarStockBajo(!mostrarStockBajo)
                if (!mostrarStockBajo) {
                  loadArticulosStockBajo()
                } else {
                  setArticulos([])
                  setBusqueda('')
                }
              }}
            >
              {mostrarStockBajo ? 'Ocultar' : 'Mostrar'} Stock Bajo
            </button>
          </div>

          {articulos.length > 0 ? (
            <div className="articulos-list">
              {articulos.map((articulo) => (
                <div
                  key={articulo.id}
                  className="articulo-item"
                  onClick={() => handleSelect(articulo)}
                >
                  <div className="articulo-info">
                    <div className="articulo-header">
                      <span className="articulo-descripcion">{articulo.descripcion}</span>
                      {articulo.codigo && (
                        <span className="articulo-codigo">Código: {articulo.codigo}</span>
                      )}
                    </div>
                    <div className="articulo-details">
                      <span className={`stock-badge ${(articulo.stock ?? 0) <= 0 ? 'sin-stock' : (articulo.stock ?? 0) <= (articulo.stock_minimo ?? 0) ? 'stock-bajo' : 'stock-ok'}`}>
                        Stock: {articulo.stock ?? 0} {articulo.unidad || 'unidad'}
                      </span>
                      {articulo.precio && (
                        <span className="articulo-precio">${articulo.precio.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <button className="btn-select-producto">Seleccionar</button>
                </div>
              ))}
            </div>
          ) : busqueda.trim().length >= 2 && !buscando ? (
            <div className="no-results">
              <p>No se encontraron productos</p>
            </div>
          ) : !mostrarStockBajo && busqueda.trim().length < 2 ? (
            <div className="no-results">
              <p>Escribe al menos 2 caracteres para buscar productos</p>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default SeleccionarProductoStockModal

