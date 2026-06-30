import { useMemo, useState } from 'react'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import { historialPorOrdenId, historialUnificadoMismoNumeroOp } from '../utils/consultaOpHistorial'
import './ClienteConsultaPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const ClienteConsultaPage = () => {
  const [searchOp, setSearchOp] = useState('')
  const [searchDni, setSearchDni] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)

  const buscarOrdenes = async (filtro: (orden: OrdenTrabajo) => boolean, mensajeError: string) => {
    setLoading(true)
    setError(null)
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
      'No se encontraron pedidos con ese número de OP.'
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
      'No se encontraron pedidos con ese DNI/CUIT.'
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

  return (
    <div className="cliente-consulta-page">
      <div className="consulta-container">
        <header className="consulta-header">
          <div className="header-content">
            <img 
              src="https://www.plotcenterlab.com.ar/Group%20187.png" 
              alt="Plot Center Logo" 
              className="consulta-logo"
            />
            <div className="header-text">
              <h1>Consulta el Estado de tu Pedido</h1>
              <p>Ingresá nombre, apellido, empresa, número de OP o DNI/CUIT para ver tus órdenes</p>
            </div>
          </div>
        </header>

        <div className="consulta-form-section">
          <div className="search-box">
            <div className="input-group">
              <label htmlFor="consulta-op">Buscar por número de OP</label>
              <input
                id="consulta-op"
                type="text"
                value={searchOp}
                onChange={(e) => setSearchOp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchOp()
                }}
                placeholder="Ej: OP-000123 o 000123"
                className="dni-input"
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleSearchOp}
              disabled={loading || !searchOp.trim()}
              className="search-button"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Buscando...
                </>
              ) : (
                <>
                  🔍 Buscar por OP
                </>
              )}
            </button>
          </div>

          <div className="search-box secondary-search-box">
            <div className="input-group">
              <label htmlFor="consulta-dni">Buscar por DNI / CUIT</label>
              <input
                id="consulta-dni"
                type="text"
                value={searchDni}
                onChange={(e) => setSearchDni(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchDni()
                }}
                placeholder="Solo números de DNI o CUIT"
                className="dni-input"
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleSearchDni}
              disabled={loading || !searchDni.trim()}
              className="search-button"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Buscando...
                </>
              ) : (
                <>
                  🔍 Buscar por DNI/CUIT
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {ordenes.length > 0 && (
          <div className="ordenes-results">
            <h2 className="results-title">
              {ordenes.length === 1 ? 'Tu Pedido' : `Tus Pedidos (${ordenes.length})`}
            </h2>

            {mostrarTimelineUnificado && historialUnificadoLista && (
              <div className="timeline-section timeline-section-unified">
                <h3 className="timeline-unified-title">Recorrido completo de la orden</h3>
                <p className="timeline-unified-subtitle">
                  Hay {ordenes.length} fichas con el mismo número de OP en distintos sectores. Acá ves
                  todos los movimientos en orden cronológico; en cada paso indicamos en qué ficha
                  quedó registrado.
                </p>
                <h4 className="timeline-title">Historial unificado</h4>
                <div className="timeline">
                  {historialUnificadoLista.map((movimiento, index) => {
                    const isLast = index === historialUnificadoLista.length - 1
                    const estadoAnterior = getEstadoLabel(movimiento.estado_anterior || '')
                    const estadoNuevo = getEstadoLabel(movimiento.estado_nuevo || '')
                    const colorNuevo = getEstadoColor(movimiento.estado_nuevo || '')

                    return (
                      <div key={movimiento.id} className="timeline-item">
                        <div className="timeline-marker" style={{ backgroundColor: colorNuevo }}>
                          {isLast ? '✓' : '○'}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-estado" style={{ color: colorNuevo }}>
                              {estadoNuevo}
                            </span>
                            <span className="timeline-date">{formatDate(movimiento.timestamp)}</span>
                          </div>
                          <div className="timeline-meta-sector">
                            {etiquetaSectorFicha(movimiento.id_orden)}
                          </div>
                          {index > 0 && (
                            <div className="timeline-transition">
                              <span className="transition-arrow">→</span>
                              <span className="transition-text">
                                Movido desde: {estadoAnterior}
                              </span>
                            </div>
                          )}
                          {movimiento.comentario && (
                            <div className="timeline-comment">💬 {movimiento.comentario}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {ordenes.map((orden) => {
            const ordenHistorial = historial[orden.id] || []
            const historialOrdenado = [...ordenHistorial].sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )

            const readyForPickup = isReadyForPickup(orden.estado)

            const dniCuit = orden.dni_cuit ? digitsOnly(orden.dni_cuit) : null

            let descripcionResumen: string | null = null
            if (dniCuit && searchDni.trim()) {
              descripcionResumen = `DNI / CUIT: ${dniCuit}`
            } else if (orden.numero_op && searchOp.trim()) {
              descripcionResumen = `OP: ${orden.numero_op}`
            } else if (orden.descripcion) {
              descripcionResumen =
                orden.descripcion.length > 180
                  ? `${orden.descripcion.slice(0, 180)}…`
                  : orden.descripcion
            }

            return (
                <div key={orden.id} className={`orden-card ${readyForPickup ? 'ready-for-pickup' : ''}`}>
                  {readyForPickup && (
                    <div className="pickup-banner">
                      <div className="pickup-content">
                        <span className="pickup-icon">🎉</span>
                        <div className="pickup-text">
                          <strong>¡Tu pedido está listo para retirar!</strong>
                          <span>Puedes pasar a buscarlo en nuestro local</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <div className={`orden-estado-badge ${readyForPickup ? 'ready-badge' : ''}`} style={{ backgroundColor: getEstadoColor(orden.estado) }}>
                      {getEstadoLabel(orden.estado)}
                      {readyForPickup && <span className="ready-indicator">✓</span>}
                    </div>
                  </div>

                  {descripcionResumen && (
                    <div className="orden-descripcion">
                      <strong>Descripción:</strong> {descripcionResumen}
                    </div>
                  )}

                  <div className="orden-details">
                    <div className="detail-item">
                      <span className="detail-label">Fecha de creación:</span>
                      <span className="detail-value">
                        {orden.fecha_creacion ? formatDate(orden.fecha_creacion) : 'N/A'}
                      </span>
                    </div>
                    {orden.fecha_entrega && (
                      <div className="detail-item">
                        <span className="detail-label">Fecha de entrega estimada:</span>
                        <span className="detail-value">{formatDate(orden.fecha_entrega)}</span>
                      </div>
                    )}
                    {orden.sector && (
                      <div className="detail-item">
                        <span className="detail-label">Sector:</span>
                        <span className="detail-value">{orden.sector}</span>
                      </div>
                    )}
                  </div>

                  {mostrarTimelineUnificado && (
                    <div className="orden-historial-delegado">
                      <p>
                        Esta tarjeta es la parte del pedido en{' '}
                        <strong>{orden.sector?.trim() || 'este sector'}</strong>. El historial paso a
                        paso está arriba, en <strong>Recorrido completo de la orden</strong>.
                      </p>
                    </div>
                  )}

                  {!mostrarTimelineUnificado && historialOrdenado.length > 0 && (
                    <div className="timeline-section">
                      <h4 className="timeline-title">Historial del Pedido</h4>
                      <div className="timeline">
                        {historialOrdenado.map((movimiento, index) => {
                          const isLast = index === historialOrdenado.length - 1
                          const estadoAnterior = getEstadoLabel(movimiento.estado_anterior || '')
                          const estadoNuevo = getEstadoLabel(movimiento.estado_nuevo || '')
                          const colorNuevo = getEstadoColor(movimiento.estado_nuevo || '')

                          return (
                            <div key={movimiento.id} className="timeline-item">
                              <div className="timeline-marker" style={{ backgroundColor: colorNuevo }}>
                                {isLast ? '✓' : '○'}
                              </div>
                              <div className="timeline-content">
                                <div className="timeline-header">
                                  <span className="timeline-estado" style={{ color: colorNuevo }}>
                                    {estadoNuevo}
                                  </span>
                                  <span className="timeline-date">{formatDate(movimiento.timestamp)}</span>
                                </div>
                                {index > 0 && (
                                  <div className="timeline-transition">
                                    <span className="transition-arrow">→</span>
                                    <span className="transition-text">
                                      Movido desde: {estadoAnterior}
                                    </span>
                                  </div>
                                )}
                                {movimiento.comentario && (
                                  <div className="timeline-comment">
                                    💬 {movimiento.comentario}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {!mostrarTimelineUnificado && historialOrdenado.length === 0 && (
                    <div className="no-timeline">
                      <p>No hay historial disponible para este pedido.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <footer className="consulta-footer">
          <p>¿Necesitas ayuda? Contacta con nosotros</p>
          <p className="footer-small">Plot Center - Sistema de Gestión de Pedidos</p>
        </footer>
      </div>
    </div>
  )
}

export default ClienteConsultaPage

