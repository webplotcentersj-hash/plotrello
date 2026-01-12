import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { Capacitacion } from '../types/api'
import './CapacitacionesPage.css'

const CapacitacionesPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([])
  const [misCapacitaciones, setMisCapacitaciones] = useState<Capacitacion[]>([])
  const [activeTab, setActiveTab] = useState<'disponibles' | 'mis-capacitaciones'>('disponibles')
  const [filtros, setFiltros] = useState({
    tipo: null as string | null,
    categoria: null as string | null
  })

  useEffect(() => {
    if (authLoading) return
    loadData()
  }, [authLoading, activeTab, filtros])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'disponibles') {
        // Obtener todas las capacitaciones (sin filtrar por estado) para mostrar las disponibles
        const response = await apiService.obtenerCapacitaciones(
          null, // Sin filtro de estado para ver todas
          filtros.tipo,
          filtros.categoria,
          null,
          null,
          usuario?.id || null
        )
        if (response.success && response.data) {
          // Filtrar en el frontend para mostrar solo las que están abiertas o planificadas
          const capacitacionesDisponibles = response.data.filter(
            c => c.estado === 'abierta' || c.estado === 'planificada' || c.estado === 'en_curso'
          )
          setCapacitaciones(capacitacionesDisponibles)
        }
      } else if (usuario?.id) {
        const response = await apiService.obtenerCapacitacionesUsuario(usuario.id, null)
        if (response.success && response.data) {
          setMisCapacitaciones(response.data)
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInscribirse = async (idCapacitacion: number) => {
    if (!usuario?.id) {
      alert('Debes estar autenticado para inscribirte')
      return
    }

    if (!confirm('¿Deseas inscribirte en esta capacitación?')) return

    const response = await apiService.inscribirseCapacitacion(idCapacitacion, usuario.id)
    if (response.success) {
      alert('Inscripción realizada. ' + (response.data?.estado === 'pendiente' ? 'Espera la aprobación de RRHH.' : 'Ya estás inscrito.'))
      loadData()
    } else {
      alert('Error: ' + response.error)
    }
  }

  const handleCancelar = async (idCapacitacion: number) => {
    if (!usuario?.id) return

    // Buscar la inscripción
    const capacitacion = misCapacitaciones.find(c => c.id === idCapacitacion)
    if (!capacitacion) return

    // Necesitamos el ID de la inscripción, pero no lo tenemos directamente
    // Por ahora, mostraremos un mensaje
    if (!confirm('¿Deseas cancelar tu inscripción?')) return

    alert('Para cancelar tu inscripción, contacta a Recursos Humanos.')
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { class: string; text: string }> = {
      pendiente: { class: 'badge-pendiente', text: 'Pendiente' },
      inscrito: { class: 'badge-inscrito', text: 'Inscrito' },
      aprobado: { class: 'badge-aprobado', text: 'Aprobado' },
      rechazado: { class: 'badge-rechazado', text: 'Rechazado' },
      completado: { class: 'badge-completado', text: 'Completado' },
      ausente: { class: 'badge-ausente', text: 'Ausente' },
      cancelado: { class: 'badge-cancelado', text: 'Cancelado' }
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
      <div className="capacitaciones-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="capacitaciones-page">
      <header className="capacitaciones-header">
        <div className="capacitaciones-header-content">
          <h1>📚 Capacitaciones</h1>
          <button className="btn-back" onClick={() => navigate('/')}>
            ← Volver al Tablero
          </button>
        </div>
      </header>

      <div className="capacitaciones-content">
        {/* Tabs */}
        <div className="capacitaciones-tabs">
          <button
            className={`capacitaciones-tab ${activeTab === 'disponibles' ? 'active' : ''}`}
            onClick={() => setActiveTab('disponibles')}
          >
            Capacitaciones Disponibles
          </button>
          <button
            className={`capacitaciones-tab ${activeTab === 'mis-capacitaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('mis-capacitaciones')}
          >
            Mis Capacitaciones
          </button>
        </div>

        {/* Filtros (solo para disponibles) */}
        {activeTab === 'disponibles' && (
          <div className="capacitaciones-filters">
            <select
              className="capacitaciones-filter-select"
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
              className="capacitaciones-filter-select"
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
          </div>
        )}

        {/* Lista de capacitaciones */}
        <div className="capacitaciones-list">
          {activeTab === 'disponibles' ? (
            capacitaciones.length === 0 ? (
              <div className="capacitaciones-info-box">
                <p>No hay capacitaciones disponibles en este momento.</p>
              </div>
            ) : (
              capacitaciones.map(capacitacion => {
                const cuposDisponibles = capacitacion.cupos_disponibles ?? null
                const puedeInscribirse = !capacitacion.usuario_inscrito && 
                  (capacitacion.estado === 'abierta' || capacitacion.estado === 'planificada' || capacitacion.estado === 'en_curso') &&
                  (cuposDisponibles === null || cuposDisponibles > 0)
                
                return (
                  <div key={capacitacion.id} className="capacitacion-card">
                    <div className="capacitacion-info">
                      <div className="capacitacion-header">
                        <span className="capacitacion-icon">{getTipoIcon(capacitacion.tipo_capacitacion)}</span>
                        <h3>{capacitacion.titulo}</h3>
                        {capacitacion.es_obligatoria && (
                          <span className="capacitacion-badge obligatoria">⚠️ Obligatoria</span>
                        )}
                      </div>
                      {capacitacion.descripcion && (
                        <p className="capacitacion-descripcion">{capacitacion.descripcion}</p>
                      )}
                      <div className="capacitacion-details">
                        <p><strong>Tipo:</strong> {capacitacion.tipo_capacitacion}</p>
                        {capacitacion.categoria && <p><strong>Categoría:</strong> {capacitacion.categoria}</p>}
                        {capacitacion.duracion_horas && <p><strong>Duración:</strong> {capacitacion.duracion_horas} horas</p>}
                        {capacitacion.fecha_inicio && (
                          <p><strong>Fecha inicio:</strong> {new Date(capacitacion.fecha_inicio).toLocaleDateString()}</p>
                        )}
                        {capacitacion.instructor && <p><strong>Instructor:</strong> {capacitacion.instructor}</p>}
                        {capacitacion.lugar && <p><strong>Lugar:</strong> {capacitacion.lugar}</p>}
                        {capacitacion.link_virtual && (
                          <p>
                            <strong>Link:</strong>{' '}
                            <a href={capacitacion.link_virtual} target="_blank" rel="noopener noreferrer">
                              {capacitacion.link_virtual}
                            </a>
                          </p>
                        )}
                        {capacitacion.cupo_maximo && (
                          <p><strong>Cupos disponibles:</strong> {capacitacion.cupos_disponibles ?? 0} / {capacitacion.cupo_maximo}</p>
                        )}
                        {capacitacion.material_adjunto_url && (
                          <p>
                            <strong>Material:</strong>{' '}
                            <a href={capacitacion.material_adjunto_url} target="_blank" rel="noopener noreferrer">
                              Ver material
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="capacitacion-actions">
                      {capacitacion.usuario_inscrito ? (
                        <div className="capacitacion-inscrito">
                          <span className={`capacitacion-badge ${getEstadoBadge(capacitacion.estado_inscripcion || '').class}`}>
                            {getEstadoBadge(capacitacion.estado_inscripcion || '').text}
                          </span>
                        </div>
                      ) : puedeInscribirse ? (
                        <button
                          className="btn-primary"
                          onClick={() => handleInscribirse(capacitacion.id)}
                        >
                          Inscribirse
                        </button>
                      ) : (
                        <p className="capacitacion-no-disponible">
                          {capacitacion.cupos_disponibles === 0 ? 'Sin cupos disponibles' : 'No disponible'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })
            )
          ) : (
            misCapacitaciones.length === 0 ? (
              <div className="capacitaciones-info-box">
                <p>No estás inscrito en ninguna capacitación.</p>
              </div>
            ) : (
              misCapacitaciones.map(capacitacion => {
                const estadoBadge = getEstadoBadge(capacitacion.estado_inscripcion || '')
                return (
                  <div key={capacitacion.id} className="capacitacion-card">
                    <div className="capacitacion-info">
                      <div className="capacitacion-header">
                        <span className="capacitacion-icon">{getTipoIcon(capacitacion.tipo_capacitacion)}</span>
                        <h3>{capacitacion.titulo}</h3>
                        <span className={`capacitacion-badge ${estadoBadge.class}`}>
                          {estadoBadge.text}
                        </span>
                      </div>
                      {capacitacion.descripcion && (
                        <p className="capacitacion-descripcion">{capacitacion.descripcion}</p>
                      )}
                      <div className="capacitacion-details">
                        <p><strong>Tipo:</strong> {capacitacion.tipo_capacitacion}</p>
                        {capacitacion.categoria && <p><strong>Categoría:</strong> {capacitacion.categoria}</p>}
                        {capacitacion.duracion_horas && <p><strong>Duración:</strong> {capacitacion.duracion_horas} horas</p>}
                        {capacitacion.fecha_inicio && (
                          <p><strong>Fecha inicio:</strong> {new Date(capacitacion.fecha_inicio).toLocaleDateString()}</p>
                        )}
                        {capacitacion.fecha_fin && (
                          <p><strong>Fecha fin:</strong> {new Date(capacitacion.fecha_fin).toLocaleDateString()}</p>
                        )}
                        {capacitacion.instructor && <p><strong>Instructor:</strong> {capacitacion.instructor}</p>}
                        {capacitacion.lugar && <p><strong>Lugar:</strong> {capacitacion.lugar}</p>}
                        {capacitacion.link_virtual && (
                          <p>
                            <strong>Link:</strong>{' '}
                            <a href={capacitacion.link_virtual} target="_blank" rel="noopener noreferrer">
                              {capacitacion.link_virtual}
                            </a>
                          </p>
                        )}
                        {capacitacion.asistio !== undefined && (
                          <p><strong>Asistencia:</strong> {capacitacion.asistio ? 'Sí' : 'No'}</p>
                        )}
                        {capacitacion.calificacion && (
                          <p><strong>Calificación:</strong> {capacitacion.calificacion} / 10</p>
                        )}
                      </div>
                    </div>
                    <div className="capacitacion-actions">
                      {(capacitacion.estado_inscripcion === 'pendiente' || 
                        capacitacion.estado_inscripcion === 'inscrito' || 
                        capacitacion.estado_inscripcion === 'aprobado') && (
                        <button
                          className="btn-danger"
                          onClick={() => handleCancelar(capacitacion.id)}
                        >
                          Cancelar Inscripción
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default CapacitacionesPage

