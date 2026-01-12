import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord, HorarioEmpleado, Turno, Ausencia, Asistencia } from '../types/api'
import './RecursosHumanosHorariosPage.css'

type TabType = 'horarios' | 'turnos' | 'ausencias' | 'asistencia' | 'reportes'

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const RecursosHumanosHorariosPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('horarios')
  
  // Datos
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [horarios, setHorarios] = useState<HorarioEmpleado[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [ausencias, setAusencias] = useState<Ausencia[]>([])
  const [asistencia, setAsistencia] = useState<Asistencia[]>([])
  
  // Filtros
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<number | null>(null)
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const date = new Date()
    date.setDate(1) // Primer día del mes
    return date.toISOString().split('T')[0]
  })
  const [fechaHasta, setFechaHasta] = useState<string>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    date.setDate(0) // Último día del mes
    return date.toISOString().split('T')[0]
  })
  

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadInitialData()
  }, [canManageRecursosHumanos, navigate, authLoading])

  useEffect(() => {
    if (activeTab === 'horarios') {
      loadHorarios()
    } else if (activeTab === 'turnos') {
      loadTurnos()
    } else if (activeTab === 'ausencias') {
      loadAusencias()
    } else if (activeTab === 'asistencia') {
      loadAsistencia()
    }
  }, [activeTab, usuarioSeleccionado, fechaDesde, fechaHasta])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadHorarios = async () => {
    if (!usuarioSeleccionado) return
    try {
      const response = await apiService.obtenerHorariosUsuario(usuarioSeleccionado)
      if (response.success && response.data) {
        setHorarios(response.data)
      }
    } catch (error) {
      console.error('Error cargando horarios:', error)
    }
  }

  const loadTurnos = async () => {
    try {
      const response = await apiService.obtenerTurnos(usuarioSeleccionado, fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setTurnos(response.data)
      }
    } catch (error) {
      console.error('Error cargando turnos:', error)
    }
  }

  const loadAusencias = async () => {
    try {
      const response = await apiService.obtenerAusencias(usuarioSeleccionado, fechaDesde, fechaHasta, null)
      if (response.success && response.data) {
        setAusencias(response.data)
      }
    } catch (error) {
      console.error('Error cargando ausencias:', error)
    }
  }

  const loadAsistencia = async () => {
    try {
      const response = await apiService.obtenerAsistencia(usuarioSeleccionado, fechaDesde, fechaHasta)
      if (response.success && response.data) {
        setAsistencia(response.data)
      }
    } catch (error) {
      console.error('Error cargando asistencia:', error)
    }
  }

  const handleMarcarEntrada = async () => {
    if (!usuario) return
    try {
      const response = await apiService.registrarEntrada(usuario.id)
      if (response.success) {
        alert('Entrada registrada correctamente')
        loadAsistencia()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar entrada')
      console.error(error)
    }
  }

  const handleMarcarSalida = async () => {
    if (!usuario) return
    try {
      const response = await apiService.registrarSalida(usuario.id)
      if (response.success) {
        alert('Salida registrada correctamente')
        loadAsistencia()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar salida')
      console.error(error)
    }
  }

  if (loading) {
    return (
      <div className="rrhh-horarios-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-horarios-page">
      <header className="rrhh-horarios-header">
        <div className="rrhh-header-content">
          <h1>🕐 Gestión de Horarios y Turnos</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-horarios-content">
        {/* Tabs */}
        <div className="rrhh-tabs">
          <button
            className={`rrhh-tab ${activeTab === 'horarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('horarios')}
          >
            📅 Horarios
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'turnos' ? 'active' : ''}`}
            onClick={() => setActiveTab('turnos')}
          >
            🗓️ Turnos
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'ausencias' ? 'active' : ''}`}
            onClick={() => setActiveTab('ausencias')}
          >
            🏖️ Ausencias
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'asistencia' ? 'active' : ''}`}
            onClick={() => setActiveTab('asistencia')}
          >
            ✅ Asistencia
          </button>
          <button
            className={`rrhh-tab ${activeTab === 'reportes' ? 'active' : ''}`}
            onClick={() => setActiveTab('reportes')}
          >
            📊 Reportes
          </button>
        </div>

        {/* Filtros */}
        <div className="rrhh-filters-section">
          <select
            value={usuarioSeleccionado || ''}
            onChange={(e) => setUsuarioSeleccionado(e.target.value ? parseInt(e.target.value) : null)}
            className="rrhh-filter-select"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
          {(activeTab === 'turnos' || activeTab === 'ausencias' || activeTab === 'asistencia' || activeTab === 'reportes') && (
            <>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="rrhh-date-input"
              />
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="rrhh-date-input"
              />
            </>
          )}
        </div>

        {/* Contenido de tabs */}
        {activeTab === 'horarios' && (
          <HorariosTab
            usuarios={usuarios}
            usuarioSeleccionado={usuarioSeleccionado}
            horarios={horarios}
            onLoad={loadHorarios}
          />
        )}

        {activeTab === 'turnos' && (
          <TurnosTab
            usuarios={usuarios}
            turnos={turnos}
            onLoad={loadTurnos}
          />
        )}

        {activeTab === 'ausencias' && (
          <AusenciasTab
            usuarios={usuarios}
            ausencias={ausencias}
            usuario={usuario}
            onLoad={loadAusencias}
          />
        )}

        {activeTab === 'asistencia' && (
          <AsistenciaTab
            asistencia={asistencia}
            usuario={usuario}
            onMarcarEntrada={handleMarcarEntrada}
            onMarcarSalida={handleMarcarSalida}
          />
        )}

        {activeTab === 'reportes' && (
          <ReportesTab
            asistencia={asistencia}
            ausencias={ausencias}
            turnos={turnos}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
          />
        )}
      </div>
    </div>
  )
}

