import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ImageIcon } from 'lucide-react'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { validarCantidadVentaComercial } from '../services/commerceCatalogService'
import {
  generarMockupImagenIa,
  generarPedidoDesdeEspecificacion
} from '../services/clientePedidoAiService'
import type { ArticuloEmpresaRecord, TipoIntencionPedido } from '../types/api'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import ClientePedidoMockupPreview from '../components/cliente/ClientePedidoMockupPreview'
import {
  buildBriefFromPedido,
  buildMockupImagePrompt,
  inferTiposProducto,
  resolveMockupProduct,
  resolveMockupScene
} from '../utils/clientePedidoMockup'
import {
  buildPedidoMockupFile,
  PEDIDO_MOCKUP_FILENAME,
  PEDIDO_MOCKUP_TIPO
} from '../utils/capturePedidoMockup'
import './ClienteNuevoPedidoPage.css'

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

  const [especificacion, setEspecificacion] = useState('')
  const [iaBrief, setIaBrief] = useState('')
  const [iaEstilo, setIaEstilo] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [mockupAiUrl, setMockupAiUrl] = useState<string | null>(null)
  const [mockupAiLoading, setMockupAiLoading] = useState(false)
  const [fotoReferenciaUrl, setFotoReferenciaUrl] = useState<string | null>(null)
  const mockupCaptureRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    fecha_limite_deseada: '',
    observaciones_cliente: '',
    es_urgente: false,
    requiere_delivery: false,
    direccion_delivery: '',
    donde_colocados: '',
    digital_o_impresion: '',
    cantidades: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadArticulos()
  }, [cliente, authLoading, navigate])

  useEffect(() => {
    return () => {
      if (fotoReferenciaUrl) URL.revokeObjectURL(fotoReferenciaUrl)
    }
  }, [fotoReferenciaUrl])

  const articuloById = useCallback(
    (id: number) => articulos.find((a) => a.id === id),
    [articulos]
  )

  const primaryItem = items.length > 0 ? items[items.length - 1] : null
  const primaryArticulo = primaryItem ? articuloById(primaryItem.id_articulo) : null

  const mockupProductKind = useMemo(() => {
    if (!primaryItem?.nombre_articulo) return 'generic' as const
    return resolveMockupProduct(primaryItem.nombre_articulo, primaryArticulo?.categoria)
  }, [primaryItem, primaryArticulo])

  const mockupSceneKind = useMemo(
    () =>
      resolveMockupScene(
        formData.donde_colocados,
        mockupProductKind,
        formData.digital_o_impresion
      ),
    [formData.donde_colocados, formData.digital_o_impresion, mockupProductKind]
  )

  const mockupProductLabel = primaryItem?.nombre_articulo || 'Producto'

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
    } catch {
      setError('Error al cargar catálogo')
    } finally {
      setLoading(false)
    }
  }

  const agregarArticulo = (articulo: ArticuloEmpresaRecord) => {
    const existente = items.find((i) => i.id_articulo === articulo.id)
    const nuevaCantidad = (existente?.cantidad || 0) + 1
    const v = validarCantidadVentaComercial(articulo, nuevaCantidad)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setError('')
    setMockupAiUrl(null)
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
    setItems([
      ...items,
      {
        id_articulo: articulo.id,
        cantidad: 1,
        precio_unitario: articulo.precio_base || 0,
        precio_total: articulo.precio_base || 0,
        nombre_articulo: articulo.nombre
      }
    ])
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
    setMockupAiUrl(null)
  }

  const calcularTotal = () => items.reduce((sum, item) => sum + item.precio_total, 0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setArchivos(Array.from(e.target.files))
    }
  }

  const handleFotoReferencia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fotoReferenciaUrl) URL.revokeObjectURL(fotoReferenciaUrl)
    setFotoReferenciaUrl(URL.createObjectURL(file))
    setArchivos((prev) => {
      const sinPreviasRef = prev.filter((f) => !f.name.startsWith('ref-mockup-'))
      return [...sinPreviasRef, file]
    })
    setMockupAiUrl(null)
    e.target.value = ''
  }

  const handleGenerarConIa = async () => {
    if (!especificacion.trim()) {
      setError('Escribí qué necesitás en la especificación antes de usar la IA.')
      return
    }
    if (items.length === 0) {
      setError('Agregá al menos un artículo del catálogo.')
      return
    }
    setIaLoading(true)
    setError('')
    try {
      const result = await generarPedidoDesdeEspecificacion({
        especificacion,
        articulos: items.map((i) => i.nombre_articulo || '').filter(Boolean),
        donde_colocados: formData.donde_colocados,
        digital_o_impresion: formData.digital_o_impresion,
        cantidades: formData.cantidades
      })
      setIaBrief(result.brief_publico)
      setIaEstilo(result.estilo_diseno)
      if (result.descripcion_articulo && items.length > 0) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === prev.length - 1
              ? { ...it, descripcion_personalizada: result.descripcion_articulo }
              : it
          )
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar con IA')
    } finally {
      setIaLoading(false)
    }
  }

  const handleGenerarMockupIa = async () => {
    if (items.length === 0) return
    setMockupAiLoading(true)
    setError('')
    try {
      const prompt = buildMockupImagePrompt({
        productLabel: mockupProductLabel,
        productKind: mockupProductKind,
        sceneKind: mockupSceneKind,
        especificacion,
        donde_colocados: formData.donde_colocados
      })
      const dataUrl = await generarMockupImagenIa(prompt)
      setMockupAiUrl(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la vista previa')
    } finally {
      setMockupAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return

    if (items.length === 0) {
      setError('Debes agregar al menos un artículo al pedido')
      return
    }

    const tieneDescripcion =
      especificacion.trim() ||
      iaBrief.trim() ||
      items.some((i) => i.descripcion_personalizada?.trim())

    if (!tieneDescripcion) {
      setError('Completá la especificación o generá la descripción con IA')
      return
    }

    if (formData.requiere_delivery && !formData.direccion_delivery.trim()) {
      setError('Debes proporcionar la dirección de delivery')
      return
    }

    const brief_publico =
      iaBrief.trim() ||
      buildBriefFromPedido({
        especificacion,
        donde_colocados: formData.donde_colocados,
        cantidades: formData.cantidades,
        digital_o_impresion: formData.digital_o_impresion,
        items
      })

    const nombresArticulos = items.map((i) => i.nombre_articulo || '').filter(Boolean)

    setSaving(true)
    setError('')

    let mockupFilePendiente: File | null = null
    if (items.length > 0 && mockupCaptureRef.current) {
      try {
        mockupFilePendiente = await buildPedidoMockupFile({
          idPedido: 0,
          aiDataUrl: mockupAiUrl,
          captureElement: mockupCaptureRef.current
        })
      } catch (captureErr) {
        console.warn('No se pudo preparar el mockup antes de crear el pedido:', captureErr)
      }
    }

    try {
      const response = await apiService.crearPedidoCliente({
        id_cliente: cliente.id,
        tipo_intencion: tipoIntencion,
        fecha_limite_deseada: formData.fecha_limite_deseada || undefined,
        observaciones_cliente: formData.observaciones_cliente.trim() || undefined,
        items: items.map((item) => ({
          id_articulo: item.id_articulo,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          precio_total: item.precio_total,
          descripcion_personalizada: item.descripcion_personalizada?.trim() || undefined
        })),
        es_urgente: formData.es_urgente,
        requiere_delivery: formData.requiere_delivery,
        direccion_delivery: formData.direccion_delivery.trim() || undefined,
        tipo_producto_servicio: inferTiposProducto(nombresArticulos),
        tipo_producto_otro: especificacion.trim() || undefined,
        donde_colocados: formData.donde_colocados.trim() || undefined,
        digital_o_impresion: formData.digital_o_impresion || undefined,
        cantidades: formData.cantidades.trim() || undefined,
        objetivo_proyecto: especificacion.trim().slice(0, 800) || undefined,
        brief_publico,
        estilo_diseno: iaEstilo.trim() || undefined
      })

      if (response.success && response.data) {
        if (response.data.id && tipoIntencion === 'compra') {
          await apiService.aplicarStockPedidoCliente(response.data.id, 'portal')
          const ventaRes = await apiService.crearVentaDesdePedidoCliente(response.data.id)
          if (!ventaRes.success) {
            setError(
              ventaRes.error ||
                'El pedido se creó pero no se registró en ventas. Contactá a mostrador.'
            )
            setSaving(false)
            return
          }
        }
        await apiService.vaciarCarritoCliente(cliente.id)
        if (response.data.id) {
          try {
            let mockupFile = mockupFilePendiente
            if (!mockupFile && mockupCaptureRef.current) {
              mockupFile = await buildPedidoMockupFile({
                idPedido: response.data.id,
                aiDataUrl: mockupAiUrl,
                captureElement: mockupCaptureRef.current
              })
            }
            if (mockupFile) {
              const mockupUpload = await apiService.uploadArchivoPedidoCliente(
                mockupFile,
                response.data.id,
                undefined,
                {
                  nombreArchivo: PEDIDO_MOCKUP_FILENAME,
                  tipoEtiqueta: PEDIDO_MOCKUP_TIPO
                }
              )
              if (!mockupUpload.success) {
                console.error('Error al guardar mockup del pedido:', mockupUpload.error)
              }
            }
          } catch (mockupError) {
            console.error('Error al guardar mockup del pedido:', mockupError)
          }

          if (archivos.length > 0) {
            try {
              for (const archivo of archivos) {
                await apiService.uploadArchivoPedidoCliente(archivo, response.data.id)
              }
            } catch (uploadError) {
              console.error('Error al subir archivos:', uploadError)
            }
          }
        }
        navigate(`/cliente/pedido/${response.data.id}`)
      } else {
        setError(response.error || 'Error al crear el pedido')
      }
    } catch {
      setError('Error al crear el pedido')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-nuevo-pedido-page">
      <ClientePageHeader
        eyebrow="Pedidos"
        title="Nuevo pedido"
        subtitle="Elegí del catálogo, describí tu idea y mirá la vista previa al costado"
        actions={
          <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/catalogo')}>
            Ver catálogo
          </button>
        }
      />

      <div className="pedido-form-layout">
        <form onSubmit={handleSubmit} className="pedido-form pedido-form-main">
          {error && <div className="cliente-page-alert cliente-page-alert--error">{error}</div>}

          <section className="cliente-page-form-section form-section">
            <h2>Tipo de solicitud</h2>
            <div className="intencion-opciones" role="radiogroup" aria-label="Tipo de solicitud">
              <label className={`intencion-opcion ${tipoIntencion === 'compra' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="tipo_intencion"
                  checked={tipoIntencion === 'compra'}
                  onChange={() => setTipoIntencion('compra')}
                />
                <span>Compra</span>
              </label>
              <label className={`intencion-opcion ${tipoIntencion === 'cotizacion' ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="tipo_intencion"
                  checked={tipoIntencion === 'cotizacion'}
                  onChange={() => setTipoIntencion('cotizacion')}
                />
                <span>Solicitar cotización</span>
              </label>
            </div>
          </section>

          <section className="cliente-page-form-section form-section">
            <h2>Artículos</h2>
            <p className="form-section-hint">
              El producto que elijas define el mockup de la derecha (banner, flyer, etc.).
            </p>
            <div className="catalogo-grid">
              {articulos.map((articulo) => (
                <div key={articulo.id} className="articulo-card">
                  <div className="articulo-info">
                    <h3>{articulo.nombre}</h3>
                    {articulo.descripcion && <p>{articulo.descripcion}</p>}
                    <div className="articulo-precio">${articulo.precio_base?.toFixed(2) || '0.00'}</div>
                  </div>
                  <button type="button" className="btn-agregar" onClick={() => agregarArticulo(articulo)}>
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
                    <div className="item-row-head">
                      <strong className="item-row-name">{item.nombre_articulo}</strong>
                      <button
                        type="button"
                        className="btn-eliminar"
                        onClick={() => eliminarItem(index)}
                        aria-label="Quitar artículo"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="item-row-metrics">
                      <div className="item-field">
                        <label htmlFor={`item-cant-${index}`}>Cantidad</label>
                        <input
                          id={`item-cant-${index}`}
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarItem(index, 'cantidad', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                      <div className="item-field">
                        <label htmlFor={`item-precio-${index}`}>Precio unit.</label>
                        <input
                          id={`item-precio-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.precio_unitario}
                          onChange={(e) =>
                            actualizarItem(index, 'precio_unitario', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="item-field item-field--total">
                        <span className="item-field-label">Subtotal</span>
                        <strong className="item-total-value">${item.precio_total.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="total-pedido">
                  <strong>Total: ${calcularTotal().toFixed(2)}</strong>
                </div>
              </div>
            )}
          </section>

          <section className="cliente-page-form-section form-section">
            <h2>Especificación</h2>
            <p className="form-section-hint">
              Lo que escribas se muestra en el mockup. La IA arma el brief para producción.
            </p>
            <div className="form-group">
              <label htmlFor="pedido-especificacion">¿Qué querés lograr?</label>
              <textarea
                id="pedido-especificacion"
                rows={4}
                value={especificacion}
                onChange={(e) => {
                  setEspecificacion(e.target.value)
                  setMockupAiUrl(null)
                }}
                placeholder="Ej: Banner 2x1 m con logo grande, colores naranja y blanco, texto de promoción verano..."
              />
            </div>
            <div className="especificacion-actions">
              <button
                type="button"
                className="cliente-btn-primary especificacion-ia-btn"
                disabled={iaLoading || items.length === 0}
                onClick={() => void handleGenerarConIa()}
              >
                <Sparkles size={16} aria-hidden />
                {iaLoading ? 'Generando…' : 'Generar descripción con IA'}
              </button>
            </div>
            {iaBrief && (
              <div className="ia-brief-preview">
                <p className="ia-brief-preview__label">Brief generado (se envía con el pedido)</p>
                <p className="ia-brief-preview__text">{iaBrief}</p>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="foto-referencia">Foto de referencia (opcional)</label>
              <input
                id="foto-referencia"
                type="file"
                accept="image/*"
                onChange={handleFotoReferencia}
                className="file-input"
              />
              <p className="form-field-hint">Se muestra en el mockup y se adjunta al pedido.</p>
            </div>
            <div className="form-group">
              <label htmlFor="archivos-adjuntos">Archivo original (opcional)</label>
              <input
                id="archivos-adjuntos"
                type="file"
                multiple
                onChange={handleFileChange}
                className="file-input"
              />
              <p className="form-field-hint">
                Subí tu archivo original si no necesitás diseño de Plot.
              </p>
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

          <section className="cliente-page-form-section form-section">
            <h2>Detalles del producto</h2>
            <p className="form-section-hint">
              La ubicación actualiza el escenario del mockup (local, vehículo, digital, etc.).
            </p>
            <div className="form-group">
              <label htmlFor="donde-colocados">¿Dónde será colocado o utilizado?</label>
              <textarea
                id="donde-colocados"
                value={formData.donde_colocados}
                onChange={(e) => {
                  setFormData({ ...formData, donde_colocados: e.target.value })
                  setMockupAiUrl(null)
                }}
                placeholder="Ej: Afuera del local en la fachada, vidriera principal..."
                rows={3}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="digital-impresion">Digital o impresión</label>
                <select
                  id="digital-impresion"
                  value={formData.digital_o_impresion}
                  onChange={(e) => {
                    setFormData({ ...formData, digital_o_impresion: e.target.value })
                    setMockupAiUrl(null)
                  }}
                >
                  <option value="">Seleccionar…</option>
                  <option value="digital">Digital</option>
                  <option value="impresion">Impresión</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cantidades-pedido">Cantidades</label>
                <input
                  id="cantidades-pedido"
                  type="text"
                  value={formData.cantidades}
                  onChange={(e) => {
                    setFormData({ ...formData, cantidades: e.target.value })
                    setMockupAiUrl(null)
                  }}
                  placeholder="Ej: 100 unidades, 500 ejemplares"
                />
              </div>
            </div>
          </section>

          <section className="cliente-page-form-section form-section">
            <h2>Plazos y opciones</h2>
            <div className="form-group form-group--date">
              <label htmlFor="fecha-limite-pedido">Fecha límite deseada</label>
              <input
                id="fecha-limite-pedido"
                type="date"
                value={formData.fecha_limite_deseada}
                onChange={(e) => setFormData({ ...formData, fecha_limite_deseada: e.target.value })}
              />
            </div>
            <div className="pedido-flags" role="group" aria-label="Opciones del pedido">
              <label className="pedido-flag-chip">
                <input
                  type="checkbox"
                  checked={formData.es_urgente}
                  onChange={(e) => setFormData({ ...formData, es_urgente: e.target.checked })}
                />
                <span>⚡ Pedido urgente</span>
              </label>
              <label className="pedido-flag-chip">
                <input
                  type="checkbox"
                  checked={formData.requiere_delivery}
                  onChange={(e) => setFormData({ ...formData, requiere_delivery: e.target.checked })}
                />
                <span>🚚 Requiere delivery</span>
              </label>
            </div>
            {formData.requiere_delivery && (
              <div className="form-group">
                <label htmlFor="direccion-delivery">Dirección de delivery</label>
                <textarea
                  id="direccion-delivery"
                  value={formData.direccion_delivery}
                  onChange={(e) => setFormData({ ...formData, direccion_delivery: e.target.value })}
                  placeholder="Dirección completa"
                  rows={2}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="observaciones">Observaciones adicionales</label>
              <textarea
                id="observaciones"
                value={formData.observaciones_cliente}
                onChange={(e) => setFormData({ ...formData, observaciones_cliente: e.target.value })}
                placeholder="Cualquier otra información relevante…"
                rows={3}
              />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="cliente-btn-outline" onClick={() => navigate('/cliente/dashboard')}>
              Cancelar
            </button>
            <button type="submit" className="cliente-btn-primary" disabled={saving || items.length === 0}>
              {saving ? 'Creando pedido…' : `Crear pedido ($${calcularTotal().toFixed(2)})`}
            </button>
          </div>
        </form>

        <aside className="pedido-mockup-aside" aria-label="Vista previa del pedido">
          <div ref={mockupCaptureRef} className="pedido-mockup-capture-wrap">
          <ClientePedidoMockupPreview
            empty={items.length === 0}
            productKind={mockupProductKind}
            sceneKind={mockupSceneKind}
            productLabel={mockupProductLabel}
            especificacion={especificacion}
            dondeColocados={formData.donde_colocados}
            digitalOImpresion={formData.digital_o_impresion}
            cantidades={formData.cantidades}
            userImageUrl={fotoReferenciaUrl}
            aiImageUrl={mockupAiUrl}
            loadingAi={mockupAiLoading}
          />
          </div>
          {items.length > 0 && (
            <>
              <p className="pedido-mockup-save-hint">
                Esta vista previa se guarda automáticamente al crear el pedido.
              </p>
              <button
                type="button"
                className="cliente-btn-outline pedido-mockup-ia-btn"
                disabled={mockupAiLoading}
                onClick={() => void handleGenerarMockupIa()}
              >
                <ImageIcon size={16} aria-hidden />
                {mockupAiLoading ? 'Generando vista IA…' : 'Vista previa realista (IA)'}
              </button>
            </>
          )}
        </aside>
      </div>
    </ClientePageLayout>
  )
}
