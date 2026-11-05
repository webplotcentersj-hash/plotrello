import { useState, useEffect, useRef } from 'react'
import { nombreVisibleDesdeRecord } from '../utils/usuarioDisplayName'
import apiService from '../services/api'
import { rrhhPuestosListar } from '../services/rrhhExtendidoService'
import type {
  LegajoConyugeDetalle,
  LegajoEmpleado,
  LegajoPersonaACargo,
  RrhhPuesto,
  UsuarioRecord
} from '../types/api'
import { CCTS_PLOT, cctEnConvenio } from '../utils/rrhhLibroSueldos'
import { isoToArgentinaDateKey } from '../utils/dateUtils'
import './LegajoEmpleadoModal.css'

const TIPOS_SERVICIO = [
  'Jornada completa',
  'Medio día',
  'Por hora',
  'Por tarea',
  'Otro'
] as const

const MODOS_LIQUIDACION = ['Mensual', 'Quincenal', 'Semanal', 'Diario'] as const

const MODALIDADES_CONTRATO = [
  { value: '001', label: '001 · Tiempo indeterminado' },
  { value: '008', label: '008 · Tiempo parcial' },
  { value: '102', label: '102 · Contrato a plazo fijo' },
  { value: '999', label: '999 · Otra' }
] as const

type LegajoEmpleadoModalProps = {
  usuario: UsuarioRecord
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  onDarDeBaja?: () => void
}

