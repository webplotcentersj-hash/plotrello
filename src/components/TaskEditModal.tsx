import { useState, useEffect, useRef, useMemo } from 'react'
import type { ActivityEvent, Task, TeamMember } from '../types/board'
import type {
  ComentarioOrden,
  HistorialMovimiento,
  MaterialRecord,
  OrdenTrabajo,
  SectorRecord
} from '../types/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import apiService from '../services/api'
import { parseTaskIdToOrdenId, filterOperariosBySector, ordenToTask } from '../utils/dataMappers'
import { improveOpDescriptionWithPlotAI } from '../utils/improveOpDescriptionPlotAI'
import {
  attachmentListHasReadySitePhoto,
  opSectoresRequierenFotosLugar,
  taskEstaEnColumnaInstalacionOMetalurgica,
  taskPhotoUrlCountAsSitePhoto
} from '../utils/sectoresFotosLugar'
import { matchesOperarioAsignado } from '../utils/operarioAsignadoUtils'
import { getRecentTiposImpresionOp } from '../utils/opImpresionRecientes'
import { pillColorFromString } from '../utils/pillColorFromString'
import OpFichaGuiaModal from './OpFichaGuiaModal'
import RevisionesSection from './RevisionesSection'
import TiempoTrabajoSection from './TiempoTrabajoSection'
import BriefLinkSection from './BriefLinkSection'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import './TaskEditModal.css'

type TaskEditModalProps = {
  task: Task | null
  teamMembers: TeamMember[]
  sectores: SectorRecord[]
  materiales: MaterialRecord[]
  activity: ActivityEvent[]
  onClose: (taskId?: string) => void
  onSave: (updatedTask: Task) => void | Promise<void>
  onDelete?: (taskId: string) => void
  /** false en flujos que no son OP (ej. Asesor/Presupuestos): sin tipo/ítems m² ni tocar esos datos al guardar */
  showImpresionOpFields?: boolean
}

type LocalAttachment = {
  id: string
  name: string
  previewUrl: string
  remoteUrl?: string
  /** id numérico en `enlaces_adjuntos` cuando el adjunto ya está guardado en BD */
  dbEnlaceId?: number
  uploading: boolean
  type?: string // MIME type del archivo
  file?: File // Referencia al archivo original para descarga
}

