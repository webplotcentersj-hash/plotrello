import { useState, useEffect, useRef } from 'react'
import apiService from '../services/api'
import type { LegajoEmpleado, UsuarioRecord } from '../types/api'
import './LegajoEmpleadoModal.css'

type LegajoEmpleadoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const LegajoEmpleadoModal = ({ usuario, isOpen, onClose, onSave }: LegajoEmpleadoModalProps) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [legajo, setLegajo] = useState<Partial<LegajoEmpleado>>({
    id_usuario: usuario.id
  })
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        if (response.data.foto_url) {
          setFotoPreview(response.data.foto_url)
        }
      } else {
        // Si no existe legajo, inicializar con datos básicos del usuario
        setLegajo({
          id_usuario: usuario.id,
          nombre: usuario.nombre.split(' ')[0] || '',
          apellido: usuario.nombre.split(' ').slice(1).join(' ') || ''
        })
      }
    } catch (error) {
      console.error('Error cargando legajo:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen')
      e.target.value = '' // Limpiar input
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB')
      e.target.value = '' // Limpiar input
      return
    }

    // Mostrar preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setFotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Subir foto
    setSaving(true)
    try {
      const uploadResponse = await apiService.uploadFotoEmpleado(file, usuario.id)
      if (uploadResponse.success && uploadResponse.data) {
        setLegajo({ ...legajo, foto_url: uploadResponse.data })
        alert('Foto subida exitosamente')
      } else {
        const errorMsg = uploadResponse.error || 'Error desconocido'
        let userMessage = `Error al subir foto: ${errorMsg}`
        
        // Mensajes de error más descriptivos
        if (errorMsg.includes('row-level security') || errorMsg.includes('RLS')) {
          userMessage = 'Error de permisos. Verifica que las políticas de Storage estén configuradas correctamente.'
        } else if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found')) {
          userMessage = 'El bucket "legajos" no existe. Créalo en Supabase → Storage → New bucket'
        } else if (errorMsg.includes('permission denied')) {
          userMessage = 'Error de permisos. El bucket debe tener políticas RLS configuradas para usuarios autenticados.'
        }
        
        alert(userMessage)
        setFotoPreview(null) // Limpiar preview en caso de error
      }
    } catch (error) {
      console.error('Error subiendo foto:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      let userMessage = `Error al subir la foto: ${errorMessage}`
      
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
        userMessage = 'Error de permisos. Verifica que las políticas de Storage estén configuradas correctamente.'
      }
      
      alert(userMessage)
      setFotoPreview(null) // Limpiar preview en caso de error
    } finally {
      setSaving(false)
      e.target.value = '' // Limpiar input después de procesar
    }
  }

  const handleSave = async () => {
    // Validar campos requeridos
    if (!legajo.nombre || legajo.nombre.trim() === '') {
      alert('El nombre es obligatorio')
      return
    }

    if (!legajo.fecha_ingreso) {
      alert('La fecha de ingreso es obligatoria')
      return
    }

    setSaving(true)
    try {
      // Asegurar que todos los campos se envíen, incluso si están vacíos
      const legajoCompleto: Partial<LegajoEmpleado> = {
        id_usuario: usuario.id,
        nombre: legajo.nombre || null,
        apellido: legajo.apellido || null,
        telefono: legajo.telefono || null,
        ubicacion: legajo.ubicacion || null,
        foto_url: legajo.foto_url || null,
        sector: legajo.sector || null,
        funciones: legajo.funciones || null,
        fecha_ingreso: legajo.fecha_ingreso || null,
        fecha_nacimiento: legajo.fecha_nacimiento || null,
        dni: legajo.dni || null,
        direccion: legajo.direccion || null,
        email: legajo.email || null,
        estado_civil: legajo.estado_civil || null,
        contacto_emergencia_nombre: legajo.contacto_emergencia_nombre || null,
        contacto_emergencia_telefono: legajo.contacto_emergencia_telefono || null,
        observaciones: legajo.observaciones || null
      }

      const response = await apiService.crearActualizarLegajo(usuario.id, legajoCompleto)
      if (response.success) {
        alert('Legajo guardado exitosamente en la base de datos')
        onSave()
        onClose()
      } else {
        console.error('Error del servidor:', response.error)
        alert(`Error al guardar: ${response.error}`)
      }
    } catch (error) {
      console.error('Error guardando legajo:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al guardar el legajo: ${errorMessage}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="legajo-modal-overlay" onClick={onClose}>
      <div className="legajo-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="legajo-modal-header">
          <h2>📋 Legajo de Empleado - {usuario.nombre}</h2>
          <button className="legajo-modal-close" onClick={onClose}>×</button>
        </header>

        {loading ? (
          <div className="legajo-modal-loading">
            <div className="spinner"></div>
            <p>Cargando legajo...</p>
          </div>
        ) : (
          <div className="legajo-modal-body">
            {/* Foto del empleado */}
            <div className="legajo-section legajo-foto-section">
              <label className="legajo-label">Foto del Empleado</label>
              <div className="legajo-foto-container">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Foto empleado" className="legajo-foto-preview" />
                ) : (
                  <div className="legajo-foto-placeholder">
                    <span>📷</span>
                    <p>Sin foto</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="legajo-file-input"
                  id="foto-input"
                />
                <label htmlFor="foto-input" className="legajo-upload-button">
                  {fotoPreview ? 'Cambiar Foto' : 'Subir Foto'}
                </label>
              </div>
            </div>

            {/* Información Personal */}
            <div className="legajo-section">
              <h3 className="legajo-section-title">Información Personal</h3>
              <div className="legajo-form-grid">
                <div className="legajo-form-group">
                  <label className="legajo-label">Nombre *</label>
                  <input
                    type="text"
                    value={legajo.nombre || ''}
                    onChange={(e) => setLegajo({ ...legajo, nombre: e.target.value })}
                    className="legajo-input"
                    placeholder="Nombre"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Apellido</label>
                  <input
                    type="text"
                    value={legajo.apellido || ''}
                    onChange={(e) => setLegajo({ ...legajo, apellido: e.target.value })}
                    className="legajo-input"
                    placeholder="Apellido"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">DNI</label>
                  <input
                    type="text"
                    value={legajo.dni || ''}
                    onChange={(e) => setLegajo({ ...legajo, dni: e.target.value })}
                    className="legajo-input"
                    placeholder="DNI"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    value={legajo.fecha_nacimiento || ''}
                    onChange={(e) => setLegajo({ ...legajo, fecha_nacimiento: e.target.value })}
                    className="legajo-input"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Estado Civil</label>
                  <select
                    value={legajo.estado_civil || ''}
                    onChange={(e) => setLegajo({ ...legajo, estado_civil: e.target.value })}
                    className="legajo-input"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Soltero/a">Soltero/a</option>
                    <option value="Casado/a">Casado/a</option>
                    <option value="Divorciado/a">Divorciado/a</option>
                    <option value="Viudo/a">Viudo/a</option>
                    <option value="Unión Libre">Unión Libre</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Información de Contacto */}
            <div className="legajo-section">
              <h3 className="legajo-section-title">Información de Contacto</h3>
              <div className="legajo-form-grid">
                <div className="legajo-form-group">
                  <label className="legajo-label">Teléfono</label>
                  <input
                    type="tel"
                    value={legajo.telefono || ''}
                    onChange={(e) => setLegajo({ ...legajo, telefono: e.target.value })}
                    className="legajo-input"
                    placeholder="Teléfono"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Email</label>
                  <input
                    type="email"
                    value={legajo.email || ''}
                    onChange={(e) => setLegajo({ ...legajo, email: e.target.value })}
                    className="legajo-input"
                    placeholder="Email"
                  />
                </div>
                <div className="legajo-form-group legajo-form-group-full">
                  <label className="legajo-label">Dirección</label>
                  <input
                    type="text"
                    value={legajo.direccion || ''}
                    onChange={(e) => setLegajo({ ...legajo, direccion: e.target.value })}
                    className="legajo-input"
                    placeholder="Dirección completa"
                  />
                </div>
                <div className="legajo-form-group legajo-form-group-full">
                  <label className="legajo-label">Ubicación</label>
                  <input
                    type="text"
                    value={legajo.ubicacion || ''}
                    onChange={(e) => setLegajo({ ...legajo, ubicacion: e.target.value })}
                    className="legajo-input"
                    placeholder="Ubicación o ciudad"
                  />
                </div>
              </div>
            </div>

            {/* Información Laboral */}
            <div className="legajo-section">
              <h3 className="legajo-section-title">Información Laboral</h3>
              <div className="legajo-form-grid">
                <div className="legajo-form-group">
                  <label className="legajo-label">Sector</label>
                  <input
                    type="text"
                    value={legajo.sector || ''}
                    onChange={(e) => setLegajo({ ...legajo, sector: e.target.value })}
                    className="legajo-input"
                    placeholder="Sector de trabajo"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Fecha de Ingreso *</label>
                  <input
                    type="date"
                    value={legajo.fecha_ingreso || ''}
                    onChange={(e) => setLegajo({ ...legajo, fecha_ingreso: e.target.value })}
                    className="legajo-input"
                    required
                  />
                </div>
                <div className="legajo-form-group legajo-form-group-full">
                  <label className="legajo-label">Funciones</label>
                  <textarea
                    value={legajo.funciones || ''}
                    onChange={(e) => setLegajo({ ...legajo, funciones: e.target.value })}
                    className="legajo-textarea"
                    placeholder="Descripción de funciones y responsabilidades del empleado"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Contacto de Emergencia */}
            <div className="legajo-section">
              <h3 className="legajo-section-title">Contacto de Emergencia</h3>
              <div className="legajo-form-grid">
                <div className="legajo-form-group">
                  <label className="legajo-label">Nombre</label>
                  <input
                    type="text"
                    value={legajo.contacto_emergencia_nombre || ''}
                    onChange={(e) => setLegajo({ ...legajo, contacto_emergencia_nombre: e.target.value })}
                    className="legajo-input"
                    placeholder="Nombre del contacto"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Teléfono</label>
                  <input
                    type="tel"
                    value={legajo.contacto_emergencia_telefono || ''}
                    onChange={(e) => setLegajo({ ...legajo, contacto_emergencia_telefono: e.target.value })}
                    className="legajo-input"
                    placeholder="Teléfono del contacto"
                  />
                </div>
              </div>
            </div>

            {/* Observaciones */}
            <div className="legajo-section">
              <h3 className="legajo-section-title">Observaciones</h3>
              <div className="legajo-form-group legajo-form-group-full">
                <textarea
                  value={legajo.observaciones || ''}
                  onChange={(e) => setLegajo({ ...legajo, observaciones: e.target.value })}
                  className="legajo-textarea"
                  placeholder="Notas adicionales sobre el empleado"
                  rows={3}
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="legajo-modal-actions">
              <button className="legajo-btn legajo-btn-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button className="legajo-btn legajo-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Legajo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LegajoEmpleadoModal

