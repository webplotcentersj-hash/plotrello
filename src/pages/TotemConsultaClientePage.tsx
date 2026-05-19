import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { historialPorOrdenId, historialUnificadoMismoNumeroOp } from '../utils/consultaOpHistorial'
import { TotemAutogestionPlotAiChat } from '@/components/ui/TotemAutogestionPlotAiChat'
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
  sectorDestino: string
  bg: string
  textColor: string
  direction: SectorDirection
}> = [
  {
    id: 'presupuestos',
    label: 'PRESUPUESTOS Y ASESORAMIENTO',
    sectorDestino: 'Presupuestos y asesoramiento',
    bg: '#7dd3fc',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'recepcion',
    label: 'RECEPCIÓN DE PEDIDOS',
    sectorDestino: 'Recepción de pedidos',
    bg: '#facc15',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'diseno',
    label: 'DISEÑO GRÁFICO',
    sectorDestino: 'Diseño gráfico',
    bg: '#ec4899',
    textColor: '#fff',
    direction: 'primer-piso'
  },
  {
    id: 'caja',
    label: 'CAJA / ENTREGA DE PEDIDOS',
    sectorDestino: 'Caja / Entrega de pedidos',
    bg: '#1f2937',
    textColor: '#fff',
    direction: 'planta-baja'
  },
  {
    id: 'base_operaciones',
    label: 'BASE DE OPERACIONES',
    sectorDestino: 'Base de operaciones',
    bg: '#f97316',
    textColor: '#0f172a',
    direction: 'planta-baja'
  },
  {
    id: 'marketing',
    label: 'MARKETING Y COMUNICACIÓN',
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
          ↑
          <br />
          ↑
          <br />↑
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

  const registrarInteraccion = () => setLastInteraction(Date.now())

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
              <div className="totem-welcome-actions">
                <button
                  className="totem-welcome-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    registrarInteraccion()
                    setStep('search')
                  }}
                >
                  🔍 Buscar mi trabajo
                </button>
                <button
                  className="totem-welcome-button totem-welcome-button--print"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    registrarInteraccion()
                    navigate('/totem/autogestion/imprimir')
                  }}
                >
                  🖨️ Imprimir
                </button>
              </div>
              <p className="totem-welcome-hint">
                Para buscar tu OP necesitás el número. Para imprimir, escaneá el código con tu celular.
              </p>

              <div className="totem-senaletica-block">
                <h2 className="totem-senaletica-title">¿Hacia dónde te dirigís?</h2>
                <p className="totem-senaletica-subtitle">
                  Tocá la franja del sector · Diseño y Marketing están en 1° piso (↑)
                </p>
                <div className="totem-senaletica-strips">
                  {TOTEM_SECTORS_QUEHACER.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      className={`totem-senaletica-strip${sector.direction === 'primer-piso' ? ' totem-senaletica-strip--upstairs' : ''}`}
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
                        setAvisoVoyNombre('')
                        setAvisoVoyMotivo('')
                      }}
                    >
                      <span className="totem-strip-text">{sector.label}</span>
                      <SectorDirectionArrows direction={sector.direction} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="totem-consulta-chat-block">
                <h2 className="totem-senaletica-title">¿Qué servicios ofrecemos?</h2>
                <p className="totem-senaletica-subtitle">
                  Preguntale a PlotAI: impresión, diseño, marketing, instalaciones y más.
                </p>
                <TotemAutogestionPlotAiChat
                  className="totem-consulta-plotai"
                  modo="totem_consulta_cliente"
                  conversationStorageKey="plotrello_totem_consulta_cliente_plotai_conv"
                  title="PlotAI"
                  titleSub="Consultá nuestros servicios en pantalla"
                  emptyHint="Ej: ¿Hacen vinilos? ¿Dónde está diseño gráfico? ¿Cuáles son los horarios?"
                />
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
                        setAvisoVoyNombre('')
                        setAvisoVoyMotivo('')
                      }
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="totem-modal-title"
                  >
                    <div className="totem-direccion-modal" onClick={(e) => e.stopPropagation()}>
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