const LegajoEmpleadoModal = ({ usuario, isOpen, onClose, onSave, onDarDeBaja }: LegajoEmpleadoModalProps) => {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [legajo, setLegajo] = useState<Partial<LegajoEmpleado>>({
    id_usuario: usuario.id
  })
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [puestos, setPuestos] = useState<RrhhPuesto[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && usuario.id) {
      loadLegajo()
      void rrhhPuestosListar().then((res) => {
        if (res.success && res.data) {
          setPuestos(res.data.filter((p) => p.activo !== false))
        }
      })
    }
  }, [isOpen, usuario.id])

  const loadLegajo = async () => {
    setLoading(true)
    try {
      const response = await apiService.getLegajoEmpleado(usuario.id)
      if (response.success && response.data) {
        const d = response.data
        let personas = Array.isArray(d.personas_a_cargo) ? [...d.personas_a_cargo] : []
        // Migración suave: si había solo el contador hijos, armar filas vacías para completar.
        if (personas.length === 0 && d.hijos != null && d.hijos > 0) {
          personas = Array.from({ length: Math.min(d.hijos, 20) }, (_, i) => ({
            id: `p-seed-${i}`,
            nombre: '',
            apellido: '',
            fecha_nacimiento: null
          }))
        }
        setLegajo({
          ...d,
          fecha_ingreso: d.fecha_ingreso
            ? isoToArgentinaDateKey(String(d.fecha_ingreso)) || d.fecha_ingreso
            : d.fecha_ingreso,
          fecha_nacimiento: d.fecha_nacimiento
            ? isoToArgentinaDateKey(String(d.fecha_nacimiento)) || d.fecha_nacimiento
            : d.fecha_nacimiento,
          conyuge_detalle: d.conyuge
            ? d.conyuge_detalle || { nombre: '', apellido: '', edad: null }
            : null,
          personas_a_cargo: personas,
          hijos: personas.length
        })
        if (d.foto_url) {
          setFotoPreview(d.foto_url)
        }
      } else {
        // Si no existe legajo, inicializar vacío (el nombre de usuario se muestra aparte en el header)
        setLegajo({
          id_usuario: usuario.id
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
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, etc.)')
      e.target.value = '' // Limpiar input
      return
    }

    // Validar tamaño (máximo 10MB para fotos de legajos)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      alert(`La imagen es demasiado grande (${sizeMB}MB). El tamaño máximo permitido es 10MB. Por favor, comprime la imagen o selecciona otra.`)
      e.target.value = '' // Limpiar input
      return
    }

    // Mostrar información del archivo
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
    console.log(`📸 Archivo seleccionado: ${file.name}, Tamaño: ${sizeMB}MB, Tipo: ${file.type}`)

    // Mostrar preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setFotoPreview(reader.result as string)
    }
    reader.onerror = () => {
      alert('Error al leer el archivo. Por favor, intenta con otra imagen.')
      e.target.value = ''
    }
    reader.readAsDataURL(file)

    // Subir foto
    setSaving(true)
    try {
      console.log('📤 Iniciando subida de foto...')
      const uploadResponse = await apiService.uploadFotoEmpleado(file, usuario.id)
      
      if (uploadResponse.success && uploadResponse.data) {
        const next = { ...legajo, foto_url: uploadResponse.data }
        setLegajo(next)
        setFotoPreview(uploadResponse.data)
        // Persistir URL de inmediato (no hace falta pulsar Guardar solo por la foto)
        try {
          await apiService.crearActualizarLegajo(usuario.id, {
            ...next,
            id_usuario: usuario.id,
            foto_url: uploadResponse.data
          })
        } catch (persistErr) {
          console.warn('Foto subida pero no se pudo persistir en legajo aún:', persistErr)
        }
        alert('✅ Foto subida y guardada en el legajo')
        console.log('✅ Foto guardada en:', uploadResponse.data)
      } else {
        const errorMsg = uploadResponse.error || 'Error desconocido'
        let userMessage = `Error al subir foto: ${errorMsg}`
        
        // Mensajes de error más descriptivos
        if (errorMsg.includes('row-level security') || errorMsg.includes('RLS') || errorMsg.includes('permisos')) {
          userMessage = 'Error de permisos. Verifica que estés autenticado correctamente. Si el problema persiste, contacta al administrador.'
        } else if (errorMsg.includes('Bucket not found') || errorMsg.includes('not found')) {
          userMessage = 'El bucket "legajos" no existe. Contacta al administrador del sistema.'
        } else if (errorMsg.includes('permission denied') || errorMsg.includes('denied')) {
          userMessage = 'Error de permisos. No tienes permisos para subir archivos. Contacta al administrador.'
        } else if (errorMsg.includes('size') || errorMsg.includes('tamaño')) {
          userMessage = `El archivo es demasiado grande. Tamaño máximo: 10MB. Tu archivo: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
        }
        
        console.error('❌ Error al subir foto:', errorMsg)
        alert(userMessage)
        setFotoPreview(null) // Limpiar preview en caso de error
      }
    } catch (error) {
      console.error('❌ Error subiendo foto:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      let userMessage = `Error al subir la foto: ${errorMessage}`
      
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS') || errorMessage.includes('permisos')) {
        userMessage = 'Error de permisos. Verifica que estés autenticado correctamente.'
      } else if (errorMessage.includes('Network') || errorMessage.includes('network')) {
        userMessage = 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
      }
      
      alert(userMessage)
      setFotoPreview(null) // Limpiar preview en caso de error
    } finally {
      setSaving(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = '' // Limpiar input después de procesar
      }
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
        cuil: legajo.cuil || null,
        n_legajo:
          legajo.n_legajo != null && Number.isFinite(Number(legajo.n_legajo)) && Number(legajo.n_legajo) > 0
            ? Math.floor(Number(legajo.n_legajo))
            : null,
        banco: legajo.banco || null,
        cbu: legajo.cbu || null,
        conyuge: !!legajo.conyuge,
        conyuge_detalle: legajo.conyuge
          ? {
              nombre: String(legajo.conyuge_detalle?.nombre || '').trim(),
              apellido: String(legajo.conyuge_detalle?.apellido || '').trim(),
              edad:
                legajo.conyuge_detalle?.edad != null &&
                Number.isFinite(Number(legajo.conyuge_detalle.edad))
                  ? Math.floor(Number(legajo.conyuge_detalle.edad))
                  : null
            }
          : null,
        personas_a_cargo: (legajo.personas_a_cargo || []).map((p) => ({
          id: p.id || `p-${Math.random().toString(36).slice(2, 9)}`,
          nombre: String(p.nombre || '').trim(),
          apellido: String(p.apellido || '').trim(),
          fecha_nacimiento: p.fecha_nacimiento || null
        })),
        hijos: (legajo.personas_a_cargo || []).length,
        obra_social: legajo.obra_social || null,
        codigo_os: legajo.codigo_os || null,
        tipo_servicio: legajo.tipo_servicio || null,
        categoria: legajo.categoria || null,
        puesto: legajo.puesto || null,
        id_puesto:
          legajo.id_puesto != null && Number.isFinite(Number(legajo.id_puesto)) && Number(legajo.id_puesto) > 0
            ? Math.floor(Number(legajo.id_puesto))
            : null,
        retribucion_pactada:
          legajo.retribucion_pactada != null && Number.isFinite(Number(legajo.retribucion_pactada))
            ? Number(legajo.retribucion_pactada)
            : null,
        modo_liquidacion: legajo.modo_liquidacion || null,
        modalidad_contrato: legajo.modalidad_contrato || null,
        convenio_cct: legajo.convenio_cct || null,
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
    <div
      className="legajo-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="legajo-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="legajo-modal-header">
          <h2>📋 Legajo de Empleado - {nombreVisibleDesdeRecord(usuario)}</h2>
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
                  <label className="legajo-label">CUIT / CUIL</label>
                  <input
                    type="text"
                    value={legajo.cuil || ''}
                    onChange={(e) => setLegajo({ ...legajo, cuil: e.target.value })}
                    className="legajo-input"
                    placeholder="XX-XXXXXXXX-X"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Legajo AFIP</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={legajo.n_legajo != null && legajo.n_legajo > 0 ? legajo.n_legajo : ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      setLegajo({
                        ...legajo,
                        n_legajo: raw === '' ? null : Math.floor(Number(raw)) || null
                      })
                    }}
                    className="legajo-input"
                    placeholder="Número"
                    inputMode="numeric"
                    autoComplete="off"
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
                <div className="legajo-form-group">
                  <label className="legajo-label">Banco</label>
                  <input
                    type="text"
                    value={legajo.banco || ''}
                    onChange={(e) => setLegajo({ ...legajo, banco: e.target.value })}
                    className="legajo-input"
                    placeholder="Banco de cobro"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">CBU</label>
                  <input
                    type="text"
                    value={legajo.cbu || ''}
                    onChange={(e) => setLegajo({ ...legajo, cbu: e.target.value.replace(/\D/g, '').slice(0, 22) })}
                    className="legajo-input"
                    placeholder="22 dígitos"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={22}
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Cónyuge a cargo</label>
                  <select
                    value={legajo.conyuge ? 'si' : 'no'}
                    onChange={(e) => {
                      const si = e.target.value === 'si'
                      setLegajo({
                        ...legajo,
                        conyuge: si,
                        conyuge_detalle: si
                          ? legajo.conyuge_detalle || { nombre: '', apellido: '', edad: null }
                          : null
                      })
                    }}
                    className="legajo-input"
                  >
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                {legajo.conyuge ? (
                  <>
                    <div className="legajo-form-group">
                      <label className="legajo-label">Cónyuge · Nombre</label>
                      <input
                        type="text"
                        value={legajo.conyuge_detalle?.nombre || ''}
                        onChange={(e) =>
                          setLegajo({
                            ...legajo,
                            conyuge_detalle: {
                              ...(legajo.conyuge_detalle || { apellido: '', edad: null }),
                              nombre: e.target.value
                            } as LegajoConyugeDetalle
                          })
                        }
                        className="legajo-input"
                        placeholder="Nombre"
                        autoComplete="off"
                      />
                    </div>
                    <div className="legajo-form-group">
                      <label className="legajo-label">Cónyuge · Apellido</label>
                      <input
                        type="text"
                        value={legajo.conyuge_detalle?.apellido || ''}
                        onChange={(e) =>
                          setLegajo({
                            ...legajo,
                            conyuge_detalle: {
                              ...(legajo.conyuge_detalle || { nombre: '', edad: null }),
                              apellido: e.target.value
                            } as LegajoConyugeDetalle
                          })
                        }
                        className="legajo-input"
                        placeholder="Apellido"
                        autoComplete="off"
                      />
                    </div>
                    <div className="legajo-form-group">
                      <label className="legajo-label">Cónyuge · Edad</label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        step={1}
                        value={
                          legajo.conyuge_detalle?.edad != null &&
                          Number.isFinite(Number(legajo.conyuge_detalle.edad))
                            ? legajo.conyuge_detalle.edad
                            : ''
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim()
                          setLegajo({
                            ...legajo,
                            conyuge_detalle: {
                              ...(legajo.conyuge_detalle || { nombre: '', apellido: '' }),
                              edad: raw === '' ? null : Math.floor(Number(raw)) || null
                            } as LegajoConyugeDetalle
                          })
                        }}
                        className="legajo-input"
                        placeholder="Años"
                        inputMode="numeric"
                      />
                    </div>
                  </>
                ) : null}
                <div className="legajo-form-group legajo-form-group-full">
                  <div className="legajo-familia-head">
                    <label className="legajo-label">
                      Personas a cargo ({(legajo.personas_a_cargo || []).length})
                    </label>
                    <button
                      type="button"
                      className="legajo-btn legajo-btn-secondary legajo-btn-sm"
                      onClick={() => {
                        const next: LegajoPersonaACargo = {
                          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          nombre: '',
                          apellido: '',
                          fecha_nacimiento: null
                        }
                        const list = [...(legajo.personas_a_cargo || []), next]
                        setLegajo({ ...legajo, personas_a_cargo: list, hijos: list.length })
                      }}
                    >
                      + Agregar persona
                    </button>
                  </div>
                  {(legajo.personas_a_cargo || []).length === 0 ? (
                    <p className="legajo-hint">Sin personas a cargo cargadas.</p>
                  ) : (
                    <div className="legajo-familia-list">
                      {(legajo.personas_a_cargo || []).map((p, idx) => (
                        <div key={p.id} className="legajo-familia-row">
                          <span className="legajo-familia-idx">#{idx + 1}</span>
                          <input
                            type="text"
                            className="legajo-input"
                            placeholder="Nombre"
                            value={p.nombre}
                            onChange={(e) => {
                              const list = (legajo.personas_a_cargo || []).map((x) =>
                                x.id === p.id ? { ...x, nombre: e.target.value } : x
                              )
                              setLegajo({ ...legajo, personas_a_cargo: list, hijos: list.length })
                            }}
                          />
                          <input
                            type="text"
                            className="legajo-input"
                            placeholder="Apellido"
                            value={p.apellido}
                            onChange={(e) => {
                              const list = (legajo.personas_a_cargo || []).map((x) =>
                                x.id === p.id ? { ...x, apellido: e.target.value } : x
                              )
                              setLegajo({ ...legajo, personas_a_cargo: list, hijos: list.length })
                            }}
                          />
                          <input
                            type="date"
                            className="legajo-input"
                            value={p.fecha_nacimiento || ''}
                            onChange={(e) => {
                              const list = (legajo.personas_a_cargo || []).map((x) =>
                                x.id === p.id
                                  ? { ...x, fecha_nacimiento: e.target.value || null }
                                  : x
                              )
                              setLegajo({ ...legajo, personas_a_cargo: list, hijos: list.length })
                            }}
                            title="Fecha de nacimiento"
                          />
                          <button
                            type="button"
                            className="legajo-btn legajo-btn-danger legajo-btn-sm"
                            onClick={() => {
                              const list = (legajo.personas_a_cargo || []).filter((x) => x.id !== p.id)
                              setLegajo({ ...legajo, personas_a_cargo: list, hijos: list.length })
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                <div className="legajo-form-group">
                  <label className="legajo-label">Puesto</label>
                  <select
                    value={legajo.id_puesto != null && legajo.id_puesto > 0 ? String(legajo.id_puesto) : ''}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null
                      const p = puestos.find((x) => x.id === id)
                      setLegajo({
                        ...legajo,
                        id_puesto: id,
                        puesto: p?.nombre || legajo.puesto || null,
                        sector: legajo.sector || p?.sector || null
                      })
                    }}
                    className="legajo-input"
                  >
                    <option value="">Seleccionar puesto…</option>
                    {puestos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {p.sector ? ` · ${p.sector}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Puesto (texto)</label>
                  <input
                    type="text"
                    value={legajo.puesto || ''}
                    onChange={(e) => setLegajo({ ...legajo, puesto: e.target.value })}
                    className="legajo-input"
                    placeholder="Si no está en el listado"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Categoría</label>
                  <input
                    type="text"
                    value={legajo.categoria || ''}
                    onChange={(e) => setLegajo({ ...legajo, categoria: e.target.value })}
                    className="legajo-input"
                    placeholder="Ej. Administrativo 1°"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Tipo de servicio</label>
                  <select
                    value={legajo.tipo_servicio || ''}
                    onChange={(e) => setLegajo({ ...legajo, tipo_servicio: e.target.value || null })}
                    className="legajo-input"
                  >
                    <option value="">Seleccionar…</option>
                    {TIPOS_SERVICIO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Obra social</label>
                  <input
                    type="text"
                    value={legajo.obra_social || ''}
                    onChange={(e) => setLegajo({ ...legajo, obra_social: e.target.value })}
                    className="legajo-input"
                    placeholder="Nombre de la obra social"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Código OS (AFIP)</label>
                  <input
                    type="text"
                    value={legajo.codigo_os || ''}
                    onChange={(e) => setLegajo({ ...legajo, codigo_os: e.target.value })}
                    className="legajo-input"
                    placeholder="000000"
                    autoComplete="off"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Retribución pactada</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={
                      legajo.retribucion_pactada != null && Number.isFinite(Number(legajo.retribucion_pactada))
                        ? legajo.retribucion_pactada
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      setLegajo({
                        ...legajo,
                        retribucion_pactada: raw === '' ? null : Number(raw)
                      })
                    }}
                    className="legajo-input"
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Modo de liquidación</label>
                  <select
                    value={legajo.modo_liquidacion || ''}
                    onChange={(e) => setLegajo({ ...legajo, modo_liquidacion: e.target.value || null })}
                    className="legajo-input"
                  >
                    <option value="">Seleccionar…</option>
                    {MODOS_LIQUIDACION.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Modalidad de contrato</label>
                  <select
                    value={legajo.modalidad_contrato || ''}
                    onChange={(e) => setLegajo({ ...legajo, modalidad_contrato: e.target.value || null })}
                    className="legajo-input"
                  >
                    <option value="">Seleccionar…</option>
                    {MODALIDADES_CONTRATO.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="legajo-form-group">
                  <label className="legajo-label">Convenio (CCT)</label>
                  <input
                    list="legajo-ccts"
                    value={legajo.convenio_cct || ''}
                    onChange={(e) => setLegajo({ ...legajo, convenio_cct: e.target.value || null })}
                    className="legajo-input"
                    placeholder="0409/05"
                    autoComplete="off"
                  />
                  <datalist id="legajo-ccts">
                    {CCTS_PLOT.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.label}
                      </option>
                    ))}
                  </datalist>
                  {legajo.convenio_cct ? (
                    <small className="legajo-hint">
                      {cctEnConvenio(legajo.convenio_cct) ? 'En convenio' : 'Excluido de convenio'}
                    </small>
                  ) : null}
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
              {onDarDeBaja ? (
                <button
                  type="button"
                  className="legajo-btn legajo-btn-danger"
                  onClick={onDarDeBaja}
                  disabled={saving}
                >
                  Dar de Baja
                </button>
              ) : (
                <span />
              )}
              <div className="legajo-modal-actions-right">
                <button className="legajo-btn legajo-btn-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button className="legajo-btn legajo-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Legajo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LegajoEmpleadoModal

