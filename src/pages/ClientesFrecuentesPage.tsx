import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { OrdenTrabajo, ClienteRecord } from '../types/api'
import { mapEstadoToStatus } from '../utils/dataMappers'
import { BOARD_COLUMNS } from '../data/mockData'
import './ClientesFrecuentesPage.css'

type ClienteFrecuente = ClienteRecord & {
  totalOrdenes: number
  ordenesActivas: number
  ultimaOrden?: string | null
  montoTotal?: number
  esVIP?: boolean
  preferencias?: string
  notas?: string
}

const ClientesFrecuentesPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteFrecuente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteFrecuente | null>(null)
  const [ordenesCliente, setOrdenesCliente] = useState<OrdenTrabajo[]>([])
  const [historialCompleto, setHistorialCompleto] = useState<OrdenTrabajo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroVIP, setFiltroVIP] = useState<boolean | null>(null)
  const [editandoPreferencias, setEditandoPreferencias] = useState(false)
  const [preferencias, setPreferencias] = useState('')
  const [notas, setNotas] = useState('')
  const [loadingOrdenes, setLoadingOrdenes] = useState(false)

  useEffect(() => {
    loadClientesFrecuentes()
  }, [])

  const loadClientesFrecuentes = async () => {
    setLoading(true)
    try {
      // Cargar todas las órdenes para calcular estadísticas
      const ordenesResponse = await apiService.getOrdenes()
      if (!ordenesResponse.success || !ordenesResponse.data) return

      // Obtener todos los clientes únicos
      const clientesMap = new Map<string, ClienteFrecuente>()

      ordenesResponse.data.forEach((orden) => {
        if (!orden.dni_cuit || !orden.cliente) return

        const dni = orden.dni_cuit.toUpperCase()
        if (!clientesMap.has(dni)) {
          clientesMap.set(dni, {
            id: orden.id || 0,
            nombre: orden.cliente,
            dni_cuit: orden.dni_cuit,
            telefono: undefined,
            email: undefined,
            direccion: undefined,
            ubicacion_link: undefined,
            drive_link: undefined,
            totalOrdenes: 0,
            ordenesActivas: 0,
            esVIP: false
          })
        }

        const cliente = clientesMap.get(dni)!
        cliente.totalOrdenes++
        if (orden.estado !== 'Entregado o Instalado') {
          cliente.ordenesActivas++
        }
        if (!cliente.ultimaOrden || 
            new Date(orden.fecha_creacion || 0) > new Date(cliente.ultimaOrden)) {
          cliente.ultimaOrden = orden.fecha_creacion
        }
      })

      // Cargar preferencias guardadas desde localStorage
      const preferenciasGuardadas = localStorage.getItem('preferencias_clientes')
      const preferenciasMap: Record<string, { preferencias?: string; notas?: string; esVIP?: boolean }> = 
        preferenciasGuardadas ? JSON.parse(preferenciasGuardadas) : {}

      // Aplicar preferencias y marcar VIP
      clientesMap.forEach((cliente, dni) => {
        const prefs = preferenciasMap[dni] || {}
        cliente.preferencias = prefs.preferencias
        cliente.notas = prefs.notas
        cliente.esVIP = prefs.esVIP || cliente.totalOrdenes >= 10
      })

      // Convertir a array y ordenar por total de órdenes
      const clientesArray = Array.from(clientesMap.values())
        .sort((a, b) => b.totalOrdenes - a.totalOrdenes)

      setClientes(clientesArray)
    } catch (error) {
      console.error('Error cargando clientes frecuentes:', error)
    } finally {
      setLoading(false)
    }
  }

  const seleccionarCliente = async (cliente: ClienteFrecuente) => {
    setClienteSeleccionado(cliente)
    setPreferencias(cliente.preferencias || '')
    setNotas(cliente.notas || '')
    setLoadingOrdenes(true)

    try {
      const ordenesResponse = await apiService.getOrdenes()
      if (ordenesResponse.success && ordenesResponse.data) {
        const dniNormalized = cliente.dni_cuit?.toUpperCase() || ''
        const ordenesFiltradas = ordenesResponse.data.filter(
          (orden) => orden.dni_cuit && orden.dni_cuit.toUpperCase() === dniNormalized
        )

        const activas = ordenesFiltradas.filter(
          (orden) => orden.estado !== 'Entregado o Instalado'
        )
        setOrdenesCliente(activas)

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

  const guardarPreferencias = () => {
    if (!clienteSeleccionado) return

    const preferenciasGuardadas = localStorage.getItem('preferencias_clientes')
    const preferenciasMap: Record<string, { preferencias?: string; notas?: string; esVIP?: boolean }> = 
      preferenciasGuardadas ? JSON.parse(preferenciasGuardadas) : {}

    preferenciasMap[clienteSeleccionado.dni_cuit!.toUpperCase()] = {
      preferencias,
      notas,
      esVIP: clienteSeleccionado.esVIP
    }

    localStorage.setItem('preferencias_clientes', JSON.stringify(preferenciasMap))

    // Actualizar cliente en la lista
    setClientes((prev) =>
      prev.map((c) =>
        c.dni_cuit === clienteSeleccionado.dni_cuit
          ? { ...c, preferencias, notas }
          : c
      )
    )

    setEditandoPreferencias(false)
    alert('Preferencias guardadas exitosamente')
  }

  const toggleVIP = () => {
    if (!clienteSeleccionado) return

    const nuevoEstadoVIP = !clienteSeleccionado.esVIP
    const preferenciasGuardadas = localStorage.getItem('preferencias_clientes')
    const preferenciasMap: Record<string, { preferencias?: string; notas?: string; esVIP?: boolean }> = 
      preferenciasGuardadas ? JSON.parse(preferenciasGuardadas) : {}

    preferenciasMap[clienteSeleccionado.dni_cuit!.toUpperCase()] = {
      ...preferenciasMap[clienteSeleccionado.dni_cuit!.toUpperCase()],
      esVIP: nuevoEstadoVIP
    }

    localStorage.setItem('preferencias_clientes', JSON.stringify(preferenciasMap))

    setClienteSeleccionado({ ...clienteSeleccionado, esVIP: nuevoEstadoVIP })
    setClientes((prev) =>
      prev.map((c) =>
        c.dni_cuit === clienteSeleccionado.dni_cuit
          ? { ...c, esVIP: nuevoEstadoVIP }
          : c
      )
    )
  }

  const clientesFiltrados = clientes.filter((cliente) => {
    const matchesSearch =
      cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.dni_cuit?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesVIP = filtroVIP === null || cliente.esVIP === filtroVIP

    return matchesSearch && matchesVIP
  })

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

  if (loading) {
    return (
      <div className="clientes-frecuentes-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando clientes frecuentes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="clientes-frecuentes-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>⭐ Clientes Frecuentes</h1>
            <p className="subtitle">
              {clientes.length} {clientes.length === 1 ? 'cliente registrado' : 'clientes registrados'}
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={() => navigate('/mostrador/dashboard')}
          >
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      {/* Filtros y Búsqueda */}
      <div className="filtros-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="filtro-vip">
          <button
            className={`filtro-btn ${filtroVIP === null ? 'active' : ''}`}
            onClick={() => setFiltroVIP(null)}
          >
            Todos ({clientes.length})
          </button>
          <button
            className={`filtro-btn ${filtroVIP === true ? 'active' : ''}`}
            onClick={() => setFiltroVIP(true)}
          >
            ⭐ VIP ({clientes.filter(c => c.esVIP).length})
          </button>
          <button
            className={`filtro-btn ${filtroVIP === false ? 'active' : ''}`}
            onClick={() => setFiltroVIP(false)}
          >
            Regulares ({clientes.filter(c => !c.esVIP).length})
          </button>
        </div>
      </div>

      <div className="clientes-content">
        {/* Lista de Clientes */}
        <section className="clientes-lista-section">
          <h2>Lista de Clientes</h2>
          {clientesFiltrados.length === 0 ? (
            <div className="empty-state">
              <p>No se encontraron clientes</p>
            </div>
          ) : (
            <div className="clientes-grid">
              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.dni_cuit}
                  className={`cliente-card ${cliente.esVIP ? 'vip' : ''} ${clienteSeleccionado?.dni_cuit === cliente.dni_cuit ? 'selected' : ''}`}
                  onClick={() => seleccionarCliente(cliente)}
                >
                  {cliente.esVIP && (
                    <div className="vip-badge">⭐ VIP</div>
                  )}
                  <div className="cliente-card-header">
                    <h3>{cliente.nombre}</h3>
                    <span className="total-ordenes">{cliente.totalOrdenes} órdenes</span>
                  </div>
                  <div className="cliente-card-info">
                    <div className="info-row">
                      <span className="label">DNI/CUIT:</span>
                      <span>{cliente.dni_cuit}</span>
                    </div>
                    {cliente.ordenesActivas > 0 && (
                      <div className="info-row activas">
                        <span className="label">Activas:</span>
                        <span className="badge-activas">{cliente.ordenesActivas}</span>
                      </div>
                    )}
                    {cliente.ultimaOrden && (
                      <div className="info-row">
                        <span className="label">Última orden:</span>
                        <span>{formatDate(cliente.ultimaOrden)}</span>
                      </div>
                    )}
                  </div>
                  {cliente.preferencias && (
                    <div className="cliente-preferencias-preview">
                      💡 {cliente.preferencias.substring(0, 50)}
                      {cliente.preferencias.length > 50 && '...'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Detalle del Cliente Seleccionado */}
        {clienteSeleccionado && (
          <section className="cliente-detalle-section">
            <div className="cliente-detalle-header">
              <div>
                <h2>
                  {clienteSeleccionado.nombre}
                  {clienteSeleccionado.esVIP && <span className="vip-tag">⭐ VIP</span>}
                </h2>
                <div className="cliente-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Órdenes:</span>
                    <span className="stat-value">{clienteSeleccionado.totalOrdenes}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Órdenes Activas:</span>
                    <span className="stat-value">{clienteSeleccionado.ordenesActivas}</span>
                  </div>
                  {clienteSeleccionado.ultimaOrden && (
                    <div className="stat-item">
                      <span className="stat-label">Última Orden:</span>
                      <span className="stat-value">{formatDate(clienteSeleccionado.ultimaOrden)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="header-actions">
                <button
                  className={`btn-vip ${clienteSeleccionado.esVIP ? 'active' : ''}`}
                  onClick={toggleVIP}
                >
                  {clienteSeleccionado.esVIP ? '⭐ Quitar VIP' : '⭐ Marcar como VIP'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setEditandoPreferencias(false)
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Preferencias y Notas */}
            <div className="preferencias-section">
              <div className="section-header">
                <h3>💡 Preferencias y Notas</h3>
                {!editandoPreferencias && (
                  <button
                    className="btn-link"
                    onClick={() => setEditandoPreferencias(true)}
                  >
                    ✏️ Editar
                  </button>
                )}
              </div>
              {editandoPreferencias ? (
                <div className="form-preferencias">
                  <div className="form-group">
                    <label>Preferencias del Cliente:</label>
                    <textarea
                      rows={3}
                      value={preferencias}
                      onChange={(e) => setPreferencias(e.target.value)}
                      placeholder="Ej: Prefiere materiales ecológicos, entrega en horario matutino..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Notas Internas:</label>
                    <textarea
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Notas internas sobre el cliente..."
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setEditandoPreferencias(false)
                        setPreferencias(clienteSeleccionado.preferencias || '')
                        setNotas(clienteSeleccionado.notas || '')
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn-primary"
                      onClick={guardarPreferencias}
                    >
                      💾 Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="preferencias-display">
                  {clienteSeleccionado.preferencias ? (
                    <div className="preferencia-item">
                      <strong>Preferencias:</strong>
                      <p>{clienteSeleccionado.preferencias}</p>
                    </div>
                  ) : (
                    <p className="sin-datos">No hay preferencias registradas</p>
                  )}
                  {clienteSeleccionado.notas && (
                    <div className="preferencia-item">
                      <strong>Notas Internas:</strong>
                      <p>{clienteSeleccionado.notas}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Órdenes Activas */}
            {loadingOrdenes ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Cargando órdenes...</p>
              </div>
            ) : (
              <>
                {ordenesCliente.length > 0 && (
                  <div className="ordenes-activas-section">
                    <h3>📋 Órdenes Activas ({ordenesCliente.length})</h3>
                    <div className="ordenes-grid">
                      {ordenesCliente.map((orden) => (
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
                          {orden.fecha_entrega && (
                            <div className="orden-fecha">
                              Entrega: {formatDate(orden.fecha_entrega)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial Completo */}
                <div className="historial-section">
                  <h3>📚 Historial Completo ({historialCompleto.length} órdenes)</h3>
                  {historialCompleto.length === 0 ? (
                    <div className="empty-state">
                      <p>No hay historial disponible</p>
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
                              <td>
                                {orden.fecha_creacion ? formatDate(orden.fecha_creacion) : '-'}
                              </td>
                              <td>
                                {orden.fecha_entrega ? formatDate(orden.fecha_entrega) : '-'}
                              </td>
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
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default ClientesFrecuentesPage