// Componente de Horarios
const HorariosTab = ({ usuarios, usuarioSeleccionado, horarios, onLoad }: {
  usuarios: UsuarioRecord[]
  usuarioSeleccionado: number | null
  horarios: HorarioEmpleado[]
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    id_usuario: usuarioSeleccionado || 0,
    tipo_horario: 'fijo' as 'fijo' | 'flexible' | 'turnos',
    dia_semana: null as number | null,
    hora_entrada: '',
    hora_salida: '',
    horas_semanales: null as number | null,
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.id_usuario) {
      alert('Selecciona un usuario')
      return
    }

    try {
      const response = await apiService.crearHorario(
        formData.id_usuario,
        formData.tipo_horario,
        formData.dia_semana,
        formData.hora_entrada || null,
        formData.hora_salida || null,
        formData.horas_semanales,
        formData.fecha_inicio || null,
        formData.fecha_fin || null,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Horario creado correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al crear horario')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este horario?')) return
    try {
      const response = await apiService.eliminarHorario(id)
      if (response.success) {
        alert('Horario eliminado')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar horario')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Horarios de Empleados</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Crear Horario
        </button>
      </div>

      {!usuarioSeleccionado && (
        <div className="rrhh-info-box">
          <p>Selecciona un usuario para ver sus horarios</p>
        </div>
      )}

      {usuarioSeleccionado && (
        <div className="rrhh-horarios-list">
          {horarios.length === 0 ? (
            <p>No hay horarios registrados</p>
          ) : (
            horarios.map(h => (
              <div key={h.id} className="rrhh-horario-card">
                <div className="rrhh-horario-info">
                  <h3>{h.tipo_horario === 'fijo' ? 'Horario Fijo' : h.tipo_horario === 'flexible' ? 'Horario Flexible' : 'Turnos'}</h3>
                  {h.dia_semana !== null && <p>Día: {DIAS_SEMANA[h.dia_semana]}</p>}
                  {h.hora_entrada && h.hora_salida && (
                    <p>Horario: {h.hora_entrada} - {h.hora_salida}</p>
                  )}
                  {h.horas_semanales && <p>Horas semanales: {h.horas_semanales}</p>}
                  {h.fecha_inicio && <p>Desde: {new Date(h.fecha_inicio).toLocaleDateString()}</p>}
                  {h.fecha_fin && <p>Hasta: {new Date(h.fecha_fin).toLocaleDateString()}</p>}
                  {h.observaciones && <p>Obs: {h.observaciones}</p>}
                  <span className={`rrhh-badge ${h.activo ? 'active' : 'inactive'}`}>
                    {h.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <button className="btn-danger" onClick={() => handleDelete(h.id)}>
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Horario</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Horario</label>
                <select
                  value={formData.tipo_horario}
                  onChange={(e) => setFormData({ ...formData, tipo_horario: e.target.value as any })}
                  required
                >
                  <option value="fijo">Fijo</option>
                  <option value="flexible">Flexible</option>
                  <option value="turnos">Turnos</option>
                </select>
              </div>
              {formData.tipo_horario === 'fijo' && (
                <>
                  <div className="form-group">
                    <label>Día de la Semana</label>
                    <select
                      value={formData.dia_semana || ''}
                      onChange={(e) => setFormData({ ...formData, dia_semana: e.target.value ? parseInt(e.target.value) : null })}
                    >
                      <option value="">Selecciona un día</option>
                      {DIAS_SEMANA.map((dia, idx) => (
                        <option key={idx} value={idx}>{dia}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Hora de Entrada</label>
                    <input
                      type="time"
                      value={formData.hora_entrada}
                      onChange={(e) => setFormData({ ...formData, hora_entrada: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Hora de Salida</label>
                    <input
                      type="time"
                      value={formData.hora_salida}
                      onChange={(e) => setFormData({ ...formData, hora_salida: e.target.value })}
                    />
                  </div>
                </>
              )}
              {formData.tipo_horario === 'flexible' && (
                <div className="form-group">
                  <label>Horas Semanales</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.horas_semanales || ''}
                    onChange={(e) => setFormData({ ...formData, horas_semanales: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Fecha Fin (opcional)</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Turnos
const TurnosTab = ({ usuarios, turnos, onLoad }: {
  usuarios: UsuarioRecord[]
  turnos: Turno[]
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    id_usuario: 0,
    fecha: '',
    hora_entrada: '',
    hora_salida: '',
    tipo_turno: 'normal' as 'normal' | 'extra' | 'nocturno',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiService.crearTurno(
        formData.id_usuario,
        formData.fecha,
        formData.hora_entrada,
        formData.hora_salida,
        formData.tipo_turno,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Turno creado correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al crear turno')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este turno?')) return
    try {
      const response = await apiService.eliminarTurno(id)
      if (response.success) {
        alert('Turno eliminado')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar turno')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Calendario de Turnos</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Crear Turno
        </button>
      </div>

      <div className="rrhh-turnos-list">
        {turnos.length === 0 ? (
          <p>No hay turnos registrados</p>
        ) : (
          turnos.map(t => (
            <div key={t.id} className="rrhh-turno-card">
              <div className="rrhh-turno-info">
                <h3>{t.nombre_usuario || 'Usuario'}</h3>
                <p>Fecha: {new Date(t.fecha).toLocaleDateString()}</p>
                <p>Horario: {t.hora_entrada} - {t.hora_salida}</p>
                <p>Tipo: {t.tipo_turno}</p>
                {t.observaciones && <p>Obs: {t.observaciones}</p>}
              </div>
              <button className="btn-danger" onClick={() => handleDelete(t.id)}>
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Turno</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hora de Entrada</label>
                <input
                  type="time"
                  value={formData.hora_entrada}
                  onChange={(e) => setFormData({ ...formData, hora_entrada: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hora de Salida</label>
                <input
                  type="time"
                  value={formData.hora_salida}
                  onChange={(e) => setFormData({ ...formData, hora_salida: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Tipo de Turno</label>
                <select
                  value={formData.tipo_turno}
                  onChange={(e) => setFormData({ ...formData, tipo_turno: e.target.value as any })}
                >
                  <option value="normal">Normal</option>
                  <option value="extra">Extra</option>
                  <option value="nocturno">Nocturno</option>
                </select>
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Ausencias
const AusenciasTab = ({ usuarios, ausencias, usuario, onLoad }: {
  usuarios: UsuarioRecord[]
  ausencias: Ausencia[]
  usuario: any
  onLoad: () => void
}) => {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    id_usuario: 0,
    tipo_ausencia: 'vacaciones' as 'vacaciones' | 'licencia' | 'inasistencia' | 'permiso' | 'enfermedad',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
    observaciones: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiService.crearAusencia(
        formData.id_usuario,
        formData.tipo_ausencia,
        formData.fecha_inicio,
        formData.fecha_fin,
        formData.motivo || null,
        formData.observaciones || null
      )

      if (response.success) {
        alert('Ausencia registrada correctamente')
        setShowModal(false)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al registrar ausencia')
      console.error(error)
    }
  }

  const handleAprobarRechazar = async (id: number, estado: 'aprobado' | 'rechazado') => {
    if (!usuario) return
    try {
      const response = await apiService.aprobarRechazarAusencia(id, estado, usuario.id)
      if (response.success) {
        alert(`Ausencia ${estado}`)
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al procesar ausencia')
      console.error(error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta ausencia?')) return
    try {
      const response = await apiService.eliminarAusencia(id)
      if (response.success) {
        alert('Ausencia eliminada')
        onLoad()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al eliminar ausencia')
      console.error(error)
    }
  }

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Gestión de Ausencias</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Registrar Ausencia
        </button>
      </div>

      <div className="rrhh-ausencias-list">
        {ausencias.length === 0 ? (
          <p>No hay ausencias registradas</p>
        ) : (
          ausencias.map(a => (
            <div key={a.id} className="rrhh-ausencia-card">
              <div className="rrhh-ausencia-info">
                <h3>{a.nombre_usuario || 'Usuario'}</h3>
                <p>Tipo: {a.tipo_ausencia}</p>
                <p>Período: {new Date(a.fecha_inicio).toLocaleDateString()} - {new Date(a.fecha_fin).toLocaleDateString()}</p>
                <p>Días: {a.dias}</p>
                {a.motivo && <p>Motivo: {a.motivo}</p>}
                <span className={`rrhh-badge ${a.estado}`}>
                  {a.estado}
                </span>
                {a.aprobado_por_nombre && <p>Aprobado por: {a.aprobado_por_nombre}</p>}
              </div>
              <div className="rrhh-ausencia-actions">
                {a.estado === 'pendiente' && usuario && (
                  <>
                    <button className="btn-success" onClick={() => handleAprobarRechazar(a.id, 'aprobado')}>
                      Aprobar
                    </button>
                    <button className="btn-danger" onClick={() => handleAprobarRechazar(a.id, 'rechazado')}>
                      Rechazar
                    </button>
                  </>
                )}
                <button className="btn-danger" onClick={() => handleDelete(a.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar Ausencia</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Usuario</label>
                <select
                  value={formData.id_usuario}
                  onChange={(e) => setFormData({ ...formData, id_usuario: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Selecciona un usuario</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Ausencia</label>
                <select
                  value={formData.tipo_ausencia}
                  onChange={(e) => setFormData({ ...formData, tipo_ausencia: e.target.value as any })}
                  required
                >
                  <option value="vacaciones">Vacaciones</option>
                  <option value="licencia">Licencia</option>
                  <option value="inasistencia">Inasistencia</option>
                  <option value="permiso">Permiso</option>
                  <option value="enfermedad">Enfermedad</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Fecha Fin</label>
                <input
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Motivo</label>
                <textarea
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de Asistencia
const AsistenciaTab = ({ asistencia, usuario, onMarcarEntrada, onMarcarSalida }: {
  asistencia: Asistencia[]
  usuario: any
  onMarcarEntrada: () => void
  onMarcarSalida: () => void
}) => {
  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Control de Asistencia</h2>
        {usuario && (
          <div className="rrhh-asistencia-actions">
            <button className="btn-success" onClick={onMarcarEntrada}>
              🕐 Marcar Entrada
            </button>
            <button className="btn-warning" onClick={onMarcarSalida}>
              🕐 Marcar Salida
            </button>
          </div>
        )}
      </div>

      <div className="rrhh-asistencia-list">
        {asistencia.length === 0 ? (
          <p>No hay registros de asistencia</p>
        ) : (
          asistencia.map(a => (
            <div key={a.id} className="rrhh-asistencia-card">
              <div className="rrhh-asistencia-info">
                <h3>{a.nombre_usuario || 'Usuario'}</h3>
                <p>Fecha: {new Date(a.fecha).toLocaleDateString()}</p>
                {a.hora_entrada && <p>Entrada: {new Date(a.hora_entrada).toLocaleTimeString()}</p>}
                {a.hora_salida && <p>Salida: {new Date(a.hora_salida).toLocaleTimeString()}</p>}
                {a.horas_trabajadas && <p>Horas trabajadas: {a.horas_trabajadas.toFixed(2)}</p>}
                <span className={`rrhh-badge ${a.tipo_registro}`}>
                  {a.tipo_registro}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Componente de Reportes
const ReportesTab = ({ asistencia, ausencias, turnos, fechaDesde, fechaHasta }: {
  asistencia: Asistencia[]
  ausencias: Ausencia[]
  turnos: Turno[]
  fechaDesde: string
  fechaHasta: string
}) => {
  const totalHorasTrabajadas = asistencia.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0)
  const totalAusencias = ausencias.filter(a => a.estado === 'aprobado').reduce((sum, a) => sum + a.dias, 0)
  const totalTurnos = turnos.length

  return (
    <div className="rrhh-tab-content">
      <div className="rrhh-section-header">
        <h2>Reportes de Horarios</h2>
      </div>

      <div className="rrhh-reportes-grid">
        <div className="rrhh-reporte-card">
          <h3>Total Horas Trabajadas</h3>
          <p className="rrhh-reporte-value">{totalHorasTrabajadas.toFixed(2)}</p>
          <p className="rrhh-reporte-periodo">
            {new Date(fechaDesde).toLocaleDateString()} - {new Date(fechaHasta).toLocaleDateString()}
          </p>
        </div>
        <div className="rrhh-reporte-card">
          <h3>Total Ausencias</h3>
          <p className="rrhh-reporte-value">{totalAusencias}</p>
          <p className="rrhh-reporte-periodo">Días aprobados</p>
        </div>
        <div className="rrhh-reporte-card">
          <h3>Total Turnos</h3>
          <p className="rrhh-reporte-value">{totalTurnos}</p>
          <p className="rrhh-reporte-periodo">En el período</p>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosHorariosPage
