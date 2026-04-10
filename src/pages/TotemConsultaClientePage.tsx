import { useEffect, useMemo, useRef, useState } from 'react'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { historialPorOrdenId, historialUnificadoMismoNumeroOp } from '../utils/consultaOpHistorial'
import './ClienteConsultaPage.css'
import './TotemConsultaClientePage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const INACTIVITY_MS = 90000
const IDLE_MS = 60000 // Tras este tiempo sin tocar, se muestra pantalla en espera (modo kiosk)

const MAX_IMPRESION_BYTES = 15 * 1024 * 1024
const ACCEPT_IMPRESION = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp'

function validarArchivoImpresion(file: File): string | null {
  if (file.size > MAX_IMPRESION_BYTES) {
    return 'El archivo supera el máximo permitido (15 MB).'
  }
  const mime = file.type || ''
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const okMime =
    mime === 'application/pdf' || mime.startsWith('image/png') || mime.startsWith('image/jpeg') || mime === 'image/webp'
  const okExt = ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)
  if (!okMime && !okExt) {
    return 'Solo se admiten PDF o imágenes (JPG, PNG, WEBP).'
  }
  return null
}

const TIPOS_IMPRESION_TOTEM = [
  { value: 'Blanco y negro (láser)', label: 'Blanco y negro (láser)' },
  { value: 'Color (láser)', label: 'Color (láser)' },
  { value: 'Plotter / gran formato', label: 'Plotter / gran formato' },
  { value: 'Otro — coordinar en mostrador', label: 'Otro — coordinar en mostrador' }
] as const

const MP_QR_URL = typeof import.meta.env.VITE_TOTEM_MP_QR_URL === 'string' ? import.meta.env.VITE_TOTEM_MP_QR_URL.trim() : ''

// Señalética tal cual la foto: franjas horizontales, colores y textos para orientar
const TOTEM_SECTORS_QUEHACER: Array<{
  id: string
  label: string
  sectorDestino: string
  bg: string
  textColor: string
}> = [
  { id: 'presupuestos', label: 'PRESUPUESTOS Y ASESORAMIENTO', sectorDestino: 'Presupuestos y asesoramiento', bg: '#7dd3fc', textColor: '#0f172a' },
  { id: 'recepcion', label: 'RECEPCIÓN DE PEDIDOS', sectorDestino: 'Recepción de pedidos', bg: '#facc15', textColor: '#0f172a' },
  { id: 'diseno', label: 'DISEÑO GRÁFICO', sectorDestino: 'Diseño gráfico', bg: '#ec4899', textColor: '#fff' },
  { id: 'caja', label: 'CAJA / ENTREGA DE PEDIDOS', sectorDestino: 'Caja / Entrega de pedidos', bg: '#1f2937', textColor: '#fff' },
  { id: 'base_operaciones', label: 'BASE DE OPERACIONES', sectorDestino: 'Base de operaciones', bg: '#f97316', textColor: '#0f172a' },
  { id: 'marketing', label: 'MARKETING Y COMUNICACIÓN', sectorDestino: 'Marketing y comunicación', bg: '#ffffff', textColor: '#0f172a' }
]

