import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { historialPorOrdenId, historialUnificadoMismoNumeroOp } from '../utils/consultaOpHistorial'
import { TOTEM_SOLICITUD_ASESOR_MARKER } from '../constants/totemSolicitudAsesor'
import { TOTEM_FINALIZADO_TALLER_PATH } from '../constants/totemFinalizadoTaller'
import {
  isOpEnAlmacenEntrega,
  isOpFinalizadoEnTaller
} from '../utils/totemConsultaOpEstado'
import { TotemAutogestionPlotAiChat } from '@/components/ui/TotemAutogestionPlotAiChat'
import { TotemKioskIcon, type TotemKioskIconName } from '../components/totem/TotemKioskIcons'
import { requestTotemKioskFullscreen, useTotemKioskFullscreen } from '../hooks/useTotemKioskMode'
import './ClienteConsultaPage.css'
import './TotemConsultaClientePage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const INACTIVITY_MS = 90000
const IDLE_MS = 60000 // Tras este tiempo sin tocar, se muestra pantalla en espera (modo kiosk)

type SectorDirection = 'planta-baja' | 'primer-piso'

// Señalética: franjas horizontales; Diseño y Marketing → 1° piso (flecha arriba)
const TOTEM_SECTORS_QUEHACER: Array<{
  id: string
  label: string
  icon: TotemKioskIconName
  sectorDestino: string
  bg: string
  textColor: string
  direction: SectorDirection
}> = [
  {
    id: 'presupuestos',
    label: 'PRESUPUESTOS Y ASESORAMIENTO',
    icon: 'presupuestos',
    sectorDestino: 'Presupuestos y asesoramiento',
    bg: '#7dd3fc',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'recepcion',
    label: 'RECEPCIÓN DE PEDIDOS',
    icon: 'recepcion',
    sectorDestino: 'Recepción de pedidos',
    bg: '#facc15',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'diseno',
    label: 'DISEÑO GRÁFICO',
    icon: 'diseno',
    sectorDestino: 'Diseño gráfico',
    bg: '#ec4899',
    textColor: '#fff',
    direction: 'primer-piso'
  },
  {
    id: 'caja',
    label: 'CAJA / ENTREGA DE PEDIDOS',
    icon: 'caja',
    sectorDestino: 'Caja / Entrega de pedidos',
    bg: '#1f2937',
    textColor: '#fff',
    direction: 'planta-baja'
  },
  {
    id: 'base_operaciones',
    label: 'BASE DE OPERACIONES',
    icon: 'base_operaciones',
    sectorDestino: 'Base de operaciones',
    bg: '#f97316',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'marketing',
    label: 'MARKETING Y COMUNICACIÓN',
    icon: 'marketing',
    sectorDestino: 'Marketing y comunicación',
    bg: '#ffffff',
    textColor: '#0f172a',
    direction: 'primer-piso'
  }
]

function SectorDirectionArrows({ direction }: { direction: SectorDirection }) {
  if (direction === 'primer-piso') {
    return (
      <span className="totem-strip-direction totem-strip-direction--up" aria-label="Subir al primer piso">
        <span className="totem-strip-floor-badge">1° piso</span>
        <span className="totem-strip-arrows-up" aria-hidden>
          ↑ ↑ ↑
        </span>
      </span>
    )
  }
  return (
    <span className="totem-strip-direction totem-strip-direction--ahead" aria-hidden>
      <span className="totem-strip-arrows">&gt;&gt;&gt;</span>
    </span>
  )
}

