import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import apiService from '../services/api'
import type { FacturaItemRecord, FacturaVentaRecord } from '../types/api'
import './CrearFacturaPage.css'

type NotaTipo = 'credito' | 'debito'

const mapNotaTipo = (tipoOriginal: FacturaVentaRecord['tipo_comprobante'], nota: NotaTipo): FacturaVentaRecord['tipo_comprobante'] => {
  if (tipoOriginal.includes('Factura A')) return nota === 'credito' ? 'Nota de Crédito A' : 'Nota de Débito A'
  if (tipoOriginal.includes('Factura C')) return nota === 'credito' ? 'Nota de Crédito C' : 'Nota de Débito C'
  return nota === 'credito' ? 'Nota de Crédito B' : 'Nota de Débito B'
}

export default function CrearNotaPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()

  const notaTipo = (searchParams.get('tipo') as NotaTipo) || 'credito'
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [facturaOrigen, setFacturaOrigen] = useState<(FacturaVentaRecord & { items?: FacturaItemRecord[] }) | null>(null)
  const [formData, setFormData] = useState({
    fecha_emision: todayStr,
    fecha_vencimiento: '',
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
    if (!id) return
    setLoading(true)
    void apiService
      .getFactura(Number(id))
      .then((r) => {
        if (r.success && r.data) {
          const f = r.data as any
          setFacturaOrigen(f)
          const baseItems = Array.isArray(f.items) ? (f.items as FacturaItemRecord[]) : []
          setItems(
            baseItems.map((it) => ({
              descripcion: it.descripcion,
              cantidad: Number(it.cantidad || 0) || 1,
              precio_unitario: Math.abs(Number(it.precio_unitario || 0)),
              descuento: Math.abs(Number(it.descuento || 0)),
              iva_porcentaje: Number(it.iva_porcentaje || 21)
            }))
          )
        } else {
          alert('No se pudo cargar la factura origen: ' + (r.error || 'desconocido'))
          navigate('/erp/facturas')
        }
      })
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
        descuento: 0,
        iva_porcentaje: 21
      }
    ])
  }

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const totales = useMemo(() => {
    let subtotal = 0
    let descuentoTotal = 0
    let ivaTotal = 0
    items.forEach((item) => {
      const sub = item.cantidad * item.precio_unitario - item.descuento
      const iva = sub * (item.iva_porcentaje / 100)
      subtotal += sub
      descuentoTotal += item.descuento
      ivaTotal += iva
    })
    return {
      subtotal,
      descuento: descuentoTotal,
      iva: ivaTotal,
      total: subtotal + ivaTotal
    }
  }, [items])

  const handleGuardar = async () => {
    if (!facturaOrigen) return
    if (items.length === 0) {
      alert('Debes agregar al menos un item')
      return
    }
    if (items.some((item) => !item.descripcion || item.precio_unitario <= 0 || item.cantidad <= 0)) {
      alert('Todos los items deben tener descripción y valores válidos')
      return
    }

    const tipoNota = mapNotaTipo(facturaOrigen.tipo_comprobante, notaTipo)

    setSaving(true)
    try {
      const response = await apiService.crearFactura({
        tipo_comprobante: tipoNota,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento || null,
        id_cliente: facturaOrigen.id_cliente || null,
        cliente_nombre: facturaOrigen.cliente_nombre,
        cliente_dni_cuit: facturaOrigen.cliente_dni_cuit || null,
        cliente_direccion: facturaOrigen.cliente_direccion || null,
        cliente_condicion_iva: facturaOrigen.cliente_condicion_iva || null,
        id_op: facturaOrigen.id_op || null,
        numero_op: facturaOrigen.numero_op || null,
        id_venta: facturaOrigen.id_venta || null,
        id_factura_referencia: facturaOrigen.id,
        items,
        observaciones:
          (formData.observaciones?.trim() ? formData.observaciones.trim() + '\n\n' : '') +
          `Ref: ${facturaOrigen.tipo_comprobante} ${facturaOrigen.numero_factura}`
      })

      if (response.success && response.data) {
        alert('Nota creada en borrador. Emitila para impactar contabilidad/IVA.')
        navigate(`/erp/facturas/${(response.data as any).id}`)
      } else {
        alert('Error al crear nota: ' + response.error)
      }
    } catch (e) {
      console.error(e)
      alert('Error al crear nota')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="crear-factura-page">
        <div className="loading">Cargando…</div>
      </div>
    )
  }

  if (!facturaOrigen) {
    return (
      <div className="crear-factura-page">
        <div className="error">Factura origen no encontrada</div>
      </div>
    )
  }

  const titulo = notaTipo === 'credito' ? 'Nueva Nota de Crédito' : 'Nueva Nota de Débito'

  return (
    <div className="crear-factura-page">
      <div className="page-header">
        <h1>{titulo}</h1>
        <button className="btn-secondary" onClick={() => navigate(`/erp/facturas/${facturaOrigen.id}`)}>
          ← Volver
        </button>
      </div>

      <div className="form-sections">
        <div className="form-section">
          <h2>Referencia</h2>
          <div className="info-grid" style={{ marginTop: 10 }}>
            <div className="info-item">
              <label>Comprobante</label>
              <div>
                {facturaOrigen.tipo_comprobante} {facturaOrigen.numero_factura}
              </div>
            </div>
            <div className="info-item">
              <label>Cliente</label>
              <div>{facturaOrigen.cliente_nombre}</div>
            </div>
            <div className="info-item">
              <label>Total original</label>
              <div>${Number(facturaOrigen.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Datos del Comprobante</h2>
          <div className="form-grid">
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
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Observaciones</label>
              <textarea
                value={formData.observaciones}
                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                className="form-input"
                rows={3}
                placeholder="Motivo / detalle de la nota…"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="section-header">
            <h2>Items</h2>
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
                    />
                  </div>
                  <div className="item-field">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleUpdateItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="form-input"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="item-field">
                    <label>Precio Unit.</label>
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
                    <label>Desc.</label>
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
                    <select
                      value={item.iva_porcentaje}
                      onChange={(e) => handleUpdateItem(index, 'iva_porcentaje', parseFloat(e.target.value) || 0)}
                      className="form-input"
                    >
                      <option value={21}>21%</option>
                      <option value={10.5}>10.5%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                  <div className="item-field item-actions">
                    <button className="btn-remove-item" onClick={() => handleRemoveItem(index)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section totales-section">
          <h2>Totales</h2>
          <div className="totales-grid">
            <div className="total-item">
              <span>Subtotal</span>
              <span>${totales.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="total-item">
              <span>IVA</span>
              <span>${totales.iva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="total-item total-final">
              <span>Total</span>
              <span>${totales.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <p className="erp-section-sub" style={{ marginTop: 10 }}>
            {notaTipo === 'credito'
              ? 'Al guardar, los importes se registran como negativos para descontar IVA/Ventas.'
              : 'La nota débito suma montos (se registra positiva).'}
          </p>
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => navigate(`/erp/facturas/${facturaOrigen.id}`)} disabled={saving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar Nota (Borrador)'}
          </button>
        </div>
      </div>
    </div>
  )
}

