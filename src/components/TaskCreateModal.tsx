import { useEffect, useRef, useState } from 'react'
import type { Task, TeamMember, TaskStatus } from '../types/board'
import type { MaterialRecord, SectorRecord } from '../types/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { useAuth } from '../hooks/useAuth'
import './TaskEditModal.css'

type TaskCreateModalProps = {
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materiales: MaterialRecord[]
  onClose: () => void
  onCreate: (newTask: Omit<Task, 'id'>, options?: { openChecklist?: boolean }) => Promise<void>
}

type LocalAttachment = {
  id: string
  name: string
  previewUrl: string
  remoteUrl?: string
  uploading: boolean
}

const COMPLEXITY_OPTIONS = ['Baja', 'Media', 'Alta']
const PRIORITY_OPTIONS = ['Normal', 'Alta', 'Media', 'Baja']

const stripEmailDomain = (value?: string | null) => {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const atIndex = trimmed.indexOf('@')
  return atIndex > 0 ? trimmed.slice(0, atIndex) : trimmed
}

const TaskCreateModal = ({
  teamMembers,
  sectores,
  materiales,
  onClose,
  onCreate
}: TaskCreateModalProps) => {
  const { usuario } = useAuth()
  
  // Sectores válidos que coinciden con las columnas del Kanban
  const sectoresKanban = [
    'Diseño Gráfico',
    'Diseño en Proceso',
    'En Espera',
    'Imprenta (Área de Impresión)',
    'Taller de Imprenta',
    'Taller Gráfico',
    'Instalaciones',
    'Metalúrgica',
    'Finalizado en Taller',
    'Almacén de Entrega'
  ]
  
  // Filtrar sectores para que solo muestre los que coinciden con las columnas del Kanban
  const sectoresValidos = sectores.filter((s) => sectoresKanban.includes(s.nombre))
  
  const [opNumber, setOpNumber] = useState('')
  const [cliente, setCliente] = useState('')
  const [dniCuit, setDniCuit] = useState('')
  const [telefonoCliente, setTelefonoCliente] = useState('')
  const [emailCliente, setEmailCliente] = useState('')
  const [direccionCliente, setDireccionCliente] = useState('')
  const [ubicacionUrl, setUbicacionUrl] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [horaEstimada, setHoraEstimada] = useState('')
  const [selectedSectores, setSelectedSectores] = useState<string[]>([])
  const [sectorSearch, setSectorSearch] = useState('')
  const [operario, setOperario] = useState<string>('')
  const [complejidad, setComplejidad] = useState<string>('Media')
  const [prioridad, setPrioridad] = useState<string>('Normal')
  const [descripcion, setDescripcion] = useState('')
  const [materials, setMaterials] = useState<Array<{ name: string; quantity: number }>>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false)
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false)
  const attachmentsRef = useRef<LocalAttachment[]>([])

  // No necesitamos sector inicial, se crean automáticamente para cada sector requerido

  useEffect(() => {
    if (!operario && teamMembers.length > 0) {
      setOperario(teamMembers[0].id)
    }
  }, [teamMembers, operario])

  const hasPendingUploads = attachments.some((attachment) => attachment.uploading)

  const handleCreate = async (openChecklist = false) => {
    if (!opNumber || !cliente) {
      alert('Por favor completa los campos obligatorios: N° OP y Cliente')
      return
    }

    // Requerir al menos un sector
    if (selectedSectores.length === 0) {
      alert('Por favor selecciona al menos un sector requerido')
      return
    }

    if (hasPendingUploads) {
      alert('Espera a que termine la subida de archivos antes de crear la orden.')
      return
    }

    const dueDate = fechaEntrega
      ? horaEstimada
        ? new Date(`${fechaEntrega}T${horaEstimada}`).toISOString()
        : new Date(`${fechaEntrega}T00:00`).toISOString()
      : new Date().toISOString()

    const creatorName = stripEmailDomain(usuario?.nombre) ?? usuario?.nombre ?? 'Usuario'

    // Mapear el primer sector al status correspondiente (la primera ficha aparecerá ahí)
    const mapSectorToStatus = (sector: string): TaskStatus => {
      const sectorMap: Record<string, TaskStatus> = {
        'Diseño Gráfico': 'diseno-grafico',
        'Diseño en Proceso': 'diseno-proceso',
        'En Espera': 'en-espera',
        'Imprenta (Área de Impresión)': 'imprenta',
        'Taller de Imprenta': 'taller-imprenta',
        'Taller Gráfico': 'taller-grafico',
        'Instalaciones': 'instalaciones',
        'Metalúrgica': 'metalurgica',
        'Finalizado en Taller': 'finalizado-taller',
        'Almacén de Entrega': 'almacen-entrega'
      }
      return sectorMap[sector] || 'diseno-grafico'
    }

    // El primer sector es donde aparecerá la primera ficha (se crearán automáticamente las demás)
    const primerSector = selectedSectores[0]

    const newTask: Omit<Task, 'id'> = {
      opNumber,
      title: cliente,
      dniCuit: dniCuit.trim() || undefined,
      summary: descripcion || 'Sin descripción.',
      status: mapSectorToStatus(primerSector),
      priority: (prioridad.toLowerCase() === 'normal' ? 'media' : prioridad.toLowerCase()) as any,
      ownerId: operario || teamMembers[0]?.id || '',
      createdBy: creatorName,
      materials: materials.map((m) => m.name),
      assignedSector: primerSector, // Primer sector (se crearán automáticamente las demás)
      sectores: selectedSectores, // Array de sectores requeridos - se crearán N fichas automáticamente
      esSubTarea: false, // Es ficha principal
      photoUrl: photoUrl || '',
      tags,
      storyPoints: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      dueDate,
      updatedAt: new Date().toISOString(),
      impact: 'media',
      clientPhone: telefonoCliente.trim() || undefined,
      clientEmail: emailCliente.trim() || undefined,
      clientAddress: direccionCliente.trim() || undefined,
      // El link de WhatsApp se genera automáticamente a partir del teléfono en el mapper
      locationUrl: ubicacionUrl.trim() || undefined,
      driveUrl: driveUrl.trim() || undefined
    }

    await onCreate(newTask, { openChecklist })
    onClose()
  }

  const addMaterial = (nombre: string) => {
    if (nombre.length < 2) return
    if (materials.some((m) => m.name.toLowerCase() === nombre.toLowerCase())) return
    setMaterials([...materials, { name: nombre, quantity: 1 }])
  }

  const handleAddMaterial = () => {
    if (materialSearch.trim().length === 0) return
    addMaterial(materialSearch.trim())
    setMaterialSearch('')
    setIsMaterialDropdownOpen(false)
  }

  const handleSelectMaterial = (material: MaterialRecord) => {
    const label = material.descripcion || material.codigo
    if (!label) return
    addMaterial(label)
    setMaterialSearch('')
    setIsMaterialDropdownOpen(false)
  }

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index))
  }

  const handleAddTag = () => {
    const value = tagInput.trim()
    if (!value) return
    if (tags.includes(value)) return
    setTags((prev) => [...prev, value])
    setTagInput('')
  }

  const handleRemoveTag = (value: string) => {
    setTags((prev) => prev.filter((t) => t !== value))
  }

  const handleToggleSector = (sector: string) => {
    if (selectedSectores.includes(sector)) {
      // Remover sector
      const newSectores = selectedSectores.filter((s) => s !== sector)
      setSelectedSectores(newSectores)
    } else {
      // Agregar sector
      const newSectores = [...selectedSectores, sector]
      setSelectedSectores(newSectores)
    }
    setSectorSearch('')
    setIsSectorDropdownOpen(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setUploadError(null)

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      setAttachments((prev) => [...prev, { id, name: file.name, previewUrl, uploading: true }])

      try {
        const remoteUrl = await uploadAttachmentAndGetUrl(file, 'capturas')
        setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === id ? { ...attachment, remoteUrl, uploading: false } : attachment
          )
        )
      } catch (error) {
        console.error('Error subiendo archivo', error)
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        
        // Mensajes de error más específicos
        let userMessage = 'No se pudo subir el archivo.'
        if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
          userMessage = `El bucket "archivos" no existe. Créalo en Supabase → Storage → New bucket (debe ser público)`
        } else if (errorMessage.includes('permission denied') || errorMessage.includes('row-level security')) {
          userMessage = 'Error de permisos. El bucket debe ser público. Ve a Supabase → Storage → archivos → Policies'
        } else {
          userMessage = `Error: ${errorMessage}`
        }
        
        setUploadError(userMessage)
        setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl)
        }
      }
    }

    event.target.value = ''
  }

  const handleRemoveFile = (attachmentId: string) => {
    setAttachments((prev) => {
      const toRemove = prev.find((item) => item.id === attachmentId)
      if (toRemove?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      return prev.filter((item) => item.id !== attachmentId)
    })
  }

  useEffect(() => {
    attachmentsRef.current = attachments
    const firstReady = attachments.find((attachment) => attachment.remoteUrl && !attachment.uploading)
    setPhotoUrl(firstReady?.remoteUrl ?? '')
  }, [attachments])

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
    }
  }, [])

  const normalizedSectorQuery = sectorSearch.trim().toLowerCase()
  const filteredSectors = sectoresValidos
    .filter((sector) =>
      normalizedSectorQuery ? sector.nombre.toLowerCase().includes(normalizedSectorQuery) : true
    )
    .slice(0, normalizedSectorQuery ? 12 : 7)

  const normalizedMaterialQuery = materialSearch.trim().toLowerCase()
  const filteredMaterials = materiales
    .filter((material) => {
      if (!normalizedMaterialQuery) return true
      const descripcion = material.descripcion?.toLowerCase() ?? ''
      const codigo = material.codigo?.toLowerCase() ?? ''
      return descripcion.includes(normalizedMaterialQuery) || codigo.includes(normalizedMaterialQuery)
    })
    .slice(0, normalizedMaterialQuery ? 15 : 10)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Agregar Nueva Orden</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>N° OP</label>
              <input
                type="text"
                value={opNumber}
                onChange={(e) => setOpNumber(e.target.value)}
                placeholder=""
              />
            </div>

            <div className="form-group">
              <label>Cliente</label>
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder=""
              />
            </div>

            <div className="form-group">
              <label>DNI / CUIT</label>
              <input
                type="text"
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
                placeholder="Ej: 12345678 o 20-12345678-9"
              />
            </div>
          </div>

        <div className="form-row">
          <div className="form-group">
            <label>Teléfono cliente (opcional)</label>
            <input
              type="text"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              placeholder="+54 9 11 ..."
            />
          </div>
          <div className="form-group">
            <label>Email cliente (opcional)</label>
            <input
              type="email"
              value={emailCliente}
              onChange={(e) => setEmailCliente(e.target.value)}
              placeholder="cliente@correo.com"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Dirección cliente (opcional)</label>
            <input
              type="text"
              value={direccionCliente}
              onChange={(e) => setDireccionCliente(e.target.value)}
              placeholder="Calle, número, ciudad..."
            />
          </div>
          <div className="form-group">
            <label>Link de ubicación (Google Maps) (opcional)</label>
            <input
              type="url"
              value={ubicacionUrl}
              onChange={(e) => setUbicacionUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Link de Drive (opcional)</label>
            <input
              type="url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha Entrega</label>
              <input
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>

            <div className="form-group">
              <label>Hora Estimada</label>
              <input
                type="time"
                value={horaEstimada}
                onChange={(e) => setHoraEstimada(e.target.value)}
                placeholder="--:--"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Sectores requeridos (múltiple selección)</label>
            <input
              type="text"
              placeholder="Buscar sectores..."
              value={sectorSearch}
              onChange={(e) => setSectorSearch(e.target.value)}
              onFocus={() => setIsSectorDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsSectorDropdownOpen(false), 120)}
            />
            {isSectorDropdownOpen && filteredSectors.length > 0 && (
              <div className="dropdown-list">
                {filteredSectors.map((sector) => {
                  const isSelected = selectedSectores.includes(sector.nombre)
                  return (
                    <div
                      key={sector.id}
                      className={`dropdown-item ${isSelected ? 'selected' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        handleToggleSector(sector.nombre)
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ marginRight: '8px' }}
                      />
                      {sector.nombre}
                    </div>
                  )
                })}
              </div>
            )}
            {selectedSectores.length > 0 && (
              <div className="selected-tags" style={{ marginTop: '8px' }}>
                {selectedSectores.map((sector) => (
                  <span key={sector} className="tag selected">
                    {sector}
                    <button
                      type="button"
                      onClick={() => {
                        const newSectores = selectedSectores.filter((s) => s !== sector)
                        setSelectedSectores(newSectores)
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {selectedSectores.length > 0 && (
            <div className="form-group">
              <label>Información</label>
              <div className="info-panel">
                <small>
                  ℹ️ Se crearán {selectedSectores.length} {selectedSectores.length === 1 ? 'ficha' : 'fichas'} (una por sector).
                  Todas comparten el mismo OP #{opNumber || 'XXX'} y se mueven por separado. <br />
                  {selectedSectores.length > 1
                    ? 'Se unifican cuando todas llegan a "Finalizado en Taller".'
                    : 'Si hay un solo sector, la ficha queda en "Finalizado en Taller" sin unificación.'}
                  <br />
                  ✅ El checklist se habilita al crear la ficha. Usa “Crear y abrir checklist” para cargar subtareas al instante.
                </small>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Operario</label>
              <select value={operario} onChange={(e) => setOperario(e.target.value)}>
                <option value="">Seleccionar...</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Complejidad</label>
              <select value={complejidad} onChange={(e) => setComplejidad(e.target.value)}>
                {COMPLEXITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Prioridad</label>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder=""
            />
          </div>

          <div className="form-group">
            <label>Etiquetas (colores automáticos)</label>
            <div className="tag-input-row">
              <input
                type="text"
                placeholder="Ej: Urgente, Cliente VIP..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={handleAddTag}>
                + Agregar
              </button>
            </div>
            {tags.length > 0 && (
              <div className="selected-tags" style={{ marginTop: '8px' }}>
                {tags.map((tag) => (
                  <span key={tag} className="tag selected">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Materiales</label>
            <input
              type="text"
              placeholder="Buscar o seleccionar material..."
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              onFocus={() => setIsMaterialDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsMaterialDropdownOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (filteredMaterials.length > 0) {
                    handleSelectMaterial(filteredMaterials[0])
                  } else {
                    handleAddMaterial()
                  }
                }
              }}
            />
            {isMaterialDropdownOpen && filteredMaterials.length > 0 && (
              <div className="dropdown-list">
                {filteredMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="dropdown-item"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSelectMaterial(material)
                    }}
                  >
                    <div>
                      <strong>{material.descripcion}</strong>
                      {material.codigo && (
                        <div className="dropdown-subtext">{material.codigo}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {materials.length > 0 && (
              <div className="materials-list">
                {materials.map((material, index) => (
                  <div key={index} className="material-item">
                    <span>{material.name}</span>
                    <div className="material-controls">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={material.quantity}
                        onChange={(e) => {
                          const newMaterials = [...materials]
                          newMaterials[index].quantity = parseFloat(e.target.value) || 0
                          setMaterials(newMaterials)
                        }}
                      />
                      <button type="button" onClick={() => handleRemoveMaterial(index)}>
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Archivos (imágenes o PDF)</label>
            {attachments.length > 0 && (
              <div className="attached-files">
                {attachments.map((file) => (
                  <div key={file.id} className="file-item">
                    <div className="file-preview">
                      {file.remoteUrl || file.previewUrl ? (
                        <img src={file.remoteUrl ?? file.previewUrl} alt={file.name} />
                      ) : (
                        <span>{file.name}</span>
                      )}
                      {file.uploading && <span className="upload-pill">Subiendo...</span>}
                    </div>
                    <button
                      type="button"
                      className="delete-file"
                      onClick={() => handleRemoveFile(file.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploadError && <p className="upload-error">{uploadError}</p>}
            <div className="upload-section">
              <label className="upload-button">
                Elegir archivos
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileUpload}
                  hidden
                />
              </label>
              <span className="upload-hint">
                {hasPendingUploads
                  ? 'Subiendo archivo...'
                  : attachments.length === 0
                    ? 'Ningún archivo seleccionado'
                    : `${attachments.length} archivo(s) listo(s)`}
              </span>
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <div className="footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleCreate(true)}
              disabled={hasPendingUploads}
            >
              Crear y abrir checklist
            </button>
            <button
              type="button"
              className="btn-create"
              onClick={() => void handleCreate(false)}
              disabled={hasPendingUploads}
            >
              Agregar Orden
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default TaskCreateModal