const TotemConsultaClientePage = () => {
  const navigate = useNavigate()
  const [searchOp, setSearchOp] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [sectorDestino, setSectorDestino] = useState<string>('Mostrador')
  const [step, setStep] = useState<'idle' | 'welcome' | 'search'>('idle')
  const [selectedQueHacer, setSelectedQueHacer] = useState<string | null>(null)
  const [avisoVoyNombre, setAvisoVoyNombre] = useState('')
  const [avisoVoyMotivo, setAvisoVoyMotivo] = useState('')
  const [enviandoAvisoVoy, setEnviandoAvisoVoy] = useState(false)
  const [lastInteraction, setLastInteraction] = useState<number>(() => Date.now())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { toggle: toggleKioskFullscreen } = useTotemKioskFullscreen()
  const pageRef = useRef<HTMLDivElement>(null)

  const registrarInteraccion = () => setLastInteraction(Date.now())

  const registrarInteraccionKiosk = () => {
    registrarInteraccion()
    if (!document.fullscreenElement && pageRef.current) {
      void requestTotemKioskFullscreen(pageRef.current)
    }
  }

  const volverAWelcome = () => {
    registrarInteraccion()
    setSearchOp('')
    setOrdenes([])
    setHistorial({})
    setError(null)
    setMensaje(null)
    setLoading(false)
    setStep('welcome')
  }

  const toggleFullscreen = async () => {
    registrarInteraccion()
    const el = pageRef.current
    if (!el) return
    await toggleKioskFullscreen(el)
  }

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - lastInteraction
      if (step === 'idle') return
      if (elapsed > INACTIVITY_MS || elapsed > IDLE_MS) {
        setSearchOp('')
        setOrdenes([])
        setHistorial({})
        setError(null)
        setMensaje(null)
        setSelectedQueHacer(null)
        setAvisoVoyNombre('')
        setAvisoVoyMotivo('')
        setStep('idle')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, ordenes.length, searchOp, step, selectedQueHacer])

  const buscarOrdenes = async (
    filtro: (orden: OrdenTrabajo) => boolean,
    mensajeError: string,
    opBuscada?: string
  ) => {
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

        let histMap: Record<number, HistorialMovimiento[]> = {}
        if (ids.length === 0) {
          setHistorial({})
        } else {
          const histResponse = await apiService.getHistorialMovimientos({
            ordenIds: ids,
            limit: 800
          })
          const movimientos =
            histResponse.success && histResponse.data ? histResponse.data : []
          histMap = historialPorOrdenId(movimientos, ids)
          setHistorial(histMap)
        }

        const tieneEntradaTaller = ordenesFiltradas.some((o) => isOpFinalizadoEnTaller(o.estado))
        if (tieneEntradaTaller) {
          const op =
            opBuscada?.trim() ||
            String(ordenesFiltradas[0]?.numero_op ?? '').trim()
          navigate(`${TOTEM_FINALIZADO_TALLER_PATH}?op=${encodeURIComponent(op)}`)
          return
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
      'No se encontraron trabajos con ese número de OP.',
      term
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
      const notas = `Sector sugerido: ${sectorDestino}. ${TOTEM_SOLICITUD_ASESOR_MARKER}`
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: nombre,
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden?.id ?? undefined,
        notas,
        sector_destino: 'Asesor',
        orden_numero_op: primerOrden?.numero_op ?? undefined
      })
      if (!res.success) {
        setError(res.error || 'No se pudo avisar a un asesor. Avisá en mostrador.')
        return
      }

      const broadcastRes = await apiService.broadcastTotemSolicitudAsesor({
        atencionId: res.data,
        clienteNombre: nombre,
        numeroOp: primerOrden?.numero_op ? String(primerOrden.numero_op) : undefined,
        sectorDestino,
        notas
      })

      if (!broadcastRes.success) {
        setMensaje(
          '📞 Registramos tu solicitud. Si nadie viene enseguida, acercate a mostrador.'
        )
      } else {
        setMensaje('📞 Avisamos a un asesor que necesitás ayuda. En breve te atienden.')
      }
    } catch (err) {
      console.error('Error llamando asesor desde tótem:', err)
      setError('No se pudo avisar a un asesor. Avisá en mostrador.')
    }
  }

  const handleAvisarQueVoy = async () => {
    registrarInteraccion()
    const sector = selectedQueHacer ? TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer) : null
    if (!sector) return

    const nombre = avisoVoyNombre.trim()
    const motivo = avisoVoyMotivo.trim()
    if (!nombre) {
      setError('Ingresá tu nombre.')
      setMensaje(null)
      return
    }
    if (!motivo) {
      setError('Contanos el motivo de tu visita.')
      setMensaje(null)
      return
    }

    try {
      setError(null)
      setMensaje(null)
      setEnviandoAvisoVoy(true)
      const res = await apiService.crearAtencionMostrador({
        cliente_nombre: nombre,
        tipo: 'consulta',
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        notas: `Cliente se dirige a ${sector.label} (desde tótem). Motivo: ${motivo}`,
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
    } finally {
      setEnviandoAvisoVoy(false)
    }
  }

  const ordenesActivas = useMemo(
    () =>
      ordenes.filter(
        (o) => !isOpEnAlmacenEntrega(o.estado) && !isOpFinalizadoEnTaller(o.estado)
      ),
    [ordenes]
  )

  const ordenesListas = useMemo(
    () => ordenes.filter((o) => isOpEnAlmacenEntrega(o.estado)),
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
      ref={pageRef}
      className={`cliente-consulta-page totem-consulta-page${isFullscreen ? ' totem-consulta-page--fs' : ''}`}
      onClick={() => {
        if (step === 'idle') {
          setStep('welcome')
        }
        registrarInteraccionKiosk()
      }}
      onKeyDown={registrarInteraccion}
    >
      <div className={`consulta-container totem-container totem-step-${step}`}>
        {step === 'idle' && (
          <div className="totem-idle">
            <div className="totem-idle-inner">
              <div className="totem-kiosk-logo-ring totem-idle-logo-ring">
                <img
                  src="https://trello.plotcenter.com.ar/Group%20187.png"
                  alt="Plot Center"
                  className="totem-idle-logo"
                />
              </div>
              <p className="totem-idle-kicker">Plot Center · Tótem</p>
              <p className="totem-idle-tagline">Impresión · Diseño · Comunicación visual</p>
              <p className="totem-idle-cta-text">Tocá la pantalla para comenzar</p>
              <div className="totem-idle-horarios">
                <p className="totem-idle-horarios-title">Horarios de atención</p>
                <p className="totem-idle-horario">
                  <span className="totem-idle-horario-day">Lun – Vie</span>
                  <span className="totem-idle-horario-time">7:00 – 21:30 hs</span>
                </p>
                <p className="totem-idle-horario">
                  <span className="totem-idle-horario-day">Sábado</span>
                  <span className="totem-idle-horario-time">8:00 – 20:00 hs</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'welcome' && (
          <div className="totem-welcome-screen" onClick={(e) => e.stopPropagation()}>
            <header className="totem-kiosk-header totem-welcome-top">
              <div className="totem-kiosk-header-brand">
                <div className="totem-kiosk-logo-ring">
                  <img
                    src="https://trello.plotcenter.com.ar/Group%20187.png"
                    alt="Plot Center"
                    className="totem-welcome-top-logo"
                  />
                </div>
                <div>
                  <p className="totem-kiosk-eyebrow">Autogestión en mostrador</p>
                  <p className="totem-kiosk-lead">
                    Consultá tu OP, imprimí o elegí productos del catálogo
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="totem-kiosk-fs-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleFullscreen()
                }}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? '⊡ Salir pantalla grande' : '⛶ Pantalla grande'}
              </button>
            </header>

            <div className="totem-welcome-grid">
              <div className="totem-welcome-main">
                <div className="totem-kiosk-actions">
                  <button
                    className="totem-kiosk-tile totem-kiosk-tile--search"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      setStep('search')
                    }}
                  >
                    <span className="totem-kiosk-ico-ring totem-kiosk-ico-ring--orange" aria-hidden>
                      <TotemKioskIcon name="search" size="tile" />
                    </span>
                    <span className="totem-kiosk-tile-title">Buscar mi trabajo</span>
                    <span className="totem-kiosk-tile-desc">Estado de tu OP en tiempo real</span>
                  </button>
                  <button
                    className="totem-kiosk-tile totem-kiosk-tile--print"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      navigate('/totem/autogestion/imprimir')
                    }}
                  >
                    <span className="totem-kiosk-ico-ring totem-kiosk-ico-ring--blue" aria-hidden>
                      <TotemKioskIcon name="print" size="tile" />
                    </span>
                    <span className="totem-kiosk-tile-title">Imprimir</span>
                    <span className="totem-kiosk-tile-desc">Fotos, documentos y más</span>
                  </button>
                  <button
                    className="totem-kiosk-tile totem-kiosk-tile--catalog"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      registrarInteraccionKiosk()
                      navigate('/totem/autogestion/catalogo', {
                        state: { returnTo: '/totem/consulta-cliente' }
                      })
                    }}
                  >
                    <span className="totem-kiosk-ico-ring totem-kiosk-ico-ring--emerald" aria-hidden>
                      <TotemKioskIcon name="catalog" size="tile" />
                    </span>
                    <span className="totem-kiosk-tile-title">Comprar</span>
                    <span className="totem-kiosk-tile-desc">Compra Tu Producto</span>
                  </button>
                </div>

                <div className="totem-senaletica-block totem-senaletica-block--compact totem-kiosk-panel">
                  <div className="totem-senaletica-head">
                    <h2 className="totem-senaletica-title">¿Hacia dónde te dirigís?</h2>
                    <p className="totem-senaletica-subtitle">
                      <span className="totem-senaletica-badge">1° piso ↑</span>
                      Diseño y Marketing
                    </p>
                  </div>
                  <div className="totem-senaletica-strips totem-senaletica-strips--modern">
                    {TOTEM_SECTORS_QUEHACER.map((sector) => (
                      <button
                        key={sector.id}
                        type="button"
                        className={`totem-senaletica-strip${sector.direction === 'primer-piso' ? ' totem-senaletica-strip--upstairs' : ''}`}
                        style={{
                          backgroundColor: sector.bg,
                          color: sector.textColor,
                          borderColor:
                            sector.textColor === '#fff'
                              ? 'rgba(255,255,255,0.4)'
                              : 'rgba(0,0,0,0.15)'
                        }}
                        onClick={() => {
                          registrarInteraccion()
                          setSelectedQueHacer(sector.id)
                          setError(null)
                          setMensaje(null)
                          setAvisoVoyNombre('')
                          setAvisoVoyMotivo('')
                        }}
                      >
                        <span className="totem-strip-icon" aria-hidden>
                          <TotemKioskIcon name={sector.icon} size="strip" />
                        </span>
                        <span className="totem-strip-text">{sector.label}</span>
                        <SectorDirectionArrows direction={sector.direction} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="totem-welcome-aside">
                <div className="totem-consulta-chat-block totem-consulta-chat-block--compact totem-kiosk-panel">
                  <div className="totem-senaletica-head">
                    <h2 className="totem-senaletica-title">¿Qué servicios ofrecemos?</h2>
                    <p className="totem-senaletica-subtitle">Preguntale a PlotAI en pantalla</p>
                  </div>
                  <TotemAutogestionPlotAiChat
                    className="totem-consulta-plotai"
                    compact
                    modo="totem_consulta_cliente"
                    conversationStorageKey="plotrello_totem_consulta_cliente_plotai_conv"
                    emptyHint="Ej: ¿Hacen vinilos? ¿Horarios?"
                  />
                </div>
              </aside>
            </div>

              {selectedQueHacer && (() => {
                const sector = TOTEM_SECTORS_QUEHACER.find((s) => s.id === selectedQueHacer)
                if (!sector) return null
                return (
                  <div
                    className="totem-direccion-modal-overlay totem-modal-overlay-enter"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        registrarInteraccion()
                        setSelectedQueHacer(null)
                        setMensaje(null)
                        setError(null)
                        setAvisoVoyNombre('')
                        setAvisoVoyMotivo('')
                      }
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="totem-modal-title"
                  >
                    <div className="totem-direccion-modal totem-modal-enter" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="totem-direccion-modal-close"
                        onClick={() => {
                          registrarInteraccion()
                          setSelectedQueHacer(null)
                          setMensaje(null)
                          setError(null)
                          setAvisoVoyNombre('')
                          setAvisoVoyMotivo('')
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
                          className={`totem-direccion-strip-grande totem-modal-strip${sector.direction === 'primer-piso' ? ' totem-modal-strip--upstairs' : ''}`}
                          style={{ backgroundColor: sector.bg, color: sector.textColor }}
                        >
                          <span className="totem-direccion-strip-text">{sector.label}</span>
                          <SectorDirectionArrows direction={sector.direction} />
                        </div>
                        <p className="totem-direccion-modal-seguir">
                          {sector.direction === 'primer-piso'
                            ? 'Subí al 1° piso por las escaleras y seguí las flechas en el piso hasta llegar a tu destino.'
                            : 'Seguí las flechas en el piso hasta llegar a tu destino.'}
                        </p>
                        <div className="totem-direccion-aviso-form">
                          <div className="totem-direccion-field">
                            <label htmlFor="totem-aviso-nombre">Tu nombre</label>
                            <input
                              id="totem-aviso-nombre"
                              type="text"
                              className="dni-input totem-input totem-direccion-input"
                              value={avisoVoyNombre}
                              onChange={(e) => {
                                registrarInteraccion()
                                setAvisoVoyNombre(e.target.value)
                              }}
                              placeholder="Nombre y apellido"
                              autoComplete="name"
                              disabled={enviandoAvisoVoy}
                            />
                          </div>
                          <div className="totem-direccion-field">
                            <label htmlFor="totem-aviso-motivo">Motivo de la visita</label>
                            <textarea
                              id="totem-aviso-motivo"
                              className="dni-input totem-input totem-direccion-textarea"
                              value={avisoVoyMotivo}
                              onChange={(e) => {
                                registrarInteraccion()
                                setAvisoVoyMotivo(e.target.value)
                              }}
                              placeholder="Ej: retirar un pedido, consultar un presupuesto…"
                              rows={3}
                              disabled={enviandoAvisoVoy}
                            />
                          </div>
                        </div>
                        <div className="totem-direccion-actions">
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small secondary"
                            onClick={() => {
                              registrarInteraccion()
                              setSelectedQueHacer(null)
                              setMensaje(null)
                              setError(null)
                              setAvisoVoyNombre('')
                              setAvisoVoyMotivo('')
                            }}
                          >
                            ← Volver
                          </button>
                          <button
                            type="button"
                            className="totem-cta-button totem-cta-small"
                            onClick={handleAvisarQueVoy}
                            disabled={enviandoAvisoVoy}
                          >
                            {enviandoAvisoVoy ? 'Enviando…' : 'Avisar que voy'}
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
        )}

        {step === 'search' && (
          <>
            <header className="consulta-header totem-header">
              <button
                type="button"
                className="totem-search-back"
                onClick={volverAWelcome}
              >
                ← Volver
              </button>
              <div className="header-content totem-header-content">
                <img
                  src="https://trello.plotcenter.com.ar/Group%20187.png"
                  alt="Plot Center Logo"
                  className="consulta-logo totem-logo"
                />
                <div className="header-text">
                  <h1>Buscá tu trabajo</h1>
                  <p>
                    Ingresá tu número de OP y te mostramos en qué estado está. Más abajo podés enviar un
                    archivo para imprimir en mostrador.
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

        <footer className="consulta-footer totem-footer">
          <p>Si tenés dudas, acercate a mostrador con tu número de OP.</p>
        </footer>
      </div>
    </div>
  )
}

export default TotemConsultaClientePage