const TotemConsultaClientePage = () => {
  const [searchOp, setSearchOp] = useState('')
  const [searchDni, setSearchDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [sectorDestino, setSectorDestino] = useState<string>('Mostrador')
  const [step, setStep] = useState<'idle' | 'welcome' | 'search'>('idle')
  const [selectedQueHacer, setSelectedQueHacer] = useState<string | null>(null)
  const [lastInteraction, setLastInteraction] = useState<number>(() => Date.now())
  const [archivoImpresion, setArchivoImpresion] = useState<File | null>(null)
  const [enviandoImpresion, setEnviandoImpresion] = useState(false)
  const [impresionModalOpen, setImpresionModalOpen] = useState(false)
  const [impresionModalStep, setImpresionModalStep] = useState<'form' | 'success'>('form')
  const [impresionResult, setImpresionResult] = useState<{
    solicitudId: number
    ventaId: number
    numeroVenta: string
    valor: number
  } | null>(null)
  const [impNombre, setImpNombre] = useState('')
  const [impImporte, setImpImporte] = useState('')
  const [impDni, setImpDni] = useState('')
  const [impTelefono, setImpTelefono] = useState('')
  const [impHojas, setImpHojas] = useState('')
  const [impTipo, setImpTipo] = useState<string>(TIPOS_IMPRESION_TOTEM[0].value)
  const [impOrigen, setImpOrigen] = useState<'pendrive' | 'subida'>('subida')
  const [impModalError, setImpModalError] = useState<string | null>(null)
  const impresionInputRef = useRef<HTMLInputElement>(null)

  const registrarInteraccion = () => setLastInteraction(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (step === 'idle') return
      if (elapsed > INACTIVITY_MS || elapsed > IDLE_MS) {
        setSearchOp('')
        setSearchDni('')
        setOrdenes([])
        setHistorial({})
        setError(null)
        setMensaje(null)
        setSelectedQueHacer(null)
        setArchivoImpresion(null)
        setImpresionModalOpen(false)
        setImpresionModalStep('form')
        setImpresionResult(null)
        setImpNombre('')
        setImpImporte('')
        setImpDni('')
        setImpTelefono('')
        setImpHojas('')
        setImpTipo(TIPOS_IMPRESION_TOTEM[0].value)
        setImpOrigen('subida')
        setImpModalError(null)
        if (impresionInputRef.current) impresionInputRef.current.value = ''
        setStep('idle')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, ordenes.length, searchOp, searchDni, step, selectedQueHacer])

  const buscarOrdenes = async (filtro: (orden: OrdenTrabajo) => boolean, mensajeError: string) => {
    registrarInteraccion()
    setStep('search')
    setLoading(true)
    setError(null)
    setMensaje(null)
    setOrdenes([])
    setHistorial({})

    try {
      const response = await apiService.getOrdenes()

      if (response.success && response.data) {
        const ordenesFiltradas = response.data.filter(filtro)

        if (ordenesFiltradas.length === 0) {
          setError(mensajeError)
          setLoading(false)
          return
        }

        setOrdenes(ordenesFiltradas)

        const ids = ordenesFiltradas
          .map((o) => o.id)
          .filter((id): id is number => typeof id === 'number' && id > 0)

        if (ids.length === 0) {
          setHistorial({})
        } else {
          const histResponse = await apiService.getHistorialMovimientos({
            ordenIds: ids,
            limit: 800
          })
          const movimientos =
            histResponse.success && histResponse.data ? histResponse.data : []
          setHistorial(historialPorOrdenId(movimientos, ids))
        }
      } else {
        setError('Error al buscar pedidos. Por favor intenta nuevamente.')
      }
    } catch (err) {
      console.error('Error buscando pedidos:', err)
      setError('Error al buscar pedidos. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchOp = async () => {
    const term = searchOp.trim()
    if (!term) {
      setError('Ingresá un número de OP para buscar.')
      return
    }
    const searchDigits = digitsOnly(term)
    if (!searchDigits) {
      setError('El número de OP debe contener dígitos.')
      return
    }

    await buscarOrdenes(
      (orden) => digitsOnly(orden.numero_op ?? '') === searchDigits,
      'No se encontraron trabajos con ese número de OP.'
    )
  }

  const handleSearchDni = async () => {
    const term = searchDni.trim()
    if (!term) {
      setError('Ingresá un DNI o CUIT para buscar.')
      return
    }
    const searchDigits = digitsOnly(term)
    if (searchDigits.length < 6) {
      setError('Ingresá al menos 6 dígitos de DNI/CUIT.')
      return
    }

    await buscarOrdenes(
      (orden) => digitsOnly(orden.dni_cuit ?? '') === searchDigits,
      'No se encontraron trabajos con ese DNI/CUIT.'
    )
  }

  const getEstadoLabel = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.label || estado
  }

  const getEstadoColor = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    const column = BOARD_COLUMNS.find((col) => col.id === status)
    return column?.accent || '#6b7280'
  }

  const isReadyForPickup = (estado: string) => {
    const status = mapEstadoToStatus(estado)
    return status === 'finalizado-taller' || status === 'almacen-entrega'
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const primerOrden = ordenes[0]

  const handleYaLlegue = async () => {
    registrarInteraccion()
    if (!primerOrden) {
      setError('Primero buscá tu trabajo para avisar que llegaste.')
      return
    }
    try {
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: primerOrden.cliente || 'Cliente tótem',
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden.id,
        notas: `Cliente se registró desde tótem. Sector sugerido: ${sectorDestino}.`,
        sector_destino: sectorDestino,
        orden_numero_op: primerOrden.numero_op ?? undefined
      })
      if (!res.success) {
        setError(res.error || 'No se pudo registrar tu llegada. Avisá en mostrador.')
      } else {
        setMensaje('✅ Avisamos a mostrador que estás esperando por tu trabajo.')
      }
    } catch (err) {
      console.error('Error registrando llegada desde tótem:', err)
      setError('No se pudo registrar tu llegada. Avisá en mostrador.')
    }
  }

  const handleLlamarAsesor = async () => {
    registrarInteraccion()
    try {
      const nombre = primerOrden?.cliente || 'Cliente tótem'
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: nombre,
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden?.id ?? undefined,
        notas: `Cliente pidió ayuda desde tótem de autoservicio. Sector sugerido: ${sectorDestino}.`,
        sector_destino: sectorDestino,
        orden_numero_op: primerOrden?.numero_op ?? undefined
      })
      if (!res.success) {
        setError(res.error || 'No se pudo avisar a un asesor. Avisá en mostrador.')
      } else {
        setMensaje('📞 Avisamos a un asesor que necesitás ayuda.')
      }
    } catch (err) {
      console.error('Error llamando asesor desde tótem:', err)
      setError('No se pudo avisar a un asesor. Avisá en mostrador.')
    }
  }

  const resetImpresionModalForm = () => {
    setImpresionModalStep('form')
    setImpresionResult(null)
    setArchivoImpresion(null)
    setImpModalError(null)
    setImpNombre('')
    setImpImporte('')
    setImpDni('')
    setImpTelefono('')
    setImpHojas('')
    setImpTipo(TIPOS_IMPRESION_TOTEM[0].value)
    setImpOrigen('subida')
    if (impresionInputRef.current) impresionInputRef.current.value = ''
  }

  const cerrarModalImpresion = () => {
    registrarInteraccion()
    setImpresionModalOpen(false)
    resetImpresionModalForm()
  }

  const handleConfirmarImpresionTotem = async () => {
    registrarInteraccion()
    setImpModalError(null)
    const nombre = impNombre.trim()
    const dni = digitsOnly(impDni)
    const tel = digitsOnly(impTelefono)
    const hojasN = parseInt(impHojas, 10)

    if (nombre.length < 2) {
      setImpModalError('Ingresá tu nombre completo.')
      return
    }
    if (dni.length < 6) {
      setImpModalError('Ingresá un DNI o CUIT válido (solo números).')
      return
    }
    if (tel.length < 8) {
      setImpModalError('Ingresá un teléfono de contacto (solo números, mínimo 8).')
      return
    }
    if (!Number.isFinite(hojasN) || hojasN < 1 || hojasN > 500) {
      setImpModalError('Indicá la cantidad de hojas (1 a 500).')
      return
    }
    const importeNorm = impImporte.trim().replace(/\./g, '').replace(',', '.')
    const importeN = importeNorm === '' ? NaN : parseFloat(importeNorm)
    if (importeNorm !== '' && (!Number.isFinite(importeN) || importeN < 0)) {
      setImpModalError('El importe debe ser un número válido (ej: 1500 o 1500,50).')
      return
    }
    if (!archivoImpresion) {
      setImpModalError('Elegí el archivo: podés traerlo en pendrive y seleccionarlo acá.')
      return
    }
    const vFile = validarArchivoImpresion(archivoImpresion)
    if (vFile) {
      setImpModalError(vFile)
      return
    }

    setEnviandoImpresion(true)
    try {
      const url = await uploadAttachmentAndGetUrl(archivoImpresion, 'totem_impresion')
      const res = await apiService.crearSolicitudImpresionTotem({
        cliente_nombre: nombre,
        cliente_dni: dni,
        cliente_telefono: tel,
        cantidad_hojas: hojasN,
        tipo_impresion: impTipo,
        origen_archivo: impOrigen === 'pendrive' ? 'pendrive' : 'subida_totem',
        archivo_url: url,
        archivo_nombre: archivoImpresion.name,
        orden_id: primerOrden?.id ?? null,
        numero_op: primerOrden?.numero_op ?? null,
        valor_total: importeNorm === '' ? null : importeN
      })
      if (!res.success || res.data == null) {
        setImpModalError(res.error || 'No se pudo registrar el pedido. Intentá de nuevo o acercate a mostrador.')
        return
      }
      setImpresionResult({
        solicitudId: res.data.solicitud_id,
        ventaId: res.data.venta_id,
        numeroVenta: res.data.numero_venta,
        valor: res.data.valor_total
      })
      setImpresionModalStep('success')
      setArchivoImpresion(null)
      if (impresionInputRef.current) impresionInputRef.current.value = ''
    } catch (err) {
      console.error('Error solicitud impresión tótem:', err)
      setImpModalError(
        err instanceof Error ? err.message : 'Error al subir el archivo. Verificá la conexión o acercate a mostrador.'
      )
    } finally {
      setEnviandoImpresion(false)
    }
  }

  const handleAvisarQueVoy = async () => {
    registrarInteraccion()
    const sector = selectedQueHacer ? TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer) : null
    if (!sector) return
    try {
      setError(null)
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: 'Cliente tótem',
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        notas: `Cliente se dirige a ${sector.label} (desde tótem).`,
        sector_destino: sector.sectorDestino
      })
      if (!res.success) {
        setError(res.error || 'No se pudo enviar el aviso.')
      } else {
        setMensaje(`✅ Avisamos a ${sector.label} que te dirigís hacia ahí.`)
      }
    } catch (err) {
      console.error('Error avisando desde tótem:', err)
      setError('No se pudo enviar el aviso.')
    }
  }

  const ordenesActivas = useMemo(
    () => ordenes.filter((o) => !isReadyForPickup(o.estado)),
    [ordenes]
  )

  const ordenesListas = useMemo(
    () => ordenes.filter((o) => isReadyForPickup(o.estado)),
    [ordenes]
  )

  const historialUnificadoLista = useMemo(() => {
    if (ordenes.length < 2) return null
    const all: HistorialMovimiento[] = []
    for (const o of ordenes) {
      if (o.id) all.push(...(historial[o.id] ?? []))
    }
    return historialUnificadoMismoNumeroOp(all, ordenes)
  }, [ordenes, historial])

  const etiquetaSectorFicha = (idOrden: number) =>
    ordenes.find((o) => o.id === idOrden)?.sector?.trim() || `Ficha #${idOrden}`

  const mostrarTimelineUnificado =
    historialUnificadoLista !== null && historialUnificadoLista.length > 0

  const renderTotemTimeline = (historialOrdenado: HistorialMovimiento[]) => {
    if (historialOrdenado.length === 0) return null
    return (
      <div className="timeline-section">
        <h4 className="timeline-title">Historial del trabajo</h4>
        <div className="timeline">
          {historialOrdenado.map((movimiento, index) => {
            const isLast = index === historialOrdenado.length - 1
            const estadoNuevo = getEstadoLabel(movimiento.estado_nuevo || '')
            const colorNuevo = getEstadoColor(movimiento.estado_nuevo || '')

            return (
              <div key={movimiento.id} className="timeline-item">
                <div
                  className="timeline-marker"
                  style={{ backgroundColor: colorNuevo }}
                >
                  {isLast ? '✓' : '○'}
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-estado" style={{ color: colorNuevo }}>
                      {estadoNuevo}
                    </span>
                    <span className="timeline-date">{formatDate(movimiento.timestamp)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="cliente-consulta-page totem-consulta-page"
      onClick={() => {
        if (step === 'idle') {
          setStep('welcome')
        }
        registrarInteraccion()
      }}
      onKeyDown={registrarInteraccion}
    >
      <div className="consulta-container totem-container">
        {step === 'idle' && (
          <div className="totem-idle">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center"
              className="totem-idle-logo"
            />
            <p className="totem-idle-cta">Tocá la pantalla para comenzar</p>
            <div className="totem-idle-horarios">
              <p className="totem-idle-horarios-title">Horarios de atención</p>
              <p className="totem-idle-horario">Lunes a Viernes: 9 a 17 hs</p>
              <p className="totem-idle-horario">Sábado: 9:00 a 14:00 hs</p>
            </div>
          </div>
        )}

        {step === 'welcome' && (
          <>
            <header className="consulta-header totem-header">
              <div className="header-content totem-header-content">
                <img
                  src="https://trello.plotcenter.com.ar/Group%20187.png"
                  alt="Plot Center Logo"
                  className="consulta-logo totem-logo"
                />
                <div className="header-text">
                  <h1>Bienvenido al tótem de Plot Center</h1>
                  <p>Desde aquí podés ver el estado de tus trabajos y avisar que ya llegaste.</p>
                </div>
              </div>
            </header>

            <div className="totem-welcome">
              <button
                className="totem-welcome-button"
                type="button"
                onClick={() => {
                  registrarInteraccion()
                  setStep('search')
                }}
              >
                🔍 Buscar mi trabajo
              </button>
              <p className="totem-welcome-hint">
                Vas a necesitar tu número de OP o tu DNI/CUIT.
              </p>
              <button
                type="button"
                className="totem-welcome-button totem-welcome-button--secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  registrarInteraccion()
                  resetImpresionModalForm()
                  setImpresionModalOpen(true)
                }}
              >
                🖨️ Imprimir un archivo
              </button>
              <p className="totem-welcome-hint totem-welcome-hint--tight">
                Completá tus datos, subí el archivo (o el de tu pendrive) y pagá en caja con Mercado Pago.
              </p>

              <div className="totem-senaletica-block">
                <h2 className="totem-senaletica-title">¿Hacia dónde te dirigís?</h2>
                <p className="totem-senaletica-subtitle">Tocá la franja del sector que necesitás</p>
                <div className="totem-senaletica-strips">
                  {TOTEM_SECTORS_QUEHACER.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      className="totem-senaletica-strip"
                      style={{
                        backgroundColor: sector.bg,
                        color: sector.textColor,
                        borderColor: sector.textColor === '#fff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)'
                      }}
                      onClick={() => {
                        registrarInteraccion()
                        setSelectedQueHacer(sector.id)
                        setError(null)
                        setMensaje(null)
                      }}
                    >
                      <span className="totem-strip-text">{sector.label}</span>
                      <span className="totem-strip-arrows">&gt;&gt;&gt;</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedQueHacer && (() => {
                const sector = TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer)
                if (!sector) return null
                return (
                  <div
                    className="totem-direccion-modal-overlay"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        registrarInteraccion()
                        setSelectedQueHacer(null)
                        setMensaje(null)
                        setError(null)
                      }
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="totem-modal-title"
                  >
                    <div className="totem-direccion-modal">
                      <button
                        type="button"
                        className="totem-direccion-modal-close"
                        onClick={() => {
                          registrarInteraccion()
                          setSelectedQueHacer(null)
                          setMensaje(null)
                          setError(null)
                        }}
                        aria-label="Cerrar"
                      >
                        ×
                      </button>
                      <div className="totem-direccion-modal-content">
                        <p className="totem-direccion-modal-leyenda" id="totem-modal-title">
                          Dirigite por la franja
                        </p>
                        <div
                          className="totem-direccion-strip-grande totem-modal-strip"
                          style={{ backgroundColor: sector.bg, color: sector.textColor }}
                        >
                          <span className="totem-direccion-strip-text">{sector.label}</span>
                          <span className="totem-direccion-strip-arrows">&gt;&gt;&gt;</span>
                        </div>
                        <p className="totem-direccion-modal-seguir">
                          Seguí las flechas en el piso hasta llegar a tu destino.
                        </p>
                        <div className="totem-direccion-actions">
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small secondary"
                            onClick={() => {
                              registrarInteraccion()
                              setSelectedQueHacer(null)
                              setMensaje(null)
                              setError(null)
                            }}
                          >
                            ← Volver
                          </button>
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small"
                            onClick={handleAvisarQueVoy}
                            disabled={loading}
                          >
                            Avisar que voy
                          </button>
                        </div>
                        {mensaje && (
                          <div className="totem-message totem-direccion-message">{mensaje}</div>
                        )}
                        {error && (
                          <div className="totem-error totem-direccion-error">{error}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </>
        )}

        {step === 'search' && (
          <>
            <header className="consulta-header totem-header">
              <div className="header-content totem-header-content">
                <img
                  src="https://trello.plotcenter.com.ar/Group%20187.png"
                  alt="Plot Center Logo"
                  className="consulta-logo totem-logo"
                />
                <div className="header-text">
                  <h1>Buscá tu trabajo</h1>
                  <p>
                    Ingresá tu número de OP o DNI/CUIT y te mostramos en qué estado está. Más abajo podés
                    enviar un archivo para imprimir en mostrador.
                  </p>
                </div>
              </div>
            </header>

            <div className="consulta-form-section totem-form">
              <div className="search-box totem-search-box">
                <div className="input-group">
                  <label htmlFor="consulta-op">Buscar por número de OP</label>
                  <input
                    id="consulta-op"
                    type="text"
                    value={searchOp}
                    onChange={(e) => {
                      registrarInteraccion()
                      setSearchOp(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchOp()
                    }}
                    placeholder="Ej: 000123"
                    className="dni-input totem-input"
                    disabled={loading}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <button
                  onClick={handleSearchOp}
                  disabled={loading || !searchOp.trim()}
                  className="search-button totem-button"
                >
                  {loading ? 'Buscando...' : 'Buscar por OP'}
                </button>
              </div>

              <div className="search-box secondary-search-box totem-search-box">
                <div className="input-group">
                  <label htmlFor="consulta-dni">Buscar por DNI / CUIT</label>
                  <input
                    id="consulta-dni"
                    type="text"
                    value={searchDni}
                    onChange={(e) => {
                      registrarInteraccion()
                      setSearchDni(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchDni()
                    }}
                    placeholder="Solo números de DNI o CUIT"
                    className="dni-input totem-input"
                    disabled={loading}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                </div>
                <button
                  onClick={handleSearchDni}
                  disabled={loading || !searchDni.trim()}
                  className="search-button totem-button"
                >
                  {loading ? 'Buscando...' : 'Buscar por DNI/CUIT'}
                </button>
              </div>

              <div
                className="totem-print-section totem-print-section--cta"
                onClick={(e) => e.stopPropagation()}
                role="region"
                aria-label="Imprimir archivo desde el tótem"
              >
                <h3 className="totem-print-title">¿Necesitás imprimir un archivo?</h3>
                <p className="totem-print-desc">
                  Te pedimos nombre, DNI, teléfono, cantidad de hojas y tipo de impresión. Si venís con pendrive,
                  conectalo y elegí el archivo acá. Avisamos a <strong>imprenta</strong>, <strong>mostrador</strong> y{' '}
                  <strong>caja</strong> (pago con Mercado Pago en caja).
                </p>
                <button
                  type="button"
                  className="totem-cta-button"
                  onClick={() => {
                    registrarInteraccion()
                    resetImpresionModalForm()
                    setImpresionModalOpen(true)
                  }}
                >
                  Comenzar pedido de impresión
                </button>
              </div>

              {error && (
                <div className="error-message totem-error">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              {mensaje && !error && (
                <div className="error-message totem-message">
                  <span>{mensaje}</span>
                </div>
              )}
            </div>
          </>
        )}

        {step === 'search' && ordenes.length > 0 && (
          <div className="ordenes-results totem-results">
            <h2 className="results-title">
              {ordenes.length === 1 ? 'Tu trabajo' : `Tus trabajos (${ordenes.length})`}
            </h2>

            {mostrarTimelineUnificado && historialUnificadoLista && (
              <div className="timeline-section timeline-section-unified totem-unified-timeline">
                <h3 className="timeline-unified-title">Recorrido completo de la orden</h3>
                <p className="timeline-unified-subtitle">
                  Hay {ordenes.length} fichas con el mismo número de OP. El historial unificado abajo
                  muestra todos los pasos en orden de fecha y en qué sector quedó cada registro.
                </p>
                <h4 className="timeline-title">Historial unificado</h4>
                <div className="timeline">
                  {historialUnificadoLista.map((movimiento, index) => {
                    const isLast = index === historialUnificadoLista.length - 1
                    const estadoNuevo = getEstadoLabel(movimiento.estado_nuevo || '')
                    const colorNuevo = getEstadoColor(movimiento.estado_nuevo || '')

                    return (
                      <div key={movimiento.id} className="timeline-item">
                        <div
                          className="timeline-marker"
                          style={{ backgroundColor: colorNuevo }}
                        >
                          {isLast ? '✓' : '○'}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-estado" style={{ color: colorNuevo }}>
                              {estadoNuevo}
                            </span>
                            <span className="timeline-date">
                              {formatDate(movimiento.timestamp)}
                            </span>
                          </div>
                          <div className="timeline-meta-sector">
                            {etiquetaSectorFicha(movimiento.id_orden)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="totem-actions-row">
              <div className="totem-sectors-row">
                <span className="totem-sectors-label">¿Para qué sector venís?</span>
                {['Mostrador', 'Diseño', 'Instalaciones', 'Caja'].map((sector) => (
                  <button
                    key={sector}
                    type="button"
                    className={`totem-sector-chip ${
                      sectorDestino === sector ? 'active' : ''
                    }`}
                    onClick={() => {
                      registrarInteraccion()
                      setSectorDestino(sector)
                    }}
                  >
                    {sector}
                  </button>
                ))}
              </div>

              <button className="totem-cta-button" onClick={handleYaLlegue}>
                🖐️ Ya llegué, estoy esperando
              </button>
              <button className="totem-cta-button secondary" onClick={handleLlamarAsesor}>
                📞 Llamar a un asesor
              </button>
            </div>

            {ordenesListas.length > 0 && (
              <div className="totem-section">
                <h3>Listos para retirar</h3>
                {ordenesListas.map((orden) => {
                  const ordenHistorial = historial[orden.id] || []
                  const historialOrdenado = [...ordenHistorial].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                  const dniCuit = orden.dni_cuit ? digitsOnly(orden.dni_cuit) : null

                  return (
                    <div key={orden.id} className="orden-card ready-for-pickup">
                      <div className="pickup-banner">
                        <div className="pickup-content">
                          <span className="pickup-icon">🎉</span>
                          <div className="pickup-text">
                            <strong>¡Tu pedido está listo para retirar!</strong>
                            <span>Acercate a mostrador con tu número de OP.</span>
                          </div>
                        </div>
                      </div>
                      <div className="orden-header">
                        <div className="orden-info">
                          <div className="orden-op-row">
                            <span className="orden-op-label">Orden de Producción</span>
                            <h3 className="orden-op-numero">#{orden.numero_op}</h3>
                          </div>
                          <p className="orden-cliente">{orden.cliente}</p>
                          {dniCuit && (
                            <div className="orden-dni">
                              <span className="orden-dni-label">DNI/CUIT:</span>
                              <span className="orden-dni-value">{dniCuit}</span>
                            </div>
                          )}
                        </div>
                        <div
                          className="orden-estado-badge ready-badge"
                          style={{ backgroundColor: getEstadoColor(orden.estado) }}
                        >
                          {getEstadoLabel(orden.estado)}
                          <span className="ready-indicator">✓</span>
                        </div>
                      </div>

                      {mostrarTimelineUnificado ? (
                        <div className="orden-historial-delegado">
                          <p>
                            Parte del pedido en{' '}
                            <strong>{orden.sector?.trim() || 'este sector'}</strong>. Ver historial
                            arriba.
                          </p>
                        </div>
                      ) : (
                        renderTotemTimeline(historialOrdenado)
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {ordenesActivas.length > 0 && (
              <div className="totem-section">
                <h3>En proceso</h3>
                {ordenesActivas.map((orden) => {
                  const ordenHistorial = historial[orden.id] || []
                  const historialOrdenado = [...ordenHistorial].sort(
                    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                  const dniCuit = orden.dni_cuit ? digitsOnly(orden.dni_cuit) : null

                  return (
                    <div key={orden.id} className="orden-card">
                      <div className="orden-header">
                        <div className="orden-info">
                          <div className="orden-op-row">
                            <span className="orden-op-label">Orden de Producción</span>
                            <h3 className="orden-op-numero">#{orden.numero_op}</h3>
                          </div>
                          <p className="orden-cliente">{orden.cliente}</p>
                          {dniCuit && (
                            <div className="orden-dni">
                              <span className="orden-dni-label">DNI/CUIT:</span>
                              <span className="orden-dni-value">{dniCuit}</span>
                            </div>
                          )}
                        </div>
                        <div
                          className="orden-estado-badge"
                          style={{ backgroundColor: getEstadoColor(orden.estado) }}
                        >
                          {getEstadoLabel(orden.estado)}
                        </div>
                      </div>

                      {mostrarTimelineUnificado ? (
                        <div className="orden-historial-delegado">
                          <p>
                            Parte del pedido en{' '}
                            <strong>{orden.sector?.trim() || 'este sector'}</strong>. Ver historial
                            arriba.
                          </p>
                        </div>
                      ) : (
                        renderTotemTimeline(historialOrdenado)
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {impresionModalOpen && (
          <div
            className="totem-impresion-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="totem-impresion-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) cerrarModalImpresion()
            }}
          >
            <div className="totem-impresion-modal" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="totem-impresion-modal-close" onClick={cerrarModalImpresion} aria-label="Cerrar">
                ×
              </button>
              {impresionModalStep === 'form' ? (
                <>
                  <h2 id="totem-impresion-modal-title" className="totem-impresion-modal-title">
                    Pedido de impresión
                  </h2>
                  <p className="totem-impresion-modal-intro">
                    Si traés el archivo en <strong>pendrive</strong>, conectalo al tótem y elegilo abajo. También podés
                    subir desde el teléfono por cable o el mismo equipo.
                  </p>
                  <div className="totem-impresion-field">
                    <label htmlFor="totem-imp-nombre">Nombre y apellido</label>
                    <input
                      id="totem-imp-nombre"
                      className="totem-impresion-input"
                      value={impNombre}
                      onChange={(e) => {
                        registrarInteraccion()
                        setImpNombre(e.target.value)
                      }}
                      autoComplete="name"
                      placeholder="Como figura en tu DNI"
                    />
                  </div>
                  <div className="totem-impresion-row2">
                    <div className="totem-impresion-field">
                      <label htmlFor="totem-imp-dni">DNI / CUIT (solo números)</label>
                      <input
                        id="totem-imp-dni"
                        className="totem-impresion-input"
                        value={impDni}
                        onChange={(e) => {
                          registrarInteraccion()
                          setImpDni(e.target.value)
                        }}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ej: 30123456"
                      />
                    </div>
                    <div className="totem-impresion-field">
                      <label htmlFor="totem-imp-tel">Teléfono (solo números)</label>
                      <input
                        id="totem-imp-tel"
                        className="totem-impresion-input"
                        value={impTelefono}
                        onChange={(e) => {
                          registrarInteraccion()
                          setImpTelefono(e.target.value)
                        }}
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Código área + número"
                      />
                    </div>
                  </div>
                  <div className="totem-impresion-row2">
                    <div className="totem-impresion-field">
                      <label htmlFor="totem-imp-hojas">Cantidad de hojas a imprimir</label>
                      <input
                        id="totem-imp-hojas"
                        className="totem-impresion-input"
                        value={impHojas}
                        onChange={(e) => {
                          registrarInteraccion()
                          setImpHojas(e.target.value.replace(/\D/g, ''))
                        }}
                        inputMode="numeric"
                        placeholder="Ej: 10"
                      />
                    </div>
                    <div className="totem-impresion-field">
                      <label htmlFor="totem-imp-importe">Importe a cobrar (ARS, opcional)</label>
                      <input
                        id="totem-imp-importe"
                        className="totem-impresion-input"
                        value={impImporte}
                        onChange={(e) => {
                          registrarInteraccion()
                          setImpImporte(e.target.value)
                        }}
                        inputMode="decimal"
                        placeholder="Ej: 2500 o 2500,50"
                      />
                    </div>
                  </div>
                  <div className="totem-impresion-field">
                    <label htmlFor="totem-imp-tipo">Tipo de impresión</label>
                    <select
                      id="totem-imp-tipo"
                      className="totem-impresion-select"
                      value={impTipo}
                      onChange={(e) => {
                        registrarInteraccion()
                        setImpTipo(e.target.value)
                      }}
                    >
                      {TIPOS_IMPRESION_TOTEM.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="totem-impresion-importe-hint">
                    Si no sabés el monto, dejalo vacío: se registra un valor mínimo y <strong>caja</strong> lo corrige en
                    el CRM de ventas.
                  </p>
                  <fieldset className="totem-impresion-origen">
                    <legend>Origen del archivo</legend>
                    <label className="totem-impresion-radio">
                      <input
                        type="radio"
                        name="origen-imp"
                        checked={impOrigen === 'subida'}
                        onChange={() => {
                          registrarInteraccion()
                          setImpOrigen('subida')
                        }}
                      />
                      Lo subo desde acá (PC / pendrive conectado)
                    </label>
                    <label className="totem-impresion-radio">
                      <input
                        type="radio"
                        name="origen-imp"
                        checked={impOrigen === 'pendrive'}
                        onChange={() => {
                          registrarInteraccion()
                          setImpOrigen('pendrive')
                        }}
                      />
                      Vengo con archivo en pendrive (elegilo abajo)
                    </label>
                  </fieldset>
                  <div className="totem-impresion-field">
                    <label htmlFor="totem-imp-file">Archivo (PDF o imagen, máx. 15 MB)</label>
                    <input
                      ref={impresionInputRef}
                      id="totem-imp-file"
                      type="file"
                      accept={ACCEPT_IMPRESION}
                      className="totem-impresion-file"
                      disabled={enviandoImpresion}
                      onChange={(e) => {
                        registrarInteraccion()
                        setImpModalError(null)
                        setArchivoImpresion(e.target.files?.[0] ?? null)
                      }}
                    />
                    {archivoImpresion && (
                      <p className="totem-impresion-file-hint">
                        {archivoImpresion.name} — {(archivoImpresion.size / 1024).toFixed(0)} KB
                      </p>
                    )}
                  </div>
                  {primerOrden && (
                    <p className="totem-impresion-op-link">
                      Vinculamos tu búsqueda: OP <strong>#{primerOrden.numero_op}</strong>
                    </p>
                  )}
                  {impModalError && <div className="totem-error totem-impresion-modal-error">{impModalError}</div>}
                  <div className="totem-impresion-modal-actions">
                    <button type="button" className="totem-cta-button secondary" onClick={cerrarModalImpresion}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="totem-cta-button"
                      disabled={enviandoImpresion}
                      onClick={handleConfirmarImpresionTotem}
                    >
                      {enviandoImpresion ? 'Enviando…' : 'Enviar pedido'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="totem-impresion-modal-title">Pedido registrado</h2>
                  <p className="totem-impresion-success-lead">
                    Solicitud tótem{' '}
                    <strong className="totem-impresion-solicitud-id">#{impresionResult?.solicitudId}</strong>
                    {impresionResult?.numeroVenta ? (
                      <>
                        {' '}
                        · Venta CRM <strong>{impresionResult.numeroVenta}</strong>
                        {impresionResult.valor > 0 ? (
                          <>
                            {' '}
                            (${impresionResult.valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                          </>
                        ) : null}
                      </>
                    ) : null}
                    . Decilo en <strong>caja</strong> al pagar.
                  </p>
                  <p className="totem-impresion-success-text">
                    Quedó cargado en <strong>ventas</strong> como pendiente de cobro. Imprenta y mostrador ya tienen el
                    archivo. Cuando caja confirma el pago (Mercado Pago u otro), se actualiza la venta y les avisamos de
                    nuevo.
                  </p>
                  {MP_QR_URL ? (
                    <div className="totem-impresion-mp-block">
                      <p className="totem-impresion-mp-label">Mercado Pago — escaneá en caja</p>
                      <img src={MP_QR_URL} alt="Código QR Mercado Pago" className="totem-impresion-mp-qr" />
                    </div>
                  ) : (
                    <p className="totem-impresion-mp-fallback">
                      Pagá en caja con <strong>Mercado Pago</strong> (QR del mostrador). Tu cajero puede marcar el pago
                      con el número de solicitud.
                    </p>
                  )}
                  <button type="button" className="totem-cta-button" onClick={cerrarModalImpresion}>
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="consulta-footer totem-footer">
          <p>Si tenés dudas, acercate a mostrador con tu número de OP.</p>
        </footer>
      </div>
    </div>
  )
}

export default TotemConsultaClientePage

