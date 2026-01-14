import { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'
import type { ClienteRecord, Venta, OportunidadVenta, OrdenTrabajo } from '../types/api'
import { formatArgentinaDate } from '../utils/dateUtils'
import './BuscadorClientesModal.css'

type BuscadorClientesModalProps = {
  onClose: () => void
}

const BuscadorClientesModal = ({ onClose }: BuscadorClientesModalProps) => {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [ventasCliente, setVentasCliente] = useState<Venta[]>([])
  const [oportunidadesCliente, setOportunidadesCliente] = useState<OportunidadVenta[]>([])
  const [ordenesCliente, setOrdenesCliente] = useState<OrdenTrabajo[]>([])
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [nuevaNota, setNuevaNota] = useState('')
  const [notasCliente, setNotasCliente] = useState<Array<{ id: number; nota: string; fecha: string; usuario: string }>>([])

  const buscarClientes = useCallback(async (query: string) => {
    if (!query.trim()) {
      setClientes([])
      return
    }

    setLoading(true)
    try {
      const response = await apiService.buscarClientes(query)
      if (response.success && response.data) {
        setClientes(response.data)
      } else {
        console.error('Error en respuesta buscarClientes:', response.error)
        setClientes([])
        // Mostrar error al usuario si es necesario
        if (response.error) {
          alert('Error al buscar clientes: ' + response.error)
        }
      }
    } catch (error: any) {
      console.error('Error buscando clientes:', error)
      setClientes([])
      alert('Error al buscar clientes: ' + (error.message || 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (busqueda.trim()) {
        buscarClientes(busqueda)
      } else {
        setClientes([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [busqueda, buscarClientes])

  const cargarDatosCliente = useCallback(async (cliente: ClienteRecord) => {
    setCargandoDatos(true)
    try {
      // Cargar ventas del cliente
      const ventasResp = await apiService.obtenerVentas()
      if (ventasResp.success && ventasResp.data) {
        const nombreClienteLower = cliente.nombre.toLowerCase()
        const apellidoClienteLower = cliente.apellido?.toLowerCase() || ''
        const nombreCompletoCliente = `${cliente.nombre} ${cliente.apellido || ''}`.trim().toLowerCase()
        
        const ventasFiltradas = ventasResp.data.filter(v => {
          const nombreVentaLower = v.cliente_nombre?.toLowerCase() || ''
          return (
            nombreVentaLower.includes(nombreClienteLower) ||
            nombreVentaLower.includes(apellidoClienteLower) ||
            nombreVentaLower === nombreCompletoCliente ||
            (cliente.dni_cuit && v.cliente_dni_cuit === cliente.dni_cuit) ||
            (cliente.telefono && v.cliente_telefono === cliente.telefono) ||
            (cliente.email && v.cliente_email === cliente.email)
          )
        })
        setVentasCliente(ventasFiltradas)
      }

      // Cargar oportunidades del cliente
      const oppResp = await apiService.obtenerOportunidadesVenta()
      if (oppResp.success && oppResp.data) {
        const nombreClienteLower = cliente.nombre.toLowerCase()
        const apellidoClienteLower = cliente.apellido?.toLowerCase() || ''
        const nombreCompletoCliente = `${cliente.nombre} ${cliente.apellido || ''}`.trim().toLowerCase()
        
        const oppFiltradas = oppResp.data.filter(o => {
          const nombreOppLower = o.cliente_nombre?.toLowerCase() || ''
          return (
            nombreOppLower.includes(nombreClienteLower) ||
            nombreOppLower.includes(apellidoClienteLower) ||
            nombreOppLower === nombreCompletoCliente ||
            (cliente.dni_cuit && o.cliente_dni_cuit === cliente.dni_cuit) ||
            (cliente.telefono && o.cliente_telefono === cliente.telefono) ||
            (cliente.email && o.cliente_email === cliente.email)
          )
        })
        setOportunidadesCliente(oppFiltradas)
      }

      // Cargar órdenes del cliente
      const ordenesResp = await apiService.getOrdenes()
      if (ordenesResp.success && ordenesResp.data) {
        const ordenesFiltradas = ordenesResp.data.filter(o =>
          o.cliente?.toLowerCase().includes(cliente.nombre.toLowerCase()) ||
          (cliente.dni_cuit && o.dni_cuit === cliente.dni_cuit) ||
          (cliente.telefono && o.telefono_cliente === cliente.telefono)
        )
        setOrdenesCliente(ordenesFiltradas)
      }

      // Cargar notas del cliente (por ahora simuladas, luego se puede agregar a la BD)
      // TODO: Implementar tabla de notas_seguimiento_clientes
      setNotasCliente([])
    } catch (error) {
      console.error('Error cargando datos del cliente:', error)
    } finally {
      setCargandoDatos(false)
    }
  }, [])

  const handleSeleccionarCliente = (cliente: ClienteRecord) => {
    setClienteSeleccionado(cliente)
    cargarDatosCliente(cliente)
  }

  const handleAgregarNota = async () => {
    if (!nuevaNota.trim() || !clienteSeleccionado) return

    // TODO: Implementar API para guardar notas
    const nota = {
      id: Date.now(),
      nota: nuevaNota.trim(),
      fecha: new Date().toISOString(),
      usuario: 'Usuario Actual' // Obtener del contexto de auth
    }

    setNotasCliente(prev => [nota, ...prev])
    setNuevaNota('')
  }

  const totalVentas = ventasCliente.reduce((sum, v) => sum + v.valor_total, 0)
  const ventasPagadas = ventasCliente.filter(v => v.estado_pago === 'Pagado').length
  const oportunidadesActivas = oportunidadesCliente.filter(o => o.activo && o.etapa !== 'Cerrado' && o.etapa !== 'Perdido').length

  return (
    <div className="modal-overlay buscador-clientes-overlay" onClick={onClose}>
      <div className="modal-content buscador-clientes-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>🔍 Buscador de Clientes</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="buscador-clientes-body">
          {/* Búsqueda */}
          <div className="busqueda-section">
            <input
              type="text"
              className="busqueda-input"
              placeholder="Buscar por nombre, DNI/CUIT, teléfono, email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
            {loading && <div className="loading-spinner-small">⏳</div>}
          </div>

          {!clienteSeleccionado ? (
            /* Lista de resultados */
            <div className="resultados-lista">
              {clientes.length === 0 && busqueda && !loading && (
                <div className="empty-state">No se encontraron clientes</div>
              )}
              {clientes.map((cliente) => (
                <div
                  key={cliente.id}
                  className="cliente-item"
                  onClick={() => handleSeleccionarCliente(cliente)}
                >
                  <div className="cliente-item-header">
                    <h3>{cliente.nombre} {cliente.apellido || ''}</h3>
                    {cliente.empresa && <span className="badge-empresa">🏢 {cliente.empresa}</span>}
                  </div>
                  <div className="cliente-item-details">
                    {cliente.dni_cuit && <span>🆔 {cliente.dni_cuit}</span>}
                    {cliente.telefono && <span>📞 {cliente.telefono}</span>}
                    {cliente.email && <span>✉️ {cliente.email}</span>}
                    {cliente.direccion && <span>📍 {cliente.direccion}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Vista detallada del cliente */
            <div className="cliente-detalle">
              <div className="cliente-detalle-header">
                <button className="btn-back" onClick={() => setClienteSeleccionado(null)}>
                  ← Volver
                </button>
                <div>
                  <h2>{clienteSeleccionado.nombre} {clienteSeleccionado.apellido || ''}</h2>
                  {clienteSeleccionado.empresa && <p className="empresa-nombre">🏢 {clienteSeleccionado.empresa}</p>}
                </div>
              </div>

              {cargandoDatos ? (
                <div className="loading-state">Cargando datos...</div>
              ) : (
                <>
                  {/* Información del Cliente */}
                  <section className="info-section">
                    <h3>📋 Información del Cliente</h3>
                    <div className="info-grid">
                      {clienteSeleccionado.dni_cuit && (
                        <div className="info-item">
                          <strong>DNI/CUIT:</strong> {clienteSeleccionado.dni_cuit}
                        </div>
                      )}
                      {clienteSeleccionado.telefono && (
                        <div className="info-item">
                          <strong>Teléfono:</strong> 
                          <a href={`tel:${clienteSeleccionado.telefono}`}>{clienteSeleccionado.telefono}</a>
                        </div>
                      )}
                      {clienteSeleccionado.email && (
                        <div className="info-item">
                          <strong>Email:</strong> 
                          <a href={`mailto:${clienteSeleccionado.email}`}>{clienteSeleccionado.email}</a>
                        </div>
                      )}
                      {clienteSeleccionado.direccion && (
                        <div className="info-item">
                          <strong>Dirección:</strong> {clienteSeleccionado.direccion}
                        </div>
                      )}
                      {clienteSeleccionado.ubicacion_link && (
                        <div className="info-item">
                          <strong>Ubicación:</strong> 
                          <a href={clienteSeleccionado.ubicacion_link} target="_blank" rel="noopener noreferrer">
                            Ver en mapa
                          </a>
                        </div>
                      )}
                      {clienteSeleccionado.drive_link && (
                        <div className="info-item">
                          <strong>Drive:</strong> 
                          <a href={clienteSeleccionado.drive_link} target="_blank" rel="noopener noreferrer">
                            Abrir carpeta
                          </a>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Estadísticas Rápidas */}
                  <section className="stats-section">
                    <div className="stats-grid">
                      <div className="stat-box">
                        <div className="stat-value">{ventasCliente.length}</div>
                        <div className="stat-label">Total Ventas</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">${totalVentas.toLocaleString()}</div>
                        <div className="stat-label">Total Facturado</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{ventasPagadas}</div>
                        <div className="stat-label">Ventas Pagadas</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{oportunidadesActivas}</div>
                        <div className="stat-label">Oportunidades Activas</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-value">{ordenesCliente.length}</div>
                        <div className="stat-label">Órdenes de Trabajo</div>
                      </div>
                    </div>
                  </section>

                  {/* Ventas */}
                  {ventasCliente.length > 0 && (
                    <section className="historial-section">
                      <h3>💰 Ventas ({ventasCliente.length})</h3>
                      <div className="historial-list">
                        {ventasCliente.map((venta) => (
                          <div key={venta.id} className="historial-item">
                            <div className="historial-item-header">
                              <span className="historial-numero">{venta.numero_venta}</span>
                              <span className={`badge-estado ${venta.estado_pago.toLowerCase()}`}>
                                {venta.estado_pago}
                              </span>
                            </div>
                            <div className="historial-item-details">
                              <span>${venta.valor_total.toLocaleString()}</span>
                              <span>{formatArgentinaDate(venta.fecha_venta)}</span>
                              {venta.numero_op && <span>OP: {venta.numero_op}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Oportunidades */}
                  {oportunidadesCliente.length > 0 && (
                    <section className="historial-section">
                      <h3>🎯 Oportunidades ({oportunidadesCliente.length})</h3>
                      <div className="historial-list">
                        {oportunidadesCliente.map((opp) => (
                          <div key={opp.id} className="historial-item">
                            <div className="historial-item-header">
                              <span className="historial-numero">{opp.numero_oportunidad}</span>
                              <span className={`badge-etapa ${opp.etapa.toLowerCase()}`}>
                                {opp.etapa}
                              </span>
                            </div>
                            <div className="historial-item-details">
                              <span>${opp.valor_estimado?.toLocaleString() || '0'}</span>
                              <span>{formatArgentinaDate(opp.created_at)}</span>
                              {opp.numero_op && <span>OP: {opp.numero_op}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Órdenes de Trabajo */}
                  {ordenesCliente.length > 0 && (
                    <section className="historial-section">
                      <h3>📋 Órdenes de Trabajo ({ordenesCliente.length})</h3>
                      <div className="historial-list">
                        {ordenesCliente.map((orden) => (
                          <div key={orden.id} className="historial-item">
                            <div className="historial-item-header">
                              <span className="historial-numero">{orden.numero_op}</span>
                              <span className="badge-estado">{orden.estado}</span>
                            </div>
                            <div className="historial-item-details">
                              <span>{orden.descripcion || 'Sin descripción'}</span>
                              <span>{formatArgentinaDate(orden.fecha_creacion || '')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Notas y Seguimiento */}
                  <section className="notas-section">
                    <h3>📝 Notas y Seguimiento</h3>
                    <div className="notas-input-container">
                      <textarea
                        className="notas-input"
                        placeholder="Agregar nota o seguimiento..."
                        value={nuevaNota}
                        onChange={(e) => setNuevaNota(e.target.value)}
                        rows={3}
                      />
                      <button className="btn-agregar-nota" onClick={handleAgregarNota}>
                        ➕ Agregar Nota
                      </button>
                    </div>
                    {notasCliente.length > 0 && (
                      <div className="notas-list">
                        {notasCliente.map((nota) => (
                          <div key={nota.id} className="nota-item">
                            <div className="nota-header">
                              <span className="nota-usuario">{nota.usuario}</span>
                              <span className="nota-fecha">{formatArgentinaDate(nota.fecha)}</span>
                            </div>
                            <div className="nota-contenido">{nota.nota}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuscadorClientesModal

