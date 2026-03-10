import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ClienteRecord } from '../types/api'
import './ClientesWebGestionPage.css'

type FiltroAcceso = 'todos' | 'con_acceso' | 'sin_acceso'

const ClientesWebGestionPage = () => {
  const navigate = useNavigate()
  const { isAdmin, isMostrador, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<ClienteRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroAcceso, setFiltroAcceso] = useState<FiltroAcceso>('todos')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [crearConAcceso, setCrearConAcceso] = useState(true)
  const [editingCliente, setEditingCliente] = useState<ClienteRecord | null>(null)
  const [darAccesoCliente, setDarAccesoCliente] = useState<ClienteRecord | null>(null)
  const [darAccesoForm, setDarAccesoForm] = useState({ usuario: '', password: '' })
  const [sortField, setSortField] = useState<keyof ClienteRecord | ''>('nombre')
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
      const response = await apiService.getClientes(true)
      if (response.success && response.data) {
        setClientes(response.data)
      } else {
        alert(response.error || 'Error al cargar clientes')
      }
    } catch (error) {
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
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido')
      return
    }
    if (crearConAcceso) {
      if (!formData.usuario.trim()) {
        alert('El usuario es requerido')
        return
      }
      if (!formData.password || formData.password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres')
        return
      }
    }

    try {
      let response
      if (editingCliente) {
        if (editingCliente.es_cliente_web) {
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
          response = await apiService.actualizarClienteDatos(editingCliente.id, {
            nombre: formData.nombre,
            apellido: formData.apellido || undefined,
            empresa: formData.empresa || undefined,
            telefono: formData.telefono || undefined,
            email: formData.email || undefined,
            dni_cuit: formData.dni_cuit || undefined,
            direccion: formData.direccion || undefined
          })
        }
      } else if (crearConAcceso) {
        response = await apiService.crearClienteWeb({
          usuario: formData.usuario,
          password: formData.password,
          nombre: formData.nombre,
          apellido: formData.apellido,
          empresa: formData.empresa,
          telefono: formData.telefono,
          email: formData.email,
          dni_cuit: formData.dni_cuit,
          direccion: formData.direccion
        })
      } else {
        response = await apiService.crearClienteSinAcceso({
          nombre: formData.nombre,
          apellido: formData.apellido,
          empresa: formData.empresa,
          telefono: formData.telefono,
          email: formData.email,
          dni_cuit: formData.dni_cuit,
          direccion: formData.direccion
        })
      }

      if (response.success) {
        setShowCreateModal(false)
        resetForm()
        await loadClientes()
      } else {
        alert(response.error || `Error al ${editingCliente ? 'actualizar' : 'crear'} cliente`)
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleDarAcceso = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!darAccesoCliente) return
    if (!darAccesoForm.usuario.trim()) {
      alert('El usuario es requerido')
      return
    }
    if (!darAccesoForm.password || darAccesoForm.password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    try {
      const response = await apiService.habilitarAccesoCliente(
        darAccesoCliente.id,
        darAccesoForm.usuario,
        darAccesoForm.password
      )
      if (response.success) {
        setDarAccesoCliente(null)
        setDarAccesoForm({ usuario: '', password: '' })
        await loadClientes()
      } else {
        alert(response.error || 'Error al habilitar acceso')
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleQuitarAcceso = async (cliente: ClienteRecord) => {
    if (!confirm(`¿Quitar acceso al portal a ${cliente.nombre}? El cliente no podrá ingresar pero se conservan sus datos.`)) return
    try {
      const response = await apiService.quitarAccesoCliente(cliente.id)
      if (response.success) await loadClientes()
      else alert(response.error || 'Error al quitar acceso')
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  const handleToggleActivo = async (cliente: ClienteRecord) => {
    if (!cliente.es_cliente_web) return
    try {
      const response = await apiService.actualizarClienteWeb(cliente.id, { activo: !cliente.activo })
      if (response.success) await loadClientes()
      else alert(response.error || 'Error al actualizar estado')
    } catch (error) {
      alert('Error al actualizar estado')
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
    setCrearConAcceso(true)
  }

  const handleSort = (field: keyof ClienteRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredClientes = clientes
    .filter((c) => {
      if (filtroAcceso === 'con_acceso') return !!c.es_cliente_web
      if (filtroAcceso === 'sin_acceso') return !c.es_cliente_web
      return true
    })
    .filter((c) => {
      const q = searchQuery.toLowerCase()
      if (!q) return true
      return (
        (c.usuario || '').toLowerCase().includes(q) ||
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.apellido || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.empresa || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (!sortField) return 0
      const aVal = a[sortField as keyof ClienteRecord]
      const bVal = b[sortField as keyof ClienteRecord]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1
      const cmp = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' })
      return sortDirection === 'asc' ? cmp : -cmp
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
          <h1>👤 Gestión de Clientes</h1>
          <div className="clientes-web-header-actions">
            <button className="btn-back" onClick={() => navigate('/clientes-web/dashboard')}>
              ← Volver
            </button>
            <button className="btn-secondary" onClick={() => navigate('/clientes-web/presupuestos')}>
              💰 Presupuestos
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setCrearConAcceso(false)
                resetForm()
                setShowCreateModal(true)
              }}
            >
              + Cliente (sin acceso)
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setCrearConAcceso(true)
                resetForm()
                setShowCreateModal(true)
              }}
            >
              + Cliente con acceso
            </button>
          </div>
        </div>
      </header>

      <div className="clientes-web-gestion-content">
        <div className="clientes-web-filters">
          <div className="clientes-web-filter-acceso">
            <span>Ver:</span>
            <button
              className={filtroAcceso === 'todos' ? 'active' : ''}
              onClick={() => setFiltroAcceso('todos')}
            >
              Todos
            </button>
            <button
              className={filtroAcceso === 'con_acceso' ? 'active' : ''}
              onClick={() => setFiltroAcceso('con_acceso')}
            >
              Con acceso
            </button>
            <button
              className={filtroAcceso === 'sin_acceso' ? 'active' : ''}
              onClick={() => setFiltroAcceso('sin_acceso')}
            >
              Sin acceso
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, email, empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="clientes-web-search-input"
          />
        </div>

        <div className="clientes-web-table-container">
          <table className="clientes-web-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('id')}>
                  ID {sortField === 'id' && <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th>Acceso</th>
                <th className="sortable" onClick={() => handleSort('usuario')}>
                  Usuario {sortField === 'usuario' && <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('nombre')}>
                  Nombre {sortField === 'nombre' && <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                </th>
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
                  <td colSpan={9} className="clientes-web-empty">
                    {searchQuery || filtroAcceso !== 'todos' ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.id}</td>
                    <td>
                      {cliente.es_cliente_web ? (
                        <span className="clientes-web-status-badge activo">Con acceso</span>
                      ) : (
                        <span className="clientes-web-status-badge sin-acceso">Sin acceso</span>
                      )}
                    </td>
                    <td>{cliente.usuario || '-'}</td>
                    <td>{cliente.nombre} {cliente.apellido || ''}</td>
                    <td>{cliente.empresa || '-'}</td>
                    <td>{cliente.email || '-'}</td>
                    <td>{cliente.telefono || '-'}</td>
                    <td>
                      {cliente.es_cliente_web ? (
                        <span className={`clientes-web-status-badge ${cliente.activo ? 'activo' : 'inactivo'}`}>
                          {cliente.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-edit"
                        onClick={() => {
                          setEditingCliente(cliente)
                          setFormData({
                            usuario: cliente.usuario || '',
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
                      {!cliente.es_cliente_web ? (
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => setDarAccesoCliente(cliente)}
                        >
                          Dar acceso
                        </button>
                      ) : (
                        <>
                          <button
                            className={`btn-toggle ${cliente.activo ? 'btn-deactivate' : 'btn-activate'}`}
                            onClick={() => handleToggleActivo(cliente)}
                          >
                            {cliente.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => handleQuitarAcceso(cliente)}
                          >
                            Quitar acceso
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {showCreateModal && (
        <div className="clientes-web-modal-overlay" onClick={() => { setShowCreateModal(false); resetForm() }}>
          <div className="clientes-web-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCliente ? 'Editar Cliente' : crearConAcceso ? 'Nuevo Cliente con Acceso' : 'Nuevo Cliente'}</h2>
            <form className="clientes-web-modal-form" onSubmit={handleCreate}>
              {!editingCliente && (
                <div className="clientes-web-form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={crearConAcceso}
                      onChange={(e) => setCrearConAcceso(e.target.checked)}
                    />
                    {' '}Crear con acceso al portal (usuario y contraseña)
                  </label>
                </div>
              )}
              {crearConAcceso && (
                <div className="clientes-web-form-row">
                  <div className="clientes-web-form-group">
                    <label>Usuario *</label>
                    <input
                      type="text"
                      value={formData.usuario}
                      onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                      disabled={!!editingCliente}
                      required={crearConAcceso && !editingCliente}
                    />
                  </div>
                  <div className="clientes-web-form-group">
                    <label>Contraseña {editingCliente ? '(vacío = no cambiar)' : '*'}</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={crearConAcceso && !editingCliente}
                      minLength={6}
                    />
                  </div>
                </div>
              )}
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
                <button type="button" className="btn-secondary" onClick={() => { setShowCreateModal(false); resetForm() }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingCliente ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal dar acceso */}
      {darAccesoCliente && (
        <div className="clientes-web-modal-overlay" onClick={() => { setDarAccesoCliente(null); setDarAccesoForm({ usuario: '', password: '' }) }}>
          <div className="clientes-web-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Dar acceso a {darAccesoCliente.nombre}</h2>
            <p className="clientes-web-modal-hint">El cliente podrá ingresar al portal con usuario y contraseña.</p>
            <form className="clientes-web-modal-form" onSubmit={handleDarAcceso}>
              <div className="clientes-web-form-group">
                <label>Usuario *</label>
                <input
                  type="text"
                  value={darAccesoForm.usuario}
                  onChange={(e) => setDarAccesoForm({ ...darAccesoForm, usuario: e.target.value })}
                  required
                  placeholder="Ej: juan.perez"
                />
              </div>
              <div className="clientes-web-form-group">
                <label>Contraseña * (mín. 6 caracteres)</label>
                <input
                  type="password"
                  value={darAccesoForm.password}
                  onChange={(e) => setDarAccesoForm({ ...darAccesoForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="clientes-web-modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setDarAccesoCliente(null); setDarAccesoForm({ usuario: '', password: '' }) }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Habilitar acceso
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
