import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ClienteWebRecord } from '../types/api'
import './ClientesWebGestionPage.css'

const ClientesWebGestionPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteWebRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteWebRecord | null>(null)
  const [sortField, setSortField] = useState<keyof ClienteWebRecord | ''>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
    nombre: '',
    apellido: '',
    empresa: '',
    telefono: '',
    email: '',
    dni_cuit: '',
    direccion: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadClientes()
  }, [navigate, isAdmin, isMostrador, authLoading])

  const loadClientes = async () => {
    setLoading(true)
    try {
      const response = await apiService.getClientesWeb()
      if (response.success && response.data) {
        setClientes(response.data)
      } else {
        console.error('Error cargando clientes:', response.error)
        alert(response.error || 'Error al cargar clientes')
      }
    } catch (error) {
      console.error('Error cargando clientes:', error)
      alert('Error de conexión al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    try {
      // Validar campos requeridos
      if (!formData.usuario && !editingCliente) {
        alert('El usuario es requerido')
        return
      }
      if (!formData.nombre) {
        alert('El nombre es requerido')
        return
      }
      if (!formData.password && !editingCliente) {
        alert('La contraseña es requerida')
        return
      }

      let response
      if (editingCliente) {
        // Actualizar cliente existente
        console.log('Actualizando cliente:', editingCliente.id, formData)
        response = await apiService.actualizarClienteWeb(editingCliente.id, {
          password: formData.password || undefined,
          nombre: formData.nombre,
          apellido: formData.apellido || undefined,
          empresa: formData.empresa || undefined,
          telefono: formData.telefono || undefined,
          email: formData.email || undefined,
          dni_cuit: formData.dni_cuit || undefined,
          direccion: formData.direccion || undefined
        })
      } else {
        // Crear nuevo cliente
        console.log('Creando cliente:', formData)
        response = await apiService.crearClienteWeb(formData)
      }
      
      console.log('Respuesta:', response)
      if (response.success) {
        setShowCreateModal(false)
        resetForm()
        await loadClientes()
      } else {
        console.error('Error en respuesta:', response.error)
        alert(response.error || `Error al ${editingCliente ? 'actualizar' : 'crear'} cliente`)
      }
    } catch (error) {
      console.error('Error en handleCreate:', error)
      alert(`Error al ${editingCliente ? 'actualizar' : 'crear'} cliente: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleToggleActivo = async (cliente: ClienteWebRecord) => {
    try {
      const response = await apiService.actualizarClienteWeb(cliente.id, {
        activo: !cliente.activo
      })
      if (response.success) {
        loadClientes()
      } else {
        alert(response.error || 'Error al actualizar estado del cliente')
      }
    } catch (error) {
      alert('Error al actualizar estado del cliente')
    }
  }

  const resetForm = () => {
    setFormData({
      usuario: '',
      password: '',
      nombre: '',
      apellido: '',
      empresa: '',
      telefono: '',
      email: '',
      dni_cuit: '',
      direccion: ''
    })
    setEditingCliente(null)
  }

  const handleSort = (field: keyof ClienteWebRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedClientes = clientes
    .filter(cliente => {
      const query = searchQuery.toLowerCase()
      return (
        cliente.usuario.toLowerCase().includes(query) ||
        cliente.nombre.toLowerCase().includes(query) ||
        cliente.email?.toLowerCase().includes(query) ||
        cliente.empresa?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      if (!sortField) return 0
      
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      // Manejar valores null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1
      
      // Comparar valores
      let comparison = 0
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' })
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = aValue === bValue ? 0 : aValue ? 1 : -1
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'es', { sensitivity: 'base' })
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

  if (loading) {
    return (
      <div className="clientes-web-gestion-loading">
        <div className="spinner"></div>
        <p>Cargando clientes...</p>
      </div>
    )
  }

  return (
    <div className="clientes-web-gestion">
      <header className="clientes-web-gestion-header">
        <div className="clientes-web-header-content">
          <h1>👤 Gestión de Clientes Web</h1>
          <div className="clientes-web-header-actions">
            <button className="btn-back" onClick={() => navigate('/clientes-web/dashboard')}>
              ← Volver
            </button>
            <button className="btn-secondary" onClick={() => navigate('/clientes-web/presupuestos')}>
              💰 Presupuestos
            </button>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              + Nuevo Cliente
            </button>
          </div>
        </div>
      </header>

      <div className="clientes-web-gestion-content">
        {/* Buscador */}
        <div className="clientes-web-search">
          <input
            type="text"
            placeholder="Buscar por usuario, nombre, email o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="clientes-web-search-input"
          />
        </div>

        {/* Tabla de clientes */}
        <div className="clientes-web-table-container">
          <table className="clientes-web-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('id')}>
                  ID
                  {sortField === 'id' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('usuario')}>
                  Usuario
                  {sortField === 'usuario' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('nombre')}>
                  Nombre
                  {sortField === 'nombre' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('empresa')}>
                  Empresa
                  {sortField === 'empresa' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('email')}>
                  Email
                  {sortField === 'email' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('telefono')}>
                  Teléfono
                  {sortField === 'telefono' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="sortable" onClick={() => handleSort('activo')}>
                  Estado
                  {sortField === 'activo' && (
                    <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedClientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="clientes-web-empty">
                    {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.id}</td>
                    <td>{cliente.usuario}</td>
                    <td>{cliente.nombre} {cliente.apellido || ''}</td>
                    <td>{cliente.empresa || '-'}</td>
                    <td>{cliente.email || '-'}</td>
                    <td>{cliente.telefono || '-'}</td>
                    <td>
                      <span className={`clientes-web-status-badge ${cliente.activo ? 'activo' : 'inactivo'}`}>
                        {cliente.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setEditingCliente(cliente)
                          setFormData({
                            usuario: cliente.usuario,
                            password: '',
                            nombre: cliente.nombre,
                            apellido: cliente.apellido || '',
                            empresa: cliente.empresa || '',
                            telefono: cliente.telefono || '',
                            email: cliente.email || '',
                            dni_cuit: cliente.dni_cuit || '',
                            direccion: cliente.direccion || ''
                          })
                          setShowCreateModal(true)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className={`btn-toggle ${cliente.activo ? 'btn-deactivate' : 'btn-activate'}`}
                        onClick={() => handleToggleActivo(cliente)}
                      >
                        {cliente.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de crear/editar */}
      {showCreateModal && (
        <div className="clientes-web-modal-overlay" onClick={() => {
          setShowCreateModal(false)
          resetForm()
        }}>
          <div className="clientes-web-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <form className="clientes-web-modal-form" onSubmit={handleCreate}>
              <div className="clientes-web-form-row">
                <div className="clientes-web-form-group">
                  <label>Usuario *</label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    disabled={!!editingCliente}
                    required
                  />
                </div>
                <div className="clientes-web-form-group">
                  <label>Contraseña {editingCliente ? '(dejar vacío para no cambiar)' : '*'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingCliente}
                  />
                </div>
              </div>
              <div className="clientes-web-form-row">
                <div className="clientes-web-form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="clientes-web-form-group">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </div>
              </div>
              <div className="clientes-web-form-row">
                <div className="clientes-web-form-group">
                  <label>Empresa</label>
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  />
                </div>
                <div className="clientes-web-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="clientes-web-form-row">
                <div className="clientes-web-form-group">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
                <div className="clientes-web-form-group">
                  <label>DNI/CUIT</label>
                  <input
                    type="text"
                    value={formData.dni_cuit}
                    onChange={(e) => setFormData({ ...formData, dni_cuit: e.target.value })}
                  />
                </div>
              </div>
              <div className="clientes-web-form-group">
                <label>Dirección</label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="clientes-web-modal-actions">
                <button 
                  type="button"
                  className="btn-secondary" 
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                >
                  {editingCliente ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientesWebGestionPage

