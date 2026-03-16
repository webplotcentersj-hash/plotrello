import { useEffect, useState } from 'react'
import type { HistorialMovimiento } from '../types/api'
import apiService from '../services/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import './ClienteConsultaPage.css'
import './OpEliminadasPage.css'

type DeletedOpRow = {
  id: number
  id_orden: number | null
  numero_op: string | null
  cliente: string | null
  id_usuario: number | null
  nombre_usuario: string | null
  rol_usuario: string | null
  estado_anterior: string | null
  estado_nuevo: string | null
  comentario: string | null
  accion_tipo: string | null
  timestamp: string
}

const OpEliminadasPage = () => {
  const [rows, setRows] = useState<DeletedOpRow[]>([])
  const [historialPorOrden, setHistorialPorOrden] = useState<Record<number, HistorialMovimiento[]>>({})
  const [selectedOrdenId, setSelectedOrdenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      const resp = await apiService.getOpEliminadas()
      if (resp.success && resp.data) {
        setRows(resp.data)
      } else {
        setError(resp.error || 'No se pudo cargar la auditoría de OP eliminadas.')
      }
      setLoading(false)
    }
    void load()
  }, [])

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

  const handleRowClick = async (row: DeletedOpRow) => {
    if (!row.id_orden) return
    const idOrden = row.id_orden
    setSelectedOrdenId((prev) => (prev === idOrden ? null : idOrden))
    if (historialPorOrden[idOrden]) return

    const resp = await apiService.getHistorialMovimientos({ ordenId: idOrden })
    if (resp.success && resp.data) {
      setHistorialPorOrden((prev: Record<number, HistorialMovimiento[]>) => ({
        ...prev,
        [idOrden]: resp.data as HistorialMovimiento[]
      }))
    }
  }

  return (
    <div className="cliente-consulta-page op-eliminadas-page">
      <div className="consulta-container">
        <header className="consulta-header">
          <div className="header-content">
            <img
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
              className="consulta-logo"
            />
            <div className="header-text">
              <h1>Biblioteca de OP eliminadas</h1>
              <p>
                Auditoría completa: quién eliminó cada OP, cuándo y con qué motivo, más todo el
                trazado previo de la ficha.
              </p>
            </div>
          </div>
        </header>

        <section className="consulta-results-section op-eliminadas-section">
          {loading && <p style={{ color: '#e5e7eb' }}>Cargando OP eliminadas...</p>}
          {error && (
            <p style={{ color: '#fecaca', marginBottom: '12px' }}>
              {error}
            </p>
          )}

          {!loading && !error && (
            <div className="ordenes-results op-eliminadas-results">
              <h2 className="results-title">Historial de OP eliminadas</h2>
              <div className="op-eliminadas-table-wrapper">
                <table className="op-eliminadas-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nº OP</th>
                      <th>Cliente</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Estado anterior</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>
                          No hay OP eliminadas registradas aún.
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        style={{ cursor: row.id_orden ? 'pointer' : 'default' }}
                      >
                        <td>{formatDate(row.timestamp)}</td>
                        <td>{row.numero_op || (row.id_orden ? `#${row.id_orden}` : '-')}</td>
                        <td>{row.cliente || '-'}</td>
                        <td>{row.nombre_usuario || '-'}</td>
                        <td>{row.rol_usuario || '-'}</td>
                        <td>{row.estado_anterior || '-'}</td>
                        <td style={{ maxWidth: '360px', whiteSpace: 'pre-wrap' }}>
                          {row.comentario || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedOrdenId && historialPorOrden[selectedOrdenId] && (
                <div className="totem-section" style={{ marginTop: '32px' }}>
                  <h3>Trazado completo de la OP #{selectedOrdenId}</h3>
                  <div className="timeline">
                    {[...historialPorOrden[selectedOrdenId]]
                      .sort(
                        (a, b) =>
                          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                      )
                      .map((mov) => {
                        const estadoNuevo = mov.estado_nuevo || ''
                        const colorNuevo = getEstadoColor(estadoNuevo)
                        return (
                          <div key={mov.id} className="timeline-item">
                            <div
                              className="timeline-marker"
                              style={{ backgroundColor: colorNuevo }}
                            >
                              ○
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-header">
                                <span
                                  className="timeline-estado"
                                  style={{ color: colorNuevo }}
                                >
                                  {getEstadoLabel(estadoNuevo)}
                                </span>
                                <span className="timeline-date">
                                  {formatDate(mov.timestamp)}
                                </span>
                              </div>
                              {mov.comentario && (
                                <p className="timeline-comment">{mov.comentario}</p>
                              )}
                              {mov.cambios_detallados &&
                                (mov.cambios_detallados as any).metros_cuadrados && (
                                  <p className="timeline-comment">
                                    Metros cuadrados:{" "}
                                    {((mov.cambios_detallados as any).metros_cuadrados as any)
                                      .anterior !== undefined &&
                                    ((mov.cambios_detallados as any).metros_cuadrados as any)
                                      .anterior !== null
                                      ? `de ${
                                          ((mov.cambios_detallados as any)
                                            .metros_cuadrados as any).anterior
                                        } `
                                      : ''}
                                    a{" "}
                                    {((mov.cambios_detallados as any).metros_cuadrados as any)
                                      .nuevo}
                                    {" "}m²
                                  </p>
                                )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default OpEliminadasPage

