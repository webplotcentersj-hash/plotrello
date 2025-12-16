import { useState, useEffect } from 'react'
import apiService from '../services/api'
import { useAuth } from '../hooks/useAuth'
import type { RevisionOrden } from '../types/api'
import './RevisionesSection.css'

type RevisionesSectionProps = {
  ordenId: number
  estadoRevisionActual?: string | null
  onEstadoCambiado?: () => void
}

const RevisionesSection = ({ ordenId, estadoRevisionActual, onEstadoCambiado }: RevisionesSectionProps) => {
  const { usuario } = useAuth()
  const [revisiones, setRevisiones] = useState<RevisionOrden[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [revisorSeleccionado, setRevisorSeleccionado] = useState<number | null>(null)
  const [comentariosSolicitud, setComentariosSolicitud] = useState('')
  const [comentariosAprobacion, setComentariosAprobacion] = useState('')
  const [comentariosRechazo, setComentariosRechazo] = useState('')
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string; rol: string }>>([])

  useEffect(() => {
    loadRevisiones()
    loadUsuarios()
  }, [ordenId])

  const loadRevisiones = async () => {
    setLoading(true)
    try {
      const response = await apiService.obtenerRevisionesOrden(ordenId)
      if (response.success && response.data) {
        setRevisiones(response.data)
      }
    } catch (error) {
      console.error('Error cargando revisiones:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsuarios = async () => {
    try {
      const response = await apiService.getUsuarios()
      if (response.success && response.data) {
        // Filtrar usuarios que pueden revisar (admin, gerencia, diseño)
        const revisores = response.data.filter(u => 
          ['administracion', 'gerencia', 'diseno'].includes(u.rol)
        )
        setUsuarios(revisores)
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    }
  }

  const handleSolicitarRevision = async () => {
    if (!revisorSeleccionado || !usuario) return

    const revisor = usuarios.find(u => u.id === revisorSeleccionado)
    if (!revisor) return

    setLoading(true)
    try {
      const response = await apiService.solicitarRevisionOrden({
        id_orden: ordenId,
        usuario_revisor_id: revisorSeleccionado,
        usuario_revisor_nombre: revisor.nombre,
        comentarios: comentariosSolicitud.trim() || undefined
      })

      if (response.success) {
        setMostrarFormulario(false)
        setComentariosSolicitud('')
        setRevisorSeleccionado(null)
        await loadRevisiones()
        onEstadoCambiado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error solicitando revisión:', error)
      alert('Error al solicitar revisión')
    } finally {
      setLoading(false)
    }
  }

  const handleAprobar = async (idRevision: number) => {
    setLoading(true)
    try {
      const response = await apiService.aprobarRevisionOrden(idRevision, comentariosAprobacion.trim() || undefined)
      if (response.success) {
        setComentariosAprobacion('')
        await loadRevisiones()
        onEstadoCambiado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error aprobando:', error)
      alert('Error al aprobar revisión')
    } finally {
      setLoading(false)
    }
  }

  const handleRechazar = async (idRevision: number) => {
    if (!comentariosRechazo.trim()) {
      alert('Debes proporcionar comentarios al rechazar')
      return
    }

    setLoading(true)
    try {
      const response = await apiService.rechazarRevisionOrden(idRevision, comentariosRechazo.trim())
      if (response.success) {
        setComentariosRechazo('')
        await loadRevisiones()
        onEstadoCambiado?.()
      } else {
        alert(`Error: ${response.error}`)
      }
    } catch (error) {
      console.error('Error rechazando:', error)
      alert('Error al rechazar revisión')
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadgeClass = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'badge-aprobado'
      case 'requiere_cambios':
        return 'badge-rechazado'
      case 'en_revision':
        return 'badge-en-revision'
      default:
        return 'badge-pendiente'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return '✅ Aprobado'
      case 'requiere_cambios':
        return '❌ Requiere Cambios'
      case 'en_revision':
        return '🔄 En Revisión'
      default:
        return '⏳ Pendiente'
    }
  }

  const revisionActiva = revisiones.find(r => r.estado_revision === 'en_revision' || r.estado_revision === 'requiere_cambios')
  const puedeRevisar = usuario && ['administracion', 'gerencia', 'diseno'].includes(usuario.rol)

  return (
    <div className="revisiones-section">
      <div className="revisiones-header">
        <h3>📋 Revisiones y Aprobaciones</h3>
        {!mostrarFormulario && !revisionActiva && (
          <button 
            className="btn-solicitar-revision"
            onClick={() => setMostrarFormulario(true)}
          >
            + Solicitar Revisión
          </button>
        )}
      </div>

      {mostrarFormulario && (
        <div className="formulario-solicitud">
          <h4>Solicitar Revisión</h4>
          <div className="form-group">
            <label>Revisor</label>
            <select
              value={revisorSeleccionado || ''}
              onChange={(e) => setRevisorSeleccionado(parseInt(e.target.value) || null)}
            >
              <option value="">Seleccionar revisor...</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.rol})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Comentarios (opcional)</label>
            <textarea
              rows={3}
              value={comentariosSolicitud}
              onChange={(e) => setComentariosSolicitud(e.target.value)}
              placeholder="Agregar comentarios sobre la revisión..."
            />
          </div>
          <div className="form-actions">
            <button 
              className="btn-primary"
              onClick={handleSolicitarRevision}
              disabled={!revisorSeleccionado || loading}
            >
              Solicitar Revisión
            </button>
            <button 
              className="btn-secondary"
              onClick={() => {
                setMostrarFormulario(false)
                setComentariosSolicitud('')
                setRevisorSeleccionado(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {revisionActiva && puedeRevisar && revisionActiva.usuario_revisor_id === usuario?.id && (
        <div className="acciones-revision">
          <h4>Revisión Activa - {revisionActiva.usuario_revisor_nombre}</h4>
          {revisionActiva.comentarios && (
            <div className="comentarios-revision">
              <strong>Comentarios:</strong>
              <p>{revisionActiva.comentarios}</p>
            </div>
          )}
          <div className="form-group">
            <label>Comentarios de Aprobación</label>
            <textarea
              rows={2}
              value={comentariosAprobacion}
              onChange={(e) => setComentariosAprobacion(e.target.value)}
              placeholder="Comentarios opcionales al aprobar..."
            />
          </div>
          <div className="form-group">
            <label>Comentarios de Rechazo (requerido si rechazas)</label>
            <textarea
              rows={3}
              value={comentariosRechazo}
              onChange={(e) => setComentariosRechazo(e.target.value)}
              placeholder="Explica qué cambios se requieren..."
              required
            />
          </div>
          <div className="form-actions">
            <button 
              className="btn-aprobar"
              onClick={() => handleAprobar(revisionActiva.id)}
              disabled={loading}
            >
              ✅ Aprobar
            </button>
            <button 
              className="btn-rechazar"
              onClick={() => handleRechazar(revisionActiva.id)}
              disabled={loading || !comentariosRechazo.trim()}
            >
              ❌ Rechazar
            </button>
          </div>
        </div>
      )}

      {estadoRevisionActual && (
        <div className={`estado-actual ${getEstadoBadgeClass(estadoRevisionActual)}`}>
          Estado Actual: {getEstadoLabel(estadoRevisionActual)}
        </div>
      )}

      {revisiones.length > 0 && (
        <div className="historial-revisiones">
          <h4>Historial de Revisiones</h4>
          {revisiones.map((revision) => (
            <div key={revision.id} className={`revision-item ${getEstadoBadgeClass(revision.estado_revision)}`}>
              <div className="revision-header">
                <span className="revision-revisor">{revision.usuario_revisor_nombre}</span>
                <span className={`revision-badge ${getEstadoBadgeClass(revision.estado_revision)}`}>
                  {getEstadoLabel(revision.estado_revision)}
                </span>
                <span className="revision-fecha">
                  {new Date(revision.fecha_revision).toLocaleString('es-AR')}
                </span>
              </div>
              {revision.comentarios && (
                <div className="revision-comentarios">
                  {revision.comentarios}
                </div>
              )}
              {revision.fecha_aprobacion && (
                <div className="revision-fecha-aprobacion">
                  Aprobado: {new Date(revision.fecha_aprobacion).toLocaleString('es-AR')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {revisiones.length === 0 && !mostrarFormulario && (
        <div className="sin-revisiones">
          <p>No hay revisiones registradas para esta orden.</p>
        </div>
      )}
    </div>
  )
}

export default RevisionesSection

