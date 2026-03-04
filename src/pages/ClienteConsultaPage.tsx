import { useState } from 'react'
import type { OrdenTrabajo, HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import './ClienteConsultaPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const ClienteConsultaPage = () => {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([])
  const [historial, setHistorial] = useState<Record<number, HistorialMovimiento[]>>({})
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    const term = search.trim()
    if (!term) {
      setError('Ingresá nombre, apellido, empresa, número de OP o DNI/CUIT para buscar.')
      return
    }

    setLoading(true)
    setError(null)
    setOrdenes([])
    setHistorial({})

    try {
      const response = await apiService.getOrdenes()

      if (response.success && response.data) {
        const searchDigits = digitsOnly(term)
        const searchLower = term.toLowerCase()
        const searchWords = searchLower.split(/\s+/).filter((w) => w.length >= 2)

        const ordenesFiltradas = response.data.filter((orden) => {
          const ordenDni = digitsOnly(orden.dni_cuit ?? '')
          const ordenOp = digitsOnly(orden.numero_op ?? '')
          const clienteLower = (orden.cliente ?? '').toLowerCase()

          if (searchDigits.length >= 6) {
            if (ordenDni === searchDigits) return true
          }
          if (searchDigits.length >= 2) {
            if (ordenOp === searchDigits || ordenOp.includes(searchDigits)) return true
          }
          if (searchLower.length >= 2 && clienteLower) {
            if (clienteLower.includes(searchLower)) return true
            if (searchWords.length > 0 && searchWords.every((w) => clienteLower.includes(w))) return true
          }
          return false
        })

        if (ordenesFiltradas.length === 0) {
          setError('No se encontraron pedidos con ese nombre, empresa, número de OP o DNI/CUIT.')
          setLoading(false)
          return
        }

        setOrdenes(ordenesFiltradas)

        // Cargar historial para cada orden
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

  return (
    <div className="cliente-consulta-page">
      <div className="consulta-container">
        <header className="consulta-header">
          <div className="header-content">
            <img 
              src="https://trello.plotcenter.com.ar/Group%20187.png" 
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
              <label htmlFor="consulta-search">Buscar por</label>
              <input
                id="consulta-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
                placeholder="Nombre, apellido, empresa, Nº OP o DNI/CUIT"
                className="dni-input"
                disabled={loading}
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !search.trim()}
              className="search-button"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Buscando...
                </>
              ) : (
                <>
                  🔍 Buscar Pedidos
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

            {ordenes.map((orden) => {
              const ordenHistorial = historial[orden.id] || []
              const historialOrdenado = [...ordenHistorial].sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )

              const readyForPickup = isReadyForPickup(orden.estado)

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
                      <h3>OP #{orden.numero_op}</h3>
                      <p className="orden-cliente">{orden.cliente}</p>
                    </div>
                    <div className={`orden-estado-badge ${readyForPickup ? 'ready-badge' : ''}`} style={{ backgroundColor: getEstadoColor(orden.estado) }}>
                      {getEstadoLabel(orden.estado)}
                      {readyForPickup && <span className="ready-indicator">✓</span>}
                    </div>
                  </div>

                  {orden.descripcion && (
                    <div className="orden-descripcion">
                      <strong>Descripción:</strong> {orden.descripcion}
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

                  {historialOrdenado.length > 0 && (
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

                  {historialOrdenado.length === 0 && (
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

