import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import apiService from '../services/api'
import type { OrdenTrabajo } from '../types/api'
import type { ClienteWebRecord } from '../types/api'
import ClienteBriefMockupStudio from '../components/cliente/ClienteBriefMockupStudio'
import BriefMockupCard from '../components/BriefMockupCard'
import {
  BRIEF_MOCKUP_FILENAME,
  BRIEF_MOCKUP_TIPO,
  BRIEF_REFERENCIA_TIPO,
  buildBriefMockupFile
} from '../utils/capturePedidoMockup'
import { generarBriefCamposIa, generarMockupImagenIa } from '../services/clienteBriefAiService'
import type { BriefCamposIa } from '../services/clienteBriefAiService'
import {
  buildBriefIaContext,
  buildBriefMockupImagePrompt,
  calcBriefProgress,
  resolveBriefMockup
} from '../utils/clienteBriefMockup'
import './BriefPublicoPage.css'

export type BriefPublicoPageProps = {
  token?: string
  clientePrefill?: ClienteWebRecord | null
  idCliente?: number
  onSuccess?: () => void
  variant?: 'publico' | 'cliente'
}

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

function BriefIaBtn({
  label,
  loading,
  disabled,
  onClick
}: {
  label: string
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="brief-ia-btn"
      disabled={disabled || loading}
      onClick={onClick}
    >
      <Sparkles size={15} aria-hidden />
      {loading ? 'Generando…' : label}
    </button>
  )
}

