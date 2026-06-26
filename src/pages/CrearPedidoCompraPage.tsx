import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PrioridadPedido, Proveedor, ArticuloStock } from '../types/pedidos'
import SeleccionarProductoStockModal from '../components/SeleccionarProductoStockModal'
import jsPDF from 'jspdf'
import './CrearPedidoCompraPage.css'

const CrearPedidoCompraPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, usuario, nombreVisible, loading: authLoading } = useAuth()
  const [saving, setSaving] = useState(false)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loadingProveedores, setLoadingProveedores] = useState(false)
  const [formData, setFormData] = useState({
    sector_solicitante: '',
    id_proveedor: '',
    motivo: '',
    observaciones: '',
    prioridad: 'Normal' as PrioridadPedido,
    fecha_entrega_estimada: ''
  })
  const [items, setItems] = useState<Array<{
    id_articulo_stock?: number
    codigo_articulo: string
    descripcion: string
    cantidad: string
    unidad: string
    observaciones: string
  }>>([{
    id_articulo_stock: undefined,
    codigo_articulo: '',
    descripcion: '',
    cantidad: '1',
    unidad: 'unidad',
    observaciones: ''
  }])
  const [mostrarModalProductos, setMostrarModalProductos] = useState(false)
  const [itemIndexParaAgregar, setItemIndexParaAgregar] = useState<number | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras || !usuario) {
      navigate('/compras/dashboard')
      return
    }
    loadProveedores()
  }, [canManageCompras, usuario, navigate, authLoading])

  const loadProveedores = async () => {
    setLoadingProveedores(true)
    try {
      const response = await apiService.getProveedores()
      if (response.success && response.data) {
        setProveedores(response.data)
      }
    } catch (error) {
      console.error('Error cargando proveedores:', error)
    } finally {
      setLoadingProveedores(false)
    }
  }

  const handleAgregarItem = () => {
    setItemIndexParaAgregar(items.length)
    setMostrarModalProductos(true)
  }

  const handleSeleccionarProducto = (articulo: ArticuloStock) => {
    if (itemIndexParaAgregar !== null) {
      const nuevosItems = [...items]
      if (itemIndexParaAgregar >= items.length) {
        // Agregar nuevo item
        nuevosItems.push({
          id_articulo_stock: articulo.id,
          codigo_articulo: articulo.codigo || '',
          descripcion: articulo.descripcion,
          cantidad: '1',
          unidad: articulo.unidad || 'unidad',
          observaciones: ''
        })
      } else {
        // Actualizar item existente
        nuevosItems[itemIndexParaAgregar] = {
          ...nuevosItems[itemIndexParaAgregar],
          id_articulo_stock: articulo.id,
          codigo_articulo: articulo.codigo || '',
          descripcion: articulo.descripcion,
          unidad: articulo.unidad || nuevosItems[itemIndexParaAgregar].unidad
        }
      }
      setItems(nuevosItems)
      setItemIndexParaAgregar(null)
    }
  }

  const handleBuscarProducto = (index: number) => {
    setItemIndexParaAgregar(index)
    setMostrarModalProductos(true)
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

    // Validar proveedor
    if (!formData.id_proveedor) {
      alert('Debes seleccionar un proveedor externo')
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
          id_articulo_stock: item.id_articulo_stock,
          codigo_articulo: item.codigo_articulo.trim() || undefined,
          descripcion: item.descripcion.trim(),
          cantidad_solicitada: cantidad,
          unidad: item.unidad || 'unidad',
          observaciones: item.observaciones.trim() || undefined
        }
      })

      const response = await apiService.crearPedidoCompra({
        id_solicitante: usuario.id,
        nombre_solicitante: nombreVisible,
        sector_solicitante: formData.sector_solicitante.trim(),
        id_proveedor: parseInt(formData.id_proveedor),
        motivo: formData.motivo.trim() || undefined,
        observaciones: formData.observaciones.trim() || undefined,
        prioridad: formData.prioridad,
        fecha_entrega_estimada: formData.fecha_entrega_estimada || undefined,
        items: itemsParaEnviar
      })

      if (response.success && response.data) {
        // Descargar PDF resumen del pedido (solo en esta pantalla)
        try {
          const pedido: any = response.data
          const proveedorSeleccionado = proveedores.find(
            (p) => p.id === parseInt(formData.id_proveedor)
          )

          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          const pageWidth = pdf.internal.pageSize.getWidth()
          const marginX = 14
          let y = 16

          const addLine = (text: string, size = 11, spacing = 6) => {
            pdf.setFontSize(size)
            const lines = pdf.splitTextToSize(text, pageWidth - marginX * 2)
            pdf.text(lines, marginX, y)
            y += lines.length * spacing
          }

          pdf.setFont('helvetica', 'bold')
          addLine('Pedido a Proveedor Externo', 16, 7)
          pdf.setFont('helvetica', 'normal')
          addLine(`N° Pedido: ${pedido?.numero_pedido || pedido?.numero || pedido?.id || ''}`, 12, 6)
          addLine(`Fecha: ${new Date().toLocaleString('es-AR')}`, 11, 6)
          addLine(`Solicitante: ${nombreVisible}`, 11, 6)
          addLine(`Sector: ${formData.sector_solicitante}`, 11, 6)
          addLine(`Proveedor: ${proveedorSeleccionado?.nombre || ''}`, 11, 6)
          if (proveedorSeleccionado?.razon_social) addLine(`Razón social: ${proveedorSeleccionado.razon_social}`, 11, 6)
          addLine(`Prioridad: ${formData.prioridad}`, 11, 6)
          if (formData.fecha_entrega_estimada) addLine(`Entrega estimada: ${formData.fecha_entrega_estimada}`, 11, 6)
          if (formData.motivo.trim()) addLine(`Motivo: ${formData.motivo.trim()}`, 11, 6)
          if (formData.observaciones.trim()) addLine(`Observaciones: ${formData.observaciones.trim()}`, 11, 6)

          y += 2
          pdf.setDrawColor(255, 255, 255)
          pdf.setLineWidth(0.2)
          pdf.line(marginX, y, pageWidth - marginX, y)
          y += 8

          pdf.setFont('helvetica', 'bold')
          addLine('Productos solicitados', 13, 6)
          pdf.setFont('helvetica', 'normal')

          const ensureSpace = (needed = 10) => {
            const pageHeight = pdf.internal.pageSize.getHeight()
            if (y + needed > pageHeight - 14) {
              pdf.addPage()
              y = 16
            }
          }

          itemsParaEnviar.forEach((it: any, idx: number) => {
            ensureSpace(14)
            const cantidadStr = `${it.cantidad_solicitada} ${it.unidad || ''}`.trim()
            const codigoStr = it.codigo_articulo ? ` (${it.codigo_articulo})` : ''
            addLine(`${idx + 1}. ${it.descripcion}${codigoStr}`, 11, 6)
            addLine(`Cantidad: ${cantidadStr}`, 10, 5)
            if (it.observaciones) addLine(`Obs: ${it.observaciones}`, 10, 5)
            y += 2
          })

          const numero = String(pedido?.numero_pedido || pedido?.numero || pedido?.id || 'pedido')
          const proveedorNombre = (proveedorSeleccionado?.nombre || 'proveedor')
            .toString()
            .replace(/[^\w\d]+/g, '_')
            .slice(0, 40)
          pdf.save(`Pedido_${numero}_${proveedorNombre}.pdf`)
        } catch (err) {
          console.error('No se pudo generar el PDF del pedido:', err)
        }

        alert(`Pedido a proveedor externo creado: ${response.data.numero_pedido}`)
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
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando...</p>
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
            <h1>➕ Crear Pedido a Proveedor Externo</h1>
            <p className="subtitle">Genera un pedido para enviar a un proveedor externo</p>
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
          <h2>📦 Pedido a Proveedor Externo</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Solicitante</label>
              <input
                type="text"
                value={nombreVisible}
                disabled
                className="disabled-input"
              />
            </div>
            <div className="form-group">
              <label>Proveedor (Externo) *</label>
              <select
                value={formData.id_proveedor}
                onChange={(e) => setFormData({ ...formData, id_proveedor: e.target.value })}
                required
                disabled={loadingProveedores}
              >
                <option value="">Selecciona un proveedor</option>
                {proveedores.map(proveedor => (
                  <option key={proveedor.id} value={proveedor.id.toString()}>
                    {proveedor.nombre} {proveedor.razon_social ? `(${proveedor.razon_social})` : ''}
                  </option>
                ))}
              </select>
              {loadingProveedores && <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Cargando proveedores...</small>}
              {proveedores.length === 0 && !loadingProveedores && (
                <small style={{ color: 'var(--warning)', display: 'block', marginTop: '4px' }}>
                  ⚠️ No hay proveedores registrados. <a href="/compras/proveedores" style={{ color: 'var(--brand)' }}>Crear proveedor</a>
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Sector Solicitante *</label>
              <select
                value={formData.sector_solicitante}
                onChange={(e) => setFormData({ ...formData, sector_solicitante: e.target.value })}
                required
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
            <button type="button" className="btn-action btn-agregar-producto" onClick={handleAgregarItem}>
              <span className="btn-icon">📦</span>
              <span>Agregar del Stock</span>
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={item.codigo_articulo}
                        onChange={(e) => handleItemChange(index, 'codigo_articulo', e.target.value)}
                        placeholder="Código interno"
                        readOnly={!!item.id_articulo_stock}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn-buscar-producto"
                        onClick={() => handleBuscarProducto(index)}
                        title="Buscar producto del stock"
                      >
                        🔍
                      </button>
                    </div>
                  </div>
                  <div className="form-group full-width">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                      placeholder="Descripción del producto"
                      required
                      minLength={3}
                      readOnly={!!item.id_articulo_stock}
                    />
                    {item.id_articulo_stock && (
                      <small style={{ color: 'var(--success)', display: 'block', marginTop: '4px' }}>
                        ✓ Producto del stock
                      </small>
                    )}
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
            {saving ? 'Creando...' : 'Crear Pedido a Proveedor Externo'}
          </button>
        </section>
      </form>

      {mostrarModalProductos && (
        <SeleccionarProductoStockModal
          onClose={() => {
            setMostrarModalProductos(false)
            setItemIndexParaAgregar(null)
          }}
          onSelect={handleSeleccionarProducto}
        />
      )}
    </div>
  )
}

export default CrearPedidoCompraPage

