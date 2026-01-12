import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Evaluacion, CriterioEvaluacion, UsuarioRecord } from '../types/api'
import './RecursosHumanosEvaluacionesPage.css'

const RecursosHumanosEvaluacionesPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [filtros, setFiltros] = useState({
    usuarioEvaluado: null as number | null,
    estado: null as string | null,
    tipo: null as string | null,
    fechaDesde: null as string | null,
    fechaHasta: null as string | null
  })
  const [showModal, setShowModal] = useState(false)
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState<Evaluacion | null>(null)
  const [criterios, setCriterios] = useState<CriterioEvaluacion[]>([])
  const [formData, setFormData] = useState({
    id_usuario_evaluado: 0,
    tipo_evaluacion: 'anual' as 'anual' | 'semestral' | 'trimestral' | 'mensual' | 'periodo_prueba' | 'especial',
    periodo_evaluacion: '',
    fecha_evaluacion: new Date().toISOString().split('T')[0],
    fecha_inicio_periodo: '',
    fecha_fin_periodo: '',
    comentarios_evaluador: '',
    objetivos_cumplidos: '',
    areas_mejora: '',
    recomendaciones: ''
  })
  const [nuevoCriterio, setNuevoCriterio] = useState({
    criterio: '',
    descripcion: '',
    calificacion: 0,
    peso: 1.0,
    comentarios: ''
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
      const [usuariosRes, evaluacionesRes] = await Promise.all([
        apiService.getUsuarios(),
        apiService.obtenerEvaluaciones(
          filtros.usuarioEvaluado,
          null,
          filtros.estado,
          filtros.tipo,
          filtros.fechaDesde,
          filtros.fechaHasta
        )
      ])

      if (usuariosRes.success && usuariosRes.data) {
        setUsuarios(usuariosRes.data)
      }

      if (evaluacionesRes.success && evaluacionesRes.data) {
        setEvaluaciones(evaluacionesRes.data)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCriterios = async (idEvaluacion: number) => {
    const response = await apiService.obtenerCriteriosEvaluacion(idEvaluacion)
    if (response.success && response.data) {
      setCriterios(response.data)
    }
  }

  const handleNuevaEvaluacion = () => {
    setEvaluacionSeleccionada(null)
    setCriterios([])
    setFormData({
      id_usuario_evaluado: 0,
      tipo_evaluacion: 'anual',
      periodo_evaluacion: '',
      fecha_evaluacion: new Date().toISOString().split('T')[0],
      fecha_inicio_periodo: '',
      fecha_fin_periodo: '',
      comentarios_evaluador: '',
      objetivos_cumplidos: '',
      areas_mejora: '',
      recomendaciones: ''
    })
    setShowModal(true)
  }

  const handleEditarEvaluacion = async (evaluacion: Evaluacion) => {
    setEvaluacionSeleccionada(evaluacion)
    setFormData({
      id_usuario_evaluado: evaluacion.id_usuario_evaluado,
      tipo_evaluacion: evaluacion.tipo_evaluacion,
      periodo_evaluacion: evaluacion.periodo_evaluacion,
      fecha_evaluacion: evaluacion.fecha_evaluacion,
      fecha_inicio_periodo: evaluacion.fecha_inicio_periodo || '',
      fecha_fin_periodo: evaluacion.fecha_fin_periodo || '',
      comentarios_evaluador: evaluacion.comentarios_evaluador || '',
      objetivos_cumplidos: evaluacion.objetivos_cumplidos || '',
      areas_mejora: evaluacion.areas_mejora || '',
      recomendaciones: evaluacion.recomendaciones || ''
    })
    await loadCriterios(evaluacion.id)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id || !formData.id_usuario_evaluado) return

    try {
      let response
      if (evaluacionSeleccionada) {
        response = await apiService.actualizarEvaluacion(
          evaluacionSeleccionada.id,
          formData.tipo_evaluacion,
          formData.periodo_evaluacion,
          formData.fecha_evaluacion,
          formData.fecha_inicio_periodo || null,
          formData.fecha_fin_periodo || null,
          null,
          formData.comentarios_evaluador || null,
          null,
          formData.objetivos_cumplidos || null,
          formData.areas_mejora || null,
          formData.recomendaciones || null
        )
      } else {
        response = await apiService.crearEvaluacion(
          formData.id_usuario_evaluado,
          usuario.id,
          formData.tipo_evaluacion,
          formData.periodo_evaluacion,
          formData.fecha_evaluacion,
          formData.fecha_inicio_periodo || null,
          formData.fecha_fin_periodo || null,
          formData.comentarios_evaluador || null,
          formData.objetivos_cumplidos || null,
          formData.areas_mejora || null,
          formData.recomendaciones || null
        )
      }

      if (response.success) {
        alert(evaluacionSeleccionada ? 'Evaluación actualizada' : 'Evaluación creada')
        setShowModal(false)
        loadData()
      } else {
        alert('Error: ' + response.error)
      }
    } catch (error) {
      alert('Error al guardar evaluación')
      console.error(error)
    }
  }

  const handleAgregarCriterio = async () => {
    if (!evaluacionSeleccionada || !nuevoCriterio.criterio || nuevoCriterio.calificacion <= 0) {
      alert('Completa todos los campos del criterio')
      return
    }

    const response = await apiService.agregarCriterioEvaluacion(
      evaluacionSeleccionada.id,
      nuevoCriterio.criterio,
      nuevoCriterio.descripcion || null,
      nuevoCriterio.calificacion,
      nuevoCriterio.peso,
      nuevoCriterio.comentarios || null
    )

    if (response.success) {
      setNuevoCriterio({
        criterio: '',
        descripcion: '',
        calificacion: 0,
        peso: 1.0,
        comentarios: ''
      })
      await loadCriterios(evaluacionSeleccionada.id)
      await loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleEliminarCriterio = async (id: number) => {
    if (!confirm('¿Eliminar este criterio?')) return

    const response = await apiService.eliminarCriterioEvaluacion(id)
    if (response.success) {
      if (evaluacionSeleccionada) {
        await loadCriterios(evaluacionSeleccionada.id)
        await loadData()
      }
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleAprobar = async (evaluacion: Evaluacion) => {
    if (!usuario?.id) return

    const response = await apiService.aprobarEvaluacion(evaluacion.id, usuario.id)
    if (response.success) {
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Eliminar esta evaluación?')) return

    const response = await apiService.eliminarEvaluacion(id)
    if (response.success) {
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      borrador: { class: 'badge-borrador', text: 'Borrador' },
      completada: { class: 'badge-completada', text: 'Completada' },
      revisada: { class: 'badge-revisada', text: 'Revisada' },
      aprobada: { class: 'badge-aprobada', text: 'Aprobada' }
    }
    return badges[estado] || { class: '', text: estado }
  }

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      anual: '📅',
      semestral: '📆',
      trimestral: '📊',
      mensual: '📈',
      periodo_prueba: '🔍',
      especial: '⭐'
    }
    return icons[tipo] || '📋'
  }

  if (loading) {
    return (
      <div className="rrhh-evaluaciones-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-evaluaciones-page">
      <header className="rrhh-evaluaciones-header">
        <div className="rrhh-header-content">
          <h1>⭐ Evaluaciones de Desempeño</h1>
          <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
            ← Volver
          </button>
        </div>
      </header>

      <div className="rrhh-evaluaciones-content">
        {/* Filtros */}
        <div className="rrhh-filters-section">
          <select
            className="rrhh-filter-select"
            value={filtros.usuarioEvaluado || ''}
            onChange={(e) => setFiltros({ ...filtros, usuarioEvaluado: e.target.value ? parseInt(e.target.value) : null })}
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>

          <select
            className="rrhh-filter-select"
            value={filtros.estado || ''}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value || null })}
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="completada">Completada</option>
            <option value="revisada">Revisada</option>
            <option value="aprobada">Aprobada</option>
          </select>

          <select
            className="rrhh-filter-select"
            value={filtros.tipo || ''}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value || null })}
          >
            <option value="">Todos los tipos</option>
            <option value="anual">Anual</option>
            <option value="semestral">Semestral</option>
            <option value="trimestral">Trimestral</option>
            <option value="mensual">Mensual</option>
            <option value="periodo_prueba">Período de Prueba</option>
            <option value="especial">Especial</option>
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

          <button className="btn-primary" onClick={handleNuevaEvaluacion}>
            + Nueva Evaluación
          </button>
        </div>

        {/* Lista de evaluaciones */}
        <div className="rrhh-evaluaciones-list">
          {evaluaciones.length === 0 ? (
            <div className="rrhh-info-box">
              <p>No hay evaluaciones que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            evaluaciones.map(evaluacion => {
              const estadoBadge = getEstadoBadge(evaluacion.estado)
              return (
                <div key={evaluacion.id} className="rrhh-evaluacion-card">
                  <div className="rrhh-evaluacion-info">
                    <div className="rrhh-evaluacion-header">
                      <span className="rrhh-evaluacion-icon">{getTipoIcon(evaluacion.tipo_evaluacion)}</span>
                      <h3>{evaluacion.nombre_evaluado || 'Usuario'}</h3>
                      <span className={`rrhh-badge ${estadoBadge.class}`}>
                        {estadoBadge.text}
                      </span>
                    </div>
                    <p className="rrhh-evaluacion-periodo">
                      <strong>Período:</strong> {evaluacion.periodo_evaluacion} ({evaluacion.tipo_evaluacion})
                    </p>
                    <p className="rrhh-evaluacion-fecha">
                      <strong>Fecha:</strong> {new Date(evaluacion.fecha_evaluacion).toLocaleDateString()}
                    </p>
                    <p className="rrhh-evaluacion-evaluador">
                      <strong>Evaluador:</strong> {evaluacion.nombre_evaluador || 'N/A'}
                    </p>
                    {evaluacion.calificacion_general !== null && (
                      <p className="rrhh-evaluacion-calificacion">
                        <strong>Calificación:</strong> {evaluacion.calificacion_general.toFixed(2)} / 10
                      </p>
                    )}
                    {evaluacion.comentarios_evaluador && (
                      <p className="rrhh-evaluacion-comentarios">
                        <strong>Comentarios:</strong> {evaluacion.comentarios_evaluador}
                      </p>
                    )}
                    {evaluacion.aprobado_por_nombre && (
                      <p className="rrhh-evaluacion-aprobador">
                        <strong>Aprobado por:</strong> {evaluacion.aprobado_por_nombre}
                        {evaluacion.fecha_aprobacion && ` el ${new Date(evaluacion.fecha_aprobacion).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                  <div className="rrhh-evaluacion-actions">
                    <button
                      className="btn-primary"
                      onClick={() => handleEditarEvaluacion(evaluacion)}
                    >
                      ✏️ Editar
                    </button>
                    {evaluacion.estado !== 'aprobada' && (
                      <button
                        className="btn-success"
                        onClick={() => handleAprobar(evaluacion)}
                      >
                        ✅ Aprobar
                      </button>
                    )}
                    <button
                      className="btn-danger"
                      onClick={() => handleEliminar(evaluacion.id)}
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

      {/* Modal de evaluación */}
      {showModal && (
        <div className="rrhh-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="rrhh-modal rrhh-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="rrhh-modal-header">
              <h2>{evaluacionSeleccionada ? 'Editar Evaluación' : 'Nueva Evaluación'}</h2>
              <button className="rrhh-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="rrhh-evaluacion-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Usuario Evaluado *</label>
                  <select
                    value={formData.id_usuario_evaluado}
                    onChange={(e) => setFormData({ ...formData, id_usuario_evaluado: parseInt(e.target.value) })}
                    required
                    disabled={!!evaluacionSeleccionada}
                  >
                    <option value="">Selecciona un usuario</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tipo de Evaluación *</label>
                  <select
                    value={formData.tipo_evaluacion}
                    onChange={(e) => setFormData({ ...formData, tipo_evaluacion: e.target.value as any })}
                    required
                  >
                    <option value="anual">📅 Anual</option>
                    <option value="semestral">📆 Semestral</option>
                    <option value="trimestral">📊 Trimestral</option>
                    <option value="mensual">📈 Mensual</option>
                    <option value="periodo_prueba">🔍 Período de Prueba</option>
                    <option value="especial">⭐ Especial</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Período de Evaluación *</label>
                  <input
                    type="text"
                    value={formData.periodo_evaluacion}
                    onChange={(e) => setFormData({ ...formData, periodo_evaluacion: e.target.value })}
                    placeholder="Ej: 2024, Q1 2024, Enero 2024"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Fecha de Evaluación *</label>
                  <input
                    type="date"
                    value={formData.fecha_evaluacion}
                    onChange={(e) => setFormData({ ...formData, fecha_evaluacion: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Inicio Período</label>
                  <input
                    type="date"
                    value={formData.fecha_inicio_periodo}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio_periodo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Fecha Fin Período</label>
                  <input
                    type="date"
                    value={formData.fecha_fin_periodo}
                    onChange={(e) => setFormData({ ...formData, fecha_fin_periodo: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Comentarios del Evaluador</label>
                <textarea
                  value={formData.comentarios_evaluador}
                  onChange={(e) => setFormData({ ...formData, comentarios_evaluador: e.target.value })}
                  rows={3}
                  placeholder="Comentarios generales sobre el desempeño..."
                />
              </div>

              <div className="form-group">
                <label>Objetivos Cumplidos</label>
                <textarea
                  value={formData.objetivos_cumplidos}
                  onChange={(e) => setFormData({ ...formData, objetivos_cumplidos: e.target.value })}
                  rows={3}
                  placeholder="Lista de objetivos cumplidos durante el período..."
                />
              </div>

              <div className="form-group">
                <label>Áreas de Mejora</label>
                <textarea
                  value={formData.areas_mejora}
                  onChange={(e) => setFormData({ ...formData, areas_mejora: e.target.value })}
                  rows={3}
                  placeholder="Áreas que requieren mejora..."
                />
              </div>

              <div className="form-group">
                <label>Recomendaciones</label>
                <textarea
                  value={formData.recomendaciones}
                  onChange={(e) => setFormData({ ...formData, recomendaciones: e.target.value })}
                  rows={3}
                  placeholder="Recomendaciones para el futuro..."
                />
              </div>

              {/* Criterios (solo si hay evaluación seleccionada) */}
              {evaluacionSeleccionada && (
                <div className="rrhh-criterios-section">
                  <h3>Criterios de Evaluación</h3>
                  
                  {criterios.length > 0 && (
                    <div className="rrhh-criterios-list">
                      {criterios.map(criterio => (
                        <div key={criterio.id} className="rrhh-criterio-item">
                          <div className="rrhh-criterio-info">
                            <strong>{criterio.criterio}</strong>
                            {criterio.descripcion && <p>{criterio.descripcion}</p>}
                            <p>Calificación: {criterio.calificacion} / 10 (Peso: {criterio.peso})</p>
                            {criterio.comentarios && <p className="rrhh-criterio-comentarios">{criterio.comentarios}</p>}
                          </div>
                          <button
                            className="btn-danger btn-small"
                            onClick={() => handleEliminarCriterio(criterio.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rrhh-nuevo-criterio">
                    <h4>Agregar Criterio</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Criterio *</label>
                        <input
                          type="text"
                          value={nuevoCriterio.criterio}
                          onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, criterio: e.target.value })}
                          placeholder="Ej: Puntualidad, Trabajo en equipo..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Calificación (0-10) *</label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={nuevoCriterio.calificacion}
                          onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, calificacion: parseFloat(e.target.value) || 0 })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Peso</label>
                        <input
                          type="number"
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={nuevoCriterio.peso}
                          onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, peso: parseFloat(e.target.value) || 1.0 })}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Descripción</label>
                      <textarea
                        value={nuevoCriterio.descripcion}
                        onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, descripcion: e.target.value })}
                        rows={2}
                        placeholder="Descripción del criterio..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Comentarios</label>
                      <textarea
                        value={nuevoCriterio.comentarios}
                        onChange={(e) => setNuevoCriterio({ ...nuevoCriterio, comentarios: e.target.value })}
                        rows={2}
                        placeholder="Comentarios sobre este criterio..."
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAgregarCriterio}
                    >
                      + Agregar Criterio
                    </button>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {evaluacionSeleccionada ? 'Actualizar' : 'Crear'} Evaluación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecursosHumanosEvaluacionesPage
