import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioBajaLog, UsuarioRecord, UserRole } from '../types/api'
import { calcularIndicadoresPersonal, fmtRotacion } from '../utils/rrhhPersonalStats'
import { etiquetaTipoDesvinculacion } from '../utils/rrhhBajaCatalog'
import LegajoEmpleadoModal from '../components/LegajoEmpleadoModal'
import VerLegajoModal from '../components/VerLegajoModal'
import DarDeBajaEmpleadoModal from '../components/DarDeBajaEmpleadoModal'
import './RecursosHumanosUsuariosPage.css'

type VistaLegajos = 'activo' | 'baja'

const RecursosHumanosUsuariosPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccessUsuarios =
    !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [bajas, setBajas] = useState<UsuarioBajaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaLegajos, setVistaLegajos] = useState<VistaLegajos>('activo')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLegajoModal, setShowLegajoModal] = useState(false)
  const [showVerLegajoModal, setShowVerLegajoModal] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioRecord | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRol, setFilterRol] = useState<string>('todos')
  const [showDarDeBajaModal, setShowDarDeBajaModal] = useState(false)
  const [usuarioParaBaja, setUsuarioParaBaja] = useState<UsuarioRecord | null>(null)

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    password: '',
    rol: 'mostrador' as UsuarioRecord['rol']
  })

  const roleOptions: { value: UsuarioRecord['rol']; label: string; color: string }[] = [
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
    { value: 'compras', label: 'Compras', color: '#06b6d4' },
    { value: 'asesor-tecnico', label: 'Asesor técnico', color: '#14b8a6' },
    { value: 'presupuestos', label: 'Presupuestos', color: '#a78bfa' }
  ]

  useEffect(() => {
    if (authLoading) return
    if (!canAccessUsuarios) {
      navigate('/rrhh/dashboard')
      return
    }
    loadUsuarios()
  }, [canAccessUsuarios, navigate, authLoading])

  useEffect(() => {
    if (loading || !canAccessUsuarios) return
    const st = location.state as { openEditUserId?: number } | undefined
    const id = st?.openEditUserId
    if (id == null) return
    if (usuarios.length === 0) {
      navigate(location.pathname, { replace: true, state: {} })
      return
    }
    const user = usuarios.find((u) => u.id === id)
    if (user) {
      setSelectedUsuario(user)
      setFormData({ nombre: user.nombre, password: '', rol: user.rol })
      setShowEditModal(true)
    }
    navigate(location.pathname, { replace: true, state: {} })
  }, [loading, usuarios, location.state, location.pathname, navigate, canAccessUsuarios])

  const loadUsuarios = async () => {
    setLoading(true)
    try {
      const [usuariosRes, bajasRes] = await Promise.all([
        apiService.getUsuarios(),
        apiService.getUsuariosBajasLog()
      ])
      if (usuariosRes.success && usuariosRes.data) {
        setUsuarios(usuariosRes.data)
      }
      if (bajasRes.success && bajasRes.data) {
        setBajas(bajasRes.data)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const indicadores = useMemo(
    () => calcularIndicadoresPersonal(usuarios.length, bajas),
    [usuarios.length, bajas]
  )

  const nombreRegistrador = useMemo(() => {
    const m = new Map<number, string>()
    usuarios.forEach((u) => m.set(u.id, u.nombre))
    return (id: number | null) => {
      if (id == null) return '—'
      return m.get(id) ?? `Usuario #${id}`
    }
  }, [usuarios])

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

  const openDarDeBajaModal = (user: UsuarioRecord) => {
    setUsuarioParaBaja(user)
    setShowDarDeBajaModal(true)
  }

  const handleBajaCompletada = async () => {
    setShowDarDeBajaModal(false)
    setUsuarioParaBaja(null)
    setShowLegajoModal(false)
    setShowVerLegajoModal(false)
    setSelectedUsuario(null)
    await loadUsuarios()
  }

  const usuarioDesdeBaja = (b: UsuarioBajaLog): UsuarioRecord => ({
    id: b.id_usuario,
    nombre: b.nombre_snapshot,
    rol: (b.rol_snapshot || 'mostrador') as UserRole
  })

  const fechaBajaLabel = (b: UsuarioBajaLog) => {
    const raw = b.fecha_desvinculacion || b.created_at.slice(0, 10)
    try {
      return format(parseISO(raw), 'd MMM yyyy', { locale: es })
    } catch {
      return raw
    }
  }

  const filteredUsuarios = usuarios.filter((u) => {
    const matchesSearch = u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRol = filterRol === 'todos' || u.rol === filterRol
    return matchesSearch && matchesRol
  })

  const filteredBajas = bajas.filter((b) => {
    const q = searchTerm.toLowerCase()
    const tipo = b.tipo_desvinculacion ? etiquetaTipoDesvinculacion(b.tipo_desvinculacion) : ''
    return (
      b.nombre_snapshot.toLowerCase().includes(q) ||
      b.motivo.toLowerCase().includes(q) ||
      tipo.toLowerCase().includes(q) ||
      (b.observaciones_finales?.toLowerCase().includes(q) ?? false)
    )
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
          <div>
            <p className="rrhh-usuarios-breadcrumb">Recursos Humanos / Usuarios</p>
            <h1>👤 Gestión de usuarios</h1>
          </div>
          <div className="rrhh-header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/rrhh/desvinculaciones')}
            >
              📉 Historial de bajas
            </button>
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
        <section className="rrhh-personal-kpis" aria-label="Indicadores de personal">
          <article className="rrhh-personal-kpi rrhh-personal-kpi--total">
            <span className="rrhh-personal-kpi-value">{indicadores.totalColaboradores}</span>
            <span className="rrhh-personal-kpi-label">Total colaboradores</span>
            <span className="rrhh-personal-kpi-hint">Activos + desvinculados históricos</span>
          </article>
          <article className="rrhh-personal-kpi rrhh-personal-kpi--activo">
            <span className="rrhh-personal-kpi-value">{indicadores.activos}</span>
            <span className="rrhh-personal-kpi-label">Personal activo</span>
            <span className="rrhh-personal-kpi-hint">Legajos vigentes en el sistema</span>
          </article>
          <article className="rrhh-personal-kpi rrhh-personal-kpi--baja">
            <span className="rrhh-personal-kpi-value">{indicadores.desvinculados}</span>
            <span className="rrhh-personal-kpi-label">Personal de baja</span>
            <span className="rrhh-personal-kpi-hint">
              {indicadores.bajasMes} baja{indicadores.bajasMes === 1 ? '' : 's'} este mes
            </span>
          </article>
          <article className="rrhh-personal-kpi rrhh-personal-kpi--rot-mes">
            <span className="rrhh-personal-kpi-value">{fmtRotacion(indicadores.rotacionMensual)}</span>
            <span className="rrhh-personal-kpi-label">Rotación mensual</span>
            <span className="rrhh-personal-kpi-hint">Bajas del mes / plantilla activa</span>
          </article>
          <article className="rrhh-personal-kpi rrhh-personal-kpi--rot-anio">
            <span className="rrhh-personal-kpi-value">{fmtRotacion(indicadores.rotacionAnual)}</span>
            <span className="rrhh-personal-kpi-label">Rotación anual</span>
            <span className="rrhh-personal-kpi-hint">
              {indicadores.bajasAnio} baja{indicadores.bajasAnio === 1 ? '' : 's'} últimos 12 meses
            </span>
          </article>
        </section>

        <div className="rrhh-personal-tabs" role="tablist" aria-label="Clasificación de legajos">
          <button
            type="button"
            role="tab"
            aria-selected={vistaLegajos === 'activo'}
            className={`rrhh-personal-tab${vistaLegajos === 'activo' ? ' rrhh-personal-tab--active' : ''}`}
            onClick={() => setVistaLegajos('activo')}
          >
            Personal activo
            <span className="rrhh-personal-tab-count">{indicadores.activos}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vistaLegajos === 'baja'}
            className={`rrhh-personal-tab${vistaLegajos === 'baja' ? ' rrhh-personal-tab--active' : ''}`}
            onClick={() => setVistaLegajos('baja')}
          >
            Personal de baja
            <span className="rrhh-personal-tab-count">{indicadores.desvinculados}</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="rrhh-filters">
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rrhh-search-input"
          />
          {vistaLegajos === 'activo' ? (
            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="rrhh-filter-select"
            >
              <option value="todos">Todos los roles</option>
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <p className="rrhh-usuarios-meta">
          {vistaLegajos === 'activo'
            ? filteredUsuarios.length === usuarios.length
              ? `${usuarios.length} colaborador${usuarios.length === 1 ? '' : 'es'} activo${usuarios.length === 1 ? '' : 's'}`
              : `Mostrando ${filteredUsuarios.length} de ${usuarios.length} activos`
            : filteredBajas.length === bajas.length
              ? `${bajas.length} baja${bajas.length === 1 ? '' : 's'} registrada${bajas.length === 1 ? '' : 's'}`
              : `Mostrando ${filteredBajas.length} de ${bajas.length} bajas`}
        </p>

        {vistaLegajos === 'activo' ? (
          <div className="rrhh-users-table-container">
            <table className="rrhh-users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Rol</th>
                  <th>Última Actividad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="rrhh-users-empty">
                      {usuarios.length === 0
                        ? 'No hay personal activo cargado.'
                        : 'Ningún colaborador coincide con la búsqueda o el filtro.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map((user) => (
                    <tr key={user.id} className="rrhh-users-row--activo">
                      <td>{user.id}</td>
                      <td>{user.nombre}</td>
                      <td>
                        <span className="rrhh-estado-badge rrhh-estado-badge--activo">Activo</span>
                      </td>
                      <td>
                        <span
                          className="rrhh-role-badge"
                          style={{
                            backgroundColor: `${roleOptions.find((r) => r.value === user.rol)?.color}20`,
                            color: roleOptions.find((r) => r.value === user.rol)?.color
                          }}
                        >
                          {roleOptions.find((r) => r.value === user.rol)?.label || user.rol}
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
                          <button className="btn-dar-baja" onClick={() => openDarDeBajaModal(user)}>
                            Dar de Baja
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rrhh-users-table-container">
            <table className="rrhh-users-table">
              <thead>
                <tr>
                  <th>ID legajo</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Desvinculación</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>Docs</th>
                  <th>Registrado por</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredBajas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="rrhh-users-empty">
                      {bajas.length === 0
                        ? 'No hay bajas registradas en el historial.'
                        : 'Ninguna baja coincide con la búsqueda.'}
                    </td>
                  </tr>
                ) : (
                  filteredBajas.map((b) => (
                    <tr key={b.id} className="rrhh-users-row--baja">
                      <td>{b.id_usuario}</td>
                      <td>{b.nombre_snapshot}</td>
                      <td>
                        <span className="rrhh-estado-badge rrhh-estado-badge--baja">De baja</span>
                      </td>
                      <td>{fechaBajaLabel(b)}</td>
                      <td>
                        {b.tipo_desvinculacion
                          ? etiquetaTipoDesvinculacion(b.tipo_desvinculacion)
                          : '—'}
                      </td>
                      <td className="rrhh-baja-motivo">{b.motivo}</td>
                      <td>{b.adjuntos.length > 0 ? b.adjuntos.length : '—'}</td>
                      <td>{nombreRegistrador(b.registrado_por)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-ver-legajo"
                          onClick={() => {
                            setSelectedUsuario(usuarioDesdeBaja(b))
                            setShowVerLegajoModal(true)
                          }}
                          title="Ver legajo histórico"
                        >
                          👁️ Ver Legajo
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDarDeBajaModal && usuarioParaBaja && usuario?.id ? (
        <DarDeBajaEmpleadoModal
          usuario={usuarioParaBaja}
          isOpen={showDarDeBajaModal}
          registradoPorId={usuario.id}
          onClose={() => {
            setShowDarDeBajaModal(false)
            setUsuarioParaBaja(null)
          }}
          onSuccess={() => void handleBajaCompletada()}
        />
      ) : null}

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false)
          }}
        >
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
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false)
          }}
        >
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
          onDarDeBaja={
            vistaLegajos === 'activo' && usuarios.some((u) => u.id === selectedUsuario.id)
              ? () => openDarDeBajaModal(selectedUsuario)
              : undefined
          }
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
          onDarDeBaja={() => openDarDeBajaModal(selectedUsuario)}
        />
      )}
    </div>
  )
}

export default RecursosHumanosUsuariosPage

