import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import LegajoEmpleadoModal from '../components/LegajoEmpleadoModal'
import VerLegajoModal from '../components/VerLegajoModal'
import './RecursosHumanosUsuariosPage.css'

const RecursosHumanosUsuariosPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLegajoModal, setShowLegajoModal] = useState(false)
  const [showVerLegajoModal, setShowVerLegajoModal] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRol, setFilterRol] = useState<string>('todos')

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    password: '',
    rol: 'mostrador' as UsuarioRecord['rol']
  })

  const roleOptions = [
    { value: 'administracion', label: 'Administración', color: '#ef4444' },
    { value: 'gerencia', label: 'Gerencia', color: '#f59e0b' },
    { value: 'recursos-humanos', label: 'Recursos Humanos', color: '#f472b6' },
    { value: 'diseno', label: 'Diseño', color: '#f97316' },
    { value: 'imprenta', label: 'Imprenta', color: '#38bdf8' },
    { value: 'taller-grafico', label: 'Taller Gráfico', color: '#6366f1' },
    { value: 'instalaciones', label: 'Instalaciones', color: '#a855f7' },
    { value: 'metalurgica', label: 'Metalúrgica', color: '#ec4899' },
    { value: 'caja', label: 'Caja', color: '#facc15' },
    { value: 'mostrador', label: 'Mostrador', color: '#10b981' },
    { value: 'compras', label: 'Compras', color: '#06b6d4' }
  ]

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadUsuarios()
  }, [canManageRecursosHumanos, navigate, authLoading])

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const response = await apiService.getUsuarios()
      if (response.success && response.data) {
        setUsuarios(response.data)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.nombre.trim() || !formData.password.trim()) {
      alert('Por favor completa todos los campos')
      return
    }

    try {
      const response = await apiService.createUsuario({
        nombre: formData.nombre,
        password: formData.password,
        rol: formData.rol
      })

      if (response.success) {
        setShowCreateModal(false)
        setFormData({ nombre: '', password: '', rol: 'mostrador' })
        await loadUsuarios()
        alert('Usuario creado exitosamente')
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error creando usuario:', error)
      alert('Error al crear usuario')
    }
  }

  const handleEdit = async () => {
    if (!selectedUsuario || !formData.nombre.trim()) {
      alert('Por favor completa el nombre del usuario')
      return
    }

    try {
      const updates: {
        nombre?: string
        rol?: UsuarioRecord['rol']
        password?: string
      } = {
        nombre: formData.nombre.trim(),
        rol: formData.rol
      }

      // Solo incluir contraseña si se proporcionó una nueva
      if (formData.password.trim()) {
        updates.password = formData.password
      }

      const response = await apiService.updateUsuario(selectedUsuario.id, updates)

      if (response.success) {
        setShowEditModal(false)
        setSelectedUsuario(null)
        setFormData({ nombre: '', password: '', rol: 'mostrador' })
        await loadUsuarios()
        alert('Usuario actualizado exitosamente')
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error actualizando usuario:', error)
      alert('Error al actualizar usuario')
    }
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const response = await apiService.deleteUsuario(userId)

      if (response.success) {
        await loadUsuarios()
        alert('Usuario eliminado exitosamente')
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error eliminando usuario:', error)
      alert('Error al eliminar usuario')
    }
  }

  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRol = filterRol === 'todos' || u.rol === filterRol
    return matchesSearch && matchesRol
  })

  if (loading) {
    return (
      <div className="rrhh-usuarios-loading">
        <div className="spinner"></div>
        <p>Cargando usuarios...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-usuarios-page">
      <header className="rrhh-usuarios-header">
        <div className="rrhh-header-content">
          <h1>👤 Gestión de Usuarios</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setFormData({ nombre: '', password: '', rol: 'mostrador' })
                setShowCreateModal(true)
              }}
            >
              + Crear Usuario
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-usuarios-content">
        {/* Filtros */}
        <div className="rrhh-filters">
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rrhh-search-input"
          />
          <select
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
            className="rrhh-filter-select"
          >
            <option value="todos">Todos los roles</option>
            {roleOptions.map(role => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla de usuarios */}
        <div className="rrhh-users-table-container">
          <table className="rrhh-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Última Actividad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsuarios.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.nombre}</td>
                  <td>
                    <span
                      className="rrhh-role-badge"
                      style={{
                        backgroundColor: `${roleOptions.find(r => r.value === user.rol)?.color}20`,
                        color: roleOptions.find(r => r.value === user.rol)?.color
                      }}
                    >
                      {roleOptions.find(r => r.value === user.rol)?.label || user.rol}
                    </span>
                  </td>
                  <td>Hoy</td>
                  <td>
                    <div className="rrhh-actions-buttons">
                      <button
                        className="btn-ver-legajo"
                        onClick={() => {
                          setSelectedUsuario(user)
                          setShowVerLegajoModal(true)
                        }}
                        title="Ver Legajo Completo"
                      >
                        👁️ Ver Legajo
                      </button>
                      <button
                        className="btn-legajo"
                        onClick={() => {
                          setSelectedUsuario(user)
                          setShowLegajoModal(true)
                        }}
                        title="Editar Legajo Completo"
                      >
                        📝 Editar Legajo
                      </button>
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setSelectedUsuario(user)
                          setFormData({
                            nombre: user.nombre,
                            password: '',
                            rol: user.rol
                          })
                          setShowEditModal(true)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(user.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Crear Nuevo Usuario</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </header>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del usuario"
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Contraseña"
                />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as UsuarioRecord['rol'] })}
                >
                  {roleOptions.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleCreate}>
                  Crear Usuario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && selectedUsuario && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h3>Editar Usuario</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                ×
              </button>
            </header>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre del usuario"
                />
              </div>
              <div className="form-group">
                <label>Nueva Contraseña (opcional)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Dejar vacío para mantener la actual"
                />
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as UsuarioRecord['rol'] })}
                >
                  {roleOptions.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleEdit}>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Legajo (Solo Lectura) */}
      {showVerLegajoModal && selectedUsuario && (
        <VerLegajoModal
          usuario={selectedUsuario}
          isOpen={showVerLegajoModal}
          onClose={() => {
            setShowVerLegajoModal(false)
            setSelectedUsuario(null)
          }}
        />
      )}

      {/* Modal Editar Legajo */}
      {showLegajoModal && selectedUsuario && (
        <LegajoEmpleadoModal
          usuario={selectedUsuario}
          isOpen={showLegajoModal}
          onClose={() => {
            setShowLegajoModal(false)
            setSelectedUsuario(null)
          }}
          onSave={() => {
            loadUsuarios()
          }}
        />
      )}
    </div>
  )
}

export default RecursosHumanosUsuariosPage

