import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { PresupuestoClienteRecord } from '../types/api'
import './PresupuestosClientesAdminPage.css'

export default function PresupuestosClientesAdminPage() {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [presupuestos, setPresupuestos] = useState<Array<PresupuestoClienteRecord & {
    cliente_nombre?: string
    cliente_empresa?: string
    cliente_email?: string
  }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEstado, setFilterEstado] = useState<string>('todos')
  const [sortField, setSortField] = useState<keyof PresupuestoClienteRecord | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadPresupuestos()
  }, [navigate, isAdmin, isMostrador, authLoading])

  const loadPresupuestos = async () => {
    setLoading(true)
    try {
      const response = await apiService.getPresupuestosClientesAdmin({
        estado: filterEstado !== 'todos' ? filterEstado as any : undefined
      })
      if (response.success && response.data) {
        setPresupuestos(response.data)
      } else {
        console.error('Error cargando presupuestos:', response.error)
        alert(response.error || 'Error al cargar presupuestos')
      }
    } catch (error) {
      console.error('Error cargando presupuestos:', error)
      alert('Error de conexión al cargar presupuestos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPresupuestos()
  }, [filterEstado])

  const handleSort = (field: keyof PresupuestoClienteRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getEstadoColor = (estado: string) => {
    const colors: Record<string, string> = {
      borrador: '#6b7280',
      enviado: '#3b82f6',
      aceptado: '#10b981',
      rechazado: '#ef4444',
      cancelado: '#9ca3af',
      convertido: '#6366f1'
    }
    return colors[estado] || '#6b7280'
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      borrador: 'Borrador',
      enviado: 'Enviado',
      aceptado: 'Aceptado',
      rechazado: 'Rechazado',
      cancelado: 'Cancelado',
      convertido: 'Convertido'
    }
    return labels[estado] || estado
  }

  const filteredAndSortedPresupuestos = presupuestos
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          p.numero_presupuesto.toLowerCase().includes(query) ||
          (p.cliente_nombre && p.cliente_nombre.toLowerCase().includes(query)) ||
          (p.cliente_empresa && p.cliente_empresa.toLowerCase().includes(query)) ||
          (p.cliente_email && p.cliente_email.toLowerCase().includes(query))
        )
      }
      return true
    })
    .sort((a, b) => {
      if (!sortField) return 0
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === undefined || aVal === null) return 1
      if (bVal === undefined || bVal === null) return -1
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })

  if (authLoading || loading) {
    return (
      <div className="presupuestos-clientes-admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando presupuestos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="presupuestos-clientes-admin-page">
      <header className="presupuestos-admin-header">
        <div className="presupuestos-admin-header-content">
          <h1>💰 Presupuestos de Clientes</h1>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/clientes-web')}
          >
            ← Volver a Gestión de Clientes
          </button>
        </div>
      </header>

      <div className="presupuestos-admin-content">
        {/* Filtros y búsqueda */}
        <div className="presupuestos-admin-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar por número, cliente, empresa o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-box">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="filter-select"
            >
              <option value="todos">Todos los estados</option>
              <option value="borrador">Borradores</option>
              <option value="enviado">Enviados</option>
              <option value="aceptado">Aceptados</option>
              <option value="rechazado">Rechazados</option>
              <option value="convertido">Convertidos</option>
            </select>
          </div>
        </div>

        {/* Tabla de presupuestos */}
        <div className="presupuestos-table-container">
          <table className="presupuestos-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('numero_presupuesto')} className="sortable">
                  Número {sortField === 'numero_presupuesto' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th onClick={() => handleSort('fecha_creacion')} className="sortable">
                  Fecha {sortField === 'fecha_creacion' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('estado')} className="sortable">
                  Estado {sortField === 'estado' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('precio_total')} className="sortable">
                  Total {sortField === 'precio_total' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedPresupuestos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-data">
                    No hay presupuestos {searchQuery ? 'que coincidan con la búsqueda' : ''}
                  </td>
                </tr>
              ) : (
                filteredAndSortedPresupuestos.map((presupuesto) => (
                  <tr key={presupuesto.id}>
                    <td>
                      <strong>{presupuesto.numero_presupuesto}</strong>
                    </td>
                    <td>
                      {presupuesto.cliente_nombre || '-'}
                      {presupuesto.cliente_email && (
                        <div className="cliente-email">{presupuesto.cliente_email}</div>
                      )}
                    </td>
                    <td>{presupuesto.cliente_empresa || '-'}</td>
                    <td>
                      {new Date(presupuesto.fecha_creacion).toLocaleDateString('es-AR')}
                    </td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getEstadoColor(presupuesto.estado) }}
                      >
                        {getEstadoLabel(presupuesto.estado)}
                      </span>
                    </td>
                    <td>
                      <strong>${presupuesto.precio_total.toFixed(2)}</strong>
                    </td>
                    <td>
                      <button
                        className="btn-view"
                        onClick={() => navigate(`/clientes-web/presupuestos/${presupuesto.id}`)}
                      >
                        Ver Detalle
                      </button>
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

