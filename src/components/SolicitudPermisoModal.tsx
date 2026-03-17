import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { SolicitudPermiso } from '../types/api'
import './SolicitudPermisoModal.css'

interface SolicitudPermisoModalProps {
  onClose: () => void
  onSolicitudCreada?: () => void
  solicitudEditar?: SolicitudPermiso | null
}

const SolicitudPermisoModal = ({ onClose, onSolicitudCreada, solicitudEditar }: SolicitudPermisoModalProps) => {
  const { usuario } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    tipo_solicitud: 'permiso' as 'turno' | 'ausencia' | 'vacaciones' | 'ropa' | 'permiso' | 'otro',
    titulo: '',
    descripcion: '',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    fecha_inicio: '',
    fecha_fin: '',
    dias_solicitados: null as number | null,
    observaciones: '',
    archivo_adjunto_url: ''
  })

  useEffect(() => {
    if (solicitudEditar) {
      setFormData({
        tipo_solicitud: solicitudEditar.tipo_solicitud,
        titulo: solicitudEditar.titulo,
        descripcion: solicitudEditar.descripcion || '',
        fecha_solicitud: solicitudEditar.fecha_solicitud,
        fecha_inicio: solicitudEditar.fecha_inicio || '',
        fecha_fin: solicitudEditar.fecha_fin || '',
        dias_solicitados: solicitudEditar.dias_solicitados,
        observaciones: solicitudEditar.observaciones || '',
        archivo_adjunto_url: solicitudEditar.archivo_adjunto_url || ''
      })
    }
  }, [solicitudEditar])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario?.id) return

    setLoading(true)
    setError(null)

    try {
      const response = await apiService.crearSolicitudPermiso(
        usuario.id,
        formData.tipo_solicitud,
        formData.titulo,
        formData.descripcion || null,
        formData.fecha_solicitud || null,
        formData.fecha_inicio || null,
        formData.fecha_fin || null,
        formData.dias_solicitados,
        formData.observaciones || null,
        formData.archivo_adjunto_url || null
      )

      if (response.success) {
        onSolicitudCreada?.()
        onClose()
      } else {
        setError(response.error || 'Error al crear solicitud')
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear solicitud')
    } finally {
      setLoading(false)
    }
  }

  const calcularDias = () => {
    if (formData.fecha_inicio && formData.fecha_fin) {
      const inicio = new Date(formData.fecha_inicio)
      const fin = new Date(formData.fecha_fin)
      const diffTime = Math.abs(fin.getTime() - inicio.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      setFormData({ ...formData, dias_solicitados: diffDays })
    }
  }

  useEffect(() => {
    if (formData.fecha_inicio && formData.fecha_fin) {
      calcularDias()
    }
  }, [formData.fecha_inicio, formData.fecha_fin])

  return (
    <div
      className="solicitud-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="solicitud-modal" onClick={(e) => e.stopPropagation()}>
        <div className="solicitud-modal-header">
          <h2>📋 Nueva Solicitud</h2>
          <button className="solicitud-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="solicitud-form">
          {error && (
            <div className="solicitud-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Tipo de Solicitud *</label>
            <select
              value={formData.tipo_solicitud}
              onChange={(e) => setFormData({ ...formData, tipo_solicitud: e.target.value as any })}
              required
            >
              <option value="turno">🕐 Turno</option>
              <option value="ausencia">❌ Ausencia</option>
              <option value="vacaciones">🏖️ Vacaciones</option>
              <option value="ropa">👕 Ropa de Trabajo</option>
              <option value="permiso">✅ Permiso</option>
              <option value="otro">📝 Otro</option>
            </select>
          </div>

          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ej: Solicitud de vacaciones enero"
              required
            />
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Detalles adicionales de la solicitud..."
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha de Inicio</label>
              <input
                type="date"
                value={formData.fecha_inicio}
                onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Fecha de Fin</label>
              <input
                type="date"
                value={formData.fecha_fin}
                onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
              />
            </div>
          </div>

          {formData.dias_solicitados && (
            <div className="form-group">
              <label>Días Solicitados</label>
              <input
                type="number"
                value={formData.dias_solicitados}
                readOnly
                className="readonly-input"
              />
            </div>
          )}

          <div className="form-group">
            <label>Observaciones</label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Información adicional..."
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SolicitudPermisoModal

