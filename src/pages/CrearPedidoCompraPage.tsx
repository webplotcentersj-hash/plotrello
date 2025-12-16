import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PrioridadPedido } from '../types/pedidos'
import './CrearPedidoCompraPage.css'

const CrearPedidoCompraPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, usuario, loading: authLoading } = useAuth()
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    sector_solicitante: '',
    motivo: '',
    observaciones: '',
    prioridad: 'Normal' as PrioridadPedido,
    fecha_entrega_estimada: ''
  })
  const [items, setItems] = useState<Array<{
    codigo_articulo: string
    descripcion: string
    cantidad: string
    unidad: string
    observaciones: string
  }>>([{
    codigo_articulo: '',
    descripcion: '',
    cantidad: '1',
    unidad: 'unidad',
    observaciones: ''
  }])

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras || !usuario) {
      navigate('/compras/dashboard')
      return
    }
  }, [canManageCompras, usuario, navigate, authLoading])

  const handleAgregarItem = () => {
    setItems([...items, {
      codigo_articulo: '',
      descripcion: '',
      cantidad: '1',
      unidad: 'unidad',
      observaciones: ''
    }])
  }

  const handleEliminarItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const nuevosItems = [...items]
    nuevosItems[index] = { ...nuevosItems[index], [field]: value }
    setItems(nuevosItems)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!usuario) {
      alert('No hay usuario autenticado')
      return
    }

    // Validar sector
    if (!formData.sector_solicitante.trim()) {
      alert('Debes seleccionar un sector')
      return
    }

    // Validar que al menos un item tenga descripción y cantidad válida
    const itemsValidos = items.filter(item => {
      const descripcion = item.descripcion.trim()
      const cantidad = parseFloat(item.cantidad)
      return descripcion && cantidad > 0 && !isNaN(cantidad)
    })

    if (itemsValidos.length === 0) {
      alert('Debes agregar al menos un producto con descripción y cantidad válida')
      return
    }

    // Validar que todas las cantidades sean válidas
    const itemsConCantidadInvalida = items.filter(item => {
      const cantidad = parseFloat(item.cantidad)
      return item.descripcion.trim() && (isNaN(cantidad) || cantidad <= 0)
    })

    if (itemsConCantidadInvalida.length > 0) {
      alert('Todas las cantidades deben ser números mayores a 0')
      return
    }

    setSaving(true)
    try {
      const itemsParaEnviar = itemsValidos.map(item => {
        const cantidad = parseFloat(item.cantidad)
        return {
          codigo_articulo: item.codigo_articulo.trim() || undefined,
          descripcion: item.descripcion.trim(),
          cantidad_solicitada: cantidad,
          unidad: item.unidad || 'unidad',
          observaciones: item.observaciones.trim() || undefined
        }
      })

      const response = await apiService.crearPedidoCompra({
        id_solicitante: usuario.id,
        nombre_solicitante: usuario.nombre,
        sector_solicitante: formData.sector_solicitante.trim(),
        motivo: formData.motivo.trim() || undefined,
        observaciones: formData.observaciones.trim() || undefined,
        prioridad: formData.prioridad,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || undefined,
        items: itemsParaEnviar
      })

      if (response.success && response.data) {
        alert(`Pedido creado exitosamente: ${response.data.numero_pedido}`)
        navigate(`/compras/pedidos/${response.data.id}`)
      } else {
        alert(`Error al crear el pedido: ${response.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error creando pedido:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al crear el pedido: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="crear-pedido-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!canManageCompras || !usuario) {
    return (
      <div className="crear-pedido-page">
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
    <div className="crear-pedido-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>➕ Crear Nueva Orden de Compra</h1>
            <p className="subtitle">Solicita productos y materiales para tu sector</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Cancelar
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="pedido-form">
        {/* Información General */}
        <section className="form-section">
          <h2>Información General</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Solicitante</label>
              <input
                type="text"
                value={usuario.nombre}
                disabled
                className="disabled-input"
              />
            </div>
            <div className="form-group">
              <label>Sector</label>
              <select
                value={formData.sector_solicitante}
                onChange={(e) => setFormData({ ...formData, sector_solicitante: e.target.value })}
              >
                <option value="">Selecciona un sector</option>
                <option value="Diseño Gráfico">Diseño Gráfico</option>
                <option value="Taller de Imprenta">Taller de Imprenta</option>
                <option value="Taller Gráfico">Taller Gráfico</option>
                <option value="Instalaciones">Instalaciones</option>
                <option value="Metalúrgica">Metalúrgica</option>
                <option value="Mostrador">Mostrador</option>
                <option value="Caja">Caja</option>
                <option value="Administración">Administración</option>
                <option value="Compras">Compras</option>
              </select>
            </div>
            <div className="form-group">
              <label>Prioridad</label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as PrioridadPedido })}
              >
                <option value="Baja">Baja</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fecha de Entrega Estimada</label>
              <input
                type="date"
                value={formData.fecha_entrega_estimada}
                onChange={(e) => setFormData({ ...formData, fecha_entrega_estimada: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group full-width">
            <label>Motivo del Pedido</label>
            <textarea
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Describe el motivo o necesidad del pedido..."
              rows={3}
            />
          </div>
          <div className="form-group full-width">
            <label>Observaciones</label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>
        </section>

        {/* Items del Pedido */}
        <section className="form-section">
          <div className="section-header">
            <h2>Productos Solicitados</h2>
            <button type="button" className="btn-action" onClick={handleAgregarItem}>
              + Agregar Producto
            </button>
          </div>
          <div className="items-list">
            {items.map((item, index) => (
              <div key={index} className="item-card">
                <div className="item-header">
                  <h3>Producto {index + 1}</h3>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => handleEliminarItem(index)}
                    >
                      × Eliminar
                    </button>
                  )}
                </div>
                <div className="item-form-grid">
                  <div className="form-group">
                    <label>Código de Artículo</label>
                    <input
                      type="text"
                      value={item.codigo_articulo}
                      onChange={(e) => handleItemChange(index, 'codigo_articulo', e.target.value)}
                      placeholder="Código interno (opcional)"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                      placeholder="Descripción del producto"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unidad *</label>
                    <select
                      value={item.unidad}
                      onChange={(e) => handleItemChange(index, 'unidad', e.target.value)}
                      required
                    >
                      <option value="unidad">Unidad</option>
                      <option value="kg">Kilogramo</option>
                      <option value="m">Metro</option>
                      <option value="m2">Metro cuadrado</option>
                      <option value="m3">Metro cúbico</option>
                      <option value="l">Litro</option>
                      <option value="caja">Caja</option>
                      <option value="pack">Pack</option>
                      <option value="rollo">Rollo</option>
                      <option value="hoja">Hoja</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Observaciones</label>
                    <textarea
                      value={item.observaciones}
                      onChange={(e) => handleItemChange(index, 'observaciones', e.target.value)}
                      placeholder="Observaciones sobre este producto..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Acciones */}
        <section className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear Pedido de Compra'}
          </button>
        </section>
      </form>
    </div>
  )
}

export default CrearPedidoCompraPage

