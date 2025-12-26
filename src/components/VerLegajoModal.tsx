import { useState, useEffect } from 'react'
import apiService from '../services/api'
import type { LegajoEmpleado, UsuarioRecord } from '../types/api'
import './VerLegajoModal.css'

type VerLegajoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  onClose: () => void
}

const VerLegajoModal = ({ usuario, isOpen, onClose }: VerLegajoModalProps) => {
  const [loading, setLoading] = useState(false)
  const [legajo, setLegajo] = useState<LegajoEmpleado | null>(null)

  useEffect(() => {
    if (isOpen && usuario.id) {
      loadLegajo()
    }
  }, [isOpen, usuario.id])

  const loadLegajo = async () => {
    setLoading(true)
    try {
      const response = await apiService.getLegajoEmpleado(usuario.id)
      if (response.success && response.data) {
        setLegajo(response.data)
      } else {
        setLegajo(null)
      }
    } catch (error) {
      console.error('Error cargando legajo:', error)
      setLegajo(null)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'No especificada'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="ver-legajo-modal-overlay" onClick={onClose}>
      <div className="ver-legajo-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ver-legajo-modal-header">
          <h2>📋 Legajo de Empleado</h2>
          <button className="ver-legajo-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="ver-legajo-loading">
            <div className="spinner"></div>
            <p>Cargando legajo...</p>
          </div>
        ) : !legajo ? (
          <div className="ver-legajo-empty">
            <p>⚠️ No se encontró información del legajo para este empleado.</p>
            <p className="ver-legajo-empty-hint">
              El legajo aún no ha sido creado. Contacta a Recursos Humanos para completar la información.
            </p>
          </div>
        ) : (
          <div className="ver-legajo-body">
            {/* Foto del empleado */}
            {legajo.foto_url && (
              <div className="ver-legajo-photo-section">
                <img 
                  src={legajo.foto_url} 
                  alt={`Foto de ${legajo.nombre || usuario.nombre}`}
                  className="ver-legajo-photo"
                />
              </div>
            )}

            {/* Información Personal */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">👤 Información Personal</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Apellido:</span>
                  <span className="ver-legajo-value">
                    {legajo.apellido || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">DNI:</span>
                  <span className="ver-legajo-value">
                    {legajo.dni || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Nacimiento:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_nacimiento)}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Estado Civil:</span>
                  <span className="ver-legajo-value">
                    {legajo.estado_civil || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">📞 Información de Contacto</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.telefono || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Email:</span>
                  <span className="ver-legajo-value">
                    {legajo.email || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Dirección:</span>
                  <span className="ver-legajo-value">
                    {legajo.direccion || 'No especificada'}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Ubicación:</span>
                  <span className="ver-legajo-value">
                    {legajo.ubicacion || 'No especificada'}
                  </span>
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">💼 Información Laboral</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Sector:</span>
                  <span className="ver-legajo-value">
                    {legajo.sector || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Fecha de Ingreso:</span>
                  <span className="ver-legajo-value">
                    {formatDate(legajo.fecha_ingreso)}
                  </span>
                </div>
                <div className="ver-legajo-info-item ver-legajo-full-width">
                  <span className="ver-legajo-label">Funciones:</span>
                  <span className="ver-legajo-value">
                    {legajo.funciones || 'No especificadas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contacto de Emergencia */}
            <div className="ver-legajo-section">
              <h3 className="ver-legajo-section-title">🚨 Contacto de Emergencia</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Nombre:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_nombre || 'No especificado'}
                  </span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Teléfono:</span>
                  <span className="ver-legajo-value">
                    {legajo.contacto_emergencia_telefono || 'No especificado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {legajo.observaciones && (
              <div className="ver-legajo-section">
                <h3 className="ver-legajo-section-title">📝 Observaciones</h3>
                <div className="ver-legajo-observaciones">
                  <p>{legajo.observaciones}</p>
                </div>
              </div>
            )}

            {/* Información del Sistema */}
            <div className="ver-legajo-section ver-legajo-system-info">
              <h3 className="ver-legajo-section-title">ℹ️ Información del Sistema</h3>
              <div className="ver-legajo-grid">
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">ID de Usuario:</span>
                  <span className="ver-legajo-value">{usuario.id}</span>
                </div>
                <div className="ver-legajo-info-item">
                  <span className="ver-legajo-label">Usuario:</span>
                  <span className="ver-legajo-value">{usuario.nombre}</span>
                </div>
                {legajo.created_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Creado:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.created_at)}
                    </span>
                  </div>
                )}
                {legajo.updated_at && (
                  <div className="ver-legajo-info-item">
                    <span className="ver-legajo-label">Última Actualización:</span>
                    <span className="ver-legajo-value">
                      {formatDate(legajo.updated_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de cerrar */}
            <div className="ver-legajo-modal-actions">
              <button className="ver-legajo-btn ver-legajo-btn-primary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerLegajoModal

