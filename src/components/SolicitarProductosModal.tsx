import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ArticuloStock, PrioridadPedido } from '../types/pedidos'
import './SolicitarProductosModal.css'

type SolicitarProductosModalProps = {
  onClose: () => void
  onSuccess?: () => void
}

type ItemSolicitud = {
  id_articulo_stock?: number
  codigo_articulo?: string
  descripcion: string
  cantidad_solicitada: number
  unidad: string
  observaciones?: string
}

const SolicitarProductosModal = ({ onClose, onSuccess }: SolicitarProductosModalProps) => {
  const { usuario } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [articulos, setArticulos] = useState<ArticuloStock[]>([])
  const [buscando, setBuscando] = useState(false)
  const [items, setItems] = useState<ItemSolicitud[]>([])
  const [prioridad, setPrioridad] = useState<PrioridadPedido>('Normal')
  const [motivo, setMotivo] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
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
      const response = await apiService.getArticulosStock(busqueda.trim())
      if (response.success && response.data) {
        setArticulos(response.data)
      }
    } catch (error) {
      console.error('Error buscando artículos:', error)
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
      }
    } catch (error) {
      console.error('Error cargando artículos con stock bajo:', error)
    } finally {
      setBuscando(false)
    }
  }

  const agregarArticulo = (articulo: ArticuloStock) => {
    // Verificar si ya está agregado
    if (items.some(item => item.id_articulo_stock === articulo.id)) {
      alert('Este artículo ya está en la lista')
      return
    }

    const nuevoItem: ItemSolicitud = {
      id_articulo_stock: articulo.id,
      codigo_articulo: articulo.codigo || undefined,
      descripcion: articulo.descripcion,
      cantidad_solicitada: 1,
      unidad: articulo.unidad || 'unidad',
      observaciones: articulo.stock !== null && articulo.stock <= 0 ? 'Stock agotado' : undefined
    }

    setItems([...items, nuevoItem])
    setBusqueda('')
    setArticulos([])
  }

  const agregarArticuloManual = () => {
    if (!busqueda.trim()) {
      alert('Ingresa una descripción para el producto')
      return
    }

    const nuevoItem: ItemSolicitud = {
      descripcion: busqueda.trim(),
      cantidad_solicitada: 1,
      unidad: 'unidad'
    }

    setItems([...items, nuevoItem])
    setBusqueda('')
    setArticulos([])
  }

  const eliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const actualizarItem = (index: number, campo: keyof ItemSolicitud, valor: any) => {
    const nuevosItems = [...items]
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor }
    setItems(nuevosItems)
  }

  const handleSubmit = async () => {
    if (!usuario) {
      alert('No hay usuario autenticado')
      return
    }

    if (items.length === 0) {
      alert('Agrega al menos un producto a la solicitud')
      return
    }

    if (!motivo.trim()) {
      alert('Por favor, indica el motivo de la solicitud')
      return
    }

    setSaving(true)
    try {
      // Obtener el sector del usuario desde localStorage o usar un valor por defecto
      const usuarioData = localStorage.getItem('usuario')
      let sectorSolicitante = ''
      if (usuarioData) {
        try {
          const usuarioObj = JSON.parse(usuarioData)
          // Mapear roles a sectores
          const sectorMap: Record<string, string> = {
            'diseno': 'Diseño Gráfico',
            'imprenta': 'Taller de Imprenta',
            'taller-grafico': 'Taller Gráfico',
            'instalaciones': 'Instalaciones',
            'metalurgica': 'Metalúrgica',
            'mostrador': 'Mostrador',
            'caja': 'Caja',
            'administracion': 'Administración',
            'gerencia': 'Gerencia'
          }
          sectorSolicitante = sectorMap[usuarioObj.rol] || ''
        } catch (e) {
          console.error('Error parseando usuario:', e)
        }
      }

      const response = await apiService.crearPedidoCompra({
        id_solicitante: usuario.id,
        nombre_solicitante: usuario.nombre,
        sector_solicitante: sectorSolicitante,
        prioridad,
        motivo: motivo.trim(),
        observaciones: observaciones.trim() || undefined,
        items
      })

      if (response.success) {
        alert('Pedido de compra creado exitosamente')
        onSuccess?.()
        onClose()
      } else {
        alert(`Error al crear pedido: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando pedido:', error)
      alert('Error al crear el pedido de compra')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="solicitar-productos-modal-overlay" onClick={onClose}>
      <div className="solicitar-productos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🛒 Solicitar Productos Faltantes</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Búsqueda de Artículos */}
          <section className="busqueda-section">
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
                  placeholder="Buscar producto por código o descripción..."
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
                  }
                }}
              >
                {mostrarStockBajo ? 'Ocultar' : 'Mostrar'} Stock Bajo
              </button>
            </div>

            {/* Lista de Artículos Encontrados */}
            {articulos.length > 0 && (
              <div className="articulos-list">
                {articulos.map((articulo) => (
                  <div
                    key={articulo.id}
                    className="articulo-item"
                    onClick={() => agregarArticulo(articulo)}
                  >
                    <div className="articulo-info">
                      <strong>{articulo.descripcion}</strong>
                      {articulo.codigo && (
                        <span className="articulo-codigo">Código: {articulo.codigo}</span>
                      )}
                    </div>
                    <div className="articulo-stock">
                      <span className={`stock-badge ${articulo.stock === null ? 'sin-stock' : articulo.stock <= 0 ? 'agotado' : articulo.stock <= 10 ? 'bajo' : 'ok'}`}>
                        {articulo.stock === null ? 'Sin stock' : articulo.stock <= 0 ? 'Agotado' : `Stock: ${articulo.stock}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botón para agregar manualmente */}
            {busqueda.trim() && articulos.length === 0 && !buscando && (
              <button
                type="button"
                className="btn-link"
                onClick={agregarArticuloManual}
              >
                + Agregar "{busqueda}" manualmente
              </button>
            )}
          </section>

          {/* Items Agregados */}
          {items.length > 0 && (
            <section className="items-section">
              <h3>Productos a Solicitar ({items.length})</h3>
              <div className="items-list">
                {items.map((item, index) => (
                  <div key={index} className="item-card">
                    <div className="item-header">
                      <strong>{item.descripcion}</strong>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => eliminarItem(index)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="item-fields">
                      <div className="field-group">
                        <label>Cantidad:</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.cantidad_solicitada}
                          onChange={(e) => actualizarItem(index, 'cantidad_solicitada', parseFloat(e.target.value) || 0)}
                          className="field-input"
                        />
                      </div>
                      <div className="field-group">
                        <label>Unidad:</label>
                        <input
                          type="text"
                          value={item.unidad}
                          onChange={(e) => actualizarItem(index, 'unidad', e.target.value)}
                          className="field-input"
                          placeholder="unidad"
                        />
                      </div>
                    </div>
                    {item.observaciones && (
                      <div className="item-observaciones">
                        <small>{item.observaciones}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Información del Pedido */}
          <section className="info-section">
            <div className="form-group">
              <label>Prioridad: *</label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as PrioridadPedido)}
                className="form-select"
              >
                <option value="Baja">Baja</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label>Motivo de la Solicitud: *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Stock agotado, nuevo proyecto, reposición..."
                rows={3}
                className="form-textarea"
              />
            </div>
            <div className="form-group">
              <label>Observaciones Adicionales:</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Información adicional sobre la solicitud..."
                rows={2}
                className="form-textarea"
              />
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving || items.length === 0 || !motivo.trim()}
          >
            {saving ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SolicitarProductosModal