type CarouselSlideEdit = { id: string; url: string; nombre: string; uploading?: boolean }

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
  onDelete,
  showImpresionOpFields = true
}: TaskEditModalProps) => {
  const { isAdmin, isDiseno, usuario } = useAuth()
  const [formData, setFormData] = useState<Partial<Task>>({})
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [materials, setMaterials] = useState<Array<{ name: string; quantity: number }>>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<Array<{ nombre: string; veces_usada: number; color: string }>>([])
  const [tagColors, setTagColors] = useState<Map<string, string>>(new Map())
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [isTagInputFocused, setIsTagInputFocused] = useState(false)
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
  // Campo "Tipo de impresión (OP)" removido de la UI (se conserva el dato en BD si existe)
  const [focusedLineaTipoIdx, setFocusedLineaTipoIdx] = useState<number | null>(null)
  const [fullHistory, setFullHistory] = useState<HistorialMovimiento[]>([])
  const [comentarios, setComentarios] = useState<ComentarioOrden[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [savingComment, setSavingComment] = useState(false)
  const [opBloqueadaSyncing, setOpBloqueadaSyncing] = useState(false)
  const [savingPortada, setSavingPortada] = useState(false)
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlideEdit[]>([])
  const attachmentsRef = useRef<LocalAttachment[]>([])
  const hasPendingCarouselUploads = carouselSlides.some((s) => s.uploading)
  const hasPendingUploads =
    attachments.some((attachment) => attachment.uploading) || hasPendingCarouselUploads
  const [previewAttachment, setPreviewAttachment] = useState<LocalAttachment | null>(null)
  const [fichaTecnicaFile, setFichaTecnicaFile] = useState<File | null>(null)
  const [fichaTecnicaUrl, setFichaTecnicaUrl] = useState<string | null>(null)
  const [uploadingFichaTecnica, setUploadingFichaTecnica] = useState(false)
  const fichaTecnicaInputRef = useRef<HTMLInputElement>(null)
  const [fichaTecnicaCargada, setFichaTecnicaCargada] = useState(false)
  const [fichaTecnicaIncompleta, setFichaTecnicaIncompleta] = useState(false)
  const [presupuestoEnviado, setPresupuestoEnviado] = useState(false)
  const [presupuestoArmado, setPresupuestoArmado] = useState(false)
  const [presupuestoEnEspera, setPresupuestoEnEspera] = useState(false)
  const [planillaPreliminar, setPlanillaPreliminar] = useState(false)
  const [fichaRelacionadaTienePlanillaPreliminar, setFichaRelacionadaTienePlanillaPreliminar] = useState(false)
  const [plotAiImprovingDescription, setPlotAiImprovingDescription] = useState(false)
  const [guiaFichaOpen, setGuiaFichaOpen] = useState(false)
  const [lineasMetrosM2, setLineasMetrosM2] = useState<Array<{ tipo: string; metrosCuadrados: number }>>([])
  const [, setRecentTiposOp] = useState<string[]>([])
  const [lineaTipoSuggestionsByIdx, setLineaTipoSuggestionsByIdx] = useState<Record<number, string[]>>({})

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
        opBloqueada: task.opBloqueada ?? false,
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
        ...(showImpresionOpFields ? { tipoImpresion: task.tipoImpresion } : {}),
        etapaTallerGrafico: task.etapaTallerGrafico,
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
      // Cargar colores de las etiquetas existentes
      if (task.tags && task.tags.length > 0) {
        loadTagColors(task.tags)
      }
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
      // Cargar ficha técnica si existe
      setFichaTecnicaUrl(task.fichaTecnicaPdfUrl || null)
      // Cargar estados de checklist
      setFichaTecnicaCargada(task.fichaTecnicaCargada ?? false)
      setFichaTecnicaIncompleta(task.fichaTecnicaIncompleta ?? false)
      setPresupuestoEnviado(task.presupuestoEnviadoCliente ?? false)
      setPresupuestoArmado(task.presupuestoArmado ?? false)
      setPresupuestoEnEspera(task.presupuestoEnEspera ?? false)
      setPlanillaPreliminar(task.planillaPreliminar ?? false)
      setLineasMetrosM2(
        showImpresionOpFields
          ? (task.lineasMetrosM2 ?? []).map((r) => ({
              tipo: r.tipo || '',
              metrosCuadrados: Number(r.metrosCuadrados) || 0
            }))
          : []
      )
      setCarouselSlides(
        (task.galeriaCarrusel ?? []).map((s) => ({
          id: crypto.randomUUID(),
          url: s.url,
          nombre: s.nombre || '',
          uploading: false
        }))
      )

      // Verificar si la ficha relacionada tiene planilla preliminar
      if (task.esFichaNoOP && task.opNumber) {
        checkFichaRelacionadaPlanillaPreliminar(task.opNumber, task.assignedSector || '')
      }
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
              // Dedup por URL: si la misma URL aparece en varias fichas del grupo, mostramos 1 sola.
              const rows = (archivosResp.data as any[]) ?? []
              const seen = new Set<string>()
              const archivosExistentes: LocalAttachment[] = rows
                .filter((archivo) => {
                  const u = String(archivo?.url ?? '').trim()
                  if (!u) return false
                  if (seen.has(u)) return false
                  seen.add(u)
                  return true
                })
                .map((archivo) => {
                  const nid = Number(archivo.id)
                  return {
                id: `existing-${archivo.id}`,
                dbEnlaceId: Number.isFinite(nid) ? nid : undefined,
                name: archivo.titulo || archivo.url.split('/').pop() || 'Archivo',
                previewUrl: archivo.url,
                remoteUrl: archivo.url,
                uploading: false
                  }
                })
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
      setLineasMetrosM2([])
    }
  }, [task, showImpresionOpFields])

  useEffect(() => {
    if (!task || !showImpresionOpFields) return
    const sum = lineasMetrosM2.reduce((s, r) => s + (Number(r.metrosCuadrados) || 0), 0)
    if (lineasMetrosM2.length > 0) {
      setFormData((prev) => ({ ...prev, metrosCuadrados: sum }))
    }
  }, [lineasMetrosM2, task, showImpresionOpFields])

  useEffect(() => {
    if (!task || !showImpresionOpFields) return
    setRecentTiposOp(getRecentTiposImpresionOp())
  }, [task?.id, showImpresionOpFields])

  useEffect(() => {
    if (!task || !showImpresionOpFields) return
    if (focusedLineaTipoIdx == null) return
    const idx = focusedLineaTipoIdx
    const q = (lineasMetrosM2[idx]?.tipo ?? '').trim()
    if (q.length < 3) {
      setLineaTipoSuggestionsByIdx((prev) => {
        if (!prev[idx]?.length) return prev
        const next = { ...prev }
        delete next[idx]
        return next
      })
      return
    }

    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        const resp = await apiService.buscarTiposLineaM2(q, 12)
        if (cancelled) return
        if (!resp.success || !resp.data) {
          setLineaTipoSuggestionsByIdx((prev) => ({ ...prev, [idx]: [] }))
          return
        }
        setLineaTipoSuggestionsByIdx((prev) => ({ ...prev, [idx]: resp.data ?? [] }))
      })()
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [task?.id, showImpresionOpFields, focusedLineaTipoIdx, lineasMetrosM2])

  // Filtrar operarios según el sector de la ficha
  const filteredOperarios = useMemo(() => {
    if (!task) return teamMembers
    return filterOperariosBySector(teamMembers, task.assignedSector)
  }, [teamMembers, task])

  const isAssignee = useMemo(() => {
    if (!task) return false
    return matchesOperarioAsignado(usuario, formData.ownerId ?? task.ownerId)
  }, [usuario, formData.ownerId, task])

  const requiereFotosLugarEdit = useMemo(() => {
    if (!task) return false
    const list =
      selectedSectors.length > 0
        ? selectedSectors
        : task.sectores && task.sectores.length > 0
          ? task.sectores
          : task.assignedSector
            ? [task.assignedSector]
            : []
    return (
      opSectoresRequierenFotosLugar(list) ||
      taskEstaEnColumnaInstalacionOMetalurgica({
        status: task.status,
        assignedSector: task.assignedSector
      })
    )
  }, [task, selectedSectors])

  const tieneFotosLugarListasEdit = useMemo(() => {
    if (!task) return true
    const cover = (formData.photoUrl ?? task.photoUrl) || ''
    return taskPhotoUrlCountAsSitePhoto(cover) || attachmentListHasReadySitePhoto(attachments)
  }, [task, formData.photoUrl, attachments])

  const saveBlockedPorFotosLugar = requiereFotosLugarEdit && !tieneFotosLugarListasEdit

  if (!task) return null

  const opLocked = Boolean(formData.opBloqueada ?? task.opBloqueada) && !isAdmin

  const handleOpBloqueadaToggle = async (next: boolean) => {
    const ordenId = parseTaskIdToOrdenId(task.id)
    if (!ordenId) return
    setOpBloqueadaSyncing(true)
    const r = await apiService.updateOrden(ordenId, { op_bloqueada: next })
    setOpBloqueadaSyncing(false)
    if (!r.success) {
      alert(r.error || 'No se pudo actualizar el bloqueo')
      return
    }
    setFormData((f) => ({ ...f, opBloqueada: next }))
    if (r.data) onSave(ordenToTask(r.data as OrdenTrabajo))
  }

  /** Ficha No OP, u OP ya convertida desde ficha (pueden subir PDF y desmarcar incompleta) */
  const muestraFichaTecnicaPdfEIncompleta =
    task.esFichaNoOP === true ||
    (task.numeroFichaOriginal != null && String(task.numeroFichaOriginal).trim() !== '')

  // Función para verificar si la ficha relacionada tiene planilla preliminar
  const checkFichaRelacionadaPlanillaPreliminar = async (numeroOP: string, sectorActual: string) => {
    try {
      const sectorRelacionado = sectorActual === 'Asesor Técnico' ? 'Presupuestos' : 
                                sectorActual === 'Presupuestos' ? 'Asesor Técnico' : null
      
      if (!sectorRelacionado) {
        setFichaRelacionadaTienePlanillaPreliminar(false)
        return
      }
      
      // Buscar la ficha relacionada usando Supabase directamente
      if (supabase) {
        const { data, error } = await supabase
          .from('ordenes_trabajo')
          .select('id, planilla_preliminar')
          .eq('numero_op', numeroOP)
          .eq('sector', sectorRelacionado)
          .eq('es_ficha_no_op', true)
          .limit(1)
        
        if (!error && data && data.length > 0) {
          setFichaRelacionadaTienePlanillaPreliminar(data[0].planilla_preliminar ?? false)
        } else {
          setFichaRelacionadaTienePlanillaPreliminar(false)
        }
      }
    } catch (error) {
      console.error('Error verificando ficha relacionada:', error)
      setFichaRelacionadaTienePlanillaPreliminar(false)
    }
  }

  const handleImproveDescriptionPlotAI = async () => {
    const desc = (formData.summary || '').trim()
    const title = (formData.title || task?.title || '').trim()
    const op = String(formData.opNumber || task?.opNumber || '').trim()
    const sector =
      selectedSectors.length > 0
        ? selectedSectors.join(', ')
        : task?.assignedSector || (task?.sectores?.length ? task.sectores.join(', ') : '')
    const brief = briefPublico.trim()

    if (!desc && !title && !op && !sector && !brief) {
      alert('Completá al menos cliente, OP, descripción o brief público para dar contexto a PlotAI.')
      return
    }

    setPlotAiImprovingDescription(true)
    try {
      const improved = await improveOpDescriptionWithPlotAI({
        currentDescription: formData.summary || '',
        clientOrTitle: title || undefined,
        opNumber: op || undefined,
        sector: sector || undefined,
        briefExcerpt: brief || undefined,
      })
      if (!improved) {
        alert('PlotAI no devolvió texto. Intentá de nuevo.')
        return
      }
      setFormData((prev) => ({ ...prev, summary: improved }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al mejorar con PlotAI.')
    } finally {
      setPlotAiImprovingDescription(false)
    }
  }

  const handleSavePortada = async () => {
    if (!task) return
    if (hasPendingUploads) {
      alert('Esperá a que termine la subida de archivos antes de guardar.')
      return
    }
    if (!opLocked) return
    const ordenId = parseTaskIdToOrdenId(task.id)
    if (!ordenId) return
    const next = (formData.photoUrl ?? '').trim()
    const prev = (task.photoUrl ?? '').trim()
    if (next === prev) {
      alert('No hay cambios en la portada.')
      return
    }
    setSavingPortada(true)
    try {
      const r = await apiService.updateOrden(ordenId, { foto_url: next || null })
      if (r.success && r.data) {
        onSave(ordenToTask(r.data as OrdenTrabajo))
        onClose(task.id)
      } else {
        alert(r.error || 'No se pudo guardar la portada (¿sos el operario asignado?).')
      }
    } finally {
      setSavingPortada(false)
    }
  }

  const handleSave = async () => {
    if (hasPendingUploads) {
      alert('Espera a que termine la subida de archivos antes de guardar.')
      return
    }
    if (!(formData.summary || '').trim()) {
      alert(
        'La descripción del trabajo es obligatoria. Detallá qué hay que producir, materiales, cantidades y plazos. Usá el botón «Cómo llenar la ficha» junto a PlotAI si necesitás ayuda.'
      )
      return
    }
    if (opLocked) {
      alert(
        'Esta OP está trabada. Destabála para guardar cambios (solo el operario asignado o administración/gerencia).'
      )
      return
    }

    if (saveBlockedPorFotosLugar) {
      alert(
        'Instalaciones / Metalúrgica: falta la FOTO REAL DEL LUGAR (sitio físico). Subí al menos una imagen en adjuntos o como portada si muestra el lugar; un PDF o render no reemplaza eso.'
      )
      return
    }

    // ⚠️ Importante: editar ficha NO debe moverla de columna automáticamente.
    // El movimiento entre columnas se hace por drag/flechas/context menu.
    const nuevoSector = task.assignedSector
    const nuevoStatus: Task['status'] = task.status

    const sectoresGuardados: string[] =
      selectedSectors.length > 0
        ? [...selectedSectors]
        : task.sectores && task.sectores.length > 0
          ? [...task.sectores]
          : nuevoSector
            ? [nuevoSector]
            : []

    const updated: Task = {
      ...task,
      ...formData,
      status: nuevoStatus,
      tags,
      materials: materials.map((m) => m.name),
      assignedSector: nuevoSector,
      sectores: sectoresGuardados,
      updatedAt: new Date().toISOString(),
      briefPublico: briefPublico.trim() || undefined,
      objetivoProyecto: objetivoProyecto.trim() || undefined,
      publicoObjetivo: publicoObjetivo.trim() || undefined,
      estiloDiseno: estiloDiseno.trim() || undefined,
      referencias: referencias.trim() || undefined,
      deadlineBrief: deadlineBrief || undefined,
      fichaTecnicaPdfUrl: fichaTecnicaUrl || undefined,
      fichaTecnicaCargada: fichaTecnicaCargada,
      fichaTecnicaIncompleta: fichaTecnicaIncompleta,
      presupuestoEnviadoCliente: presupuestoEnviado,
      planillaPreliminar: planillaPreliminar,
      // Asegurar que ownerId se preserve correctamente
      ownerId: formData.ownerId || task.ownerId || 'sin-asignar',
      opBloqueada: formData.opBloqueada ?? task.opBloqueada,
      tipoImpresion: task.tipoImpresion,
      lineasMetrosM2: showImpresionOpFields
        ? lineasMetrosM2
            .filter((r) => (Number(r.metrosCuadrados) || 0) > 0)
            .map(({ tipo, metrosCuadrados }) => ({
              tipo: tipo.trim(),
              metrosCuadrados
            }))
        : task.lineasMetrosM2,
      galeriaCarrusel: carouselSlides
        .filter((s) => s.url && !s.uploading)
        .map(({ url, nombre }) => ({ url, nombre: nombre.trim() }))
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
      
      // Recargar historial después de guardar para mostrar los cambios recientes
      setTimeout(async () => {
        const histResp = await apiService.getHistorialMovimientos({ ordenId, limit: 500 })
        if (histResp.success && histResp.data) {
          setFullHistory(histResp.data as HistorialMovimiento[])
        }
      }, 500) // Pequeño delay para asegurar que el cambio se haya guardado
    }

    await Promise.resolve(onSave(updated))

    onClose(task.id)
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return
    if (opLocked) {
      alert(
        'Esta OP está trabada: no se pueden agregar comentarios hasta que se destabe (administración/gerencia puede hacerlo).'
      )
      return
    }
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

  const addMaterial = (nombre: string | number | null | undefined) => {
    const n = String(nombre ?? '').trim()
    if (n.length < 2) return
    if (materials.some((m) => String(m.name ?? '').toLowerCase() === n.toLowerCase())) return
    setMaterials([...materials, { name: n, quantity: 1 }])
  }

  const handleAddMaterial = () => {
    if (materialSearch.trim().length === 0) return
    addMaterial(materialSearch.trim())
    setMaterialSearch('')
    setIsMaterialDropdownOpen(false)
  }

  const handleSelectMaterial = (material: MaterialRecord) => {
    const raw = material.descripcion?.trim() || material.codigo
    if (raw == null || raw === '') return
    addMaterial(String(raw).trim())
    setMaterialSearch('')
    setIsMaterialDropdownOpen(false)
  }

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index))
  }

  // Cargar etiquetas disponibles al montar el componente (precarga rápida)
  useEffect(() => {
    let cancelled = false
    const loadEtiquetasDisponibles = async () => {
      try {
        const response = await apiService.getEtiquetasDisponibles()
        if (!cancelled && response.success && response.data) {
          setEtiquetasDisponibles(response.data)
          // Crear mapa de colores
          const colorsMap = new Map<string, string>()
          response.data.forEach((etiqueta) => {
            const nom = etiqueta.nombre?.trim()
            if (!nom) return
            colorsMap.set(nom.toLowerCase(), etiqueta.color || '#6B7280')
          })
          setTagColors(colorsMap)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error cargando etiquetas disponibles:', error)
        }
      }
    }
    // Cargar inmediatamente sin delay
    loadEtiquetasDisponibles()
    return () => {
      cancelled = true
    }
  }, [])

  // Cargar colores de etiquetas específicas (optimizado con Promise.all)
  const loadTagColors = async (tagNames: string[]) => {
    try {
      const cleaned = tagNames
        .map((t) => String(t ?? '').trim())
        .filter((t) => t.length > 0)
      // Cargar todos los colores en paralelo
      const colorPromises = cleaned.map((tagName) =>
        apiService.obtenerColorEtiqueta(tagName).then((response) => ({
          tagName: tagName.toLowerCase(),
          color: response.success && response.data ? response.data : '#6B7280'
        }))
      )
      
      const colors = await Promise.all(colorPromises)
      const colorsMap = new Map<string, string>()
      colors.forEach(({ tagName, color }) => {
        colorsMap.set(tagName, color)
      })
      
      setTagColors(prev => {
        const newMap = new Map(prev)
        colorsMap.forEach((color, tag) => {
          newMap.set(tag, color)
        })
        return newMap
      })
    } catch (error) {
      console.error('Error cargando colores de etiquetas:', error)
    }
  }

  const normalizeTag = (value: string) => value.trim().toLowerCase()

  // Filtrar sugerencias basadas en el input
  useEffect(() => {
    const normalizedSelected = new Set(
      tags.map((t) => String(t ?? '').trim().toLowerCase()).filter(Boolean)
    )
    const normalizedInput = tagInput.trim().toLowerCase()

    // Mostrar todas las etiquetas disponibles cuando no hay texto o cuando hay texto que coincide
    const filtered = etiquetasDisponibles
      .filter((e) => {
        const nom = e.nombre?.trim()
        if (!nom) return false
        const nLow = nom.toLowerCase()
        // Si no hay texto, mostrar todas (excepto las ya seleccionadas)
        if (normalizedInput.length === 0) {
          return !normalizedSelected.has(nLow)
        }
        // Si hay texto, filtrar por coincidencia
        return nLow.includes(normalizedInput) && !normalizedSelected.has(nLow)
      })
      .sort((a, b) => b.veces_usada - a.veces_usada) // Ordenar por uso (más usadas primero)
      .slice(0, 10) // Mostrar hasta 10 sugerencias
      .map((e) => e.nombre)
      .filter((n): n is string => Boolean(n?.trim()))
    
    setTagSuggestions(filtered)
    // Abrir dropdown solo cuando el input está enfocado y hay sugerencias
    setIsTagDropdownOpen(isTagInputFocused && filtered.length > 0)
  }, [tagInput, etiquetasDisponibles, tags, isTagInputFocused])

  const handleAddTag = async () => {
    const normalized = normalizeTag(tagInput)
    if (!normalized) return
    if (tags.some((t) => String(t ?? '').trim().toLowerCase() === normalized)) return
    
    // Agregar inmediatamente a la UI para respuesta rápida
    setTags((prev) => [...prev, normalized])
    setTagInput('')
    setIsTagDropdownOpen(false)
    
    // Obtener color de la etiqueta (puede ser nueva o existente)
    const etiquetaExistente = etiquetasDisponibles.find(
      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === normalized
    )
    
    if (etiquetaExistente) {
      // Si ya existe, usar su color inmediatamente
      setTagColors(prev => {
        const newMap = new Map(prev)
        newMap.set(normalized, etiquetaExistente.color || '#6B7280')
        return newMap
      })
    } else {
      // Si es nueva, obtener color después de guardar
      try {
        await apiService.guardarEtiquetaDisponible(normalized)
        const colorResponse = await apiService.obtenerColorEtiqueta(normalized)
        const color = colorResponse.success && colorResponse.data ? colorResponse.data : '#6B7280'
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(normalized, color)
          return newMap
        })
        setEtiquetasDisponibles(prev => [
          ...prev,
          { nombre: normalized, veces_usada: 1, color: color }
        ])
      } catch (error) {
        console.error('Error guardando etiqueta:', error)
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(normalized, '#6B7280')
          return newMap
        })
      }
    }
  }

  const handleSelectTagSuggestion = async (suggestion: string) => {
    const normalized = normalizeTag(suggestion)
    if (!normalized) return
    if (tags.some((t) => String(t ?? '').trim().toLowerCase() === normalized)) return
    
    // Agregar inmediatamente a la UI para respuesta rápida
    setTags((prev) => [...prev, normalized])
    setTagInput('')
    setIsTagDropdownOpen(false)
    
    // Obtener color de la etiqueta existente
    const etiquetaExistente = etiquetasDisponibles.find(
      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === normalized
    )
    
    if (etiquetaExistente) {
      // Usar color existente inmediatamente
      setTagColors(prev => {
        const newMap = new Map(prev)
        newMap.set(normalized, etiquetaExistente.color || '#6B7280')
        return newMap
      })
      // Incrementar contador de uso en background
      apiService.guardarEtiquetaDisponible(normalized).catch(err => 
        console.error('Error actualizando uso de etiqueta:', err)
      )
    } else {
      // Si no existe, obtener color después de guardar
      try {
        await apiService.guardarEtiquetaDisponible(normalized)
        const colorResponse = await apiService.obtenerColorEtiqueta(normalized)
        const color = colorResponse.success && colorResponse.data ? colorResponse.data : '#6B7280'
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(normalized, color)
          return newMap
        })
        setEtiquetasDisponibles(prev => [
          ...prev,
          { nombre: normalized, veces_usada: 1, color: color }
        ])
      } catch (error) {
        console.error('Error guardando etiqueta:', error)
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(normalized, '#6B7280')
          return newMap
        })
      }
    }
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
      await uploadSingleAttachment(file)
    }

    event.target.value = ''
  }

  const handleRemoveFile = async (attachmentId: string) => {
    const toRemove = attachmentsRef.current.find((item) => item.id === attachmentId)
    if (!toRemove) return

    // Si es un archivo nuevo (aún no guardado en DB), solo quitar de UI.
    if (toRemove.previewUrl.startsWith('blob:') && !toRemove.remoteUrl) {
      setAttachments((prev) => {
        const local = prev.find((item) => item.id === attachmentId)
        if (local?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(local.previewUrl)
        return prev.filter((item) => item.id !== attachmentId)
      })
      return
    }

    const ordenId = task ? parseTaskIdToOrdenId(task.id) : null
    const remoteUrl = toRemove.remoteUrl || toRemove.previewUrl
    if (!ordenId || !remoteUrl) {
      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId))
      return
    }

    const ok = window.confirm('¿Eliminar este adjunto? Se va a quitar de todas las fichas duplicadas de la OP.')
    if (!ok) return

    const delResp =
      toRemove.dbEnlaceId != null && Number.isFinite(toRemove.dbEnlaceId)
        ? await apiService.deleteAdjuntosGrupoPorEnlaceId(ordenId, toRemove.dbEnlaceId)
        : await apiService.deleteArchivosGrupoByUrl(ordenId, remoteUrl)
    if (!delResp.success) {
      alert(delResp.error || 'No se pudo eliminar el adjunto.')
      return
    }

    const eliminadas = delResp.data?.eliminadas ?? 0
    if (eliminadas <= 0) {
      alert(
        'No se encontró el archivo en la base para borrarlo. Si ya lo quitaste antes, refrescá la página.'
      )
      return
    }

    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId))
  }

  const addCarouselImage = async (file: File) => {
    const id = crypto.randomUUID()
    setCarouselSlides((prev) => [...prev, { id, url: '', nombre: '', uploading: true }])
    try {
      const remoteUrl = await uploadAttachmentAndGetUrl(file, `capturas/carrusel/${task?.id ?? 'sin-id'}`)
      setCarouselSlides((prev) =>
        prev.map((s) => (s.id === id ? { ...s, url: remoteUrl, uploading: false } : s))
      )
    } catch (error) {
      console.error('Error subiendo imagen del carrusel', error)
      setUploadError('No se pudo subir una imagen del carrusel.')
      setCarouselSlides((prev) => prev.filter((s) => s.id !== id))
    }
  }

  const moveCarouselSlide = (idx: number, delta: number) => {
    setCarouselSlides((rows) => {
      const j = idx + delta
      if (j < 0 || j >= rows.length) return rows
      const next = [...rows]
      const a = next[idx]!
      next[idx] = next[j]!
      next[j] = a
      return next
    })
  }

  const removeCarouselSlide = (slideId: string) => {
    setCarouselSlides((prev) => prev.filter((s) => s.id !== slideId))
  }

  const uploadSingleAttachment = async (
    file: File,
    opts?: { asPortada?: boolean }
  ) => {
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)
    setAttachments((prev) => [
      ...prev,
      {
        id,
        name: file.name,
        previewUrl,
        uploading: true,
        type: file.type,
        file
      }
    ])

    try {
      const remoteUrl = await uploadAttachmentAndGetUrl(file, `capturas/${task?.id ?? 'sin-id'}`)
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id ? { ...attachment, remoteUrl, uploading: false } : attachment
        )
      )
      // Subida desde la sección Portada (o pegado): siempre reemplaza la portada.
      // Desde adjuntos generales: solo auto-portada si todavía no hay una elegida.
      setFormData((prev) =>
        opts?.asPortada
          ? { ...prev, photoUrl: remoteUrl }
          : prev.photoUrl
            ? prev
            : { ...prev, photoUrl: remoteUrl }
      )
    } catch (error) {
      console.error('Error subiendo archivo', error)
      setUploadError('No se pudo subir el archivo. Intenta nuevamente.')
      setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }

  useEffect(() => {
    attachmentsRef.current = attachments
    const firstReady = attachments.find((attachment) => attachment.remoteUrl && !attachment.uploading)
    if (firstReady?.remoteUrl) {
      // Solo setear portada automática si todavía no hay una portada elegida
      setFormData((prev) => (prev.photoUrl ? prev : { ...prev, photoUrl: firstReady.remoteUrl }))
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

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase()
    return materiales
      .filter((material) => {
        const label = String(material.descripcion?.trim() || material.codigo || '').trim()
        if (!label) return false
        if (materials.some((m) => String(m.name ?? '').toLowerCase() === label.toLowerCase())) {
          return false
        }
        if (!q) return true
        const descripcion = material.descripcion?.toLowerCase() ?? ''
        const codigo = String(material.codigo ?? '').toLowerCase()
        return descripcion.includes(q) || codigo.includes(q)
      })
      .slice(0, q ? 15 : 10)
  }, [materiales, materialSearch, materials])

  // Campo "Tipo de impresión (OP)" removido de la UI

  const getLineaTipoSuggestions = (idx: number) => {
    return lineaTipoSuggestionsByIdx[idx] ?? []
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(task?.id)
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose(task?.id)
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onPaste={(e) => {
          const items = e.clipboardData?.items
          if (!items?.length) return
          const imageItem = Array.from(items).find((it) => it.kind === 'file' && it.type.startsWith('image/'))
          if (!imageItem) return
          const file = imageItem.getAsFile()
          if (!file) return
          e.preventDefault()
          const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'img'
          const named = new File([file], `captura-${Date.now()}.${ext}`, { type: file.type })
          void uploadSingleAttachment(named, { asPortada: true })
        }}
      >
        <header className="modal-header">
          <h2>
            Editando {task?.esFichaNoOP ? 'Ficha' : 'OP'} #{formData.opNumber || task.opNumber}
          </h2>
          <button type="button" className="modal-close" onClick={() => onClose(task?.id)}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {opLocked && (
            <div className="task-edit-op-lock-banner" role="alert">
              Esta OP está trabada: no podés editarla ni guardar hasta que el operario asignado la destabe
              (administración o gerencia pueden hacerlo con su usuario).
            </div>
          )}
          {(isAssignee || isAdmin) && (
            <div className="task-edit-op-lock-toggle">
              <label className="task-edit-op-lock-label">
                <input
                  type="checkbox"
                  checked={!!(formData.opBloqueada ?? task.opBloqueada)}
                  disabled={opBloqueadaSyncing}
                  onChange={(e) => void handleOpBloqueadaToggle(e.target.checked)}
                />
                <span>Trabar OP (nadie puede editarla ni moverla hasta que se destabe)</span>
              </label>
            </div>
          )}
          <div className="task-cover-section task-cover-section--always-editable">
            <div className="task-cover-header">
              <strong>Portada</strong>
              <small>Pegá una captura con Ctrl+V o subí una imagen.</small>
            </div>
            {opLocked && (
              <p className="task-cover-lock-hint">
                OP trabada: el resto de los campos no se puede editar, pero sí la portada. Guardá con «Guardar portada»
                (quien puede hacerlo depende del rol y del operario asignado).
              </p>
            )}
            {formData.photoUrl ? (
              <div className="task-photo-preview">
                <img
                  src={formData.photoUrl}
                  alt={`Portada ${task?.esFichaNoOP ? 'Ficha' : 'OP'} ${task.opNumber}`}
                />
              </div>
            ) : (
              <div className="task-cover-empty">Sin portada</div>
            )}
            <div className="task-cover-actions">
              <label className="task-cover-upload">
                Subir / Reemplazar
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    void uploadSingleAttachment(f, { asPortada: true })
                    e.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                className="task-cover-remove"
                onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                disabled={!formData.photoUrl}
              >
                Quitar portada
              </button>
            </div>
          </div>
          <fieldset className="task-edit-op-fieldset" disabled={opLocked}>
          <div className="task-carousel-editor">
            <div className="task-carousel-header">
              <strong>Galería de imágenes</strong>
              <small>Se muestran miniaturas en la vista expandida (solo lectura). Cada foto puede tener un nombre.</small>
            </div>
            <div className="task-carousel-list">
              {carouselSlides.length === 0 ? (
                <p className="task-carousel-empty">Todavía no hay imágenes en la galería.</p>
              ) : (
                carouselSlides.map((slide, idx) => (
                  <div key={slide.id} className="task-carousel-row">
                    <div className="task-carousel-thumb">
                      {slide.uploading ? (
                        <span className="task-carousel-uploading">Subiendo…</span>
                      ) : slide.url ? (
                        <img src={slide.url} alt="" />
                      ) : (
                        <span className="task-carousel-thumb-placeholder">—</span>
                      )}
                    </div>
                    <div className="task-carousel-nombre-field">
                      <label className="task-carousel-nombre-label" htmlFor={`carousel-nombre-${slide.id}`}>
                        Nombre
                      </label>
                      <input
                        id={`carousel-nombre-${slide.id}`}
                        type="text"
                        className="task-carousel-title-input"
                        placeholder="Nombre de la foto (opcional)"
                        value={slide.nombre}
                        onChange={(e) =>
                          setCarouselSlides((rows) =>
                            rows.map((r) => (r.id === slide.id ? { ...r, nombre: e.target.value } : r))
                          )
                        }
                        disabled={slide.uploading}
                        autoComplete="off"
                      />
                    </div>
                    <div className="task-carousel-row-actions">
                      <button
                        type="button"
                        className="task-carousel-move"
                        title="Mover arriba"
                        disabled={idx === 0 || slide.uploading}
                        onClick={() => moveCarouselSlide(idx, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="task-carousel-move"
                        title="Mover abajo"
                        disabled={idx === carouselSlides.length - 1 || slide.uploading}
                        onClick={() => moveCarouselSlide(idx, 1)}
                      >
                        {'\u2193'}
                      </button>
                      <button
                        type="button"
                        className="task-carousel-remove"
                        disabled={slide.uploading}
                        onClick={() => removeCarouselSlide(slide.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <label className="task-carousel-add">
              + Agregar imagen a la galería
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void addCarouselImage(f)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>N° {task?.esFichaNoOP ? 'Ficha' : 'OP'}</label>
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
                    ? /^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate)
                      ? formData.dueDate
                      : new Intl.DateTimeFormat('en-CA', {
                          timeZone: 'America/Argentina/Buenos_Aires',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }).format(new Date(formData.dueDate))
                    : ''
                }
                onChange={(e) => {
                  const dateStr = e.target.value
                  const timeStr = estimatedTime || '00:00'
                  setFormData({
                    ...formData,
                    // Guardar como instant en horario Argentina para no correrse de día
                    dueDate: `${dateStr}T${timeStr}:00-03:00`
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
                    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate)
                      ? formData.dueDate
                      : new Intl.DateTimeFormat('en-CA', {
                          timeZone: 'America/Argentina/Buenos_Aires',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }).format(new Date(formData.dueDate))
                    setFormData({ ...formData, dueDate: `${dateStr}T${timeStr}:00-03:00` })
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
            <label>Sectores de la OP</label>
            <input
              type="text"
              placeholder="Buscar o agregar sector..."
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
            <div className="info-panel" style={{ marginTop: '10px' }}>
              <small>
                Podés <strong>agregar sectores</strong> a esta OP en cualquier momento: al guardar se sincroniza la lista en
                todo el grupo y se crean en el tablero las <strong>fichas que falten</strong> para sectores nuevos (misma OP).
                Quitar un sector del listado no borra automáticamente una ficha ya creada; consultá con sistema si necesitás
                limpieza manual.
                <br />
                Si dos fichas de la misma OP entran en la <strong>misma columna</strong>, una absorbe a la otra a la vista del
                tablero: la fila oculta no se elimina y la <strong>trazabilidad</strong> (movimientos, comentarios, adjuntos)
                queda en la ficha visible.
              </small>
            </div>
            {requiereFotosLugarEdit && (
              <div
                className="fotos-lugar-requerido-box"
                role="region"
                aria-label="Requisito: foto real del lugar de instalación o montaje"
                style={{ marginTop: '10px' }}
              >
                <p className="fotos-lugar-eyebrow">Instalaciones · Metalúrgica — obligatorio</p>
                <h3 className="fotos-lugar-title">Foto real del lugar (sitio físico)</h3>
                <p className="fotos-lugar-sub">
                  No es un adjunto genérico: tiene que verse el <strong>espacio real</strong> donde se instala o monta (calle,
                  fachada, interior, taller del cliente, acceso, etc.).
                </p>
                <div className="fotos-lugar-lista-no">
                  <strong>Esto no cuenta como foto del lugar:</strong> solo PDF, render 3D, mockup en pantalla, flyer, logo
                  suelto o captura sin el sitio físico.
                </div>
                <ul className="fotos-lugar-lista-si">
                  <li>
                    Subí <strong>al menos una imagen</strong> en <strong>Archivos adjuntos</strong> más abajo, o usá la{' '}
                    <strong>portada</strong> (arriba) si ya es foto del sitio.
                  </li>
                  <li>
                    Para mover la ficha a esas columnas desde el tablero también se valida que exista esta evidencia (adjunto
                    imagen o portada con foto del lugar).
                  </li>
                </ul>
                {!tieneFotosLugarListasEdit && (
                  <p className="fotos-lugar-falta" role="status">
                    Pendiente: falta una imagen lista del lugar — portada o adjuntos.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="form-group">
            <div className="task-desc-toolbar">
              <label htmlFor="task-edit-summary">Descripción del trabajo *</label>
              <div className="task-desc-toolbar-actions">
                <button
                  type="button"
                  className="task-desc-guia-btn"
                  onClick={() => setGuiaFichaOpen(true)}
                  title="Recomendaciones para completar la ficha (énfasis en la descripción)"
                >
                  Cómo llenar la ficha
                </button>
                <button
                  type="button"
                  className="task-desc-plotai-btn"
                  onClick={() => void handleImproveDescriptionPlotAI()}
                  disabled={plotAiImprovingDescription}
                  title="Reescribe la descripción con PlotAI (conserva datos; revisá antes de guardar)"
                >
                  {plotAiImprovingDescription ? 'Mejorando…' : '✨ Mejorar con PlotAI'}
                </button>
              </div>
            </div>
            <textarea
              id="task-edit-summary"
              rows={4}
              value={formData.summary || ''}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              placeholder="Qué se produce, cantidades, medidas, materiales, plazos, instalación o entrega…"
              required
              aria-required
            />
          </div>

          {/* Sección de Brief Público - Solo para Diseño Gráfico y Admin */}
          {/* IMPORTANTE: Siempre renderizar BriefLinkSection para mantener consistencia en hooks */}
          {/* El componente maneja su propia validación de permisos internamente */}
          <div className="form-section-divider" style={{ display: (isAdmin || isDiseno) ? 'block' : 'none' }}>
            <h3>📋 Brief del Proyecto (Público)</h3>
            <p className="section-description">Envía este formulario al cliente para que complete el brief</p>
            
            {/* Componente para generar link del formulario */}
            {/* Siempre renderizar el mismo componente para mantener consistencia en hooks */}
            <BriefLinkSection ordenId={task ? (parseTaskIdToOrdenId(task.id) || undefined) : undefined} />
          </div>

          {/* Mostrar datos del brief completo si fueron completados por el cliente */}
          {task && (task.clienteNombreCompleto || task.tipoProductoServicio?.length || task.materialLogo) && (
            <div className="form-section-divider" style={{ marginTop: '24px', padding: '20px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px', border: '2px solid rgba(102, 126, 234, 0.3)' }}>
              <h3 style={{ color: '#667eea', marginBottom: '16px' }}>📝 Brief Completado por el Cliente</h3>
              
              {task.clienteNombreCompleto && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#e5e7eb' }}>Cliente:</strong> {task.clienteNombreCompleto}
                  {task.clienteEmpresa && <span style={{ color: '#d1d5db' }}> - {task.clienteEmpresa}</span>}
                </div>
              )}
              
              {task.tipoProductoServicio && task.tipoProductoServicio.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#e5e7eb' }}>Tipo de Producto/Servicio:</strong>
                  <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {task.tipoProductoServicio.map((tipo, idx) => (
                      <span key={idx} style={{ 
                        padding: '4px 8px', 
                        background: 'rgba(102, 126, 234, 0.2)', 
                        borderRadius: '6px', 
                        fontSize: '0.85rem',
                        color: '#667eea'
                      }}>
                        {tipo}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {task.objetivoProyecto && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#e5e7eb' }}>Objetivo:</strong> {task.objetivoProyecto}
                </div>
              )}
              
              {(task.materialLogo || task.materialTextos || task.materialImagenes) && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#e5e7eb' }}>Material Disponible:</strong>
                  <div style={{ marginTop: '4px', fontSize: '0.9rem', color: '#d1d5db' }}>
                    {task.materialLogo && <div>Logo: {task.materialLogo.replace(/_/g, ' ')}</div>}
                    {task.materialTextos && <div>Textos: {task.materialTextos.replace(/_/g, ' ')}</div>}
                    {task.materialImagenes && <div>Imágenes: {task.materialImagenes.replace(/_/g, ' ')}</div>}
                  </div>
                </div>
              )}
              
              {task.esUrgencia && (
                <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px' }}>
                  <strong style={{ color: '#ef4444' }}>⚠️ URGENCIA</strong>
                </div>
              )}
              
              {task.fechaLimiteBrief && (
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#e5e7eb' }}>Fecha Límite:</strong> {
                    task.fechaLimiteBrief 
                      ? (() => {
                          try {
                            return new Date(task.fechaLimiteBrief).toLocaleDateString('es-AR')
                          } catch (e) {
                            return task.fechaLimiteBrief
                          }
                        })()
                      : 'N/A'
                  }
                </div>
              )}
            </div>
          )}

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
                value={deadlineBrief ? (() => {
                  try {
                    const date = new Date(deadlineBrief)
                    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0]
                  } catch {
                    return ''
                  }
                })() : ''}
                onChange={(e) => {
                  try {
                    setDeadlineBrief(e.target.value ? new Date(e.target.value).toISOString() : '')
                  } catch {
                    setDeadlineBrief('')
                  }
                }}
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

          {showImpresionOpFields ? (
            <>
              <div className="form-group">
                <label>Ítems con metros (opcional)</label>
                <p className="form-hint-muted">
                  Varias piezas con tipo y m². Si hay ítems, el total de m² de la OP se calcula como la suma. Sugerencias
                  como en etiquetas.
                </p>
                {lineasMetrosM2.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginBottom: 8,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div
                      className="tag-input-row"
                      style={{ flex: '1 1 160px', minWidth: 140, alignSelf: 'flex-start' }}
                    >
                      <input
                        type="text"
                        placeholder="Tipo / pieza"
                        value={row.tipo}
                        onChange={(e) => {
                          const next = [...lineasMetrosM2]
                          next[idx] = { ...next[idx], tipo: e.target.value }
                          setLineasMetrosM2(next)
                        }}
                        onFocus={() => setFocusedLineaTipoIdx(idx)}
                        onBlur={() =>
                          setTimeout(() => {
                            setFocusedLineaTipoIdx((cur) => (cur === idx ? null : cur))
                          }, 200)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const sug = getLineaTipoSuggestions(idx)[0]
                            if (sug) {
                              const next = [...lineasMetrosM2]
                              next[idx] = { ...next[idx], tipo: sug }
                              setLineasMetrosM2(next)
                            }
                          } else if (e.key === 'Escape') {
                            setFocusedLineaTipoIdx(null)
                          }
                        }}
                      />
                      {focusedLineaTipoIdx === idx && getLineaTipoSuggestions(idx).length > 0 && (
                        <div className="tag-suggestions-dropdown">
                          {getLineaTipoSuggestions(idx).map((suggestion) => {
                            const c = pillColorFromString(suggestion)
                            return (
                              <div
                                key={suggestion}
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                  const next = [...lineasMetrosM2]
                                  next[idx] = { ...next[idx], tipo: suggestion }
                                  setLineasMetrosM2(next)
                                  setFocusedLineaTipoIdx(null)
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '3px',
                                    backgroundColor: c,
                                    flexShrink: 0
                                  }}
                                />
                                <span>{suggestion}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="m²"
                      value={row.metrosCuadrados || ''}
                      onChange={(e) => {
                        const next = [...lineasMetrosM2]
                        const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
                        next[idx] = { ...next[idx], metrosCuadrados: Number.isFinite(v) ? v : 0 }
                        setLineasMetrosM2(next)
                      }}
                      style={{ width: 96, alignSelf: 'center' }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ alignSelf: 'center' }}
                      onClick={() => setLineasMetrosM2(lineasMetrosM2.filter((_, i) => i !== idx))}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setLineasMetrosM2([...lineasMetrosM2, { tipo: '', metrosCuadrados: 0 }])
                  }
                >
                  + Agregar ítem
                </button>
              </div>

              <div className="form-group">
                <label>Metros cuadrados (m²){lineasMetrosM2.length > 0 ? ' — total calculado' : ''}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.metrosCuadrados ?? ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseFloat(e.target.value)
                    setFormData({ ...formData, metrosCuadrados: value ?? undefined })
                  }}
                  placeholder="Ej: 6.24 (opcional salvo reglas de Taller Gráfico al crear la OP)"
                  disabled={lineasMetrosM2.length > 0}
                />
                <small style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Disponible en cualquier sector. En Taller Gráfico, si lo dejás vacío, a veces se puede inferir desde
                  dimensiones en la descripción (ej. 290CM × 215CM).
                </small>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Metros cuadrados (m²)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.metrosCuadrados ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : parseFloat(e.target.value)
                  setFormData({ ...formData, metrosCuadrados: value ?? undefined })
                }}
                placeholder="Ej: 6.24 (opcional)"
              />
              <small style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                En el tablero de OP podés cargar tipo de impresión e ítems detallados.
              </small>
            </div>
          )}

          {/* Campos específicos de Taller Gráfico */}
          {task.assignedSector === 'Taller Gráfico' && (
            <div className="form-group">
              <label>Etapa en Taller Gráfico</label>
              <select
                value={formData.etapaTallerGrafico || ''}
                onChange={(e) => {
                  setFormData({ ...formData, etapaTallerGrafico: e.target.value || undefined })
                }}
              >
                <option value="">Sin etapa asignada</option>
                <option value="Falta Material para Impresión o archivo">Falta Material para Impresión o archivo</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Para Cortar o Pegar">Para Cortar o Pegar</option>
                <option value="Para Rotular">Para Rotular</option>
                <option value="Instalaciones/Ploteo">Instalaciones/Ploteo</option>
                <option value="Metalurgica Instalacion">Metalurgica Instalacion</option>
                <option value="laminas">laminas</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Etiquetas (colores automáticos)</label>
            <div className="tag-input-row">
              <input
                type="text"
                placeholder="Ej: Urgente, Cliente VIP..."
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value)
                }}
                onFocus={() => {
                  setIsTagInputFocused(true)
                  if (tagSuggestions.length > 0) setIsTagDropdownOpen(true)
                }}
                onBlur={() => {
                  setIsTagInputFocused(false)
                  // Delay para permitir click en sugerencias
                  setTimeout(() => setIsTagDropdownOpen(false), 200)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (tagSuggestions.length > 0) {
                      handleSelectTagSuggestion(tagSuggestions[0])
                    } else {
                      handleAddTag()
                    }
                  } else if (e.key === 'Escape') {
                    setIsTagDropdownOpen(false)
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={handleAddTag}>
                + Agregar
              </button>
              {isTagDropdownOpen && tagSuggestions.length > 0 && (
                <div className="tag-suggestions-dropdown">
                  {tagSuggestions.map((suggestion) => {
                    const etiqueta = etiquetasDisponibles.find(e => e.nombre === suggestion)
                    const tagColor = etiqueta?.color || tagColors.get(suggestion.toLowerCase()) || '#6B7280'
                    return (
                      <div
                        key={suggestion}
                        onClick={() => handleSelectTagSuggestion(suggestion)}
                        onMouseDown={(e) => {
                          // Prevenir que el blur del input cierre el dropdown
                          e.preventDefault()
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            backgroundColor: tagColor,
                            flexShrink: 0
                          }}
                        />
                        <span>{suggestion}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {tags.length > 0 && (
              <div className="selected-tags" style={{ marginTop: '8px' }}>
                {tags.map((tag) => {
                  const tagStr = String(tag ?? '').trim()
                  if (!tagStr) return null
                  const tagColor =
                    tagColors.get(tagStr.toLowerCase()) ||
                    etiquetasDisponibles.find(
                      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === tagStr.toLowerCase()
                    )?.color ||
                    '#6B7280'
                  return (
                    <span 
                      key={tagStr} 
                      className="tag selected"
                      style={{
                        backgroundColor: tagColor,
                        borderColor: tagColor,
                        color: '#ffffff',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      {tagStr}
                      <button type="button" onClick={() => handleRemoveTag(tagStr)}>
                        ×
                      </button>
                    </span>
                  )
                })}
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
                {taskHistory.map((entryRaw) => {
                  const entry = entryRaw as HistorialMovimiento & {
                    cambios_detallados?: any
                  }
                  // Usar nombre_usuario directamente del historial (ya viene de la BD)
                  const nombreUsuario = (entry as any).nombre_usuario || 
                    teamMembers.find((m) => m.id === entry.id_usuario.toString())?.name || 
                    `Usuario ${entry.id_usuario}`
                  
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
                      {entry.comentario && (
                        <p className="history-comment">{entry.comentario}</p>
                      )}
                      {entry.cambios_detallados && (entry.cambios_detallados as any).metros_cuadrados && (
                        <p className="history-comment">
                          Metros cuadrados modificados:{' '}
                          {((entry.cambios_detallados as any).metros_cuadrados as any)
                            .anterior !== undefined &&
                          ((entry.cambios_detallados as any).metros_cuadrados as any)
                            .anterior !== null
                            ? `de ${
                                ((entry.cambios_detallados as any)
                                  .metros_cuadrados as any).anterior
                              } `
                            : ''}
                          a{' '}
                          {((entry.cambios_detallados as any).metros_cuadrados as any)
                            .nuevo}
                          {' '}m²
                        </p>
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

          {/* Ficha técnica PDF + incompleta: fichas No OP y OP convertidas desde ficha (historial) */}
          {muestraFichaTecnicaPdfEIncompleta && (
            <div className="form-group">
              <label>Ficha Técnica</label>
              {task.esFichaNoOP !== true && task.numeroFichaOriginal && (
                <p className="form-hint" style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.85rem', opacity: 0.85 }}>
                  Orden convertida desde {task.numeroFichaOriginal}. Podés subir un PDF nuevo y desmarcar &quot;ficha incompleta&quot; para quitar el resaltado en el tablero.
                </p>
              )}
              {fichaTecnicaUrl ? (
                <div className="ficha-tecnica-section">
                  <div className="ficha-tecnica-info">
                    <span className="ficha-tecnica-icon">📄</span>
                    <span className="ficha-tecnica-text">Ficha técnica cargada</span>
                    <div className="ficha-tecnica-actions">
                      <button
                        type="button"
                        className="btn-view-pdf"
                        onClick={() => {
                          if (fichaTecnicaUrl) {
                            window.open(fichaTecnicaUrl, '_blank')
                          }
                        }}
                      >
                        Ver PDF
                      </button>
                      <button
                        type="button"
                        className="btn-download-pdf"
                        onClick={() => {
                          if (fichaTecnicaUrl) {
                            const link = document.createElement('a')
                            link.href = fichaTecnicaUrl
                            link.download = `Ficha-Tecnica-${task.opNumber || 'sin-op'}.pdf`
                            link.target = '_blank'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          }
                        }}
                      >
                        Descargar
                      </button>
                      <button
                        type="button"
                        className="btn-replace-pdf"
                        onClick={() => {
                          setFichaTecnicaUrl(null)
                          setFichaTecnicaFile(null)
                          if (fichaTecnicaInputRef.current) {
                            fichaTecnicaInputRef.current.value = ''
                          }
                        }}
                      >
                        Reemplazar
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <iframe
                      src={fichaTecnicaUrl}
                      title={`Ficha técnica ${task.opNumber || ''}`}
                      style={{
                        width: '100%',
                        height: 420,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        background: '#0b1020'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="ficha-tecnica-upload-section">
                  <input
                    ref={fichaTecnicaInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && file.type === 'application/pdf') {
                        setFichaTecnicaFile(file)
                      } else {
                        alert('Por favor selecciona un archivo PDF')
                        if (fichaTecnicaInputRef.current) {
                          fichaTecnicaInputRef.current.value = ''
                        }
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="select-file-button"
                    onClick={() => fichaTecnicaInputRef.current?.click()}
                  >
                    Seleccionar archivo
                  </button>
                  <span className="file-name">
                    {fichaTecnicaFile ? fichaTecnicaFile.name : 'Ningún archivo seleccionado'}
                  </span>
                  {fichaTecnicaFile && !fichaTecnicaUrl && (
                    <button
                      type="button"
                      className="upload-button"
                      onClick={async () => {
                        if (!fichaTecnicaFile) return
                        setUploadingFichaTecnica(true)
                        try {
                          const url = await uploadAttachmentAndGetUrl(fichaTecnicaFile, 'fichas-tecnicas')
                          setFichaTecnicaUrl(url)
                        } catch (error) {
                          console.error('Error subiendo ficha técnica:', error)
                          alert('Error al subir el archivo PDF')
                        } finally {
                          setUploadingFichaTecnica(false)
                        }
                      }}
                      disabled={uploadingFichaTecnica}
                    >
                      {uploadingFichaTecnica ? 'Subiendo...' : 'Subir'}
                    </button>
                  )}
                  {fichaTecnicaUrl && (
                    <span className="upload-success">✓ Archivo subido</span>
                  )}
                </div>
              )}
              <div className="planilla-preliminar-section" style={{ marginTop: '14px' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fichaTecnicaIncompleta}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setFichaTecnicaIncompleta(nuevoValor)
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          ficha_tecnica_incompleta: nuevoValor
                        })
                      }
                    }}
                  />
                  <span>Ficha técnica incompleta (marcado manual)</span>
                </label>
              </div>
            </div>
          )}

          {/* Sección de Planilla Preliminar (fichas No OP o OP convertidas desde ficha) */}
          {(task?.esFichaNoOP || (task?.numeroFichaOriginal != null && String(task.numeroFichaOriginal).trim() !== '')) && (
            <div className="form-group">
              <label>Estado Planilla Preliminar</label>
              <div className="planilla-preliminar-section">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={planillaPreliminar}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setPlanillaPreliminar(nuevoValor)
                      
                      // Guardar inmediatamente
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          planilla_preliminar: nuevoValor
                        })
                        
                        // Verificar ficha relacionada después de actualizar
                        if (task.opNumber) {
                          await checkFichaRelacionadaPlanillaPreliminar(task.opNumber, task.assignedSector || '')
                        }
                      }
                    }}
                  />
                  <span>Marcar como Planilla Preliminar</span>
                </label>
                {fichaRelacionadaTienePlanillaPreliminar && (
                  <div className="info-message" style={{ 
                    marginTop: '12px', 
                    padding: '8px 12px', 
                    background: 'rgba(6, 182, 212, 0.1)', 
                    border: '1px solid rgba(6, 182, 212, 0.3)', 
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#06b6d4'
                  }}>
                    ℹ️ La ficha relacionada está marcada como Planilla Preliminar. Puedes avanzar con los checklists.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sección de Checklists (fichas No OP).
              En DT, Presupuestos necesita verlos siempre al llegar a su columna. */}
          {(task?.esFichaNoOP ||
            (task?.numeroFichaOriginal != null && String(task.numeroFichaOriginal).trim() !== '')) &&
            (task.status === 'presupuestos' ||
              task.assignedSector === 'Presupuestos' ||
              planillaPreliminar ||
              fichaRelacionadaTienePlanillaPreliminar) && (
            <div className="form-group">
              <label>Checklist</label>
              <div className="checklist-section">
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoArmado}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setPresupuestoArmado(nuevoValor)
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          presupuesto_armado: nuevoValor
                        })
                        await apiService.notificarChecklistFichaNoOP(
                          ordenId,
                          'presupuesto_armado',
                          task.opNumber || 'Sin ficha'
                        )
                      }
                    }}
                  />
                  <span>ARMADO</span>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={fichaTecnicaCargada}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setFichaTecnicaCargada(nuevoValor)
                      
                      // Guardar inmediatamente
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          ficha_tecnica_cargada: nuevoValor
                        })
                        
                        // Notificar a Presupuestos si se marca
                        if (nuevoValor) {
                          await apiService.notificarChecklistFichaNoOP(
                            ordenId,
                            'ficha_tecnica_cargada',
                            task.opNumber || 'Sin ficha'
                          )
                        }
                      }
                    }}
                  />
                  <span>FICHA TECNICA CARGADA</span>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoEnviado}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setPresupuestoEnviado(nuevoValor)
                      
                      // Guardar inmediatamente
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          presupuesto_enviado_cliente: nuevoValor
                        })
                        
                        // Notificar a Asesor Técnico si se marca
                        if (nuevoValor) {
                          await apiService.notificarChecklistFichaNoOP(
                            ordenId,
                            'presupuesto_enviado',
                            task.opNumber || 'Sin ficha'
                          )
                        }
                      }
                    }}
                  />
                  <span>PRESUPUESTO ENVIADO AL CLIENTE</span>
                </label>
                <label className="checklist-item">
                  <input
                    type="checkbox"
                    checked={presupuestoEnEspera}
                    onChange={async (e) => {
                      const nuevoValor = e.target.checked
                      setPresupuestoEnEspera(nuevoValor)
                      const ordenId = parseTaskIdToOrdenId(task.id)
                      if (ordenId) {
                        await apiService.updateOrden(ordenId, {
                          presupuesto_en_espera: nuevoValor
                        })
                        await apiService.notificarChecklistFichaNoOP(
                          ordenId,
                          'presupuesto_en_espera',
                          task.opNumber || 'Sin ficha'
                        )
                      }
                    }}
                  />
                  <span>EN ESPERA</span>
                </label>
              </div>
            </div>
          )}

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
            <p className="form-hint-muted">
              Como etiquetas: catálogo con sugerencias en desplegable y pastillas con color; cantidad en cada pastilla.
            </p>
            <div className="tag-input-row">
              <input
                type="text"
                placeholder="Buscar precargado o escribir material..."
                value={materialSearch}
                onChange={(e) => {
                  const value = e.target.value
                  setMaterialSearch(value)
                  const q = value.trim().toLowerCase()
                  const hasAny = materiales.some((mat) => {
                    const label = String(mat.descripcion?.trim() || mat.codigo || '').trim()
                    if (!label) return false
                    if (materials.some((m) => String(m.name ?? '').toLowerCase() === label.toLowerCase())) {
                      return false
                    }
                    if (!q) return true
                    const des = (mat.descripcion || '').toLowerCase()
                    const cod = String(mat.codigo ?? '').toLowerCase()
                    return des.includes(q) || cod.includes(q)
                  })
                  setIsMaterialDropdownOpen(hasAny && materiales.length > 0)
                }}
                onFocus={() => {
                  if (materiales.length > 0) setIsMaterialDropdownOpen(true)
                }}
                onBlur={() => setTimeout(() => setIsMaterialDropdownOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filteredMaterials.length > 0) {
                      handleSelectMaterial(filteredMaterials[0])
                    } else {
                      handleAddMaterial()
                    }
                  } else if (e.key === 'Escape') {
                    setIsMaterialDropdownOpen(false)
                  }
                }}
              />
              <button type="button" className="btn-secondary" onClick={handleAddMaterial}>
                + Agregar
              </button>
              {isMaterialDropdownOpen && filteredMaterials.length > 0 && (
                <div className="tag-suggestions-dropdown">
                  {filteredMaterials.map((material) => {
                    const label = String(material.descripcion?.trim() || material.codigo || '').trim()
                    const c = pillColorFromString(label)
                    return (
                      <div
                        key={material.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectMaterial(material)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            borderRadius: '3px',
                            backgroundColor: c,
                            flexShrink: 0,
                            marginTop: '3px'
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{material.descripcion || label}</div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted, #9ca3af)',
                              marginTop: '2px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              alignItems: 'center'
                            }}
                          >
                            {material.codigo != null && material.codigo !== '' && (
                              <span>Cód. {material.codigo}</span>
                            )}
                            {material.stock !== null && material.stock !== undefined && (
                              <span
                                style={{
                                  fontWeight: 600,
                                  color:
                                    material.stock <= 0
                                      ? '#f87171'
                                      : material.stock <= 10
                                        ? '#fbbf24'
                                        : '#22c55e'
                                }}
                              >
                                Stock: {material.stock}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {materials.length > 0 && (
              <div className="selected-tags" style={{ marginTop: '8px' }}>
                {materials.map((material, index) => {
                  const pillColor = pillColorFromString(material.name)
                  return (
                    <span
                      key={`${material.name}-${index}`}
                      className="tag selected material-tag-pill"
                      style={{
                        backgroundColor: pillColor,
                        borderColor: pillColor,
                        color: '#ffffff'
                      }}
                    >
                      <span className="material-tag-name">{material.name}</span>
                      <input
                        type="number"
                        className="material-tag-qty"
                        min="0"
                        step="0.001"
                        title="Cantidad"
                        value={material.quantity}
                        onChange={(e) => {
                          const newMaterials = [...materials]
                          newMaterials[index].quantity = parseFloat(e.target.value) || 0
                          setMaterials(newMaterials)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button type="button" onClick={() => handleRemoveMaterial(index)}>
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              {requiereFotosLugarEdit
                ? 'Archivos adjuntos — acá va la foto REAL del lugar (obligatoria) y, si querés, PDF u otras imágenes de apoyo'
                : 'Archivos Adjuntos'}
            </label>
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
                            void handleRemoveFile(file.id)
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
                  : requiereFotosLugarEdit && !tieneFotosLugarListasEdit
                    ? 'Elegí una imagen del lugar real y esperá a que termine de subir (no alcanza solo PDF).'
                    : attachments.length === 0
                      ? 'Ningún archivo seleccionado'
                      : `${attachments.length} archivo(s) listo(s)`}
              </span>
            </div>
          </div>
          </fieldset>
        </div>

        <footer className="modal-footer">
          {onDelete && (
            <button
              type="button"
              className="btn-delete"
              disabled={opLocked}
              onClick={() => !opLocked && onDelete(task.id)}
            >
              Eliminar
            </button>
          )}
          <button type="button" className="btn-cancel" onClick={() => onClose(task?.id)}>
            Cancelar
          </button>
          {opLocked && (
            <button
              type="button"
              className="btn-save task-edit-save-cover"
              onClick={() => void handleSavePortada()}
              disabled={
                savingPortada ||
                hasPendingUploads ||
                (formData.photoUrl ?? '').trim() === (task.photoUrl ?? '').trim()
              }
            >
              {savingPortada ? 'Guardando…' : 'Guardar portada'}
            </button>
          )}
          <button
            type="button"
            className="btn-save"
            onClick={handleSave}
            disabled={opLocked || hasPendingUploads || saveBlockedPorFotosLugar}
            title={
              saveBlockedPorFotosLugar
                ? 'Falta la foto real del lugar físico (Instalaciones / Metalúrgica)'
                : undefined
            }
          >
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

      <OpFichaGuiaModal open={guiaFichaOpen} onClose={() => setGuiaFichaOpen(false)} />
    </div>
  )
}

export default TaskEditModal

