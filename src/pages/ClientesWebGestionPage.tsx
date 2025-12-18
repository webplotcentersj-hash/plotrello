import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ClienteWebRecord } from '../types/api'
import './ClientesWebGestionPage.css'

const ClientesWebGestionPage = () => {
  const navigate = useNavigate()
  const { usuario, isAdmin, isMostrador } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteWebRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteWebRecord | null>(null)
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
    if (!isAdmin && !isMostrador) {
      navigate('/')
      return
    }
    loadClientes()
  }, [navigate, isAdmin, isMostrador])

  const loadClientes = async () => {
    setLoading(true)
    try {
      const response = await apiService.getClientesWeb()
      if (response.success && response.data) {
        setClientes(response.data)
      }
    } catch (error) {
      console.error('Error cargando clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await apiService.crearClienteWeb(formData)
      if (response.success) {
        setShowCreateModal(false)
        resetForm()
        loadClientes()
      } else {
        alert(response.error || 'Error al crear cliente')
      }
    } catch (error) {
      alert('Error al crear cliente')
    }
  }

  const handleToggleActivo = async (cliente: ClienteWebRecord) => {
    // TODO: Implementar función para actualizar estado activo
    alert('Función de actualizar estado pendiente de implementar')
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

  const filteredClientes = clientes.filter(cliente => {
    const query = searchQuery.toLowerCase()
    return (
      cliente.usuario.toLowerCase().includes(query) ||
      cliente.nombre.toLowerCase().includes(query) ||
      cliente.email?.toLowerCase().includes(query) ||
      cliente.empresa?.toLowerCase().includes(query)
    )
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
                <th>ID</th>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="clientes-web-empty">
                    {searchQuery ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
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
            <div className="clientes-web-modal-form">
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
                <button className="btn-secondary" onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  {editingCliente ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientesWebGestionPage

