import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo, Venta } from '../types/api'
import './CrearFacturaPage.css'

export default function CrearFacturaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const idOP = searchParams.get('id_op')
  const idVenta = searchParams.get('id_venta')

  const [loading, setLoading] = useState(false)
  const [op, setOP] = useState<OrdenTrabajo | null>(null)
  const [venta, setVenta] = useState<Venta | null>(null)
  const [formData, setFormData] = useState({
    tipo_comprobante: 'Factura B' as 'Factura A' | 'Factura B' | 'Factura C',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    cliente_condicion_iva: '' as '' | 'Responsable Inscripto' | 'Monotributista' | 'Exento' | 'Consumidor Final' | 'No Responsable',
    observaciones: ''
  })
  const [items, setItems] = useState<Array<{
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento: number
    iva_porcentaje: number
  }>>([])

  useEffect(() => {
    if (idOP) {
      loadOP(parseInt(idOP))
    }
    if (idVenta) {
      loadVenta(parseInt(idVenta))
    }
  }, [idOP, idVenta])

  const loadOP = async (opId: number) => {
    try {
      const response = await apiService.getOrden(opId)
      if (response.success && response.data) {
        setOP(response.data)
        // Determinar tipo de comprobante según CUIT
        if (response.data.dni_cuit && response.data.dni_cuit.length === 11) {
          setFormData(prev => ({ ...prev, tipo_comprobante: 'Factura A' }))
        }
      }
    } catch (error) {
      console.error('Error cargando OP:', error)
    }
  }

  const loadVenta = async (ventaId: number) => {
    try {
      const response = await apiService.getVenta(ventaId)
      if (response.success && response.data) {
        setVenta(response.data)
        // Cargar items de la venta
        const itemsResponse = await apiService.getItemsVenta(ventaId)
        if (itemsResponse.success && itemsResponse.data) {
          setItems(itemsResponse.data.map(item => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento: item.descuento || 0,
            iva_porcentaje: 21
          })))
        }
      }
    } catch (error) {
      console.error('Error cargando venta:', error)
    }
  }

  const handleAddItem = () => {
    setItems([...items, {
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      descuento: 0,
      iva_porcentaje: 21
    }])
  }

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calcularTotales = () => {
    let subtotal = 0
    let descuentoTotal = 0
    let ivaTotal = 0

    items.forEach(item => {
      const subtotalItem = (item.cantidad * item.precio_unitario) - item.descuento
      const ivaItem = subtotalItem * (item.iva_porcentaje / 100)
      subtotal += subtotalItem
      descuentoTotal += item.descuento
      ivaTotal += ivaItem
    })

    return {
      subtotal,
      descuento: descuentoTotal,
      iva: ivaTotal,
      total: subtotal + ivaTotal
    }
  }

  const handleGuardar = async () => {
    if (items.length === 0) {
      alert('Debes agregar al menos un item')
      return
    }

    if (items.some(item => !item.descripcion || item.precio_unitario <= 0)) {
      alert('Todos los items deben tener descripción y precio unitario mayor a 0')
      return
    }

    setLoading(true)
    try {
      const clienteNombre = op?.cliente || venta?.cliente_nombre || 'Cliente'
      const clienteDNI = op?.dni_cuit || venta?.cliente_dni_cuit || null
      const clienteDireccion = op?.direccion_cliente || venta?.cliente_direccion || null

      const response = await apiService.crearFactura({
        tipo_comprobante: formData.tipo_comprobante,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        id_cliente: null,
        cliente_nombre: clienteNombre,
        cliente_dni_cuit: clienteDNI,
        cliente_direccion: clienteDireccion,
        cliente_condicion_iva: formData.cliente_condicion_iva || null,
        id_op: op?.id || null,
        numero_op: op?.numero_op || null,
        id_venta: venta?.id || null,
        items: items,
        observaciones: formData.observaciones || null
      })

      if (response.success && response.data) {
        alert('Factura creada correctamente')
        navigate(`/erp/facturas/${response.data.id}`)
      } else {
        alert('Error al crear factura: ' + response.error)
      }
    } catch (error) {
      console.error('Error creando factura:', error)
      alert('Error al crear factura')
    } finally {
      setLoading(false)
    }
  }

  const totales = calcularTotales()

  return (
    <div className="crear-factura-page">
      <div className="page-header">
        <h1>Nueva Factura</h1>
        <button className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
          ← Cancelar
        </button>
      </div>

      <div className="form-sections">
        <div className="form-section">
          <h2>Datos del Comprobante</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo de Comprobante *</label>
              <select
                value={formData.tipo_comprobante}
                onChange={(e) => setFormData({ ...formData, tipo_comprobante: e.target.value as any })}
                className="form-input"
              >
                <option value="Factura A">Factura A</option>
                <option value="Factura B">Factura B</option>
                <option value="Factura C">Factura C</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fecha de Emisión *</label>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Fecha de Vencimiento</label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Condición IVA del Cliente</label>
              <select
                value={formData.cliente_condicion_iva}
                onChange={(e) => setFormData({ ...formData, cliente_condicion_iva: e.target.value as any })}
                className="form-input"
              >
                <option value="">Seleccionar...</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Exento">Exento</option>
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="No Responsable">No Responsable</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2>Items de la Factura</h2>
            <button className="btn-add-item" onClick={handleAddItem}>
              + Agregar Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="empty-items">
              <p>No hay items. Haz clic en "Agregar Item" para comenzar.</p>
            </div>
          ) : (
            <div className="items-list">
              {items.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="item-field">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleUpdateItem(index, 'descripcion', e.target.value)}
                      className="form-input"
                      placeholder="Descripción del producto/servicio"
                    />
                  </div>
                  <div className="item-field">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleUpdateItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0.01"
                      step="0.01"
                    />
                  </div>
                  <div className="item-field">
                    <label>Precio Unitario *</label>
                    <input
                      type="number"
                      value={item.precio_unitario}
                      onChange={(e) => handleUpdateItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="item-field">
                    <label>Descuento</label>
                    <input
                      type="number"
                      value={item.descuento}
                      onChange={(e) => handleUpdateItem(index, 'descuento', parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="item-field">
                    <label>IVA %</label>
                    <input
                      type="number"
                      value={item.iva_porcentaje}
                      onChange={(e) => handleUpdateItem(index, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                  <div className="item-field">
                    <label>Subtotal</label>
                    <div className="item-subtotal">
                      ${((item.cantidad * item.precio_unitario) - item.descuento + ((item.cantidad * item.precio_unitario) - item.descuento) * (item.iva_porcentaje / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <button
                    className="btn-remove-item"
                    onClick={() => handleRemoveItem(index)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section">
          <h2>Totales</h2>
          <div className="totales-preview">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            {totales.descuento > 0 && (
              <div className="total-row">
                <span>Descuento:</span>
                <span>-${totales.descuento.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="total-row">
              <span>IVA:</span>
              <span>${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="total-row total-final">
              <span>Total:</span>
              <span>${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Observaciones</h2>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            className="form-textarea"
            rows={4}
            placeholder="Observaciones adicionales..."
          />
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => navigate('/erp/facturas')}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleGuardar}
            disabled={loading || items.length === 0}
          >
            {loading ? 'Guardando...' : 'Guardar Factura'}
          </button>
        </div>
      </div>
    </div>
  )
}

