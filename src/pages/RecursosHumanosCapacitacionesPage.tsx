import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Capacitacion, InscripcionCapacitacion } from '../types/api'
import './RecursosHumanosCapacitacionesPage.css'

const RecursosHumanosCapacitacionesPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([])
  const [inscripciones, setInscripciones] = useState<InscripcionCapacitacion[]>([])
  const [capacitacionSeleccionada, setCapacitacionSeleccionada] = useState<Capacitacion | null>(null)
  const [filtros, setFiltros] = useState({
    estado: null as string | null,
    tipo: null as string | null,
    categoria: null as string | null,
    fechaDesde: null as string | null,
    fechaHasta: null as string | null
  })
  const [showModal, setShowModal] = useState(false)
  const [showInscripcionesModal, setShowInscripcionesModal] = useState(false)
  const [showAprobarModal, setShowAprobarModal] = useState(false)
  const [inscripcionSeleccionada, setInscripcionSeleccionada] = useState<InscripcionCapacitacion | null>(null)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo_capacitacion: 'presencial' as 'presencial' | 'virtual' | 'mixta' | 'online',
    categoria: '',
    duracion_horas: null as number | null,
    fecha_inicio: '',
    fecha_fin: '',
    fecha_limite_inscripcion: '',
    cupo_maximo: null as number | null,
    lugar: '',
    link_virtual: '',
    instructor: '',
    es_obligatoria: false,
    requiere_aprobacion: true,
    material_adjunto_url: '',
    observaciones: ''
  })

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadData()
  }, [canManageRecursosHumanos, navigate, authLoading, filtros])

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerCapacitaciones(
        filtros.estado,
        filtros.tipo,
        filtros.categoria,
        filtros.fechaDesde,
        filtros.fechaHasta,
        null
      )

      if (response.success && response.data) {
        setCapacitaciones(response.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInscripciones = async (idCapacitacion: number) => {
    const response = await apiService.obtenerInscripcionesCapacitacion(idCapacitacion, null)
    if (response.success && response.data) {
      setInscripciones(response.data)
    }
  }

  const handleNuevaCapacitacion = () => {
    setCapacitacionSeleccionada(null)
    setFormData({
      titulo: '',
      descripcion: '',
      tipo_capacitacion: 'presencial',
      categoria: '',
      duracion_horas: null,
      fecha_inicio: '',
      fecha_fin: '',
      fecha_limite_inscripcion: '',
      cupo_maximo: null,
      lugar: '',
      link_virtual: '',
      instructor: '',
      es_obligatoria: false,
      requiere_aprobacion: true,
      material_adjunto_url: '',
      observaciones: ''
    })
    setShowModal(true)
  }

  const handleEditarCapacitacion = (capacitacion: Capacitacion) => {
    setCapacitacionSeleccionada(capacitacion)
    setFormData({
      titulo: capacitacion.titulo,
      descripcion: capacitacion.descripcion || '',
      tipo_capacitacion: capacitacion.tipo_capacitacion,
      categoria: capacitacion.categoria || '',
      duracion_horas: capacitacion.duracion_horas,
      fecha_inicio: capacitacion.fecha_inicio || '',
      fecha_fin: capacitacion.fecha_fin || '',
      fecha_limite_inscripcion: capacitacion.fecha_limite_inscripcion || '',
      cupo_maximo: capacitacion.cupo_maximo,
      lugar: capacitacion.lugar || '',
      link_virtual: capacitacion.link_virtual || '',
      instructor: capacitacion.instructor || '',
      es_obligatoria: capacitacion.es_obligatoria,
      requiere_aprobacion: capacitacion.requiere_aprobacion,
      material_adjunto_url: capacitacion.material_adjunto_url || '',
      observaciones: capacitacion.observaciones || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id) return

    try {
      let response
      if (capacitacionSeleccionada) {
        response = await apiService.actualizarCapacitacion(
          capacitacionSeleccionada.id,
          formData.titulo,
          formData.descripcion || null,
          formData.tipo_capacitacion,
          formData.categoria || null,
          formData.duracion_horas,
          formData.fecha_inicio || null,
          formData.fecha_fin || null,
          formData.fecha_limite_inscripcion || null,
          formData.cupo_maximo,
          formData.lugar || null,
          formData.link_virtual || null,
          formData.instructor || null,
          null,
          formData.es_obligatoria,
          formData.requiere_aprobacion,
          formData.material_adjunto_url || null,
          formData.observaciones || null
        )
      } else {
        response = await apiService.crearCapacitacion(
          formData.titulo,
          formData.descripcion || null,
          usuario.id,
          formData.tipo_capacitacion,
          formData.categoria || null,
          formData.duracion_horas,
          formData.fecha_inicio || null,
          formData.fecha_fin || null,
          formData.fecha_limite_inscripcion || null,
          formData.cupo_maximo,
          formData.lugar || null,
          formData.link_virtual || null,
          formData.instructor || null,
          formData.es_obligatoria,
          formData.requiere_aprobacion,
          formData.material_adjunto_url || null,
          formData.observaciones || null
        )
      }

      if (response.success) {
        alert(capacitacionSeleccionada ? 'Capacitación actualizada' : 'Capacitación creada')
        setShowModal(false)
        loadData()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al guardar capacitación')
      console.error(error)
    }
  }

  const handleVerInscripciones = async (capacitacion: Capacitacion) => {
    setCapacitacionSeleccionada(capacitacion)
    await loadInscripciones(capacitacion.id)
    setShowInscripcionesModal(true)
  }

  const handleAprobarRechazar = async (inscripcion: InscripcionCapacitacion, aprobar: boolean) => {
    if (!usuario?.id) return

    if (!aprobar && !motivoRechazo.trim()) {
      alert('Debes ingresar un motivo de rechazo')
      return
    }

    const response = await apiService.aprobarRechazarInscripcion(
      inscripcion.id,
      aprobar ? 'aprobado' : 'rechazado',
      usuario.id,
      aprobar ? null : motivoRechazo
    )

    if (response.success) {
      alert(aprobar ? 'Inscripción aprobada' : 'Inscripción rechazada')
      setShowAprobarModal(false)
      setMotivoRechazo('')
      if (capacitacionSeleccionada) {
        await loadInscripciones(capacitacionSeleccionada.id)
      }
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta capacitación?')) return

    const response = await apiService.eliminarCapacitacion(id)
    if (response.success) {
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      planificada: { class: 'badge-planificada', text: 'Planificada' },
      abierta: { class: 'badge-abierta', text: 'Abierta' },
      en_curso: { class: 'badge-en-curso', text: 'En Curso' },
      completada: { class: 'badge-completada', text: 'Completada' },
      cancelada: { class: 'badge-cancelada', text: 'Cancelada' }
    }
    return badges[estado] || { class: '', text: estado }
  }

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      presencial: '🏢',
      virtual: '💻',
      mixta: '🔄',
      online: '🌐'
    }
    return icons[tipo] || '📚'
  }

  if (loading) {
    return (
      <div className="rrhh-capacitaciones-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-capacitaciones-page">
      <header className="rrhh-capacitaciones-header">
        <div className="rrhh-header-content">
          <h1>📚 Gestión de Capacitaciones</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-capacitaciones-content">
        {/* Filtros */}
        <div className="rrhh-filters-section">
          <select
            className="rrhh-filter-select"
            value={filtros.estado || ''}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value || null })}
          >
            <option value="">Todos los estados</option>
            <option value="planificada">Planificada</option>
            <option value="abierta">Abierta</option>
            <option value="en_curso">En Curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>

          <select
            className="rrhh-filter-select"
            value={filtros.tipo || ''}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value || null })}
          >
            <option value="">Todos los tipos</option>
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
            <option value="mixta">Mixta</option>
            <option value="online">Online</option>
          </select>

          <select
            className="rrhh-filter-select"
            value={filtros.categoria || ''}
            onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value || null })}
          >
            <option value="">Todas las categorías</option>
            <option value="tecnica">Técnica</option>
            <option value="seguridad">Seguridad</option>
            <option value="soft_skills">Soft Skills</option>
            <option value="compliance">Compliance</option>
            <option value="otra">Otra</option>
          </select>

          <input
            type="date"
            className="rrhh-date-input"
            value={filtros.fechaDesde || ''}
            onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value || null })}
            placeholder="Fecha desde"
          />

          <input
            type="date"
            className="rrhh-date-input"
            value={filtros.fechaHasta || ''}
            onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value || null })}
            placeholder="Fecha hasta"
          />

          <button className="btn-primary" onClick={handleNuevaCapacitacion}>
            + Nueva Capacitación
          </button>
        </div>

        {/* Lista de capacitaciones */}
        <div className="rrhh-capacitaciones-list">
          {capacitaciones.length === 0 ? (
            <div className="rrhh-info-box">
              <p>No hay capacitaciones que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            capacitaciones.map(capacitacion => {
              const estadoBadge = getEstadoBadge(capacitacion.estado)
              return (
                <div key={capacitacion.id} className="rrhh-capacitacion-card">
                  <div className="rrhh-capacitacion-info">
                    <div className="rrhh-capacitacion-header">
                      <span className="rrhh-capacitacion-icon">{getTipoIcon(capacitacion.tipo_capacitacion)}</span>
                      <h3>{capacitacion.titulo}</h3>
                      <span className={`rrhh-badge ${estadoBadge.class}`}>
                        {estadoBadge.text}
                      </span>
                    </div>
                    {capacitacion.descripcion && (
                      <p className="rrhh-capacitacion-descripcion">{capacitacion.descripcion}</p>
                    )}
                    <div className="rrhh-capacitacion-details">
                      <p><strong>Tipo:</strong> {capacitacion.tipo_capacitacion}</p>
                      {capacitacion.categoria && <p><strong>Categoría:</strong> {capacitacion.categoria}</p>}
                      {capacitacion.duracion_horas && <p><strong>Duración:</strong> {capacitacion.duracion_horas} horas</p>}
                      {capacitacion.fecha_inicio && (
                        <p><strong>Fecha inicio:</strong> {new Date(capacitacion.fecha_inicio).toLocaleDateString()}</p>
                      )}
                      {capacitacion.instructor && <p><strong>Instructor:</strong> {capacitacion.instructor}</p>}
                      {capacitacion.lugar && <p><strong>Lugar:</strong> {capacitacion.lugar}</p>}
                      {capacitacion.cupo_maximo && (
                        <p><strong>Cupos:</strong> {capacitacion.inscripciones_count || 0} / {capacitacion.cupo_maximo}</p>
                      )}
                      {capacitacion.es_obligatoria && <p className="rrhh-obligatoria">⚠️ Obligatoria</p>}
                    </div>
                  </div>
                  <div className="rrhh-capacitacion-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleEditarCapacitacion(capacitacion)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleVerInscripciones(capacitacion)}
                    >
                      👥 Inscripciones ({capacitacion.inscripciones_count || 0})
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleEliminar(capacitacion.id)}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal de capacitación */}
      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal rrhh-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>{capacitacionSeleccionada ? 'Editar Capacitación' : 'Nueva Capacitación'}</h2>
              <button className="rrhh-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="rrhh-capacitacion-form">
              <div className="form-row">
                <div className="form-group form-group-full">
                  <label>Título *</label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo *</label>
                  <select
                    value={formData.tipo_capacitacion}
                    onChange={(e) => setFormData({ ...formData, tipo_capacitacion: e.target.value as any })}
                    required
                  >
                    <option value="presencial">🏢 Presencial</option>
                    <option value="virtual">💻 Virtual</option>
                    <option value="mixta">🔄 Mixta</option>
                    <option value="online">🌐 Online</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  >
                    <option value="">Selecciona...</option>
                    <option value="tecnica">Técnica</option>
                    <option value="seguridad">Seguridad</option>
                    <option value="soft_skills">Soft Skills</option>
                    <option value="compliance">Compliance</option>
                    <option value="otra">Otra</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Duración (horas)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.duracion_horas || ''}
                    onChange={(e) => setFormData({ ...formData, duracion_horas: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>

                <div className="form-group">
                  <label>Instructor</label>
                  <input
                    type="text"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Inicio</label>
                  <input
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha Fin</label>
                  <input
                    type="date"
                    value={formData.fecha_fin}
                    onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Límite Inscripción</label>
                  <input
                    type="date"
                    value={formData.fecha_limite_inscripcion}
                    onChange={(e) => setFormData({ ...formData, fecha_limite_inscripcion: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Cupo Máximo</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.cupo_maximo || ''}
                    onChange={(e) => setFormData({ ...formData, cupo_maximo: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Lugar</label>
                  <input
                    type="text"
                    value={formData.lugar}
                    onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                    placeholder="Para capacitaciones presenciales"
                  />
                </div>

                <div className="form-group">
                  <label>Link Virtual</label>
                  <input
                    type="url"
                    value={formData.link_virtual}
                    onChange={(e) => setFormData({ ...formData, link_virtual: e.target.value })}
                    placeholder="Para capacitaciones virtuales"
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.es_obligatoria}
                      onChange={(e) => setFormData({ ...formData, es_obligatoria: e.target.checked })}
                      className="checkbox-input"
                    />
                    <span>Es Obligatoria</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiere_aprobacion}
                      onChange={(e) => setFormData({ ...formData, requiere_aprobacion: e.target.checked })}
                      className="checkbox-input"
                    />
                    <span>Requiere Aprobación</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {capacitacionSeleccionada ? 'Actualizar' : 'Crear'} Capacitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de inscripciones */}
      {showInscripcionesModal && capacitacionSeleccionada && (
        <div className="rrhh-modal-overlay" onClick={() => setShowInscripcionesModal(false)}>
          <div className="rrhh-modal rrhh-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Inscripciones: {capacitacionSeleccionada.titulo}</h2>
              <button className="rrhh-modal-close" onClick={() => setShowInscripcionesModal(false)}>✕</button>
            </div>

            <div className="rrhh-inscripciones-list">
              {inscripciones.length === 0 ? (
                <p>No hay inscripciones</p>
              ) : (
                inscripciones.map(inscripcion => (
                  <div key={inscripcion.id} className="rrhh-inscripcion-item">
                    <div className="rrhh-inscripcion-info">
                      <strong>{inscripcion.nombre_usuario || 'Usuario'}</strong>
                      <p>Estado: {inscripcion.estado}</p>
                      <p>Fecha inscripción: {new Date(inscripcion.fecha_inscripcion).toLocaleDateString()}</p>
                      {inscripcion.asistio !== null && (
                        <p>Asistió: {inscripcion.asistio ? 'Sí' : 'No'}</p>
                      )}
                      {inscripcion.calificacion && (
                        <p>Calificación: {inscripcion.calificacion} / 10</p>
                      )}
                    </div>
                    {capacitacionSeleccionada.requiere_aprobacion && 
                     inscripcion.estado === 'pendiente' && (
                      <div className="rrhh-inscripcion-actions">
                        <button
                          className="btn-success"
                          onClick={() => {
                            setInscripcionSeleccionada(inscripcion)
                            setShowAprobarModal(true)
                          }}
                        >
                          Revisar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal aprobar/rechazar */}
      {showAprobarModal && inscripcionSeleccionada && (
        <div className="rrhh-modal-overlay" onClick={() => setShowAprobarModal(false)}>
          <div className="rrhh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>Revisar Inscripción</h2>
              <button className="rrhh-modal-close" onClick={() => setShowAprobarModal(false)}>✕</button>
            </div>

            <div className="rrhh-aprobar-form">
              <p><strong>Usuario:</strong> {inscripcionSeleccionada.nombre_usuario}</p>
              <div className="form-group">
                <label>Motivo de Rechazo (si aplica)</label>
                <textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  rows={3}
                  placeholder="Si rechazas, indica el motivo..."
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-success"
                  onClick={() => handleAprobarRechazar(inscripcionSeleccionada, true)}
                >
                  ✅ Aprobar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => handleAprobarRechazar(inscripcionSeleccionada, false)}
                >
                  ❌ Rechazar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAprobarModal(false)
                    setMotivoRechazo('')
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosCapacitacionesPage

