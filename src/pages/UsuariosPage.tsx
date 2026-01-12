import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UsuarioRecord, UserRole } from '../types/api'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './UsuariosPage.css'

const UsuariosPage = () => {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const roleOptions: Array<{ value: UserRole; label: string; color: string }> = [
    { value: 'diseno', label: 'Diseño', color: '#f97316' },
    { value: 'imprenta', label: 'Imprenta', color: '#38bdf8' },
    { value: 'taller-grafico', label: 'Taller Gráfico', color: '#6366f1' },
    { value: 'instalaciones', label: 'Instalaciones', color: '#a855f7' },
    { value: 'metalurgica', label: 'Metalúrgica', color: '#ec4899' },
    { value: 'caja', label: 'Caja', color: '#facc15' },
    { value: 'mostrador', label: 'Mostrador', color: '#10b981' },
    { value: 'compras', label: 'Compras', color: '#8b5cf6' },
    { value: 'recursos-humanos', label: 'Recursos Humanos', color: '#f472b6' },
    { value: 'gerencia', label: 'Gerencia', color: '#0ea5e9' }
  ]

  const [formData, setFormData] = useState({
    nombre: '',
    password: '',
    confirmPassword: '',
    rol: 'diseno' as UserRole
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/')
    }
  }, [isAdmin, loading, navigate])

  useEffect(() => {
    if (isAdmin) {
      loadUsuarios()
    }
  }, [isAdmin])

  const loadUsuarios = async () => {
    setLoadingUsuarios(true)
    setError(null)
    try {
      const response = await apiService.getUsuarios()
      if (response.success && response.data) {
        // Filtrar solo usuarios no admin
        const usuariosNoAdmin = response.data.filter((u) => u.rol !== 'administracion')
        setUsuarios(usuariosNoAdmin)
      } else {
        setError('Error al cargar usuarios')
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err)
      setError('Error al cargar usuarios')
    } finally {
      setLoadingUsuarios(false)
    }
  }

  const handleCreateUsuario = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validaciones
    if (!formData.nombre.trim()) {
      setError('El nombre de usuario es requerido')
      return
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setCreating(true)
    try {
      const response = await apiService.createUsuario({
        nombre: formData.nombre.trim(),
        password: formData.password,
        rol: formData.rol
      })

      if (response.success) {
        setSuccess(`Usuario "${formData.nombre}" creado exitosamente`)
        setFormData({
          nombre: '',
          password: '',
          confirmPassword: '',
          rol: 'diseno'
        })
        setShowCreateForm(false)
        await loadUsuarios()
      } else {
        setError(response.error || 'Error al crear usuario')
      }
    } catch (err) {
      console.error('Error creando usuario:', err)
      setError('Error al crear usuario. Por favor intenta nuevamente.')
    } finally {
      setCreating(false)
    }
  }

  const getRolLabel = (rol: UserRole) => {
    const option = roleOptions.find((r) => r.value === rol)
    if (rol === 'administracion') return 'Administración'
    return option?.label || rol
  }

  const getRolColor = (rol: UserRole) => {
    if (rol === 'administracion') return '#eb671b'
    const option = roleOptions.find((r) => r.value === rol)
    return option?.color || '#6b7280'
  }

  if (loading) {
    return (
      <div className="usuarios-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="usuarios-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
          <button onClick={() => navigate('/board')} className="back-button" style={{ marginTop: '20px' }}>
            ← Volver al Tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="usuarios-page">
      <header className="usuarios-header">
        <div className="header-content">
          <img 
            src="https://trello.plotcenter.com.ar/Group%20187.png" 
            alt="Plot Center Logo" 
            className="usuarios-logo"
          />
          <div className="header-text">
            <h1>Gestión de Usuarios</h1>
            <p>Administra usuarios del sistema (Taller y Mostrador)</p>
          </div>
          <button className="back-button" onClick={() => navigate('/board')}>
            ← Volver al Tablero
          </button>
        </div>
      </header>

      <div className="usuarios-container">
        <div className="usuarios-actions">
          <button
            className="create-button"
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setError(null)
              setSuccess(null)
            }}
          >
            {showCreateForm ? '−' : '+'} Crear Nuevo Usuario
          </button>
        </div>

        {error && (
          <div className="message error-message">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="message success-message">
            <span>✅</span>
            <span>{success}</span>
          </div>
        )}

        {showCreateForm && (
          <div className="create-form-card">
            <h3>Crear Nuevo Usuario</h3>
            <form onSubmit={handleCreateUsuario}>
              <div className="form-group">
                <label htmlFor="nombre">Nombre de Usuario *</label>
                <input
                  id="nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: juan_perez"
                  required
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rol">Rol *</label>
                <select
                  id="rol"
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole })}
                  disabled={creating}
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <small className="form-hint">Los usuarios del rol Administración deben crearse desde la base de datos</small>
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña *</label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={creating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Contraseña *</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Repite la contraseña"
                  required
                  disabled={creating}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setFormData({
                      nombre: '',
                      password: '',
                      confirmPassword: '',
                      rol: 'diseno'
                    })
                    setError(null)
                    setSuccess(null)
                  }}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={creating}
                >
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="usuarios-list">
          <h2>Usuarios del Sistema ({usuarios.length})</h2>
          
          {loadingUsuarios ? (
            <div className="loading-state">
              <p>Cargando usuarios...</p>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="empty-state">
              <p>No hay usuarios registrados</p>
              <p className="empty-hint">Crea el primer usuario usando el botón de arriba</p>
            </div>
          ) : (
            <div className="usuarios-grid">
              {usuarios.map((usuario) => (
                <div key={usuario.id} className="usuario-card">
                  <div className="usuario-header">
                    <div className="usuario-avatar">
                      {usuario.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="usuario-info">
                      <h3>{usuario.nombre}</h3>
                      <div
                        className="usuario-rol-badge"
                        style={{ backgroundColor: getRolColor(usuario.rol) }}
                      >
                        {getRolLabel(usuario.rol)}
                      </div>
                    </div>
                  </div>
                  <div className="usuario-id">
                    <span className="id-label">ID:</span>
                    <span className="id-value">{usuario.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UsuariosPage