const BriefPublicoPage = (props?: BriefPublicoPageProps) => {
  const paramsToken = useParams<{ token: string }>().token
  const token = props?.token ?? paramsToken
  const clientePrefill = props?.clientePrefill
  const idCliente = props?.idCliente
  const onSuccess = props?.onSuccess
  const isCliente = props?.variant === 'cliente'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orden, setOrden] = useState<Partial<OrdenTrabajo> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mockupAiUrl, setMockupAiUrl] = useState<string | null>(null)
  const [mockupAiLoading, setMockupAiLoading] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)
  const [fotoReferenciaUrl, setFotoReferenciaUrl] = useState<string | null>(null)
  const [fotoReferenciaFile, setFotoReferenciaFile] = useState<File | null>(null)
  const [briefId, setBriefId] = useState<number | null>(null)
  const [mockupUrlGuardado, setMockupUrlGuardado] = useState<string | null>(null)
  const mockupCaptureRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    // Datos del cliente
    cliente_nombre_completo: '',
    cliente_empresa: '',
    telefono_cliente: '',
    email_cliente: '',
    
    // Tipo de producto/servicio
    tipo_producto_servicio: [] as string[],
    tipo_producto_otro: '',
    necesita_asesoramiento: false,
    
    // Detalles del producto
    donde_colocados: '',
    digital_o_impresion: '',
    cantidades: '',
    
    // Objetivo
    objetivo_proyecto: '',
    
    // Material disponible
    material_logo: '',
    material_textos: '',
    material_imagenes: '',
    tiene_referencias: false,
    referencias_links: '',
    
    // Brief y referencias
    brief_publico: '',
    estilo_diseno: '',
    referencias: '',
    
    // Plazos
    fecha_limite_brief: '',
    es_urgencia: false
  })

  useEffect(() => {
    if (token) {
      loadOrden()
    } else {
      setError('Token no válido')
      setLoading(false)
    }
  }, [token, clientePrefill])

  useEffect(() => {
    return () => {
      if (fotoReferenciaUrl) URL.revokeObjectURL(fotoReferenciaUrl)
    }
  }, [fotoReferenciaUrl])

  const mockupState = useMemo(
    () =>
      resolveBriefMockup(
        formData.tipo_producto_servicio,
        formData.tipo_producto_otro,
        formData.donde_colocados,
        formData.digital_o_impresion,
        formData.necesita_asesoramiento
      ),
    [
      formData.tipo_producto_servicio,
      formData.tipo_producto_otro,
      formData.donde_colocados,
      formData.digital_o_impresion,
      formData.necesita_asesoramiento
    ]
  )

  const briefProgress = useMemo(
    () =>
      calcBriefProgress(
        formData.tipo_producto_servicio,
        formData.tipo_producto_otro,
        formData.donde_colocados,
        formData.digital_o_impresion,
        formData.necesita_asesoramiento,
        formData.objetivo_proyecto,
        formData.brief_publico,
        formData.estilo_diseno
      ),
    [formData]
  )

  const buildIaContext = useCallback(
    () =>
      buildBriefIaContext({
        tipos_producto: formData.tipo_producto_servicio,
        tipo_producto_otro: formData.tipo_producto_otro,
        necesita_asesoramiento: formData.necesita_asesoramiento,
        donde_colocados: formData.donde_colocados,
        digital_o_impresion: formData.digital_o_impresion,
        cantidades: formData.cantidades,
        objetivo_proyecto: formData.objetivo_proyecto,
        brief_publico: formData.brief_publico,
        estilo_diseno: formData.estilo_diseno,
        material_logo: formData.material_logo,
        material_textos: formData.material_textos,
        material_imagenes: formData.material_imagenes,
        referencias_links: formData.referencias_links,
        cliente_empresa: formData.cliente_empresa
      }),
    [formData]
  )

  const loadOrden = async () => {
    if (!token) return
    
    setLoading(true)
    try {
      // Intentar obtener desde la nueva tabla de briefs primero
      const briefResponse = await apiService.obtenerBriefPorToken(token)
      let response
      
      if (briefResponse.success && briefResponse.data) {
        // Usar los datos del brief directamente
        response = { success: true, data: briefResponse.data }
      } else {
        // Fallback: intentar con la función antigua
        response = await apiService.obtenerOrdenPorBriefToken(token)
      }
      
      if (response.success && response.data) {
        setOrden(response.data)
        const data = response.data
        if (typeof data.id === 'number') {
          setBriefId(data.id)
        }
        if (data.mockup_url) {
          setMockupUrlGuardado(data.mockup_url)
        }
        const nombreCompleto = data.cliente_nombre_completo || (clientePrefill ? `${clientePrefill.nombre || ''} ${clientePrefill.apellido || ''}`.trim() || clientePrefill.nombre : '')
        const empresa = data.cliente_empresa || clientePrefill?.empresa || ''
        const telefono = data.telefono_cliente || clientePrefill?.telefono || ''
        const email = data.email_cliente || clientePrefill?.email || ''
        setFormData({
          cliente_nombre_completo: nombreCompleto,
          cliente_empresa: empresa,
          telefono_cliente: telefono,
          email_cliente: email,
          tipo_producto_servicio: response.data.tipo_producto_servicio || [],
          tipo_producto_otro: response.data.tipo_producto_otro || '',
          necesita_asesoramiento: response.data.necesita_asesoramiento || false,
          donde_colocados: response.data.donde_colocados || '',
          digital_o_impresion: response.data.digital_o_impresion || '',
          cantidades: response.data.cantidades || '',
          objetivo_proyecto: response.data.objetivo_proyecto || '',
          material_logo: response.data.material_logo || '',
          material_textos: response.data.material_textos || '',
          material_imagenes: response.data.material_imagenes || '',
          tiene_referencias: response.data.tiene_referencias || false,
          referencias_links: response.data.referencias_links || '',
          brief_publico: response.data.brief_publico || '',
          estilo_diseno: response.data.estilo_diseno || '',
          referencias: response.data.referencias || '',
          fecha_limite_brief: response.data.fecha_limite_brief || '',
          es_urgencia: response.data.es_urgencia || false
        })
      } else {
        setError(response.error || 'No se pudo cargar la información de la orden')
      }
    } catch (error) {
      console.error('Error cargando orden:', error)
      setError('Error al cargar la información')
    } finally {
      setLoading(false)
    }
  }

  const handleTipoProductoChange = (tipo: string) => {
    setMockupAiUrl(null)
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

  const patchForm = (patch: Partial<typeof formData>) => {
    setMockupAiUrl(null)
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  const handleFotoReferencia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fotoReferenciaUrl) URL.revokeObjectURL(fotoReferenciaUrl)
    setFotoReferenciaFile(file)
    setFotoReferenciaUrl(URL.createObjectURL(file))
    setMockupAiUrl(null)
  }

  const guardarMockupBrief = async (idBrief: number) => {
    if (mockupState.empty) return
    try {
      const mockupFile = await buildBriefMockupFile({
        idBrief,
        aiDataUrl: mockupAiUrl,
        captureElement: mockupCaptureRef.current
      })
      if (mockupFile) {
        const up = await apiService.uploadArchivoBriefPublico(mockupFile, idBrief, {
          nombreArchivo: BRIEF_MOCKUP_FILENAME,
          tipoEtiqueta: BRIEF_MOCKUP_TIPO
        })
        if (up.success && up.data) {
          setMockupUrlGuardado(up.data)
        }
      }
      if (fotoReferenciaFile) {
        await apiService.uploadArchivoBriefPublico(fotoReferenciaFile, idBrief, {
          nombreArchivo: fotoReferenciaFile.name,
          tipoEtiqueta: BRIEF_REFERENCIA_TIPO
        })
      }
    } catch (err) {
      console.warn('No se pudo guardar el mockup del brief:', err)
    }
  }

  const handleGenerarCamposIa = async (campo: BriefCamposIa) => {
    const contexto = buildIaContext()
    if (!contexto.trim() && campo === 'all') {
      setError('Seleccioná al menos un producto o servicio antes de usar la IA')
      return
    }
    setIaLoading(true)
    setError(null)
    try {
      const result = await generarBriefCamposIa({ contexto, campo })
      setFormData((prev) => ({
        ...prev,
        ...(result.objetivo_proyecto && (campo === 'all' || campo === 'objetivo')
          ? { objetivo_proyecto: result.objetivo_proyecto }
          : {}),
        ...(result.brief_publico && (campo === 'all' || campo === 'brief_publico')
          ? { brief_publico: result.brief_publico }
          : {}),
        ...(result.estilo_diseno && (campo === 'all' || campo === 'estilo_diseno')
          ? { estilo_diseno: result.estilo_diseno }
          : {})
      }))
      setMockupAiUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar con IA')
    } finally {
      setIaLoading(false)
    }
  }

  const handleGenerarMockupIa = async () => {
    if (mockupState.empty) return
    setMockupAiLoading(true)
    setError(null)
    try {
      const prompt = buildBriefMockupImagePrompt({
        productLabel: mockupState.productLabel,
        productKind: mockupState.productKind,
        sceneKind: mockupState.sceneKind,
        tipos: formData.tipo_producto_servicio,
        donde_colocados: formData.donde_colocados,
        objetivo_proyecto: formData.objetivo_proyecto,
        brief_publico: formData.brief_publico,
        estilo_diseno: formData.estilo_diseno,
        digital_o_impresion: formData.digital_o_impresion,
        cantidades: formData.cantidades
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
    if (!token) return

    // Validación básica
    if (!formData.cliente_nombre_completo.trim()) {
      setError('El nombre completo es obligatorio')
      return
    }

    if (formData.tipo_producto_servicio.length === 0 && !formData.necesita_asesoramiento) {
      setError('Debes seleccionar al menos un tipo de producto o servicio, o marcar que necesitas asesoramiento')
      return
    }

    setSaving(true)
    setError(null)
    
    try {
      // Usar la nueva función que actualiza la tabla de briefs
      const response = await apiService.actualizarBriefPublico({
        token,
        id_cliente: idCliente,
        cliente_nombre_completo: formData.cliente_nombre_completo.trim(),
        cliente_empresa: formData.cliente_empresa.trim() || undefined,
        telefono_cliente: formData.telefono_cliente.trim() || undefined,
        email_cliente: formData.email_cliente.trim() || undefined,
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
        referencias: formData.referencias.trim() || undefined,
        fecha_limite_brief: formData.fecha_limite_brief || undefined,
        es_urgencia: formData.es_urgencia
      })

      if (response.success) {
        let idBrief = briefId
        if (!idBrief && token) {
          const refreshed = await apiService.obtenerBriefPorToken(token)
          if (refreshed.success && refreshed.data?.id) {
            idBrief = refreshed.data.id
            setBriefId(idBrief)
          }
        }
        if (idBrief) {
          await guardarMockupBrief(idBrief)
        }
        setSuccess(true)
        if (onSuccess) {
          setTimeout(onSuccess, 1500)
        } else {
          setTimeout(() => {
            setSuccess(false)
          }, 5000)
        }
      } else {
        setError(response.error || 'Error al guardar el brief')
      }
    } catch (error) {
      console.error('Error guardando brief:', error)
      setError('Error al guardar el brief. Por favor intenta nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="brief-publico-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando formulario...</p>
        </div>
      </div>
    )
  }

  if (error && !orden) {
    return (
      <div className="brief-publico-page">
        <div className="error-container">
          <h1>❌ Error</h1>
          <p>{error}</p>
          <p className="error-help">El enlace puede haber expirado o ser inválido. Por favor contacta con nosotros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`brief-publico-page${isCliente ? ' brief-publico-page--cliente' : ''}`}>
      <div className={`brief-container${isCliente ? ' brief-container--cliente' : ''}`}>
        {!isCliente && (
        <header className="brief-header">
          <div className="brief-logo">
            <div className="brief-logo-main">
              <img
                src="https://plotcenter.com.ar/wp-content/uploads/2024/10/FAVICON_Mesa-de-trabajo-1.png"
                alt="Plot Center"
                className="brief-logo-img"
              />
              <div className="brief-logo-text">
                <h1>Formulario de Brief</h1>
                <p className="brief-subtitle">Plot Center</p>
                <p className="brief-address">9 de Julio 622 (Oeste), Capital · San Juan · Argentina</p>
              </div>
            </div>
          </div>
          {orden && (
            <div className="orden-info">
              <p><strong>Orden:</strong> OP #{orden.numero_op}</p>
              {orden.cliente && <p><strong>Cliente:</strong> {orden.cliente}</p>}
            </div>
          )}
        </header>
        )}

        {isCliente && orden && (
          <div className="brief-orden-compact">
            {orden.numero_op != null && <p><strong>OP #{orden.numero_op}</strong></p>}
            {orden.cliente && <p className="brief-orden-compact__cliente">{orden.cliente}</p>}
          </div>
        )}

        {!isCliente && mockupUrlGuardado && (
          <div className="brief-mockup-staff-banner">
            <h3 className="brief-mockup-staff-banner__title">Mockup del cliente</h3>
            <BriefMockupCard mockupUrl={mockupUrlGuardado} />
          </div>
        )}

        {success && (
          <div className="success-message">
            ✅ ¡Brief guardado exitosamente! Gracias por completar el formulario. Nos pondremos en contacto contigo pronto.
          </div>
        )}

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <div className={isCliente ? 'brief-studio-layout' : undefined}>
        <form onSubmit={handleSubmit} className="brief-form">
          {/* 1. Datos del Cliente */}
          <div className="form-section">
            <h2>1. Datos del Cliente</h2>
            
            <div className="form-group">
              <label htmlFor="cliente_nombre_completo">
                Nombre y Apellido *
              </label>
              <input
                id="cliente_nombre_completo"
                type="text"
                value={formData.cliente_nombre_completo}
                onChange={(e) => setFormData({ ...formData, cliente_nombre_completo: e.target.value })}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="cliente_empresa">
                Empresa / Emprendimiento (si aplica)
              </label>
              <input
                id="cliente_empresa"
                type="text"
                value={formData.cliente_empresa}
                onChange={(e) => setFormData({ ...formData, cliente_empresa: e.target.value })}
                placeholder="Nombre de tu empresa o emprendimiento"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="telefono_cliente">
                  Teléfono *
                </label>
                <input
                  id="telefono_cliente"
                  type="tel"
                  value={formData.telefono_cliente}
                  onChange={(e) => setFormData({ ...formData, telefono_cliente: e.target.value })}
                  placeholder="Ej: +54 9 264..."
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email_cliente">
                  Email *
                </label>
                <input
                  id="email_cliente"
                  type="email"
                  value={formData.email_cliente}
                  onChange={(e) => setFormData({ ...formData, email_cliente: e.target.value })}
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>
          </div>

          {/* 2. Tipo de Producto o Servicio */}
          <div className="form-section">
            <h2>2. Tipo de Producto o Servicio que Necesitás</h2>
            <p className="section-description">
              Marcá una o varias opciones{isCliente ? ' — el mockup a la derecha se actualiza al instante' : ''}
            </p>
            
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
              <label htmlFor="tipo_producto_otro">
                Otro:
              </label>
              <input
                id="tipo_producto_otro"
                type="text"
                value={formData.tipo_producto_otro}
                onChange={(e) => patchForm({ tipo_producto_otro: e.target.value })}
                placeholder="Especifica otro tipo de producto o servicio"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.necesita_asesoramiento}
                  onChange={(e) => {
                    setMockupAiUrl(null)
                    setFormData({ ...formData, necesita_asesoramiento: e.target.checked })
                  }}
                />
                <span>No sé bien lo que necesito, quiero asesoramiento</span>
              </label>
            </div>
          </div>

          {/* Detalles del Producto */}
          {formData.tipo_producto_servicio.length > 0 && (
            <div className="form-section">
              <h3>Detalles del Producto Seleccionado</h3>
              
              <div className="form-group">
                <label htmlFor="donde_colocados">
                  ¿Dónde serán colocados?
                </label>
                <input
                  id="donde_colocados"
                  type="text"
                  value={formData.donde_colocados}
                  onChange={(e) => patchForm({ donde_colocados: e.target.value })}
                  placeholder="Ej: En el local, en redes sociales, en vehículos, etc."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="digital_o_impresion">
                    ¿Digital o con impresión?
                  </label>
                  <select
                    id="digital_o_impresion"
                    value={formData.digital_o_impresion}
                    onChange={(e) => patchForm({ digital_o_impresion: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="digital">Solo Digital</option>
                    <option value="impresion">Con Impresión</option>
                    <option value="ambos">Ambos</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="cantidades">
                    ¿Qué cantidades?
                  </label>
                  <input
                    id="cantidades"
                    type="text"
                    value={formData.cantidades}
                    onChange={(e) => patchForm({ cantidades: e.target.value })}
                    placeholder="Ej: 100 unidades, 500 ejemplares, etc."
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Objetivo */}
          <div className="form-section">
            <div className="form-section-head">
              <h2>3. Objetivo del Producto o Servicio</h2>
              {isCliente && (
                <BriefIaBtn
                  label="Generar objetivo con IA"
                  loading={iaLoading}
                  disabled={mockupState.empty}
                  onClick={() => void handleGenerarCamposIa('objetivo')}
                />
              )}
            </div>
            <p className="section-description">
              Ej.: vender más, comunicar un evento, reforzar identidad, lanzamiento, señalización, etc.
            </p>
            
            <div className="form-group">
              <textarea
                rows={4}
                value={formData.objetivo_proyecto}
                onChange={(e) => patchForm({ objetivo_proyecto: e.target.value })}
                placeholder="Describe el objetivo principal de este proyecto..."
              />
            </div>
          </div>

          {/* 4. Material Disponible */}
          <div className="form-section">
            <h2>4. Material que Tenés Disponible para Brindarnos</h2>
            
            <div className="form-group">
              <label htmlFor="material_logo">Logo</label>
              <select
                id="material_logo"
                value={formData.material_logo}
                onChange={(e) => setFormData({ ...formData, material_logo: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                <option value="si_pdf_eps_ai">Sí (PDF, EPS, AI)</option>
                <option value="si_solo_imagen">Sí, pero solo en imagen o captura</option>
                <option value="no">No</option>
                <option value="necesito_diseno">Necesito que lo diseñen</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="material_textos">Textos</label>
              <select
                id="material_textos"
                value={formData.material_textos}
                onChange={(e) => setFormData({ ...formData, material_textos: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                <option value="si_definitivos">Sí, ya están definitivos</option>
                <option value="no">No</option>
                <option value="necesito_redacten">Necesito que ustedes los redacten</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="material_imagenes">Imágenes / Fotos</label>
              <select
                id="material_imagenes"
                value={formData.material_imagenes}
                onChange={(e) => setFormData({ ...formData, material_imagenes: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                <option value="si_material_propio">Sí, tengo material propio</option>
                <option value="no">No</option>
                <option value="usar_banco_imagenes">Usar banco de imágenes</option>
              </select>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.tiene_referencias}
                  onChange={(e) => setFormData({ ...formData, tiene_referencias: e.target.checked })}
                />
                <span>Referencias de estilo</span>
              </label>
            </div>

            {formData.tiene_referencias && (
              <div className="form-group">
                <label htmlFor="referencias_links">
                  Adjuntar links o imágenes de referencias
                </label>
                <textarea
                  id="referencias_links"
                  rows={3}
                  value={formData.referencias_links}
                  onChange={(e) => patchForm({ referencias_links: e.target.value })}
                  placeholder="Pega aquí los links de Pinterest, Behance, imágenes, o describe las referencias..."
                />
              </div>
            )}

            {isCliente && (
              <div className="form-group">
                <label htmlFor="brief-foto-ref">Foto de referencia (aparece en el mockup)</label>
                <input
                  id="brief-foto-ref"
                  type="file"
                  accept="image/*"
                  className="brief-file-input"
                  onChange={handleFotoReferencia}
                />
              </div>
            )}
          </div>

          {/* Brief Público */}
          <div className="form-section">
            <div className="form-section-head">
              <h2>Información Adicional del Proyecto</h2>
              {isCliente && (
                <div className="form-section-head__actions">
                  <BriefIaBtn
                    label="Descripción con IA"
                    loading={iaLoading}
                    disabled={mockupState.empty}
                    onClick={() => void handleGenerarCamposIa('brief_publico')}
                  />
                  <BriefIaBtn
                    label="Estilo con IA"
                    loading={iaLoading}
                    disabled={mockupState.empty}
                    onClick={() => void handleGenerarCamposIa('estilo_diseno')}
                  />
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="brief_publico">
                Descripción Detallada del Proyecto
              </label>
              <textarea
                id="brief_publico"
                rows={6}
                value={formData.brief_publico}
                onChange={(e) => patchForm({ brief_publico: e.target.value })}
                placeholder="Describe tu proyecto, contexto, ideas, y cualquier información relevante..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="estilo_diseno">
                Estilo de Diseño Deseado
              </label>
              <input
                id="estilo_diseno"
                type="text"
                value={formData.estilo_diseno}
                onChange={(e) => patchForm({ estilo_diseno: e.target.value })}
                placeholder="Ej: Minimalista, Corporativo, Moderno, Colorido, etc."
              />
            </div>
          </div>

          {/* 5. Plazos y Presupuesto */}
          <div className="form-section">
            <h2>5. Plazos y Presupuesto</h2>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="fecha_limite_brief">
                  ¿Tenés una fecha límite?
                </label>
                <input
                  id="fecha_limite_brief"
                  type="date"
                  value={formData.fecha_limite_brief}
                  onChange={(e) => setFormData({ ...formData, fecha_limite_brief: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label urgent-label">
                  <input
                    type="checkbox"
                    checked={formData.es_urgencia}
                    onChange={(e) => setFormData({ ...formData, es_urgencia: e.target.checked })}
                  />
                  <span>¿Este pedido es una urgencia?</span>
                </label>
                {formData.es_urgencia && (
                  <small className="urgent-warning">
                    ⚠️ Los pedidos marcados como urgencia ingresarán bajo el Ítem de Servicio Urgente, con tarifas diferenciales debido a la prioridad de ejecución.
                  </small>
                )}
              </div>
            </div>
          </div>

          {/* Bases y Condiciones */}
          <div className="form-section bases-condiciones">
            <h2>Bases y Condiciones</h2>
            <div className="bases-content">
              <div className="base-item">
                <h4>1. Validez del presupuesto</h4>
                <p>El presupuesto tendrá validez desde la fecha de emisión hasta la fecha límite indicada. Si no se recibe confirmación dentro de ese plazo, la propuesta será considerada no aceptada y podrá quedar sin efecto. El trabajo ingresará como orden de pedido una vez abonada la seña del 50% del monto total.</p>
              </div>
              
              <div className="base-item">
                <h4>2. Verificación de materiales e insumos provistos por el cliente</h4>
                <p>Antes de comenzar el diseño o producción, Plot Center revisará la calidad de logos, imágenes y textos enviados por el cliente. Si los insumos no cumplen con la calidad mínima necesaria, se informará al cliente. Podrá solicitarse el envío de materiales nuevos, o la realización de horas extra de diseño para vectorizar, mejorar o reconstruir archivos. Estas horas serán presupuestadas aparte y deberán aprobarse antes de avanzar.</p>
              </div>
              
              <div className="base-item">
                <h4>3. Correcciones incluidas</h4>
                <p>Cada proyecto incluye hasta tres (3) rondas de correcciones sin cargo. Las correcciones adicionales, cambios estructurales o pedidos que alteren significativamente el diseño serán cotizados como horas extra de diseño.</p>
              </div>
              
              <div className="base-item">
                <h4>4. Control y retiro de los productos</h4>
                <p>El cliente deberá revisar los productos al momento de recibirlos o retirarlos. Una vez retirado el material, Plot Center no se responsabiliza por faltantes, roturas o deterioros ocurridos fuera del local. Los reclamos deberán realizarse antes de abandonar el establecimiento.</p>
              </div>
              
              <div className="base-item">
                <h4>5. Entrega de archivos digitales y editables</h4>
                <p>La entrega de archivos digitales y/o editables se realiza por única vez. La conservación, resguardo y respaldo de los archivos será responsabilidad exclusiva del cliente. En caso de extravío o necesidad de reenvío, podrá aplicarse un costo adicional sujeto a disponibilidad.</p>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Enviar Brief'}
            </button>
          </div>
        </form>

        {isCliente && (
          <div className="brief-mockup-aside" aria-label="Vista previa fija al completar el brief">
            <ClienteBriefMockupStudio
              captureRef={mockupCaptureRef}
              productKind={mockupState.productKind}
              sceneKind={mockupState.sceneKind}
              productLabel={mockupState.productLabel}
              especificacion={formData.brief_publico || formData.objetivo_proyecto}
              dondeColocados={formData.donde_colocados}
              digitalOImpresion={formData.digital_o_impresion}
              cantidades={formData.cantidades}
              estiloDiseno={formData.estilo_diseno}
              selectedTipos={formData.tipo_producto_servicio}
              progress={briefProgress}
              empty={mockupState.empty}
              aiImageUrl={mockupAiUrl}
              loadingAi={mockupAiLoading}
              userImageUrl={fotoReferenciaUrl}
              iaLoading={iaLoading}
              onGenerarMockupIa={() => void handleGenerarMockupIa()}
              onGenerarTodoIa={() => void handleGenerarCamposIa('all')}
            />
          </div>
        )}
        </div>

        {!isCliente && (
        <footer className="brief-footer">
          <p>Plot Center SRL - 9 de Julio 622 - Oeste, Capital. San Juan · Argentina</p>
          <p>plotcenter.com.ar</p>
        </footer>
        )}
      </div>
    </div>
  )
}

export default BriefPublicoPage
