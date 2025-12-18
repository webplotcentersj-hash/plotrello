import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PedidoClienteRecord } from '../types/api'
import './PedidosClientesPage.css'

const PedidosClientesPage = () => {
  const navigate = useNavigate()
  const { usuario, isAdmin, isMostrador } = useAuth()
  const [loading, setLoading] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoClienteRecord[]>([])
  const [filterEstado, setFilterEstado] = useState<string>('todos')

  useEffect(() => {
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadPedidos()
  }, [navigate, isAdmin, isMostrador])

  const loadPedidos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getPedidosPendientes()
      if (response.success && response.data) {
        setPedidos(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPedidos = pedidos.filter(pedido => {
    if (filterEstado === 'todos') return true
    return pedido.estado === filterEstado
  })

  if (loading) {
    return (
      <div className="pedidos-clientes-loading">
        <div className="spinner"></div>
        <p>Cargando pedidos...</p>
      </div>
    )
  }

  return (
    <div className="pedidos-clientes">
      <header className="pedidos-clientes-header">
        <div className="pedidos-clientes-header-content">
          <h1>📋 Pedidos de Clientes</h1>
          <div className="pedidos-clientes-header-actions">
            <button className="btn-back" onClick={() => navigate('/clientes-web/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="pedidos-clientes-content">
        {/* Filtros */}
        <div className="pedidos-clientes-filters">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="pedidos-clientes-filter-select"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En Revisión</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
            <option value="convertido_completo">Convertidos</option>
          </select>
        </div>

        {/* Tabla de pedidos */}
        <div className="pedidos-clientes-table-container">
          <table className="pedidos-clientes-table">
            <thead>
              <tr>
                <th>N° Pedido</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Total</th>
                <th>OP Asociada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pedidos-clientes-empty">
                    No hay pedidos {filterEstado !== 'todos' ? `con estado "${filterEstado}"` : ''}
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>{pedido.numero_pedido}</td>
                    <td>Cliente #{pedido.id_cliente}</td>
                    <td>{new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className={`pedidos-clientes-status-badge ${pedido.estado}`}>
                        {pedido.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td>${pedido.precio_total?.toFixed(2) || '0.00'}</td>
                    <td>
                      {pedido.id_op_asociada ? (
                        <a
                          href={`/op/${pedido.id_op_asociada}`}
                          className="pedidos-clientes-op-link"
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/op/${pedido.id_op_asociada}`)
                          }}
                        >
                          OP #{pedido.id_op_asociada}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-view"
                        onClick={() => navigate(`/clientes-web/pedidos/${pedido.id}`)}
                      >
                        Ver Detalle
                      </button>
                      {pedido.estado === 'pendiente' && (
                        <button
                          className="btn-convert"
                          onClick={() => navigate(`/clientes-web/pedidos/${pedido.id}/convertir`)}
                        >
                          Convertir a OP
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PedidosClientesPage

