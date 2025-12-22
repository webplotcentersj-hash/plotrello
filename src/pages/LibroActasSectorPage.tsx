import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ActaSectorRecord, SectorRecord, TipoNovedad } from '../types/api'
import { canAccessSector } from '../utils/sectorPermissions'
import './LibroActasSectorPage.css'

// Tipos para reconocimiento de voz
declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

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
  const [grabando, setGrabando] = useState(false)
  const [reconocimientoVoz, setReconocimientoVoz] = useState<SpeechRecognition | null>(null)
  const [campoGrabando, setCampoGrabando] = useState<'titulo' | 'contenido' | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/login')
      return
    }
    if (sectorId) {
      loadSector()
    }

    // Inicializar reconocimiento de voz
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'es-AR'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let textoCompleto = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          textoCompleto += event.results[i][0].transcript
        }

        if (campoGrabando === 'titulo') {
          setFormData(prev => ({ ...prev, titulo: prev.titulo + textoCompleto }))
        } else if (campoGrabando === 'contenido') {
          setFormData(prev => ({ ...prev, contenido: prev.contenido + textoCompleto }))
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Error en reconocimiento de voz:', event.error)
        if (event.error === 'no-speech') {
          // No es un error crítico, solo no se detectó voz
          return
        }
        alert(`Error en reconocimiento de voz: ${event.error}`)
        setGrabando(false)
        setCampoGrabando(null)
      }

      recognition.onend = () => {
        if (grabando) {
          // Si aún está grabando, reiniciar
          try {
            recognition.start()
          } catch (e) {
            // Ya está iniciado o hay un error
            setGrabando(false)
            setCampoGrabando(null)
          }
        }
      }

      setReconocimientoVoz(recognition)
    }

    return () => {
      if (reconocimientoVoz) {
        try {
          reconocimientoVoz.stop()
        } catch (e) {
          // Ignorar errores al detener
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId, usuario, navigate, authLoading])

  const loadSector = async () => {
    if (!sectorId || !usuario) return
    try {
      const response = await apiService.getSectores()
      if (response.success && response.data) {
        const sectorEncontrado = response.data.find(s => s.id === parseInt(sectorId))
        if (sectorEncontrado) {
          // Verificar permisos de acceso
          if (!canAccessSector(usuario.rol, sectorEncontrado.nombre)) {
            setError('No tienes permiso para acceder a este sector')
            setSector(null)
            return
          }
          setSector(sectorEncontrado)
          loadActas()
        } else {
          setError('Sector no encontrado')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Error al cargar el sector')
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
    if (!actaEditando || !usuario || !sector) return

    // Verificar permisos: solo el creador o admin puede editar
    const puedeEditar = 
      usuario.rol === 'administracion' || 
      usuario.rol === 'gerencia' || 
      (actaEditando.usuario_id !== null && usuario.id === actaEditando.usuario_id)
    
    if (!puedeEditar) {
      alert('No tienes permiso para editar esta acta')
      return
    }

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

  const handleEliminar = async (id: number, acta: ActaSectorRecord) => {
    if (!usuario) return

    // Verificar permisos: solo el creador o admin puede eliminar
    const puedeEliminar = 
      usuario.rol === 'administracion' || 
      usuario.rol === 'gerencia' || 
      (acta.usuario_id !== null && usuario.id === acta.usuario_id)
    
    if (!puedeEliminar) {
      alert('No tienes permiso para eliminar esta acta')
      return
    }

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
    if (!usuario) return
    
    // Verificar permisos antes de abrir el formulario de edición
    const puedeEditar = 
      usuario.rol === 'administracion' || 
      usuario.rol === 'gerencia' || 
      (acta.usuario_id !== null && usuario.id === acta.usuario_id)
    
    if (!puedeEditar) {
      alert('No tienes permiso para editar esta acta')
      return
    }
    
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

  const iniciarGrabacion = (campo: 'titulo' | 'contenido') => {
    if (!reconocimientoVoz) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome, Edge o Safari.')
      return
    }

    try {
      setCampoGrabando(campo)
      setGrabando(true)
      reconocimientoVoz.start()
    } catch (error) {
      console.error('Error al iniciar grabación:', error)
      alert('Error al iniciar la grabación de voz')
      setGrabando(false)
      setCampoGrabando(null)
    }
  }

  const detenerGrabacion = () => {
    if (reconocimientoVoz) {
      try {
        reconocimientoVoz.stop()
      } catch (e) {
        // Ignorar errores
      }
    }
    setGrabando(false)
    setCampoGrabando(null)
  }

  const soportaVoz = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window

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
            {sector && usuario && canAccessSector(usuario.rol, sector.nombre) && (
              <button
                className="btn-primary"
                onClick={() => {
                  cancelarFormulario()
                  setMostrarFormulario(true)
                }}
              >
                + Nueva Acta
              </button>
            )}
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
        {mostrarFormulario && sector && usuario && canAccessSector(usuario.rol, sector.nombre) && (
          <section className="formulario-section">
            <h2>{actaEditando ? 'Editar Acta' : 'Nueva Acta'}</h2>
            <div className="form-grid">
              <div className="form-item">
                <label>Título: *</label>
                <div className="input-with-voice">
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Problema con la impresora"
                  />
                  {soportaVoz && (
                    <button
                      type="button"
                      className={`btn-voice ${grabando && campoGrabando === 'titulo' ? 'recording' : ''}`}
                      onClick={() => grabando && campoGrabando === 'titulo' ? detenerGrabacion() : iniciarGrabacion('titulo')}
                      title={grabando && campoGrabando === 'titulo' ? 'Detener grabación' : 'Grabar por voz'}
                    >
                      {grabando && campoGrabando === 'titulo' ? '⏹️' : '🎤'}
                    </button>
                  )}
                </div>
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
                <div className="textarea-with-voice">
                  <textarea
                    value={formData.contenido}
                    onChange={(e) => setFormData({ ...formData, contenido: e.target.value })}
                    className="form-textarea"
                    placeholder="Describe la novedad, problema, mejora, etc..."
                    rows={6}
                  />
                  {soportaVoz && (
                    <button
                      type="button"
                      className={`btn-voice btn-voice-textarea ${grabando && campoGrabando === 'contenido' ? 'recording' : ''}`}
                      onClick={() => grabando && campoGrabando === 'contenido' ? detenerGrabacion() : iniciarGrabacion('contenido')}
                      title={grabando && campoGrabando === 'contenido' ? 'Detener grabación' : 'Grabar por voz'}
                    >
                      {grabando && campoGrabando === 'contenido' ? '⏹️' : '🎤'}
                    </button>
                  )}
                </div>
                {grabando && (
                  <div className="recording-indicator">
                    <span className="recording-dot"></span>
                    Grabando... {campoGrabando === 'titulo' ? 'Título' : 'Contenido'}
                  </div>
                )}
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
              {sector && usuario && canAccessSector(usuario.rol, sector.nombre) && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    cancelarFormulario()
                    setMostrarFormulario(true)
                  }}
                >
                  Crear Primera Acta
                </button>
              )}
            </div>
          ) : (
            <div className="actas-list">
              {actas.map((acta) => {
                const tipoInfo = getTipoNovedadInfo(acta.tipo_novedad)
                // Verificar permisos: el creador, admin o gerencia pueden editar/eliminar
                const puedeEditar = usuario && (
                  (acta.usuario_id !== null && usuario.id === acta.usuario_id) || 
                  usuario.rol === 'administracion' || 
                  usuario.rol === 'gerencia'
                )
                const puedeEliminar = puedeEditar
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
                          <button
                            className="btn-edit"
                            onClick={() => abrirEditar(acta)}
                          >
                            ✏️ Editar
                          </button>
                        )}
                        {puedeEliminar && (
                          <button
                            className="btn-delete"
                            onClick={() => handleEliminar(acta.id, acta)}
                          >
                            🗑️ Eliminar
                          </button>
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

