import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { validarCantidadVentaComercial } from '../services/commerceCatalogService'
import type { ArticuloEmpresaRecord, TipoIntencionPedido } from '../types/api'
import './ClienteNuevoPedidoPage.css'

const TIPOS_PRODUCTO = [
  'Diseño de una pieza gráfica',
  'Flyer',
  'Banner',
  'Carpetas',
  'Folletos',
  'Agendas',
  'Tarjetas personales',
  'Stickers',
  'Presentación PDF',
  'Packaging',
  'Brochure',
  'Cuaderno',
  'Calendario',
  'Logo',
  'Rediseño de logo existente',
  'Cartelería',
  'Ploteo vehicular',
  'Ploteo de vidrieras/comercios',
  'Señalética',
  'Diseño y desarrollo web. Automatización con IA',
  'No sé bien lo que necesito, quiero asesoramiento'
]

interface PedidoItem {
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  descripcion_personalizada?: string
  nombre_articulo?: string
}

export default function ClienteNuevoPedidoPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [items, setItems] = useState<PedidoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [tipoIntencion, setTipoIntencion] = useState<TipoIntencionPedido>('compra')

  const [formData, setFormData] = useState({
    fecha_limite_deseada: '',
    observaciones_cliente: '',
    es_urgente: false,
    requiere_delivery: false,
    direccion_delivery: '',
    tipo_producto_servicio: [] as string[],
    tipo_producto_otro: '',
    necesita_asesoramiento: false,
    donde_colocados: '',
    digital_o_impresion: '',
    cantidades: '',
    objetivo_proyecto: '',
    material_logo: '',
    material_textos: '',
    material_imagenes: '',
    tiene_referencias: false,
    referencias_links: '',
    brief_publico: '',
    estilo_diseno: '',
    referencias: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadArticulos()
  }, [cliente, authLoading, navigate])

  const loadArticulos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getCatalogoComercial({ canal: 'portal', limite: 500 })
      if (response.success && response.data) {
        setArticulos(response.data.items)
      } else {
        setError('Error al cargar catálogo')
      }

      if (cliente) {
        const carrito = await apiService.getCarritoCliente(cliente.id)
        if (carrito.success && carrito.data?.items.length) {
          setItems(
            carrito.data.items.map((it) => ({
              id_articulo: it.id_articulo,
              cantidad: it.cantidad,
              precio_unitario: it.precio_unitario,
              precio_total: it.precio_total,
              nombre_articulo: it.articulo.nombre
            }))
          )
        }
      }
    } catch (err) {
      setError('Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }

  const handleTipoProductoChange = (tipo: string) => {
    setFormData(prev => {
      const isSelected = prev.tipo_producto_servicio.includes(tipo)
      if (isSelected) {
        return {
          ...prev,
          tipo_producto_servicio: prev.tipo_producto_servicio.filter(t => t !== tipo)
        }
      } else {
        return {
          ...prev,
          tipo_producto_servicio: [...prev.tipo_producto_servicio, tipo]
        }
      }
    })
  }

  const articuloById = (id: number) => articulos.find((a) => a.id === id)

  const agregarArticulo = (articulo: ArticuloEmpresaRecord) => {
    const existente = items.find((i) => i.id_articulo === articulo.id)
    const nuevaCantidad = (existente?.cantidad || 0) + 1
    const v = validarCantidadVentaComercial(articulo, nuevaCantidad)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError('')
    if (existente) {
      setItems(
        items.map((i) =>
          i.id_articulo === articulo.id
            ? {
                ...i,
                cantidad: nuevaCantidad,
                precio_total: nuevaCantidad * (i.precio_unitario || 0)
              }
            : i
        )
      )
      return
    }
    const nuevoItem: PedidoItem = {
      id_articulo: articulo.id,
      cantidad: 1,
      precio_unitario: articulo.precio_base || 0,
      precio_total: articulo.precio_base || 0,
      nombre_articulo: articulo.nombre
    }
    setItems([...items, nuevoItem])
  }

  const actualizarItem = (index: number, campo: keyof PedidoItem, valor: unknown) => {
    const nuevosItems = [...items]
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor }
    if (campo === 'cantidad' || campo === 'precio_unitario') {
      nuevosItems[index].precio_total = nuevosItems[index].cantidad * nuevosItems[index].precio_unitario
    }
    if (campo === 'cantidad') {
      const articulo = articuloById(nuevosItems[index].id_articulo)
      if (articulo) {
        const v = validarCantidadVentaComercial(articulo, Number(valor))
        if (!v.ok) {
          setError(v.error)
          return
        }
        setError('')
      }
    }
    setItems(nuevosItems)
  }

  const eliminarItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calcularTotal = () => {
    return items.reduce((sum, item) => sum + item.precio_total, 0)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return

    if (items.length === 0) {
      setError('Debes agregar al menos un artículo al pedido')
      return
    }

    if (formData.requiere_delivery && !formData.direccion_delivery.trim()) {
      setError('Debes proporcionar la dirección de delivery')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Crear pedido con todos los campos
      const response = await apiService.crearPedidoCliente({
        id_cliente: cliente.id,
        tipo_intencion: tipoIntencion,
        fecha_limite_deseada: formData.fecha_limite_deseada || undefined,
        observaciones_cliente: formData.observaciones_cliente.trim() || undefined,
        items: items.map(item => ({
          id_articulo: item.id_articulo,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_total,
          descripcion_personalizada: item.descripcion_personalizada?.trim() || undefined
        })),
        es_urgente: formData.es_urgente,
        requiere_delivery: formData.requiere_delivery,
        direccion_delivery: formData.direccion_delivery.trim() || undefined,
        tipo_producto_servicio: formData.tipo_producto_servicio.length > 0 ? formData.tipo_producto_servicio : undefined,
        tipo_producto_otro: formData.tipo_producto_otro.trim() || undefined,
        necesita_asesoramiento: formData.necesita_asesoramiento,
        donde_colocados: formData.donde_colocados.trim() || undefined,
        digital_o_impresion: formData.digital_o_impresion.trim() || undefined,
        cantidades: formData.cantidades.trim() || undefined,
        objetivo_proyecto: formData.objetivo_proyecto.trim() || undefined,
        material_logo: formData.material_logo || undefined,
        material_textos: formData.material_textos || undefined,
        material_imagenes: formData.material_imagenes || undefined,
        tiene_referencias: formData.tiene_referencias,
        referencias_links: formData.referencias_links.trim() || undefined,
        brief_publico: formData.brief_publico.trim() || undefined,
        estilo_diseno: formData.estilo_diseno.trim() || undefined,
        referencias: formData.referencias.trim() || undefined
      })

      if (response.success && response.data) {
        if (response.data.id && tipoIntencion === 'compra') {
          await apiService.aplicarStockPedidoCliente(response.data.id, 'portal')
        }
        await apiService.vaciarCarritoCliente(cliente.id)
        // Subir archivos si hay
        if (archivos.length > 0 && response.data.id) {
          try {
            for (const archivo of archivos) {
              await apiService.uploadArchivoPedidoCliente(archivo, response.data.id)
            }
          } catch (uploadError) {
            console.error('Error al subir archivos:', uploadError)
            // Continuar aunque falle la subida de archivos
          }
        }
        navigate(`/cliente/pedido/${response.data.id}`)
      } else {
        setError(response.error || 'Error al crear el pedido')
      }
    } catch (err) {
      setError('Error al crear el pedido')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="cliente-nuevo-pedido-page">
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="cliente-nuevo-pedido-page">
      <header className="cliente-nuevo-pedido-header">
        <div className="cliente-header-content">
          <div className="cliente-header-logo">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <h1>Nuevo Pedido</h1>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/cliente/dashboard')}
          >
            ← Volver
          </button>
        </div>
      </header>

      <main className="cliente-nuevo-pedido-main">
        <form onSubmit={handleSubmit} className="pedido-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <section className="form-section">
            <h2>Tipo de solicitud</h2>
            <div className="intencion-opciones">
              <label>
                <input
                  type="radio"
                  name="tipo_intencion"
                  checked={tipoIntencion === 'compra'}
                  onChange={() => setTipoIntencion('compra')}
                />
                Compra (descuenta stock si aplica)
              </label>
              <label>
                <input
                  type="radio"
                  name="tipo_intencion"
                  checked={tipoIntencion === 'cotizacion'}
                  onChange={() => setTipoIntencion('cotizacion')}
                />
                Solicitar cotización
              </label>
            </div>
          </section>

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
                  <button
                    type="button"
                    className="btn-agregar"
                    onClick={() => agregarArticulo(articulo)}
                  >
                    + Agregar
                  </button>
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
                      <textarea
                        className="item-descripcion"
                        placeholder="Descripción personalizada..."
                        value={item.descripcion_personalizada || ''}
                        onChange={(e) => actualizarItem(index, 'descripcion_personalizada', e.target.value)}
                      />
                    </div>
                    <div className="item-cantidad">
                      <label>Cantidad:</label>
                      <input
                        type="number"
                        min="1"
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(index, 'cantidad', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="item-precio">
                      <label>Precio unitario:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.precio_unitario}
                        onChange={(e) => actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="item-total">
                      <strong>${item.precio_total.toFixed(2)}</strong>
                    </div>
                    <button
                      type="button"
                      className="btn-eliminar"
                      onClick={() => eliminarItem(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="total-pedido">
                  <strong>Total: ${calcularTotal().toFixed(2)}</strong>
                </div>
              </div>
            )}
          </section>

          {/* Sección: Tipo de Producto/Servicio */}
          <section className="form-section">
            <h2>🎨 Tipo de Producto/Servicio</h2>
            <div className="checkbox-grid">
              {TIPOS_PRODUCTO.map((tipo) => (
                <label key={tipo} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.tipo_producto_servicio.includes(tipo)}
                    onChange={() => handleTipoProductoChange(tipo)}
                  />
                  <span>{tipo}</span>
                </label>
              ))}
            </div>
            <div className="form-group">
              <label>Otro tipo (especificar):</label>
              <input
                type="text"
                value={formData.tipo_producto_otro}
                onChange={(e) => setFormData({ ...formData, tipo_producto_otro: e.target.value })}
                placeholder="Especifica otro tipo de producto o servicio"
              />
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.necesita_asesoramiento}
                onChange={(e) => setFormData({ ...formData, necesita_asesoramiento: e.target.checked })}
              />
              <span>No sé bien lo que necesito, quiero asesoramiento</span>
            </label>
          </section>

          {/* Sección: Detalles del Producto */}
          <section className="form-section">
            <h2>📋 Detalles del Producto</h2>
            <div className="form-group">
              <label>¿Dónde será colocado/utilizado?</label>
              <textarea
                value={formData.donde_colocados}
                onChange={(e) => setFormData({ ...formData, donde_colocados: e.target.value })}
                placeholder="Ej: En la fachada del local, en redes sociales, etc."
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Digital o Impresión:</label>
                <select
                  value={formData.digital_o_impresion}
                  onChange={(e) => setFormData({ ...formData, digital_o_impresion: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  <option value="digital">Digital</option>
                  <option value="impresion">Impresión</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cantidades:</label>
                <input
                  type="text"
                  value={formData.cantidades}
                  onChange={(e) => setFormData({ ...formData, cantidades: e.target.value })}
                  placeholder="Ej: 100 unidades, 500 ejemplares"
                />
              </div>
            </div>
          </section>

          {/* Sección: Objetivo y Brief */}
          <section className="form-section">
            <h2>🎯 Objetivo y Brief</h2>
            <div className="form-group">
              <label>Objetivo del Proyecto:</label>
              <textarea
                value={formData.objetivo_proyecto}
                onChange={(e) => setFormData({ ...formData, objetivo_proyecto: e.target.value })}
                placeholder="¿Cuál es el objetivo principal de este proyecto?"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Brief Público *</label>
              <textarea
                value={formData.brief_publico}
                onChange={(e) => setFormData({ ...formData, brief_publico: e.target.value })}
                placeholder="Describe el proyecto, objetivos, contexto y cualquier información relevante..."
                rows={5}
                required
              />
            </div>
            <div className="form-group">
              <label>Estilo de Diseño:</label>
              <input
                type="text"
                value={formData.estilo_diseno}
                onChange={(e) => setFormData({ ...formData, estilo_diseno: e.target.value })}
                placeholder="Ej: Minimalista, Corporativo, Moderno, etc."
              />
            </div>
            <div className="form-group">
              <label>Referencias:</label>
              <textarea
                value={formData.referencias}
                onChange={(e) => setFormData({ ...formData, referencias: e.target.value })}
                placeholder="Describe referencias visuales o estilos que te gusten"
                rows={3}
              />
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.tiene_referencias}
                onChange={(e) => setFormData({ ...formData, tiene_referencias: e.target.checked })}
              />
              <span>Tengo referencias (links abajo)</span>
            </label>
            {formData.tiene_referencias && (
              <div className="form-group">
                <label>Links de Referencias:</label>
                <textarea
                  value={formData.referencias_links}
                  onChange={(e) => setFormData({ ...formData, referencias_links: e.target.value })}
                  placeholder="Pega aquí los links de tus referencias (uno por línea)"
                  rows={3}
                />
              </div>
            )}
          </section>

          {/* Sección: Material Disponible */}
          <section className="form-section">
            <h2>📎 Material Disponible</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Logo:</label>
                <select
                  value={formData.material_logo}
                  onChange={(e) => setFormData({ ...formData, material_logo: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  <option value="si_pdf_eps_ai">Sí, en PDF/EPS/AI</option>
                  <option value="si_solo_imagen">Sí, solo imagen</option>
                  <option value="no">No tengo</option>
                  <option value="necesito_diseno">Necesito diseño</option>
                </select>
              </div>
              <div className="form-group">
                <label>Textos:</label>
                <select
                  value={formData.material_textos}
                  onChange={(e) => setFormData({ ...formData, material_textos: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  <option value="si_definitivos">Sí, textos definitivos</option>
                  <option value="no">No tengo</option>
                  <option value="necesito_redacten">Necesito que redacten</option>
                </select>
              </div>
              <div className="form-group">
                <label>Imágenes:</label>
                <select
                  value={formData.material_imagenes}
                  onChange={(e) => setFormData({ ...formData, material_imagenes: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  <option value="si_material_propio">Sí, material propio</option>
                  <option value="no">No tengo</option>
                  <option value="usar_banco_imagenes">Usar banco de imágenes</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Archivos Adjuntos:</label>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="file-input"
              />
              {archivos.length > 0 && (
                <div className="archivos-list">
                  {archivos.map((archivo, index) => (
                    <span key={index} className="archivo-item">
                      {archivo.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Sección: Plazos y Opciones */}
          <section className="form-section">
            <h2>⏰ Plazos y Opciones</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha Límite Deseada:</label>
                <input
                  type="date"
                  value={formData.fecha_limite_deseada}
                  onChange={(e) => setFormData({ ...formData, fecha_limite_deseada: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.es_urgente}
                    onChange={(e) => setFormData({ ...formData, es_urgente: e.target.checked })}
                  />
                  <span>⚡ Pedido Urgente</span>
                </label>
              </div>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.requiere_delivery}
                onChange={(e) => setFormData({ ...formData, requiere_delivery: e.target.checked })}
              />
              <span>🚚 Requiere Delivery</span>
            </label>
            {formData.requiere_delivery && (
              <div className="form-group">
                <label>Dirección de Delivery:</label>
                <textarea
                  value={formData.direccion_delivery}
                  onChange={(e) => setFormData({ ...formData, direccion_delivery: e.target.value })}
                  placeholder="Ingresa la dirección completa para el delivery"
                  rows={2}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>Observaciones Adicionales:</label>
              <textarea
                value={formData.observaciones_cliente}
                onChange={(e) => setFormData({ ...formData, observaciones_cliente: e.target.value })}
                placeholder="Cualquier otra información relevante..."
                rows={3}
              />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/cliente/dashboard')}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving || items.length === 0}>
              {saving ? 'Creando Pedido...' : `Crear Pedido ($${calcularTotal().toFixed(2)})`}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

