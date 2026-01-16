import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo, ClienteRecord } from '../types/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import './BuscarClientePage.css'

const BuscarClientePage = () => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteRecord | null>(null)
  const [ordenesActivas, setOrdenesActivas] = useState<OrdenTrabajo[]>([])
  const [historialCompleto, setHistorialCompleto] = useState<OrdenTrabajo[]>([])
  const [loadingOrdenes, setLoadingOrdenes] = useState(false)

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      buscarClientes()
    } else {
      setClientesEncontrados([])
    }
  }, [searchTerm])

  const buscarClientes = async () => {
    setLoading(true)
    try {
      const response = await apiService.buscarClientes(searchTerm.trim())
      if (response.success && response.data) {
        setClientesEncontrados(response.data)
      }
    } catch (error) {
      console.error('Error buscando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Función auxiliar para normalizar DNI/CUIT (eliminar guiones, espacios, etc.)
  const normalizarDniCuit = (dniCuit: string | null | undefined): string => {
    if (!dniCuit) return ''
    return dniCuit.replace(/[-\s]/g, '').toUpperCase().trim()
  }

  const seleccionarCliente = async (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    setLoadingOrdenes(true)
    
    try {
      // Buscar todas las órdenes del cliente
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        // Normalizar datos del cliente para búsqueda
        const dniClienteNormalized = normalizarDniCuit(cliente.dni_cuit)
        const nombreClienteLower = cliente.nombre?.toLowerCase().trim() || ''
        const apellidoClienteLower = cliente.apellido?.toLowerCase().trim() || ''
        const nombreCompletoCliente = `${nombreClienteLower} ${apellidoClienteLower}`.trim()
        const telefonoCliente = cliente.telefono?.trim() || ''
        const emailCliente = cliente.email?.toLowerCase().trim() || ''

        // Filtrar órdenes por múltiples criterios
        const ordenesFiltradas = ordenesResponse.data.filter((orden) => {
          // Buscar por DNI/CUIT (normalizado)
          if (dniClienteNormalized) {
            const dniOrdenNormalized = normalizarDniCuit(orden.dni_cuit)
            if (dniOrdenNormalized && dniOrdenNormalized === dniClienteNormalized) {
              return true
            }
          }

          // Buscar por nombre del cliente
          if (nombreClienteLower) {
            const nombreOrdenLower = orden.cliente?.toLowerCase().trim() || ''
            if (nombreOrdenLower) {
              // Coincidencia exacta o parcial del nombre
              if (nombreOrdenLower === nombreCompletoCliente || 
                  nombreOrdenLower === nombreClienteLower ||
                  nombreOrdenLower.includes(nombreClienteLower) ||
                  (apellidoClienteLower && nombreOrdenLower.includes(apellidoClienteLower))) {
                return true
              }
            }
          }

          // Buscar por teléfono
          if (telefonoCliente && orden.telefono_cliente) {
            const telefonoOrden = orden.telefono_cliente.replace(/[-\s()]/g, '').trim()
            const telefonoClienteClean = telefonoCliente.replace(/[-\s()]/g, '').trim()
            if (telefonoOrden === telefonoClienteClean) {
              return true
            }
          }

          // Buscar por email
          if (emailCliente && orden.email_cliente) {
            const emailOrdenLower = orden.email_cliente.toLowerCase().trim()
            if (emailOrdenLower === emailCliente) {
              return true
            }
          }

          return false
        })

        // Separar órdenes activas (no entregadas)
        const activas = ordenesFiltradas.filter(
          (orden) => orden.estado !== 'Entregado o Instalado'
        )
        setOrdenesActivas(activas)
        
        // Historial completo (todas las órdenes ordenadas por fecha)
        const historial = [...ordenesFiltradas].sort(
          (a, b) => new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
        )
        setHistorialCompleto(historial)
      }
    } catch (error) {
      console.error('Error cargando órdenes del cliente:', error)
    } finally {
      setLoadingOrdenes(false)
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

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="buscar-cliente-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>🔍 Buscar Cliente</h1>
            <p className="subtitle">Busca clientes por nombre, DNI o CUIT</p>
          </div>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* Búsqueda */}
      <div className="search-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por nombre, DNI o CUIT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            autoFocus
          />
          <span className="search-icon">🔍</span>
          {loading && <span className="loading-spinner">⏳</span>}
        </div>

        {/* Lista de clientes encontrados */}
        {clientesEncontrados.length > 0 && !clienteSeleccionado && (
          <div className="clientes-list">
            {clientesEncontrados.map((cliente) => (
              <div
                key={cliente.id}
                className="cliente-card"
                onClick={() => seleccionarCliente(cliente)}
              >
                <div className="cliente-info">
                  <h3>{cliente.nombre}</h3>
                  {cliente.dni_cuit && (
                    <p className="cliente-dni">DNI/CUIT: {cliente.dni_cuit}</p>
                  )}
                  {cliente.telefono && (
                    <p className="cliente-contacto">📞 {cliente.telefono}</p>
                  )}
                  {cliente.email && (
                    <p className="cliente-contacto">✉️ {cliente.email}</p>
                  )}
                </div>
                <button className="btn-select">Seleccionar →</button>
              </div>
            ))}
          </div>
        )}

        {searchTerm.length >= 2 && clientesEncontrados.length === 0 && !loading && (
          <div className="empty-state">
            <p>No se encontraron clientes con ese criterio de búsqueda</p>
          </div>
        )}
      </div>

      {/* Información del cliente seleccionado */}
      {clienteSeleccionado && (
        <div className="cliente-detalle">
          <div className="cliente-header">
            <div>
              <h2>{clienteSeleccionado.nombre}</h2>
              <div className="cliente-meta">
                {clienteSeleccionado.dni_cuit && (
                  <span>DNI/CUIT: {clienteSeleccionado.dni_cuit}</span>
                )}
                {clienteSeleccionado.telefono && (
                  <span>📞 {clienteSeleccionado.telefono}</span>
                )}
                {clienteSeleccionado.email && (
                  <span>✉️ {clienteSeleccionado.email}</span>
                )}
                {clienteSeleccionado.direccion && (
                  <span>📍 {clienteSeleccionado.direccion}</span>
                )}
              </div>
            </div>
            <button
              className="btn-secondary"
              onClick={() => {
              setClienteSeleccionado(null)
              setOrdenesActivas([])
              setHistorialCompleto([])
              }}
            >
              Buscar Otro
            </button>
          </div>

          {loadingOrdenes ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Cargando órdenes...</p>
            </div>
          ) : (
            <>
              {/* Órdenes Activas */}
              {ordenesActivas.length > 0 && (
                <section className="ordenes-section activas">
                  <h3>📋 Órdenes Activas ({ordenesActivas.length})</h3>
                  <div className="ordenes-grid">
                    {ordenesActivas.map((orden) => (
                      <div
                        key={orden.id}
                        className="orden-card"
                        onClick={() => navigate(`/op/${orden.numero_op}`)}
                      >
                        <div className="orden-header">
                          <h4>OP #{orden.numero_op}</h4>
                          <span
                            className="badge"
                            style={{ backgroundColor: getEstadoColor(orden.estado) }}
                          >
                            {getEstadoLabel(orden.estado)}
                          </span>
                        </div>
                        {orden.descripcion && (
                          <p className="orden-descripcion">{orden.descripcion}</p>
                        )}
                        <div className="orden-fechas">
                          {orden.fecha_creacion && (
                            <span>Creada: {formatDate(orden.fecha_creacion)}</span>
                          )}
                          {orden.fecha_entrega && (
                            <span>Entrega: {formatDate(orden.fecha_entrega)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Historial Completo */}
              <section className="ordenes-section historial">
                <h3>📚 Historial Completo ({historialCompleto.length} órdenes)</h3>
                {historialCompleto.length === 0 ? (
                  <div className="empty-state">
                    <p>Este cliente no tiene órdenes registradas</p>
                  </div>
                ) : (
                  <div className="historial-table">
                    <table>
                      <thead>
                        <tr>
                          <th>OP</th>
                          <th>Estado</th>
                          <th>Descripción</th>
                          <th>Fecha Creación</th>
                          <th>Fecha Entrega</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialCompleto.map((orden) => (
                          <tr key={orden.id}>
                            <td>
                              <strong>#{orden.numero_op}</strong>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{ backgroundColor: getEstadoColor(orden.estado) }}
                              >
                                {getEstadoLabel(orden.estado)}
                              </span>
                            </td>
                            <td className="descripcion-cell">
                              {orden.descripcion || 'Sin descripción'}
                            </td>
                            <td>{orden.fecha_creacion ? formatDate(orden.fecha_creacion) : '-'}</td>
                            <td>{orden.fecha_entrega ? formatDate(orden.fecha_entrega) : '-'}</td>
                            <td>
                              <button
                                className="btn-link"
                                onClick={() => navigate(`/op/${orden.numero_op}`)}
                              >
                                Ver →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default BuscarClientePage
