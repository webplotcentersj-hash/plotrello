import { useEffect, useMemo, useState } from 'react'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import './ClienteConsultaPage.css'
import './TotemConsultaClientePage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const INACTIVITY_MS = 90000

const TotemConsultaClientePage = () => {
  const [searchOp, setSearchOp] = useState('')
  const [searchDni, setSearchDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [sectorDestino, setSectorDestino] = useState<string>('Mostrador')
  const [step, setStep] = useState<'welcome' | 'search'>('welcome')
  const [lastInteraction, setLastInteraction] = useState<number>(() => Date.now())

  const registrarInteraccion = () => setLastInteraction(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      if (!ordenes.length && !searchOp && !searchDni && step === 'welcome') return
      if (Date.now() - lastInteraction > INACTIVITY_MS) {
        setSearchOp('')
        setSearchDni('')
        setOrdenes([])
        setHistorial({})
        setError(null)
        setMensaje(null)
        setStep('welcome')
      }
    }, 5000)
    return () => clearInterval(id)
  }, [lastInteraction, ordenes.length, searchOp, searchDni, step])

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

        const historialPromises = ordenesFiltradas.map(async (orden) => {
          if (!orden.id) return [orden.id, []]
          const histResponse = await apiService.getHistorialMovimientos({ ordenId: orden.id })
          return [
            orden.id,
            histResponse.success && histResponse.data ? histResponse.data : []
          ]
        })

        const historialResults = await Promise.all(historialPromises)
        const historialMap: Record<number, HistorialMovimiento[]> = {}

        historialResults.forEach((result) => {
          const [id, movimientos] = result
          if (id && typeof id === 'number') {
            historialMap[id] = movimientos as HistorialMovimiento[]
          }
        })

        setHistorial(historialMap)
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
        // Usamos un usuario del sistema (ej: admin con id 1) para cumplir FK
        usuario_id: 1,
        usuario_nombre: 'Totem autoservicio',
        orden_id: primerOrden.id,
        notas: `Cliente se registró desde tótem. Sector sugerido: ${sectorDestino}.`
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
        orden_id: primerOrden?.id,
        notas: `Cliente pidió ayuda desde tótem de autoservicio. Sector sugerido: ${sectorDestino}.`
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

  const ordenesActivas = useMemo(
    () => ordenes.filter((o) => !isReadyForPickup(o.estado)),
    [ordenes]
  )

  const ordenesListas = useMemo(
    () => ordenes.filter((o) => isReadyForPickup(o.estado)),
    [ordenes]
  )

  return (
    <div
      className="cliente-consulta-page totem-consulta-page"
      onClick={registrarInteraccion}
      onKeyDown={registrarInteraccion}
    >
      <div className="consulta-container totem-container">
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
                  <p>Ingresá tu número de OP o DNI/CUIT y te mostramos en qué estado está.</p>
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

                      {historialOrdenado.length > 0 && (
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
                                      <span
                                        className="timeline-estado"
                                        style={{ color: colorNuevo }}
                                      >
                                        {estadoNuevo}
                                      </span>
                                      <span className="timeline-date">
                                        {formatDate(movimiento.timestamp)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
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

                      {historialOrdenado.length > 0 && (
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
                                      <span
                                        className="timeline-estado"
                                        style={{ color: colorNuevo }}
                                      >
                                        {estadoNuevo}
                                      </span>
                                      <span className="timeline-date">
                                        {formatDate(movimiento.timestamp)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
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

