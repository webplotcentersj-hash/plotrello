import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ActaSectorRecord, SectorRecord, TipoNovedad } from '../types/api'
import './LibroActasSectorPage.css'

const TIPOS_NOVEDAD: { value: TipoNovedad; label: string; color: string }[] = [
  { value: 'general', label: 'General', color: '#6b7280' },
  { value: 'problema', label: 'Problema', color: '#ef4444' },
  { value: 'mejora', label: 'Mejora', color: '#10b981' },
  { value: 'incidente', label: 'Incidente', color: '#f59e0b' },
  { value: 'reunion', label: 'Reunión', color: '#3b82f6' },
  { value: 'capacitacion', label: 'Capacitación', color: '#8b5cf6' },
  { value: 'otro', label: 'Otro', color: '#9ca3af' }
]

export default function LibroActasSectorPage() {
  const { sectorId } = useParams<{ sectorId: string }>()
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [sector, setSector] = useState<SectorRecord | null>(null)
  const [actas, setActas] = useState<ActaSectorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [actaEditando, setActaEditando] = useState<ActaSectorRecord | null>(null)
  const [filtros, setFiltros] = useState({
    tipo_novedad: '' as TipoNovedad | '',
    fecha_desde: '',
    fecha_hasta: ''
  })

  const [formData, setFormData] = useState({
    titulo: '',
    contenido: '',
    tipo_novedad: 'general' as TipoNovedad,
    fecha: new Date().toISOString().slice(0, 16)
  })

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/login')
      return
    }
    if (sectorId) {
      loadSector()
      loadActas()
    }
  }, [sectorId, usuario, navigate, authLoading])

  const loadSector = async () => {
    if (!sectorId) return
    try {
      const response = await apiService.getSectores()
      if (response.success && response.data) {
        const sectorEncontrado = response.data.find(s => s.id === parseInt(sectorId))
        if (sectorEncontrado) {
          setSector(sectorEncontrado)
        } else {
          setError('Sector no encontrado')
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadActas = async () => {
    if (!sectorId) return
    setLoading(true)
    setError('')
    try {
      const response = await apiService.listarActasSector({
        id_sector: parseInt(sectorId),
        tipo_novedad: filtros.tipo_novedad || undefined,
        fecha_desde: filtros.fecha_desde || undefined,
        fecha_hasta: filtros.fecha_hasta || undefined,
        limit: 100
      })
      if (response.success && response.data) {
        setActas(response.data)
      } else {
        setError(response.error || 'Error al cargar las actas')
      }
    } catch (err) {
      setError('Error al cargar las actas')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sectorId) {
      loadActas()
    }
  }, [filtros])

  const handleCrear = async () => {
    if (!sectorId || !usuario) return

    if (!formData.titulo.trim()) {
      alert('El título es requerido')
      return
    }

    if (!formData.contenido.trim()) {
      alert('El contenido es requerido')
      return
    }

    try {
      const response = await apiService.crearActaSector({
        id_sector: parseInt(sectorId),
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre || 'Usuario',
        titulo: formData.titulo.trim(),
        contenido: formData.contenido.trim(),
        tipo_novedad: formData.tipo_novedad,
        fecha: formData.fecha ? new Date(formData.fecha).toISOString() : undefined
      })

      if (response.success) {
        alert('Acta creada exitosamente')
        setMostrarFormulario(false)
        setFormData({
          titulo: '',
          contenido: '',
          tipo_novedad: 'general',
          fecha: new Date().toISOString().slice(0, 16)
        })
        loadActas()
      } else {
        alert(response.error || 'Error al crear la acta')
      }
    } catch (err) {
      alert('Error al crear la acta')
      console.error(err)
    }
  }

  const handleActualizar = async () => {
    if (!actaEditando) return

    if (!formData.titulo.trim()) {
      alert('El título es requerido')
      return
    }

    if (!formData.contenido.trim()) {
      alert('El contenido es requerido')
      return
    }

    try {
      const response = await apiService.actualizarActaSector({
        id_acta: actaEditando.id,
        titulo: formData.titulo.trim(),
        contenido: formData.contenido.trim(),
        tipo_novedad: formData.tipo_novedad,
        fecha: formData.fecha ? new Date(formData.fecha).toISOString() : undefined
      })

      if (response.success) {
        alert('Acta actualizada exitosamente')
        setActaEditando(null)
        setMostrarFormulario(false)
        setFormData({
          titulo: '',
          contenido: '',
          tipo_novedad: 'general',
          fecha: new Date().toISOString().slice(0, 16)
        })
        loadActas()
      } else {
        alert(response.error || 'Error al actualizar la acta')
      }
    } catch (err) {
      alert('Error al actualizar la acta')
      console.error(err)
    }
  }

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta acta?')) return

    try {
      const response = await apiService.eliminarActaSector(id)
      if (response.success) {
        alert('Acta eliminada exitosamente')
        loadActas()
      } else {
        alert(response.error || 'Error al eliminar la acta')
      }
    } catch (err) {
      alert('Error al eliminar la acta')
      console.error(err)
    }
  }

  const abrirEditar = (acta: ActaSectorRecord) => {
    setActaEditando(acta)
    setFormData({
      titulo: acta.titulo,
      contenido: acta.contenido,
      tipo_novedad: acta.tipo_novedad,
      fecha: new Date(acta.fecha).toISOString().slice(0, 16)
    })
    setMostrarFormulario(true)
  }

  const cancelarFormulario = () => {
    setMostrarFormulario(false)
    setActaEditando(null)
    setFormData({
      titulo: '',
      contenido: '',
      tipo_novedad: 'general',
      fecha: new Date().toISOString().slice(0, 16)
    })
  }

  const getTipoNovedadInfo = (tipo: TipoNovedad) => {
    return TIPOS_NOVEDAD.find(t => t.value === tipo) || TIPOS_NOVEDAD[0]
  }

  if (authLoading || loading) {
    return (
      <div className="libro-actas-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando libro de actas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="libro-actas-page">
      <header className="libro-actas-header">
        <div className="libro-actas-header-content">
          <div>
            <h1>📋 Libro de Actas - {sector?.nombre || 'Sector'}</h1>
            <p className="sector-info">Registro de novedades y eventos del sector</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-secondary"
              onClick={() => navigate('/')}
            >
              ← Volver
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                cancelarFormulario()
                setMostrarFormulario(true)
              }}
            >
              + Nueva Acta
            </button>
          </div>
        </div>
      </header>

      <main className="libro-actas-main">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Filtros */}
        <section className="filtros-section">
          <h2>Filtros</h2>
          <div className="filtros-grid">
            <div className="filtro-item">
              <label>Tipo de Novedad:</label>
              <select
                value={filtros.tipo_novedad}
                onChange={(e) => setFiltros({ ...filtros, tipo_novedad: e.target.value as TipoNovedad | '' })}
                className="filtro-select"
              >
                <option value="">Todos</option>
                {TIPOS_NOVEDAD.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
            <div className="filtro-item">
              <label>Fecha Desde:</label>
              <input
                type="date"
                value={filtros.fecha_desde}
                onChange={(e) => setFiltros({ ...filtros, fecha_desde: e.target.value })}
                className="filtro-input"
              />
            </div>
            <div className="filtro-item">
              <label>Fecha Hasta:</label>
              <input
                type="date"
                value={filtros.fecha_hasta}
                onChange={(e) => setFiltros({ ...filtros, fecha_hasta: e.target.value })}
                className="filtro-input"
              />
            </div>
            <div className="filtro-item">
              <button
                className="btn-clear-filters"
                onClick={() => setFiltros({ tipo_novedad: '', fecha_desde: '', fecha_hasta: '' })}
              >
                Limpiar Filtros
              </button>
            </div>
          </div>
        </section>

        {/* Formulario de creación/edición */}
        {mostrarFormulario && (
          <section className="formulario-section">
            <h2>{actaEditando ? 'Editar Acta' : 'Nueva Acta'}</h2>
            <div className="form-grid">
              <div className="form-item">
                <label>Título: *</label>
                <input
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="form-input"
                  placeholder="Ej: Problema con la impresora"
                />
              </div>
              <div className="form-item">
                <label>Tipo de Novedad:</label>
                <select
                  value={formData.tipo_novedad}
                  onChange={(e) => setFormData({ ...formData, tipo_novedad: e.target.value as TipoNovedad })}
                  className="form-select"
                >
                  {TIPOS_NOVEDAD.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label>Fecha y Hora:</label>
                <input
                  type="datetime-local"
                  value={formData.fecha}
                  onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-item full-width">
                <label>Contenido: *</label>
                <textarea
                  value={formData.contenido}
                  onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                  className="form-textarea"
                  placeholder="Describe la novedad, problema, mejora, etc..."
                  rows={6}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={cancelarFormulario}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={actaEditando ? handleActualizar : handleCrear}
              >
                {actaEditando ? 'Actualizar' : 'Crear'} Acta
              </button>
            </div>
          </section>
        )}

        {/* Lista de actas */}
        <section className="actas-section">
          <h2>Actas Registradas ({actas.length})</h2>
          {actas.length === 0 ? (
            <div className="empty-state">
              <p>No hay actas registradas para este sector.</p>
              <button
                className="btn-primary"
                onClick={() => {
                  cancelarFormulario()
                  setMostrarFormulario(true)
                }}
              >
                Crear Primera Acta
              </button>
            </div>
          ) : (
            <div className="actas-list">
              {actas.map((acta) => {
                const tipoInfo = getTipoNovedadInfo(acta.tipo_novedad)
                const puedeEditar = usuario && (usuario.id === acta.usuario_id || usuario.rol === 'administracion' || usuario.rol === 'gerencia')
                return (
                  <div key={acta.id} className="acta-card">
                    <div className="acta-header">
                      <div className="acta-header-left">
                        <span
                          className="tipo-badge"
                          style={{ backgroundColor: tipoInfo.color }}
                        >
                          {tipoInfo.label}
                        </span>
                        <h3>{acta.titulo}</h3>
                      </div>
                      <div className="acta-header-right">
                        {puedeEditar && (
                          <>
                            <button
                              className="btn-edit"
                              onClick={() => abrirEditar(acta)}
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="btn-delete"
                              onClick={() => handleEliminar(acta.id)}
                            >
                              🗑️ Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="acta-content">
                      <p>{acta.contenido}</p>
                    </div>
                    <div className="acta-footer">
                      <span className="acta-meta">
                        📅 {new Date(acta.fecha).toLocaleString('es-AR')}
                      </span>
                      <span className="acta-meta">
                        👤 {acta.usuario_nombre}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

