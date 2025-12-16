import { useState, useEffect, useRef, useMemo } from 'react'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import type { ComentarioOrden, HistorialMovimiento, MaterialRecord, SectorRecord } from '../types/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import apiService from '../services/api'
import { parseTaskIdToOrdenId, filterOperariosBySector } from '../utils/dataMappers'
import RevisionesSection from './RevisionesSection'
import TiempoTrabajoSection from './TiempoTrabajoSection'
import BriefLinkSection from './BriefLinkSection'
import './TaskEditModal.css'

type TaskEditModalProps = {
  task: Task | null
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materiales: MaterialRecord[]
  activity: ActivityEvent[]
  onClose: (taskId?: string) => void
  onSave: (updatedTask: Task) => void
  onDelete?: (taskId: string) => void
}

type LocalAttachment = {
  id: string
  name: string
  previewUrl: string
  remoteUrl?: string
  uploading: boolean
  type?: string // MIME type del archivo
  file?: File // Referencia al archivo original para descarga
}

const COMPLEXITY_OPTIONS = ['Baja', 'Media', 'Alta']
const PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja']

const TaskEditModal = ({
  task,
  teamMembers,
  sectores,
  materiales,
  activity,
  onClose,
  onSave,
  onDelete
}: TaskEditModalProps) => {
  const [formData, setFormData] = useState<Partial<Task>>({})
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [materials, setMaterials] = useState<Array<{ name: string; quantity: number }>>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [sectorSearch, setSectorSearch] = useState('')
  const [briefPublico, setBriefPublico] = useState('')
  const [objetivoProyecto, setObjetivoProyecto] = useState('')
  const [publicoObjetivo, setPublicoObjetivo] = useState('')
  const [estiloDiseno, setEstiloDiseno] = useState('')
  const [referencias, setReferencias] = useState('')
  const [deadlineBrief, setDeadlineBrief] = useState('')
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [complexity, setComplexity] = useState<string>('Baja')
  const [estimatedTime, setEstimatedTime] = useState<string>('00:00')
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false)
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false)
  const [fullHistory, setFullHistory] = useState<HistorialMovimiento[]>([])
  const [comentarios, setComentarios] = useState<ComentarioOrden[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const attachmentsRef = useRef<LocalAttachment[]>([])
  const hasPendingUploads = attachments.some((attachment) => attachment.uploading)
  const [previewAttachment, setPreviewAttachment] = useState<LocalAttachment | null>(null)

  const taskHistory = useMemo(() => {
    if (!task) return []
    const fromActivity = activity
      .filter((event) => event.taskId === task.id)
      .map((evt) => ({
        id: parseInt(evt.id),
        id_orden: parseTaskIdToOrdenId(task.id) || 0,
        estado_anterior: evt.from,
        estado_nuevo: evt.to,
        id_usuario: parseInt(evt.actorId),
        timestamp: evt.timestamp,
        comentario: evt.note
      }))
    return [...fullHistory, ...fromActivity]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [activity, task, fullHistory])

  useEffect(() => {
    if (task) {
      setFormData({
        opNumber: task.opNumber,
        title: task.title,
        summary: task.summary || '',
        priority: task.priority,
        ownerId: task.ownerId,
        dueDate: task.dueDate,
        assignedSector: task.assignedSector,
        photoUrl: task.photoUrl,
        clientPhone: task.clientPhone,
        clientEmail: task.clientEmail,
        clientAddress: task.clientAddress,
        // whatsappUrl se recalcula automáticamente a partir del teléfono al guardar
        locationUrl: task.locationUrl,
        driveUrl: task.driveUrl,
        metrosCuadrados: task.metrosCuadrados,
        briefPublico: task.briefPublico,
        objetivoProyecto: task.objetivoProyecto,
        publicoObjetivo: task.publicoObjetivo,
        estiloDiseno: task.estiloDiseno,
        referencias: task.referencias,
        deadlineBrief: task.deadlineBrief
      })
      if (task.sectores && task.sectores.length > 0) {
        setSelectedSectors(task.sectores)
      } else {
        setSelectedSectors(task.assignedSector ? [task.assignedSector] : [])
      }
      setTags(task.tags || [])
      setBriefPublico(task.briefPublico || '')
      setObjetivoProyecto(task.objetivoProyecto || '')
      setPublicoObjetivo(task.publicoObjetivo || '')
      setEstiloDiseno(task.estiloDiseno || '')
      setReferencias(task.referencias || '')
      setDeadlineBrief(task.deadlineBrief || '')
      setMaterials(
        task.materials.map((m) => ({
          name: m,
          quantity: 1
        }))
      )
      setAttachments(
        task.photoUrl
          ? [
              {
                id: 'existing-photo',
                name: task.photoUrl.split('/').pop() || 'Adjunto',
                previewUrl: task.photoUrl,
                remoteUrl: task.photoUrl,
                uploading: false
              }
            ]
          : []
      )
      if (task.dueDate) {
        const date = new Date(task.dueDate)
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        setEstimatedTime(`${hours}:${minutes}`)
      }

      // Cargar historial completo, comentarios y archivos adjuntos
      const ordenId = parseTaskIdToOrdenId(task.id)
      if (ordenId) {
        setLoadingHistory(true)
        Promise.all([
          apiService.getHistorialMovimientos({ ordenId, limit: 500 }),
          apiService.getComentariosOrden(ordenId),
          apiService.getArchivosOrden(ordenId)
        ])
          .then(([histResp, comResp, archivosResp]) => {
            if (histResp.success && histResp.data) {
              setFullHistory(histResp.data as HistorialMovimiento[])
            }
            if (comResp.success && comResp.data) {
              setComentarios(comResp.data as ComentarioOrden[])
            }
            // Cargar archivos adjuntos existentes
            if (archivosResp.success && archivosResp.data) {
              const archivosExistentes: LocalAttachment[] = (archivosResp.data as any[]).map((archivo) => ({
                id: `existing-${archivo.id}`,
                name: archivo.titulo || archivo.url.split('/').pop() || 'Archivo',
                previewUrl: archivo.url,
                remoteUrl: archivo.url,
                uploading: false
              }))
              // Combinar con el photoUrl si existe y no está ya en los archivos
              const archivosCombinados = [...archivosExistentes]
              if (task.photoUrl && !archivosExistentes.some(a => a.remoteUrl === task.photoUrl)) {
                archivosCombinados.push({
                  id: 'existing-photo',
                  name: task.photoUrl.split('/').pop() || 'Adjunto',
                  previewUrl: task.photoUrl,
                  remoteUrl: task.photoUrl,
                  uploading: false
                })
              }
              setAttachments(archivosCombinados)
            } else if (task.photoUrl) {
              // Si no hay archivos pero hay photoUrl, mantener solo el photoUrl
              setAttachments([
                {
                  id: 'existing-photo',
                  name: task.photoUrl.split('/').pop() || 'Adjunto',
                  previewUrl: task.photoUrl,
                  remoteUrl: task.photoUrl,
                  uploading: false
                }
              ])
            }
          })
          .catch((err) => {
            console.error('Error cargando historial/comentarios:', err)
          })
          .finally(() => {
            setLoadingHistory(false)
          })
      }
    } else {
      setFullHistory([])
      setComentarios([])
    }
  }, [task])

  // Filtrar operarios según el sector de la ficha
  const filteredOperarios = useMemo(() => {
    if (!task) return teamMembers
    return filterOperariosBySector(teamMembers, task.assignedSector)
  }, [teamMembers, task])

  if (!task) return null

  const handleSave = async () => {
    if (hasPendingUploads) {
      alert('Espera a que termine la subida de archivos antes de guardar.')
      return
    }

    const updated: Task = {
      ...task,
      ...formData,
      tags,
      materials: materials.map((m) => m.name),
      assignedSector: selectedSectors[0] || task.assignedSector,
      updatedAt: new Date().toISOString(),
      briefPublico: briefPublico.trim() || undefined,
      objetivoProyecto: objetivoProyecto.trim() || undefined,
      publicoObjetivo: publicoObjetivo.trim() || undefined,
      estiloDiseno: estiloDiseno.trim() || undefined,
      referencias: referencias.trim() || undefined,
      deadlineBrief: deadlineBrief || undefined
    } as Task
    
    // Guardar archivos nuevos después de guardar la orden
    const ordenId = parseTaskIdToOrdenId(task.id)
    if (ordenId) {
      // Obtener archivos existentes para comparar
      const archivosExistentesResp = await apiService.getArchivosOrden(ordenId)
      const archivosExistentesUrls = archivosExistentesResp.success && archivosExistentesResp.data
        ? (archivosExistentesResp.data as any[]).map(a => a.url)
        : []
      
      // Guardar solo los archivos nuevos (que no están en la base de datos)
      for (const attachment of attachments) {
        if (attachment.remoteUrl && !attachment.uploading && !archivosExistentesUrls.includes(attachment.remoteUrl)) {
          await apiService.guardarArchivoOrden(ordenId, attachment.name, attachment.remoteUrl)
        }
      }
    }
    
    onSave(updated)
    onClose(task.id)
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return
    const ordenId = parseTaskIdToOrdenId(task.id)
    if (!ordenId) return

    const usuarioNombre = localStorage.getItem('usuario')
      ? JSON.parse(localStorage.getItem('usuario') || '{}').nombre || 'Usuario'
      : 'Usuario'

    setSavingComment(true)
    const response = await apiService.addComentarioOrden(ordenId, newComment.trim(), usuarioNombre)
    if (response.success && response.data) {
      setComentarios((prev) => [response.data as ComentarioOrden, ...prev])
      setNewComment('')
    } else {
      alert(response.error || 'No se pudo agregar el comentario')
    }
    setSavingComment(false)
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

  const handleAddSector = (sector: string) => {
    if (!selectedSectors.includes(sector)) {
      setSelectedSectors([...selectedSectors, sector])
    }
    setSectorSearch('')
    setIsSectorDropdownOpen(false)
  }

  const handleRemoveSector = (sector: string) => {
    setSelectedSectors(selectedSectors.filter((s) => s !== sector))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setUploadError(null)

    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      setAttachments((prev) => [...prev, { 
        id, 
        name: file.name, 
        previewUrl, 
        uploading: true,
        type: file.type,
        file: file
      }])

      try {
        const remoteUrl = await uploadAttachmentAndGetUrl(file, `capturas/${task?.id ?? 'sin-id'}`)
        setAttachments((prev) =>
          prev.map((attachment) =>
            attachment.id === id ? { ...attachment, remoteUrl, uploading: false } : attachment
          )
        )
      } catch (error) {
        console.error('Error subiendo archivo', error)
        setUploadError('No se pudo subir el archivo. Intenta nuevamente.')
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
    if (firstReady?.remoteUrl) {
      setFormData((prev) => ({ ...prev, photoUrl: firstReady.remoteUrl }))
    } else if (attachments.length === 0) {
      setFormData((prev) => ({ ...prev, photoUrl: '' }))
    }
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
  const filteredSectors = sectores
    .filter((sector) => !selectedSectors.includes(sector.nombre))
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
    <div className="modal-overlay" onClick={() => onClose(task?.id)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Editando OP #{formData.opNumber || task.opNumber}</h2>
          <button type="button" className="modal-close" onClick={() => onClose(task?.id)}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {task.photoUrl && (
            <div className="task-photo-preview">
              <img src={task.photoUrl} alt={`Captura OP ${task.opNumber}`} />
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>N° OP</label>
              <input
                type="text"
                value={formData.opNumber || ''}
                onChange={(e) => setFormData({ ...formData, opNumber: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Cliente</label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>DNI / CUIT</label>
              <input
                type="text"
                value={formData.dniCuit || ''}
                onChange={(e) => setFormData({ ...formData, dniCuit: e.target.value })}
                placeholder="Ej: 12345678 o 20-12345678-9"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha Entrega</label>
              <input
                type="date"
                value={
                  formData.dueDate
                    ? new Date(formData.dueDate).toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) => {
                  const dateStr = e.target.value
                  const timeStr = estimatedTime || '00:00'
                  const [hours, minutes] = timeStr.split(':')
                  const fullDate = new Date(dateStr)
                  fullDate.setHours(parseInt(hours), parseInt(minutes))
                  setFormData({
                    ...formData,
                    dueDate: fullDate.toISOString()
                  })
                }}
              />
            </div>

            <div className="form-group">
              <label>Hora Estimada</label>
              <input
                type="time"
                value={estimatedTime}
                onChange={(e) => {
                  const timeStr = e.target.value
                  setEstimatedTime(timeStr)
                  if (formData.dueDate) {
                    const date = new Date(formData.dueDate)
                    const [hours, minutes] = timeStr.split(':')
                    date.setHours(parseInt(hours), parseInt(minutes))
                    setFormData({ ...formData, dueDate: date.toISOString() })
                  }
                }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Operario</label>
              <select
                value={formData.ownerId || ''}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
              >
                <option value="">Otro</option>
                {filteredOperarios.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Complejidad</label>
              <select value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                {COMPLEXITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Prioridad</label>
              <select
                value={formData.priority || 'media'}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt.toLowerCase()}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Sectores</label>
            <input
              type="text"
              placeholder="Buscar o seleccionar sector..."
              value={sectorSearch}
              onChange={(e) => setSectorSearch(e.target.value)}
              onFocus={() => setIsSectorDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsSectorDropdownOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredSectors.length > 0) {
                  handleAddSector(filteredSectors[0].nombre)
                }
              }}
            />
            {isSectorDropdownOpen && filteredSectors.length > 0 && (
              <div className="dropdown-list">
                {filteredSectors.map((sector) => (
                  <div
                    key={sector.id}
                    className="dropdown-item"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleAddSector(sector.nombre)
                    }}
                  >
                    {sector.nombre}
                  </div>
                ))}
              </div>
            )}
            <div className="selected-tags">
              {selectedSectors.map((sector) => (
                <span key={sector} className="tag selected">
                  {sector}
                  <button type="button" onClick={() => handleRemoveSector(sector)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              rows={4}
              value={formData.summary || ''}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Sin descripción."
            />
          </div>

          {/* Sección de Brief Público */}
          <div className="form-section-divider">
            <h3>📋 Brief del Proyecto (Público)</h3>
            <p className="section-description">Envía este formulario al cliente para que complete el brief</p>
            {task && (() => {
              const ordenId = parseTaskIdToOrdenId(task.id)
              console.log('🔍 Debug BriefLinkSection - task.id:', task.id, 'ordenId:', ordenId)
              if (ordenId) {
                return <BriefLinkSection ordenId={ordenId} />
              } else {
                console.warn('⚠️ No se pudo obtener ordenId para BriefLinkSection')
                return <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>⚠️ No se pudo obtener el ID de la orden</p>
              }
            })()}
          </div>

          <div className="form-group">
            <label>Brief Público</label>
            <textarea
              rows={5}
              value={briefPublico}
              onChange={(e) => setBriefPublico(e.target.value)}
              placeholder="Describe el proyecto, objetivos, contexto y cualquier información relevante que deba conocer el equipo..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Objetivo del Proyecto</label>
              <input
                type="text"
                value={objetivoProyecto}
                onChange={(e) => setObjetivoProyecto(e.target.value)}
                placeholder="Ej: Incrementar ventas, Branding, etc."
              />
            </div>
            <div className="form-group">
              <label>Público Objetivo</label>
              <input
                type="text"
                value={publicoObjetivo}
                onChange={(e) => setPublicoObjetivo(e.target.value)}
                placeholder="Ej: Jóvenes 18-25 años, Empresas B2B, etc."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Estilo de Diseño</label>
              <input
                type="text"
                value={estiloDiseno}
                onChange={(e) => setEstiloDiseno(e.target.value)}
                placeholder="Ej: Minimalista, Corporativo, Moderno, etc."
              />
            </div>
            <div className="form-group">
              <label>Deadline del Brief</label>
              <input
                type="date"
                value={deadlineBrief ? new Date(deadlineBrief).toISOString().split('T')[0] : ''}
                onChange={(e) => setDeadlineBrief(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Referencias</label>
            <textarea
              rows={3}
              value={referencias}
              onChange={(e) => setReferencias(e.target.value)}
              placeholder="Enlaces a referencias visuales, Pinterest, Behance, o descripción de estilos deseados..."
            />
          </div>

          {/* Campo de metros cuadrados cuando está en Taller Gráfico */}
          {task.assignedSector === 'Taller Gráfico' && (
            <div className="form-group">
              <label>Metros Cuadrados (m²) - Para impresión</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.metrosCuadrados ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : parseFloat(e.target.value)
                  setFormData({ ...formData, metrosCuadrados: value ?? undefined })
                }}
                placeholder="Ej: 6.24 (se calcula automáticamente desde dimensiones si está vacío)"
              />
              <small style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Si está vacío, se calculará automáticamente desde las dimensiones en la descripción (ej: "290CM X 215CM")
              </small>
            </div>
          )}

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

          <div className="form-row">
            <div className="form-group">
              <label>Teléfono cliente (opcional)</label>
              <input
                type="text"
                value={formData.clientPhone || ''}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                placeholder="+54 9 11 ..."
              />
            </div>
            <div className="form-group">
              <label>Email cliente (opcional)</label>
              <input
                type="email"
                value={formData.clientEmail || ''}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                placeholder="cliente@correo.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Dirección cliente (opcional)</label>
              <input
                type="text"
                value={formData.clientAddress || ''}
                onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                placeholder="Calle, número, ciudad..."
              />
            </div>
            <div className="form-group">
              <label>Link de ubicación (Google Maps) (opcional)</label>
              <input
                type="url"
                value={formData.locationUrl || ''}
                onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Link de Drive (opcional)</label>
              <input
                type="url"
                value={formData.driveUrl || ''}
                onChange={(e) => setFormData({ ...formData, driveUrl: e.target.value })}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>

          <div className="form-group history-section">
            <label>Trazabilidad completa - Historial de movimientos</label>
            {loadingHistory ? (
              <p className="history-loading">Cargando historial...</p>
            ) : taskHistory.length > 0 ? (
              <div className="history-list">
                {taskHistory.map((entry) => {
                  const usuario = teamMembers.find((m) => m.id === entry.id_usuario.toString())
                  const nombreUsuario = usuario?.name || `Usuario ${entry.id_usuario}`
                  return (
                    <div key={entry.id} className="history-item">
                      <div className="history-header">
                        <strong>{nombreUsuario}</strong>
                        <span className="history-date">
                          {new Date(entry.timestamp).toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="history-content">
                        {entry.estado_anterior && entry.estado_nuevo && entry.estado_anterior !== entry.estado_nuevo ? (
                          <>
                            <span className="history-from">{entry.estado_anterior}</span>
                            <span className="history-arrow">→</span>
                            <span className="history-to">{entry.estado_nuevo}</span>
                          </>
                        ) : (
                          <span className="history-note">{entry.comentario || 'Movimiento registrado'}</span>
                        )}
                      </div>
                      {entry.comentario && entry.estado_anterior !== entry.estado_nuevo && (
                        <p className="history-comment">{entry.comentario}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="history-empty">Esta orden todavía no tiene movimientos registrados.</p>
            )}
          </div>

          <div className="form-group comments-section">
            <label>Comentarios</label>
            <div className="comments-list">
              {comentarios.length > 0 ? (
                comentarios.map((comentario) => (
                  <div key={comentario.id} className="comment-item">
                    <div className="comment-header">
                      <strong>{comentario.usuario_nombre}</strong>
                      <span className="comment-date">
                        {new Date(comentario.timestamp).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="comment-text">{comentario.comentario}</p>
                  </div>
                ))
              ) : (
                <p className="comments-empty">No hay comentarios aún.</p>
              )}
            </div>
            <div className="comment-input-section">
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <button
                type="button"
                className="btn-add-comment"
                onClick={handleAddComment}
                disabled={!newComment.trim() || savingComment}
              >
                {savingComment ? 'Guardando...' : 'Agregar comentario'}
              </button>
            </div>
          </div>

          {/* Sección de Revisiones y Aprobaciones */}
          {task && (() => {
            const ordenId = parseTaskIdToOrdenId(task.id)
            return ordenId ? (
              <RevisionesSection
                ordenId={ordenId}
                estadoRevisionActual={task.estadoRevision}
                onEstadoCambiado={async () => {
                  // Recargar la orden para obtener el estado actualizado
                  if (ordenId) {
                    const ordenResponse = await apiService.getOrden(ordenId)
                    if (ordenResponse.success && ordenResponse.data) {
                      // Actualizar el estado de revisión en el task
                      setFormData(prev => ({
                        ...prev,
                        estadoRevision: ordenResponse.data?.estado_revision || undefined
                      }))
                    }
                  }
                }}
              />
            ) : null
          })()}

          {/* Sección de Registro de Tiempo */}
          {task && (() => {
            const ordenId = parseTaskIdToOrdenId(task.id)
            return ordenId ? (
              <TiempoTrabajoSection
                ordenId={ordenId}
                onTiempoActualizado={() => {
                  // Recargar datos si es necesario
                }}
              />
            ) : null
          })()}

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
                      <div className="dropdown-subtext">
                        {material.codigo && <span>{material.codigo}</span>}
                        {material.stock !== null && material.stock !== undefined && (
                          <span
                            style={{
                              marginLeft: material.codigo ? '8px' : '0',
                              color: material.stock <= 0 ? '#f87171' : material.stock <= 10 ? '#fbbf24' : '#22c55e',
                              fontWeight: 600
                            }}
                          >
                            Stock: {material.stock}
                          </span>
                        )}
                      </div>
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
            <label>Archivos Adjuntos</label>
            {attachments.length > 0 && (
              <div className="attached-files">
                {attachments.map((file) => {
                  const isImage = file.type?.startsWith('image/')
                  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                  const fileUrl = file.remoteUrl || file.previewUrl
                  
                  return (
                    <div key={file.id} className="file-item">
                      <div 
                        className="file-preview"
                        style={{ cursor: fileUrl && !file.uploading ? 'pointer' : 'default' }}
                        onClick={() => {
                          if (fileUrl && !file.uploading) {
                            setPreviewAttachment(file)
                          }
                        }}
                      >
                        {isImage && fileUrl ? (
                          <img src={fileUrl} alt={file.name} />
                        ) : isPDF ? (
                          <div className="file-icon pdf-icon">📄</div>
                        ) : (
                          <div className="file-icon">📎</div>
                        )}
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          {file.uploading && <span className="upload-pill">Subiendo...</span>}
                        </div>
                      </div>
                      <div className="file-actions">
                        {fileUrl && !file.uploading && (
                          <button
                            type="button"
                            className="download-file"
                            onClick={(e) => {
                              e.stopPropagation()
                              const url = file.remoteUrl || file.previewUrl
                              if (url) {
                                const link = document.createElement('a')
                                link.href = url
                                link.download = file.name
                                link.target = '_blank'
                                document.body.appendChild(link)
                                link.click()
                                document.body.removeChild(link)
                              }
                            }}
                            title="Descargar"
                          >
                            ⬇️
                          </button>
                        )}
                        <button
                          type="button"
                          className="delete-file"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFile(file.id)
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {uploadError && <p className="upload-error">{uploadError}</p>}
            <div className="upload-section">
              <label className="upload-button">
                Seleccionar archivos
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
          {onDelete && (
            <button type="button" className="btn-delete" onClick={() => onDelete(task.id)}>
              Eliminar
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={() => onClose(task?.id)}>
            Cancelar
          </button>
          <button type="button" className="btn-save" onClick={handleSave} disabled={hasPendingUploads}>
            Guardar Cambios
          </button>
        </footer>
      </div>

      {/* Modal de previsualización de archivos */}
      {previewAttachment && (
        <div className="modal-overlay" onClick={() => setPreviewAttachment(null)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
            <header className="modal-header">
              <h3>{previewAttachment.name}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPreviewAttachment(null)}
              >
                ×
              </button>
            </header>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              {previewAttachment.type?.startsWith('image/') ? (
                <img 
                  src={previewAttachment.remoteUrl || previewAttachment.previewUrl} 
                  alt={previewAttachment.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : previewAttachment.type === 'application/pdf' || previewAttachment.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewAttachment.remoteUrl || previewAttachment.previewUrl}
                  style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px' }}
                  title={previewAttachment.name}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p>Vista previa no disponible para este tipo de archivo</p>
                  <a
                    href={previewAttachment.remoteUrl || previewAttachment.previewUrl}
                    download={previewAttachment.name}
                    style={{ 
                      display: 'inline-block', 
                      marginTop: '20px', 
                      padding: '10px 20px', 
                      background: 'rgba(59, 130, 246, 0.2)', 
                      color: '#60a5fa',
                      borderRadius: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    Descargar archivo
                  </a>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  const url = previewAttachment.remoteUrl || previewAttachment.previewUrl
                  if (url) {
                    const link = document.createElement('a')
                    link.href = url
                    link.download = previewAttachment.name
                    link.target = '_blank'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }
                }}
                className="confirm-button"
              >
                ⬇️ Descargar
              </button>
              <button onClick={() => setPreviewAttachment(null)} className="cancel-button">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskEditModal

