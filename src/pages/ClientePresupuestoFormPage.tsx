import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord, PresupuestoClienteRecord } from '../types/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClientePresupuestoFormPage.css'

interface PresupuestoItem {
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  descripcion_personalizada?: string
  nombre_articulo?: string
}

export default function ClientePresupuestoFormPage() {
  const { id } = useParams<{ id: string }>()
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [items, setItems] = useState<PresupuestoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [presupuestoExistente, setPresupuestoExistente] = useState<PresupuestoClienteRecord | null>(null)

  const [formData, setFormData] = useState({
    fecha_vencimiento: '',
    observaciones_cliente: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadArticulos()
    if (id && id !== 'nuevo') {
      loadPresupuesto()
    }
  }, [cliente, authLoading, navigate, id])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getArticulosEmpresa(true)
      if (response.success && response.data) {
        setArticulos(response.data)
      } else {
        setError('Error al cargar catálogo')
      }
    } catch (err) {
      setError('Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }

  const loadPresupuesto = async () => {
    if (!id || id === 'nuevo') return
    
    setLoading(true)
    try {
      const response = await apiService.getDetallePresupuestoCliente(parseInt(id))
      if (response.success && response.data) {
        setPresupuestoExistente(response.data.presupuesto as any)
        setItems(response.data.items.map((item: any) => ({
          id_articulo: item.id_articulo,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_total,
          descripcion_personalizada: item.descripcion_personalizada,
          nombre_articulo: item.articulo?.nombre
        })))
        setFormData({
          fecha_vencimiento: response.data.presupuesto.fecha_vencimiento || '',
          observaciones_cliente: response.data.presupuesto.observaciones_cliente || ''
        })
      } else {
        setError('Error al cargar presupuesto')
      }
    } catch (err) {
      setError('Error al cargar presupuesto')
    } finally {
      setLoading(false)
    }
  }

  const agregarArticulo = (articulo: ArticuloEmpresaRecord) => {
    const nuevoItem: PresupuestoItem = {
      id_articulo: articulo.id,
      cantidad: 1,
      precio_unitario: articulo.precio_base || 0,
      precio_total: articulo.precio_base || 0,
      nombre_articulo: articulo.nombre
    }
    setItems([...items, nuevoItem])
  }

  const actualizarItem = (index: number, campo: keyof PresupuestoItem, valor: any) => {
    const nuevosItems = [...items]
    
    // No permitir modificar precio_unitario - siempre usar el precio del artículo
    if (campo === 'precio_unitario') {
      return // Ignorar cambios al precio unitario
    }
    
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor }
    
    // Recalcular precio_total si cambia cantidad
    if (campo === 'cantidad') {
      nuevosItems[index].precio_total = nuevosItems[index].cantidad * nuevosItems[index].precio_unitario
    }
    
    setItems(nuevosItems)
  }

  const eliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calcularTotal = () => {
    return items.reduce((sum, item) => sum + item.precio_total, 0)
  }

  const handleGuardarBorrador = async () => {
    if (!cliente?.id) return
    if (items.length === 0) {
      alert('Debes agregar al menos un artículo')
      return
    }

    setSaving(true)
    setError('')
    try {
      let response
      if (presupuestoExistente) {
        // Actualizar presupuesto existente
        response = await apiService.actualizarPresupuestoCliente(presupuestoExistente.id, {
          items: items,
          fecha_vencimiento: formData.fecha_vencimiento || undefined,
          observaciones_cliente: formData.observaciones_cliente || undefined,
          estado: 'borrador'
        })
      } else {
        // Crear nuevo presupuesto
        response = await apiService.crearPresupuestoCliente({
          id_cliente: cliente.id,
          items: items,
          fecha_vencimiento: formData.fecha_vencimiento || undefined,
          observaciones_cliente: formData.observaciones_cliente || undefined,
          estado: 'borrador'
        })
      }

      if (response.success) {
        alert('Presupuesto guardado como borrador')
        navigate('/cliente/presupuestos')
      } else {
        setError(response.error || 'Error al guardar presupuesto')
      }
    } catch (err) {
      setError('Error al guardar presupuesto')
    } finally {
      setSaving(false)
    }
  }

  const handleEnviar = async () => {
    if (!cliente?.id) return
    if (items.length === 0) {
      alert('Debes agregar al menos un artículo')
      return
    }

    if (!confirm('¿Estás seguro de enviar este presupuesto a la empresa? Una vez enviado no podrás editarlo.')) {
      return
    }

    setSaving(true)
    setError('')
    try {
      let response
      if (presupuestoExistente) {
        // Actualizar y enviar presupuesto existente
        response = await apiService.actualizarPresupuestoCliente(presupuestoExistente.id, {
          items: items,
          fecha_vencimiento: formData.fecha_vencimiento || undefined,
          observaciones_cliente: formData.observaciones_cliente || undefined,
          estado: 'enviado'
        })
      } else {
        // Crear y enviar nuevo presupuesto
        response = await apiService.crearPresupuestoCliente({
          id_cliente: cliente.id,
          items: items,
          fecha_vencimiento: formData.fecha_vencimiento || undefined,
          observaciones_cliente: formData.observaciones_cliente || undefined,
          estado: 'enviado'
        })
      }

      if (response.success) {
        alert('Presupuesto enviado exitosamente')
        navigate('/cliente/presupuestos')
      } else {
        setError(response.error || 'Error al enviar presupuesto')
      }
    } catch (err) {
      setError('Error al enviar presupuesto')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  const puedeEditar = !presupuestoExistente || presupuestoExistente.estado === 'borrador'

  return (
    <ClientePageLayout className="cliente-presupuesto-form-page">
      <ClientePageHeader
        eyebrow="Cotizaciones"
        title={presupuestoExistente ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        subtitle="Armá tu solicitud de cotización"
        actions={
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/presupuestos')}>
            ← Presupuestos
          </button>
        }
      />

      <div className="cliente-presupuesto-form-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {presupuestoExistente && presupuestoExistente.estado !== 'borrador' && (
          <div className="info-message">
            Este presupuesto ya fue enviado y no puede ser editado. Estado: {presupuestoExistente.estado}
          </div>
        )}

        {/* Sección: Artículos */}
        <section className="form-section">
          <h2>📦 Artículos</h2>
          <div className="catalogo-grid">
            {articulos.map((articulo) => (
              <div key={articulo.id} className="articulo-card">
                <div className="articulo-info">
                  <h3>{articulo.nombre}</h3>
                  {articulo.descripcion && <p>{articulo.descripcion}</p>}
                  <div className="articulo-precio">
                    ${articulo.precio_base?.toFixed(2) || '0.00'}
                  </div>
                </div>
                {puedeEditar && (
                  <button
                    type="button"
                    className="btn-agregar"
                    onClick={() => agregarArticulo(articulo)}
                  >
                    + Agregar
                  </button>
                )}
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="items-list">
              <h3>Artículos seleccionados</h3>
              {items.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="item-info">
                    <strong>{item.nombre_articulo}</strong>
                    {puedeEditar && (
                      <textarea
                        className="item-descripcion"
                        placeholder="Descripción personalizada..."
                        value={item.descripcion_personalizada || ''}
                        onChange={(e) => actualizarItem(index, 'descripcion_personalizada', e.target.value)}
                      />
                    )}
                    {!puedeEditar && item.descripcion_personalizada && (
                      <p className="item-descripcion-readonly">{item.descripcion_personalizada}</p>
                    )}
                  </div>
                  <div className="item-cantidad">
                    <label>Cantidad:</label>
                    {puedeEditar ? (
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(index, 'cantidad', parseInt(e.target.value) || 1)}
                      />
                    ) : (
                      <span>{item.cantidad}</span>
                    )}
                  </div>
                  <div className="item-precio">
                    <label>Precio unitario:</label>
                    <span className="precio-readonly">${item.precio_unitario.toFixed(2)}</span>
                  </div>
                  <div className="item-total">
                    <strong>${item.precio_total.toFixed(2)}</strong>
                  </div>
                  {puedeEditar && (
                    <button
                      type="button"
                      className="btn-eliminar"
                      onClick={() => eliminarItem(index)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="total-presupuesto">
                <strong>Total: ${calcularTotal().toFixed(2)}</strong>
              </div>
            </div>
          )}
        </section>

        {/* Sección: Información adicional */}
        {puedeEditar && (
          <section className="form-section">
            <h2>📋 Información Adicional</h2>
            <div className="form-group">
              <label>Fecha de vencimiento del presupuesto:</label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Observaciones:</label>
              <textarea
                value={formData.observaciones_cliente}
                onChange={(e) => setFormData({ ...formData, observaciones_cliente: e.target.value })}
                placeholder="Información adicional sobre tu presupuesto..."
                rows={4}
              />
            </div>
          </section>
        )}

        {/* Botones de acción */}
        {puedeEditar && (
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleGuardarBorrador}
              disabled={saving || items.length === 0}
            >
              {saving ? 'Guardando...' : '💾 Guardar Borrador'}
            </button>
            <button
              type="button"
              className="cliente-btn-primary"
              onClick={handleEnviar}
              disabled={saving || items.length === 0}
            >
              {saving ? 'Enviando...' : '📤 Enviar a la Empresa'}
            </button>
          </div>
        )}
      </div>
    </ClientePageLayout>
  )
}

