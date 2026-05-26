import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ClienteRecord } from '../types/api'
import './ClientesWebGestionPage.css'

type FiltroAcceso = 'todos' | 'con_acceso' | 'sin_acceso'

const ClientesWebGestionPage = () => {
  const navigate = useNavigate()
  const { canAccessMostradorViews, loading: authLoading } = useAuth()
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
    if (!canAccessMostradorViews) {
      navigate('/')
      return
    }
    loadClientes()
  }, [navigate, canAccessMostradorViews, authLoading])

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

  const stats = useMemo(
    () => ({
      total: clientes.length,
      conAcceso: clientes.filter((c) => c.es_cliente_web).length,
      sinAcceso: clientes.filter((c) => !c.es_cliente_web).length
    }),
    [clientes]
  )

  if (loading) {
    return (
      <div className="cwg-page cwg-loading">
        <div className="cwg-spinner" />
        <p>Cargando clientes…</p>
      </div>
    )
  }

  return (
    <div className="cwg-page">
      <div className="cwg-shell">
        <header className="cwg-header">
          <div className="cwg-header__title">
            <span className="cwg-header__icon" aria-hidden>
              CW
            </span>
            <div>
              <h1>Gestión de clientes</h1>
              <p className="cwg-header__sub">
                {stats.total} en total · {stats.conAcceso} con portal · {stats.sinAcceso} solo ficha
              </p>
            </div>
          </div>
          <div className="cwg-header__actions">
            <button type="button" className="cwg-btn cwg-btn--ghost cwg-btn--xs" onClick={() => navigate('/clientes-web/dashboard')}>
              Volver
            </button>
            <button type="button" className="cwg-btn cwg-btn--ghost cwg-btn--xs" onClick={() => navigate('/clientes-web/presupuestos')}>
              Presupuestos
            </button>
            <button
              type="button"
              className="cwg-btn cwg-btn--ghost cwg-btn--xs"
              onClick={() => {
                setCrearConAcceso(false)
                resetForm()
                setShowCreateModal(true)
              }}
            >
              + Sin acceso
            </button>
            <button
              type="button"
              className="cwg-btn cwg-btn--primary cwg-btn--xs"
              onClick={() => {
                setCrearConAcceso(true)
                resetForm()
                setShowCreateModal(true)
              }}
            >
              + Con acceso
            </button>
          </div>
        </header>

        <div className="cwg-toolbar">
          <div className="cwg-filters">
            <span className="cwg-filters__label">Ver</span>
            <button
              type="button"
              className={`cwg-pill${filtroAcceso === 'todos' ? ' cwg-pill--active' : ''}`}
              onClick={() => setFiltroAcceso('todos')}
            >
              Todos ({stats.total})
            </button>
            <button
              type="button"
              className={`cwg-pill${filtroAcceso === 'con_acceso' ? ' cwg-pill--active' : ''}`}
              onClick={() => setFiltroAcceso('con_acceso')}
            >
              Portal ({stats.conAcceso})
            </button>
            <button
              type="button"
              className={`cwg-pill${filtroAcceso === 'sin_acceso' ? ' cwg-pill--active' : ''}`}
              onClick={() => setFiltroAcceso('sin_acceso')}
            >
              Sin portal ({stats.sinAcceso})
            </button>
          </div>
          <label className="cwg-search">
            <span className="sr-only">Buscar clientes</span>
            <input
              type="search"
              placeholder="Nombre, usuario, email, empresa…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <span className="cwg-meta">
            {filteredClientes.length} mostrado{filteredClientes.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="cwg-table-wrap">
          <table className="cwg-table">
            <thead>
              <tr>
                <th className="cwg-th--sort" onClick={() => handleSort('id')}>
                  ID
                  {sortField === 'id' && (
                    <span className="cwg-sort">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Acceso</th>
                <th className="cwg-th--sort" onClick={() => handleSort('usuario')}>
                  Usuario
                  {sortField === 'usuario' && (
                    <span className="cwg-sort">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="cwg-th--sort" onClick={() => handleSort('nombre')}>
                  Nombre
                  {sortField === 'nombre' && (
                    <span className="cwg-sort">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Empresa</th>
                <th>Email</th>
                <th>Tel.</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="cwg-empty">
                    {searchQuery || filtroAcceso !== 'todos'
                      ? 'No hay clientes con ese criterio'
                      : 'No hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td className="cwg-td--id">{cliente.id}</td>
                    <td>
                      {cliente.es_cliente_web ? (
                        <span className="cwg-badge cwg-badge--portal">Portal</span>
                      ) : (
                        <span className="cwg-badge cwg-badge--none">Ficha</span>
                      )}
                    </td>
                    <td className="cwg-td--muted">{cliente.usuario || '—'}</td>
                    <td className="cwg-td--name">
                      {cliente.nombre}
                      {cliente.apellido ? ` ${cliente.apellido}` : ''}
                    </td>
                    <td className="cwg-td--muted">{cliente.empresa || '—'}</td>
                    <td className="cwg-td--muted">{cliente.email || '—'}</td>
                    <td className="cwg-td--muted">{cliente.telefono || '—'}</td>
                    <td>
                      {cliente.es_cliente_web ? (
                        <span className={`cwg-badge ${cliente.activo ? 'cwg-badge--ok' : 'cwg-badge--off'}`}>
                          {cliente.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      ) : (
                        <span className="cwg-td--muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="cwg-actions">
                        <button
                          type="button"
                          className="cwg-btn cwg-btn--edit cwg-btn--xs"
                          onClick={() => {
                            setEditingCliente(cliente)
                            setCrearConAcceso(!!cliente.es_cliente_web)
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
                            type="button"
                            className="cwg-btn cwg-btn--primary cwg-btn--xs"
                            onClick={() => setDarAccesoCliente(cliente)}
                          >
                            Acceso
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`cwg-btn cwg-btn--xs ${cliente.activo ? 'cwg-btn--warn' : 'cwg-btn--ok'}`}
                              onClick={() => void handleToggleActivo(cliente)}
                            >
                              {cliente.activo ? 'Off' : 'On'}
                            </button>
                            <button
                              type="button"
                              className="cwg-btn cwg-btn--muted cwg-btn--xs"
                              onClick={() => void handleQuitarAcceso(cliente)}
                            >
                              Quitar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="cwg-modal-overlay" onClick={() => { setShowCreateModal(false); resetForm() }}>
          <div className="cwg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>
              {editingCliente
                ? 'Editar cliente'
                : crearConAcceso
                  ? 'Nuevo con acceso al portal'
                  : 'Nuevo cliente (solo ficha)'}
            </h2>
            <form className="cwg-form" onSubmit={handleCreate}>
              {!editingCliente && (
                <div className="cwg-field cwg-field--check">
                  <label>
                    <input
                      type="checkbox"
                      checked={crearConAcceso}
                      onChange={(e) => setCrearConAcceso(e.target.checked)}
                    />
                    Crear con usuario y contraseña para el portal
                  </label>
                </div>
              )}
              {crearConAcceso && (
                <div className="cwg-form-row">
                  <div className="cwg-field">
                    <label>Usuario *</label>
                    <input
                      type="text"
                      value={formData.usuario}
                      onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                      disabled={!!editingCliente}
                      required={crearConAcceso && !editingCliente}
                    />
                  </div>
                  <div className="cwg-field">
                    <label>Contraseña {editingCliente ? '(vacío = sin cambio)' : '*'}</label>
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
              <div className="cwg-form-row">
                <div className="cwg-field">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="cwg-field">
                  <label>Apellido</label>
                  <input
                    type="text"
                    value={formData.apellido}
                    onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  />
                </div>
              </div>
              <div className="cwg-form-row">
                <div className="cwg-field">
                  <label>Empresa</label>
                  <input
                    type="text"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  />
                </div>
                <div className="cwg-field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="cwg-form-row">
                <div className="cwg-field">
                  <label>Teléfono</label>
                  <input
                    type="text"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>
                <div className="cwg-field">
                  <label>DNI / CUIT</label>
                  <input
                    type="text"
                    value={formData.dni_cuit}
                    onChange={(e) => setFormData({ ...formData, dni_cuit: e.target.value })}
                  />
                </div>
              </div>
              <div className="cwg-field">
                <label>Dirección</label>
                <textarea
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="cwg-modal-actions">
                <button
                  type="button"
                  className="cwg-btn cwg-btn--ghost cwg-btn--xs"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="cwg-btn cwg-btn--primary cwg-btn--xs">
                  {editingCliente ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {darAccesoCliente && (
        <div
          className="cwg-modal-overlay"
          onClick={() => {
            setDarAccesoCliente(null)
            setDarAccesoForm({ usuario: '', password: '' })
          }}
        >
          <div className="cwg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>Acceso portal — {darAccesoCliente.nombre}</h2>
            <p className="cwg-modal__hint">Usuario y contraseña para ingresar al portal de clientes.</p>
            <form className="cwg-form" onSubmit={handleDarAcceso}>
              <div className="cwg-field">
                <label>Usuario *</label>
                <input
                  type="text"
                  value={darAccesoForm.usuario}
                  onChange={(e) => setDarAccesoForm({ ...darAccesoForm, usuario: e.target.value })}
                  required
                  placeholder="juan.perez"
                />
              </div>
              <div className="cwg-field">
                <label>Contraseña * (mín. 6)</label>
                <input
                  type="password"
                  value={darAccesoForm.password}
                  onChange={(e) => setDarAccesoForm({ ...darAccesoForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="cwg-modal-actions">
                <button
                  type="button"
                  className="cwg-btn cwg-btn--ghost cwg-btn--xs"
                  onClick={() => {
                    setDarAccesoCliente(null)
                    setDarAccesoForm({ usuario: '', password: '' })
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="cwg-btn cwg-btn--primary cwg-btn--xs">
                  Habilitar
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
