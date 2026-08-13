import { useEffect, useRef, useState, useMemo } from 'react'
import type { Task, TeamMember, TaskStatus } from '../types/board'
import type { ClienteRecord, MaterialRecord, SectorRecord, PedidoClienteRecord } from '../types/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { useAuth } from '../hooks/useAuth'
import { filterOperariosBySector } from '../utils/dataMappers'
import apiService from '../services/api'
import { improveOpDescriptionWithPlotAI } from '../utils/improveOpDescriptionPlotAI'
import OpFichaGuiaModal from './OpFichaGuiaModal'
import BriefMockupCard from './BriefMockupCard'
import { attachmentListHasReadySitePhoto, opSectoresRequierenFotosLugar } from '../utils/sectoresFotosLugar'
import { getRecentTiposImpresionOp } from '../utils/opImpresionRecientes'
import { pillColorFromString } from '../utils/pillColorFromString'
import { normalizeHoraEstimada } from '../utils/horaEstimada'
import OpCobroFooterChecks from './OpCobroFooterChecks'
import {
  cobroOpToTaskFields,
  type CobroOpEstado
} from '../utils/opCobroEstado'
import {
  clearOpCreateDraft,
  formatOpCreateDraftSavedAt,
  isOpCreateDraftMeaningful,
  loadOpCreateDraft,
  saveOpCreateDraft,
  type OpCreateDraftData
} from '../utils/opCreateDraft'
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
  type?: string // MIME type del archivo
  file?: File // Referencia al archivo original para descarga
}

const COMPLEXITY_OPTIONS = ['Baja', 'Media', 'Alta']
const PRIORITY_OPTIONS = ['Normal', 'Alta', 'Media', 'Baja']

const TaskCreateModal = ({
  teamMembers,
  sectores,
  materiales,
  onClose,
  onCreate
}: TaskCreateModalProps) => {
  const { usuario, nombreVisible, isAdmin, isDiseno } = useAuth()
  const draftUserKey = String(usuario?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('usuario_id') : '') || 'anon')
  const [briefTokenSeleccionado, setBriefTokenSeleccionado] = useState<string | null>(null)
  const [briefMockupUrl, setBriefMockupUrl] = useState<string | null>(null)
  const [briefsPendientes, setBriefsPendientes] = useState<any[]>([])
  const [loadingBriefs, setLoadingBriefs] = useState(false)
  const [mostrarSelectorBrief, setMostrarSelectorBrief] = useState(false)
  const [pedidoWebSeleccionado, setPedidoWebSeleccionado] = useState<PedidoClienteRecord | null>(null)
  const [pedidosWebPendientes, setPedidosWebPendientes] = useState<PedidoClienteRecord[]>([])
  const [loadingPedidosWeb, setLoadingPedidosWeb] = useState(false)
  const [mostrarSelectorPedidoWeb, setMostrarSelectorPedidoWeb] = useState(false)
  
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
    'Entregas taller de Imprenta',
    'Entregas taller gráfico'
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
  const [cobroOp, setCobroOp] = useState<CobroOpEstado>('ninguno')
  const [montoPagoParcialInput, setMontoPagoParcialInput] = useState('')
  const [selectedSectores, setSelectedSectores] = useState<string[]>([])
  const [sectorSearch, setSectorSearch] = useState('')
  const [operario, setOperario] = useState<string>('')
  const [complejidad, setComplejidad] = useState<string>('Media')
  const [prioridad, setPrioridad] = useState<string>('Normal')
  const [descripcion, setDescripcion] = useState('')
  const [plotAiImprovingDesc, setPlotAiImprovingDesc] = useState(false)
  const [guiaFichaOpen, setGuiaFichaOpen] = useState(false)
  const [briefPublico, setBriefPublico] = useState('')
  const [objetivoProyecto, setObjetivoProyecto] = useState('')
  const [publicoObjetivo, setPublicoObjetivo] = useState('')
  const [estiloDiseno, setEstiloDiseno] = useState('')
  const [referencias, setReferencias] = useState('')
  const [deadlineBrief, setDeadlineBrief] = useState('')
  const [materials, setMaterials] = useState<Array<{ name: string; quantity: number }>>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [metrosCuadrados, setMetrosCuadrados] = useState<string>('')
  const [lineasMetrosM2, setLineasMetrosM2] = useState<Array<{ tipo: string; metrosCuadrados: number }>>([])
  const [, setRecentTiposOp] = useState<string[]>(() => getRecentTiposImpresionOp())
  const [lineaTipoSuggestionsByIdx, setLineaTipoSuggestionsByIdx] = useState<Record<number, string[]>>({})
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [etiquetasDisponibles, setEtiquetasDisponibles] = useState<Array<{ nombre: string; veces_usada: number; color: string }>>([])
  const [tagColors, setTagColors] = useState<Map<string, string>>(new Map())
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [isSectorDropdownOpen, setIsSectorDropdownOpen] = useState(false)
  const [isMaterialDropdownOpen, setIsMaterialDropdownOpen] = useState(false)
  const [focusedLineaTipoIdx, setFocusedLineaTipoIdx] = useState<number | null>(null)
  const [isClienteDropdownOpen, setIsClienteDropdownOpen] = useState(false)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClienteRecord[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  /** Nombre ya elegido de la lista: evita reabrir el dropdown y re-autocompletar. */
  const clienteElegidoRef = useRef<string | null>(null)
  const attachmentsRef = useRef<LocalAttachment[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<LocalAttachment | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const draftSnapshotRef = useRef<OpCreateDraftData | null>(null)

  // No necesitamos sector inicial, se crean automáticamente para cada sector requerido

  // Filtrar operarios según el primer sector seleccionado
  const filteredOperarios = useMemo(() => {
    const primerSector = selectedSectores[0]
    return filterOperariosBySector(teamMembers, primerSector)
  }, [teamMembers, selectedSectores])

  useEffect(() => {
    if (!operario && filteredOperarios.length > 0) {
      setOperario(filteredOperarios[0].id)
    }
  }, [filteredOperarios, operario])

  useEffect(() => {
    setRecentTiposOp(getRecentTiposImpresionOp())
  }, [])

  useEffect(() => {
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
  }, [focusedLineaTipoIdx, lineasMetrosM2])

  useEffect(() => {
    if (lineasMetrosM2.length === 0) return
    const sum = lineasMetrosM2.reduce((s, r) => s + (Number(r.metrosCuadrados) || 0), 0)
    setMetrosCuadrados(sum > 0 ? String(sum) : '')
  }, [lineasMetrosM2])

  // Buscar clientes cuando se escribe en el campo cliente
  useEffect(() => {
    const q = cliente.trim()
    // Ya elegido de la lista: no volver a buscar ni reabrir el dropdown sobre el mismo nombre.
    if (q.length < 2 || clienteElegidoRef.current === q.toLowerCase()) {
      setClientesEncontrados([])
      setIsClienteDropdownOpen(false)
      setBuscandoClientes(false)
      return
    }

    let cancelled = false
    const buscarClientes = async () => {
      setBuscandoClientes(true)
      const response = await apiService.buscarClientes(q)
      if (cancelled) return
      if (response.success && response.data && response.data.length > 0) {
        setClientesEncontrados(response.data)
        setIsClienteDropdownOpen(true)
      } else {
        setClientesEncontrados([])
        setIsClienteDropdownOpen(false)
      }
      setBuscandoClientes(false)
    }

    const timeoutId = setTimeout(() => {
      void buscarClientes()
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [cliente])

  const handleSelectCliente = (clienteSeleccionado: ClienteRecord) => {
    clienteElegidoRef.current = clienteSeleccionado.nombre.trim().toLowerCase()
    setCliente(clienteSeleccionado.nombre)
    setDniCuit(clienteSeleccionado.dni_cuit || '')
    setTelefonoCliente(clienteSeleccionado.telefono || '')
    setEmailCliente(clienteSeleccionado.email || '')
    setDireccionCliente(clienteSeleccionado.direccion || '')
    setUbicacionUrl(clienteSeleccionado.ubicacion_link || '')
    setDriveUrl(clienteSeleccionado.drive_link || '')
    setClientesEncontrados([])
    setIsClienteDropdownOpen(false)
    setBuscandoClientes(false)
  }

  // Autocompletar cuando se escribe el nombre exacto de un cliente
  const handleClienteBlur = () => {
    setTimeout(() => {
      setIsClienteDropdownOpen(false)
      const q = cliente.trim()
      if (!q || clienteElegidoRef.current === q.toLowerCase()) return
      // Si hay exactamente un cliente encontrado y coincide con el texto escrito, autocompletar
      if (clientesEncontrados.length === 1) {
        const clienteExacto = clientesEncontrados.find(
          c => c.nombre.toLowerCase() === q.toLowerCase()
        )
        if (clienteExacto) {
          handleSelectCliente(clienteExacto)
        }
      }
    }, 200)
  }

  // Autocompletar cuando se presiona Enter en el campo cliente
  const handleClienteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && clientesEncontrados.length > 0) {
      e.preventDefault()
      // Si hay un solo resultado, seleccionarlo automáticamente
      if (clientesEncontrados.length === 1) {
        handleSelectCliente(clientesEncontrados[0])
      } else if (clientesEncontrados.length > 1) {
        // Si hay múltiples resultados, seleccionar el primero que coincida exactamente
        const clienteExacto = clientesEncontrados.find(
          c => c.nombre.toLowerCase() === cliente.trim().toLowerCase()
        )
        if (clienteExacto) {
          handleSelectCliente(clienteExacto)
        } else {
          // Si no hay coincidencia exacta, seleccionar el primero
          handleSelectCliente(clientesEncontrados[0])
        }
      }
    } else if (e.key === 'Escape') {
      setIsClienteDropdownOpen(false)
    }
  }

  // Brief desde otra pantalla, o recuperar borrador local (autosave)
  useEffect(() => {
    const tokenGuardado = localStorage.getItem('brief_token_seleccionado')
    if (tokenGuardado) {
      setBriefTokenSeleccionado(tokenGuardado)
      localStorage.removeItem('brief_token_seleccionado')
      void cargarBriefDesdeToken(tokenGuardado)
      setDraftReady(true)
      return
    }
    const rec = loadOpCreateDraft(draftUserKey)
    if (rec?.data) {
      const d = rec.data
      setOpNumber(d.opNumber || '')
      setCliente(d.cliente || '')
      if (d.cliente.trim()) clienteElegidoRef.current = d.cliente.trim().toLowerCase()
      setDniCuit(d.dniCuit || '')
      setTelefonoCliente(d.telefonoCliente || '')
      setEmailCliente(d.emailCliente || '')
      setDireccionCliente(d.direccionCliente || '')
      setUbicacionUrl(d.ubicacionUrl || '')
      setDriveUrl(d.driveUrl || '')
      setFechaEntrega(d.fechaEntrega || '')
      setHoraEstimada(d.horaEstimada || '')
      setCobroOp(d.cobroOp || 'ninguno')
      setMontoPagoParcialInput(d.montoPagoParcialInput || '')
      setSelectedSectores(Array.isArray(d.selectedSectores) ? d.selectedSectores : [])
      setOperario(d.operario || '')
      setComplejidad(d.complejidad || 'Media')
      setPrioridad(d.prioridad || 'Normal')
      setDescripcion(d.descripcion || '')
      setBriefPublico(d.briefPublico || '')
      setObjetivoProyecto(d.objetivoProyecto || '')
      setPublicoObjetivo(d.publicoObjetivo || '')
      setEstiloDiseno(d.estiloDiseno || '')
      setReferencias(d.referencias || '')
      setDeadlineBrief(d.deadlineBrief || '')
      setMaterials(Array.isArray(d.materials) ? d.materials : [])
      setPhotoUrl(d.photoUrl || '')
      setMetrosCuadrados(d.metrosCuadrados || '')
      setLineasMetrosM2(Array.isArray(d.lineasMetrosM2) ? d.lineasMetrosM2 : [])
      setTags(Array.isArray(d.tags) ? d.tags : [])
      setTagColors(new Map(Object.entries(d.tagColors || {})))
      setBriefTokenSeleccionado(d.briefTokenSeleccionado)
      setBriefMockupUrl(d.briefMockupUrl)
      setPedidoWebSeleccionado(d.pedidoWebSeleccionado)
      setAttachments(
        (d.attachments || [])
          .filter((a) => a.remoteUrl)
          .map((a) => ({
            id: a.id || `att-${a.remoteUrl}`,
            name: a.name,
            previewUrl: a.remoteUrl,
            remoteUrl: a.remoteUrl,
            uploading: false,
            type: a.type
          }))
      )
      setDraftSavedAt(rec.savedAt)
      setDraftRestored(true)
    }
    setDraftReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidratar una sola vez al abrir
  }, [])

  // Cargar briefs pendientes si es diseño gráfico o admin
  useEffect(() => {
    if ((isAdmin || isDiseno) && mostrarSelectorBrief) {
      cargarBriefsPendientes()
    }
  }, [isAdmin, isDiseno, mostrarSelectorBrief])

  // Cargar pedidos web pendientes si se muestra el selector
  useEffect(() => {
    if (mostrarSelectorPedidoWeb) {
      cargarPedidosWebPendientes()
    }
  }, [mostrarSelectorPedidoWeb])

  const cargarBriefsPendientes = async () => {
    setLoadingBriefs(true)
    try {
      const response = await apiService.listarBriefsPendientes()
      if (response.success && response.data) {
        setBriefsPendientes(response.data)
      }
    } catch (error) {
      console.error('Error cargando briefs pendientes:', error)
    } finally {
      setLoadingBriefs(false)
    }
  }

  const cargarBriefDesdeToken = async (token: string) => {
    try {
      const response = await apiService.obtenerBriefPorToken(token)
      if (response.success && response.data) {
        const brief = response.data
        // Prellenar campos con datos del brief
        if (brief.cliente_nombre_completo) {
          setCliente(brief.cliente_nombre_completo)
        }
        if (brief.cliente_empresa) {
          setCliente(prev => prev ? `${prev} - ${brief.cliente_empresa}` : brief.cliente_empresa)
        }
        if (brief.telefono_cliente) {
          setTelefonoCliente(brief.telefono_cliente)
        }
        if (brief.email_cliente) {
          setEmailCliente(brief.email_cliente)
        }
        if (brief.brief_publico) {
          setBriefPublico(brief.brief_publico)
        }
        if (brief.objetivo_proyecto) {
          setObjetivoProyecto(brief.objetivo_proyecto)
        }
        if (brief.estilo_diseno) {
          setEstiloDiseno(brief.estilo_diseno)
        }
        if (brief.referencias) {
          setReferencias(brief.referencias)
        }
        if (brief.fecha_limite_brief) {
          setDeadlineBrief(brief.fecha_limite_brief)
        }
        setBriefMockupUrl(brief.mockup_url || null)
      }
    } catch (error) {
      console.error('Error cargando brief desde token:', error)
    }
  }

  const handleSeleccionarBrief = async (brief: any) => {
    setBriefTokenSeleccionado(brief.token)
    await cargarBriefDesdeToken(brief.token)
    setMostrarSelectorBrief(false)
  }

  const cargarPedidosWebPendientes = async () => {
    setLoadingPedidosWeb(true)
    try {
      const response = await apiService.getPedidosPendientes()
      if (response.success && response.data) {
        setPedidosWebPendientes(response.data)
      }
    } catch (error) {
      console.error('Error cargando pedidos web pendientes:', error)
    } finally {
      setLoadingPedidosWeb(false)
    }
  }

  const cargarPedidoWebCompleto = async (idPedido: number) => {
    try {
      const response = await apiService.getDetallePedidoCliente(idPedido)
      if (response.success && response.data) {
        const detalle = response.data
        const pedido = detalle.pedido as any
        const clienteData = pedido.cliente as any

        // Autocompletar datos del cliente
        if (clienteData) {
          const nombreCompleto = clienteData.apellido 
            ? `${clienteData.nombre} ${clienteData.apellido}`
            : clienteData.nombre
          clienteElegidoRef.current = String(nombreCompleto || '').trim().toLowerCase()
          setCliente(nombreCompleto)
          setDniCuit(clienteData.dni_cuit || '')
          setTelefonoCliente(clienteData.telefono || '')
          setEmailCliente(clienteData.email || '')
          setDireccionCliente(clienteData.direccion || '')
        }

        // Autocompletar datos del pedido
        if (pedido.fecha_limite_deseada) {
          setFechaEntrega(pedido.fecha_limite_deseada)
        }
        if (pedido.observaciones_cliente) {
          setDescripcion(pedido.observaciones_cliente)
        }
        if (pedido.brief_publico) {
          setBriefPublico(pedido.brief_publico)
        }
        if (pedido.objetivo_proyecto) {
          setObjetivoProyecto(pedido.objetivo_proyecto)
        }
        if (pedido.estilo_diseno) {
          setEstiloDiseno(pedido.estilo_diseno)
        }
        if (pedido.referencias) {
          setReferencias(pedido.referencias)
        }
        if (pedido.es_urgente) {
          setPrioridad('Alta')
        }
        if (pedido.requiere_delivery && pedido.direccion_delivery) {
          setDireccionCliente(pedido.direccion_delivery)
        }
      }
    } catch (error) {
      console.error('Error cargando detalle del pedido web:', error)
    }
  }

  const handleSeleccionarPedidoWeb = async (pedido: PedidoClienteRecord) => {
    setPedidoWebSeleccionado(pedido)
    await cargarPedidoWebCompleto(pedido.id)
    setMostrarSelectorPedidoWeb(false)
  }

  const hasPendingUploads = attachments.some((attachment) => attachment.uploading)

  const requiereFotosLugar = useMemo(() => opSectoresRequierenFotosLugar(selectedSectores), [selectedSectores])

  const tieneFotosLugarListas = useMemo(
    () => attachmentListHasReadySitePhoto(attachments),
    [attachments]
  )

  const createBlockedPorFotos = requiereFotosLugar && !tieneFotosLugarListas

  const buildDraftSnapshot = (): OpCreateDraftData => ({
    opNumber,
    cliente,
    dniCuit,
    telefonoCliente,
    emailCliente,
    direccionCliente,
    ubicacionUrl,
    driveUrl,
    fechaEntrega,
    horaEstimada,
    cobroOp,
    montoPagoParcialInput,
    selectedSectores,
    operario,
    complejidad,
    prioridad,
    descripcion,
    briefPublico,
    objetivoProyecto,
    publicoObjetivo,
    estiloDiseno,
    referencias,
    deadlineBrief,
    materials,
    photoUrl,
    metrosCuadrados,
    lineasMetrosM2,
    tags,
    tagColors: Object.fromEntries(tagColors),
    briefTokenSeleccionado,
    briefMockupUrl,
    pedidoWebSeleccionado,
    attachments: attachments
      .filter((a) => a.remoteUrl && !a.uploading)
      .map((a) => ({
        id: a.id,
        name: a.name,
        remoteUrl: a.remoteUrl as string,
        type: a.type
      }))
  })

  draftSnapshotRef.current = buildDraftSnapshot()

  const persistDraftNow = () => {
    const snap = draftSnapshotRef.current || buildDraftSnapshot()
    if (!isOpCreateDraftMeaningful(snap)) {
      clearOpCreateDraft(draftUserKey)
      setDraftSavedAt(null)
      setDraftSaving(false)
      return false
    }
    const ts = saveOpCreateDraft(draftUserKey, snap)
    setDraftSavedAt(ts)
    setDraftSaving(false)
    return true
  }

  const handleCloseKeepDraft = () => {
    persistDraftNow()
    onClose()
  }

  const handleSaveDraftAndClose = () => {
    const ok = persistDraftNow()
    if (!ok) {
      alert('No hay datos para guardar como borrador.')
      return
    }
    onClose()
  }

  const handleDiscardDraft = () => {
    if (!confirm('¿Descartar el borrador de esta orden? Se pierde lo cargado.')) return
    clearOpCreateDraft(draftUserKey)
    setDraftRestored(false)
    setDraftSavedAt(null)
    onClose()
  }

  useEffect(() => {
    if (!draftReady) return
    const snap = buildDraftSnapshot()
    if (!isOpCreateDraftMeaningful(snap)) return
    setDraftSaving(true)
    const t = window.setTimeout(() => {
      const ts = saveOpCreateDraft(draftUserKey, snap)
      setDraftSavedAt(ts)
      setDraftSaving(false)
    }, 800)
    return () => window.clearTimeout(t)
    // Campos del formulario: el snapshot se arma en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftReady,
    draftUserKey,
    opNumber,
    cliente,
    dniCuit,
    telefonoCliente,
    emailCliente,
    direccionCliente,
    ubicacionUrl,
    driveUrl,
    fechaEntrega,
    horaEstimada,
    cobroOp,
    montoPagoParcialInput,
    selectedSectores,
    operario,
    complejidad,
    prioridad,
    descripcion,
    briefPublico,
    objetivoProyecto,
    publicoObjetivo,
    estiloDiseno,
    referencias,
    deadlineBrief,
    materials,
    photoUrl,
    metrosCuadrados,
    lineasMetrosM2,
    tags,
    tagColors,
    briefTokenSeleccionado,
    briefMockupUrl,
    pedidoWebSeleccionado,
    attachments
  ])

  const handleImproveDescriptionPlotAI = async () => {
    const hasAny =
      descripcion.trim() ||
      cliente.trim() ||
      opNumber.trim() ||
      selectedSectores.length > 0 ||
      briefPublico.trim()
    if (!hasAny) {
      alert('Completá al menos cliente, OP, sectores, descripción o brief para dar contexto a PlotAI.')
      return
    }

    setPlotAiImprovingDesc(true)
    try {
      const improved = await improveOpDescriptionWithPlotAI({
        currentDescription: descripcion,
        clientOrTitle: cliente.trim() || undefined,
        opNumber: opNumber.trim() || undefined,
        sector: selectedSectores.length ? selectedSectores.join(', ') : undefined,
        briefExcerpt: briefPublico.trim() || undefined,
      })
      if (!improved) {
        alert('PlotAI no devolvió texto. Intentá de nuevo.')
        return
      }
      setDescripcion(improved)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al mejorar con PlotAI.')
    } finally {
      setPlotAiImprovingDesc(false)
    }
  }

  const handleCreate = async (openChecklist = false) => {
    if (!opNumber || !cliente) {
      alert('Por favor completa los campos obligatorios: N° OP y Cliente')
      return
    }

    // DNI y teléfono solo obligatorios en alta manual (sin brief ni pedido web).
    const altaManual = !briefTokenSeleccionado && !pedidoWebSeleccionado
    if (altaManual && !dniCuit.trim()) {
      alert('El DNI / CUIT del cliente es obligatorio.')
      return
    }

    if (altaManual && !telefonoCliente.trim()) {
      alert('El teléfono del cliente es obligatorio.')
      return
    }

    // Requerir al menos un sector
    if (selectedSectores.length === 0) {
      alert('Por favor selecciona al menos un sector requerido')
      return
    }

    if (!descripcion.trim()) {
      alert(
        'La descripción del trabajo es obligatoria. Detallá qué hay que producir, materiales, cantidades y plazos. Usá el botón «Cómo llenar la ficha» junto a PlotAI si necesitás ayuda.'
      )
      return
    }

    if (hasPendingUploads) {
      alert('Espera a que termine la subida de archivos antes de crear la orden.')
      return
    }

    // Guardar/actualizar cliente antes de crear la OP
    const clienteResponse = await apiService.buscarOCrearCliente({
      nombre: cliente.trim(),
      dni_cuit: dniCuit.trim() || undefined,
      telefono: telefonoCliente.trim() || undefined,
      email: emailCliente.trim() || undefined,
      direccion: direccionCliente.trim() || undefined,
      ubicacion_link: ubicacionUrl.trim() || undefined,
      drive_link: driveUrl.trim() || undefined
    })

    if (!clienteResponse.success) {
      console.warn('⚠️ No se pudo guardar/actualizar el cliente:', clienteResponse.error)
      // Continuar de todas formas, pero mostrar advertencia
    }

    // fecha_entrega en BD es DATE; la hora va en hora_estimada (HH:MM)
    const horaNorm = normalizeHoraEstimada(horaEstimada)
    const dueDate = fechaEntrega
      ? `${fechaEntrega}T${horaNorm || '12:00'}:00-03:00`
      : ''

    const creatorName = nombreVisible || 'Usuario'

    // Mapear el primer sector al status correspondiente (primera ficha de la OP en el tablero)
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
        'Entregas taller de Imprenta': 'finalizado-taller',
        'Almacén de Entrega': 'almacen-entrega',
        'Entregas taller gráfico': 'almacen-entrega',
        'Entregas taller grafico': 'almacen-entrega'
      }
      return sectorMap[sector] || 'diseno-grafico'
    }

    // Primer sector = columna inicial de la OP; si hay más sectores, la BD crea fichas adicionales de la misma OP
    const primerSector = selectedSectores[0]
    const requiereMetrosTG = selectedSectores.includes('Taller Gráfico')
    const metrosValParseado = parseFloat((metrosCuadrados || '').replace(',', '.'))
    const sumLineasM2 = lineasMetrosM2.reduce((s, r) => s + (Number(r.metrosCuadrados) || 0), 0)
    const hayLineasConM2 = lineasMetrosM2.some((r) => (Number(r.metrosCuadrados) || 0) > 0)
    const metrosManualValidos =
      metrosCuadrados.trim() && !Number.isNaN(metrosValParseado) && metrosValParseado > 0
    const metrosIngresadosValidos = hayLineasConM2 || metrosManualValidos

    if (requiereMetrosTG) {
      if (!metrosIngresadosValidos) {
        alert('Si la OP incluye Taller Gráfico, los metros cuadrados (m²) son obligatorios (manual o sumando ítems).')
        return
      }
    }

    if (requiereFotosLugar && !tieneFotosLugarListas) {
      alert(
        'Instalaciones / Metalúrgica: falta la FOTO REAL DEL LUGAR (el sitio físico donde se instala o monta). Subí al menos una imagen sacada ahí; un PDF o render no reemplaza eso.'
      )
      return
    }

    console.log('🏷️ [TaskCreateModal] Tags antes de crear orden:', tags)
    console.log('🏷️ [TaskCreateModal] Tags es array:', Array.isArray(tags))
    console.log('🏷️ [TaskCreateModal] Tags length:', tags?.length)
    
    const newTask: Omit<Task, 'id'> & { attachments?: LocalAttachment[] } = {
      opNumber,
      title: cliente,
      dniCuit: dniCuit.trim() || undefined,
      summary: descripcion.trim(),
      status: mapSectorToStatus(primerSector),
      priority: (prioridad.toLowerCase() === 'normal' ? 'media' : prioridad.toLowerCase()) as any,
      ownerId: operario || teamMembers[0]?.id || '',
      createdBy: creatorName,
      materials: materials.map((m) => m.name),
      assignedSector: primerSector, // Primer sector (se crearán automáticamente las demás)
      sectores: selectedSectores, // Sectores de la OP; N>1 → trigger crea N fichas tablero con mismo N° OP
      esSubTarea: false, // Ficha principal de la OP (no subtarea checklist)
      photoUrl: photoUrl || '',
      tags: tags && tags.length > 0 ? tags : [], // Asegurar que siempre sea un array
      storyPoints: 0,
      progress: 0,
      createdAt: new Date().toISOString(),
      dueDate,
      estimatedTime: horaNorm,
      ...cobroOpToTaskFields(cobroOp, montoPagoParcialInput),
      updatedAt: new Date().toISOString(),
      impact: 'media',
      clientPhone: telefonoCliente.trim() || undefined,
      clientEmail: emailCliente.trim() || undefined,
      clientAddress: direccionCliente.trim() || undefined,
      // El link de WhatsApp se genera automáticamente a partir del teléfono en el mapper
      locationUrl: ubicacionUrl.trim() || undefined,
      driveUrl: driveUrl.trim() || undefined,
      attachments: attachments.filter(a => a.remoteUrl && !a.uploading), // Solo archivos listos
      briefPublico: briefPublico.trim() || undefined,
      objetivoProyecto: objetivoProyecto.trim() || undefined,
      publicoObjetivo: publicoObjetivo.trim() || undefined,
      estiloDiseno: estiloDiseno.trim() || undefined,
      referencias: referencias.trim() || undefined,
      deadlineBrief: deadlineBrief || undefined,
      lineasMetrosM2: lineasMetrosM2
        .filter((r) => (Number(r.metrosCuadrados) || 0) > 0)
        .map(({ tipo, metrosCuadrados: m2 }) => ({ tipo: tipo.trim(), metrosCuadrados: m2 }))
    }

    if (hayLineasConM2) {
      newTask.metrosCuadrados = sumLineasM2
    } else if (metrosManualValidos) {
      newTask.metrosCuadrados = metrosValParseado
    }

    console.log('🏷️ [TaskCreateModal] newTask.tags:', newTask.tags)
    
    // Si hay un brief token seleccionado, guardarlo para asociarlo después de crear la OP
    if (briefTokenSeleccionado) {
      (newTask as any).briefToken = briefTokenSeleccionado
    }

    // Si hay un pedido web seleccionado, guardarlo para asociarlo después de crear la OP
    if (pedidoWebSeleccionado) {
      (newTask as any).idPedidoCliente = pedidoWebSeleccionado.id
    }
    
    await onCreate(newTask, { openChecklist })
    clearOpCreateDraft(draftUserKey)
    setDraftSavedAt(null)
    setDraftRestored(false)
    
    // Asociar brief a la OP si hay token
    if (briefTokenSeleccionado && opNumber) {
      try {
        // Buscar la OP por número para obtener su ID
        const opResponse = await apiService.getOrdenByOpNumber(opNumber)
        if (opResponse.success && opResponse.data) {
          const ordenId = opResponse.data.id
          await apiService.asociarBriefAOrden(briefTokenSeleccionado, ordenId)
          console.log('✅ Brief asociado a la OP:', ordenId)
        }
      } catch (error) {
        console.error('Error asociando brief a la OP:', error)
      }
    }

    // Asociar pedido web con la OP creada
    if (pedidoWebSeleccionado && opNumber) {
      try {
        // Buscar la OP por número para obtener su ID
        const opResponse = await apiService.getOrdenByOpNumber(opNumber)
        if (opResponse.success && opResponse.data) {
          const ordenId = opResponse.data.id
          // Actualizar el pedido para asociarlo con la OP usando apiService
          // Primero actualizar el pedido
          const { createClient } = await import('@supabase/supabase-js')
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
          
          if (supabaseUrl && supabaseAnonKey) {
            const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
            
            await supabaseClient
              .from('pedidos_clientes')
              .update({
                id_op_asociada: ordenId,
                estado: 'convertido_completo',
                updated_at: new Date().toISOString()
              })
              .eq('id', pedidoWebSeleccionado.id)

            // También actualizar la OP para asociarla con el pedido
            await supabaseClient
              .from('ordenes_trabajo')
              .update({
                id_pedido_cliente: pedidoWebSeleccionado.id,
                origen_pedido_web: true
              })
              .eq('id', ordenId)

            console.log('✅ Pedido web asociado con la OP:', ordenId)
          }
        }
      } catch (error) {
        console.error('Error asociando pedido web con la OP:', error)
        // No bloquear la creación de la OP si falla la asociación
      }
    }
    
    onClose()
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

  // Filtrar sugerencias basadas en el input
  useEffect(() => {
    // Mostrar todas las etiquetas disponibles cuando no hay texto o cuando hay texto que coincide
    const filtered = etiquetasDisponibles
      .filter((e) => {
        const nom = e.nombre?.trim()
        if (!nom) return false
        // Si no hay texto, mostrar todas (excepto las ya seleccionadas)
        if (tagInput.trim().length === 0) {
          return !tags.includes(nom)
        }
        // Si hay texto, filtrar por coincidencia
        return nom.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(nom)
      })
      .sort((a, b) => b.veces_usada - a.veces_usada) // Ordenar por uso (más usadas primero)
      .slice(0, 10) // Mostrar hasta 10 sugerencias
      .map(e => e.nombre)
    
    setTagSuggestions(filtered)
    // Abrir dropdown si hay sugerencias y el input tiene focus o hay texto
    setIsTagDropdownOpen(filtered.length > 0 && (tagInput.trim().length > 0 || isTagDropdownOpen))
  }, [tagInput, etiquetasDisponibles, tags, isTagDropdownOpen])

  const handleAddTag = async () => {
    const value = tagInput.trim()
    if (!value) return
    if (tags.includes(value)) return
    
    // Agregar inmediatamente a la UI para respuesta rápida
    setTags((prev) => [...prev, value])
    setTagInput('')
    setIsTagDropdownOpen(false)
    
    // Obtener color de la etiqueta (puede ser nueva o existente)
    const etiquetaExistente = etiquetasDisponibles.find(
      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === value.toLowerCase()
    )
    
    if (etiquetaExistente) {
      // Si ya existe, usar su color
      setTagColors(prev => {
        const newMap = new Map(prev)
        newMap.set(value.toLowerCase(), etiquetaExistente.color || '#6B7280')
        return newMap
      })
    } else {
      // Si es nueva, obtener color después de guardar
      try {
        await apiService.guardarEtiquetaDisponible(value)
        const colorResponse = await apiService.obtenerColorEtiqueta(value)
        const color = colorResponse.success && colorResponse.data ? colorResponse.data : '#6B7280'
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(value.toLowerCase(), color)
          return newMap
        })
        // Actualizar lista de etiquetas disponibles
        setEtiquetasDisponibles(prev => [
          ...prev,
          { nombre: value.toLowerCase(), veces_usada: 1, color: color }
        ])
      } catch (error) {
        console.error('Error guardando etiqueta:', error)
        // Usar color por defecto si falla
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(value.toLowerCase(), '#6B7280')
          return newMap
        })
      }
    }
  }

  const handleSelectTagSuggestion = async (suggestion: string) => {
    if (tags.includes(suggestion)) return
    
    // Agregar inmediatamente a la UI para respuesta rápida
    setTags((prev) => [...prev, suggestion])
    setTagInput('')
    setIsTagDropdownOpen(false)
    
    // Obtener color de la etiqueta existente
    const etiquetaExistente = etiquetasDisponibles.find(
      (e) => e.nombre?.trim() && e.nombre.toLowerCase() === suggestion.toLowerCase()
    )
    
    if (etiquetaExistente) {
      // Usar color existente inmediatamente
      setTagColors(prev => {
        const newMap = new Map(prev)
        newMap.set(suggestion.toLowerCase(), etiquetaExistente.color || '#6B7280')
        return newMap
      })
      // Incrementar contador de uso en background
      apiService.guardarEtiquetaDisponible(suggestion).catch(err => 
        console.error('Error actualizando uso de etiqueta:', err)
      )
    } else {
      // Si no existe, obtener color después de guardar
      try {
        await apiService.guardarEtiquetaDisponible(suggestion)
        const colorResponse = await apiService.obtenerColorEtiqueta(suggestion)
        const color = colorResponse.success && colorResponse.data ? colorResponse.data : '#6B7280'
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(suggestion.toLowerCase(), color)
          return newMap
        })
        setEtiquetasDisponibles(prev => [
          ...prev,
          { nombre: suggestion.toLowerCase(), veces_usada: 1, color: color }
        ])
      } catch (error) {
        console.error('Error guardando etiqueta:', error)
        setTagColors(prev => {
          const newMap = new Map(prev)
          newMap.set(suggestion.toLowerCase(), '#6B7280')
          return newMap
        })
      }
    }
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

  const uploadSingleAttachment = async (file: File) => {
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
      const remoteUrl = await uploadAttachmentAndGetUrl(file, 'capturas')
      setAttachments((prev) =>
        prev.map((attachment) =>
          attachment.id === id ? { ...attachment, remoteUrl, uploading: false } : attachment
        )
      )
    } catch (error) {
      console.error('Error subiendo archivo', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

      let userMessage = 'No se pudo subir el archivo.'
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
        userMessage = 'El bucket "archivos" no existe. Crealo en Supabase -> Storage -> New bucket (debe ser publico)'
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('row-level security')) {
        userMessage = 'Error de permisos. El bucket debe ser publico. Ve a Supabase -> Storage -> archivos -> Policies'
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setUploadError(null)

    for (const file of Array.from(files)) {
      await uploadSingleAttachment(file)
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

  const getLineaTipoSuggestions = (idx: number) => lineaTipoSuggestionsByIdx[idx] ?? []

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCloseKeepDraft()
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) handleCloseKeepDraft()
      }}
    >
      <div
        className="modal-content create-modal"
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
          void uploadSingleAttachment(named)
        }}
      >
        <header className="modal-header create-modal-header">
          <div>
            <h2>Agregar Nueva Orden</h2>
            <p
              className={`create-draft-status${draftSaving ? ' is-saving' : ''}`}
              aria-live="polite"
            >
              {draftSaving
                ? 'Guardando borrador…'
                : draftSavedAt
                  ? `Borrador guardado · ${formatOpCreateDraftSavedAt(draftSavedAt)}`
                  : 'Guardado automático como borrador'}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={handleCloseKeepDraft}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {draftRestored ? (
            <div className="create-draft-banner">
              <span>Recuperamos tu borrador. El guardado automático sigue activo.</span>
              <button type="button" onClick={handleDiscardDraft}>
                Descartar
              </button>
            </div>
          ) : null}
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
                onChange={(e) => {
                  clienteElegidoRef.current = null
                  setCliente(e.target.value)
                }}
                onFocus={() => {
                  if (clientesEncontrados.length > 0) setIsClienteDropdownOpen(true)
                }}
                onBlur={handleClienteBlur}
                onKeyDown={handleClienteKeyDown}
                placeholder="Buscar cliente existente... (los datos se autocompletarán)"
              />
              {isClienteDropdownOpen && clientesEncontrados.length > 0 && (
                <div className="dropdown-list">
                  {buscandoClientes && (
                    <div className="dropdown-item" style={{ color: '#d1d5db' }}>
                      🔍 Buscando...
                    </div>
                  )}
                  {!buscandoClientes && (
                    <>
                      <div className="dropdown-header" style={{ 
                        padding: '8px 12px', 
                        fontSize: '0.75rem', 
                        color: '#d1d5db',
                        borderBottom: '1px solid var(--surface-border)',
                        fontWeight: 600
                      }}>
                        💡 Selecciona un cliente para autocompletar datos
                      </div>
                      {clientesEncontrados.map((c) => (
                        <div
                          key={c.id}
                          className="dropdown-item"
                          style={{ cursor: 'pointer' }}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            handleSelectCliente(c)
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-hover)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <div>
                            <strong>{c.nombre}</strong>
                            {c.dni_cuit && (
                              <div className="dropdown-subtext">📄 DNI/CUIT: {c.dni_cuit}</div>
                            )}
                            {c.telefono && (
                              <div className="dropdown-subtext">📞 Tel: {c.telefono}</div>
                            )}
                            {c.email && (
                              <div className="dropdown-subtext">✉️ Email: {c.email}</div>
                            )}
                            {c.direccion && (
                              <div className="dropdown-subtext">📍 {c.direccion}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {cliente && clientesEncontrados.length === 0 && !buscandoClientes && cliente.trim().length >= 2 && (
                <div style={{ 
                  marginTop: '4px', 
                  fontSize: '0.75rem', 
                  color: '#d1d5db',
                  fontStyle: 'italic'
                }}>
                  💡 Cliente no encontrado. Se creará uno nuevo al guardar.
                </div>
              )}
            </div>

            {/* Selector de Brief Pendiente - Solo para Diseño Gráfico y Admin */}
            {(isAdmin || isDiseno) && (
              <div className="form-group">
                <label>📋 Brief Público (Opcional)</label>
                {briefTokenSeleccionado ? (
                  <div style={{ 
                    padding: '12px', 
                    background: 'rgba(102, 126, 234, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    marginBottom: '8px'
                  }}>
                    {briefMockupUrl && (
                      <div style={{ marginBottom: '10px' }}>
                        <BriefMockupCard mockupUrl={briefMockupUrl} compact alt="Mockup del brief" />
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#667eea', fontWeight: 600 }}>
                        ✓ Brief seleccionado
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setBriefTokenSeleccionado(null)
                          setBriefMockupUrl(null)
                          setCliente('')
                          setTelefonoCliente('')
                          setEmailCliente('')
                          setBriefPublico('')
                          setObjetivoProyecto('')
                          setEstiloDiseno('')
                          setReferencias('')
                          setDeadlineBrief('')
                        }}
                        style={{
                          padding: '4px 12px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMostrarSelectorBrief(!mostrarSelectorBrief)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(102, 126, 234, 0.1)',
                      color: '#667eea',
                      border: '1px dashed rgba(102, 126, 234, 0.4)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {mostrarSelectorBrief ? '✕ Cerrar selector' : '📋 Seleccionar Brief Pendiente'}
                  </button>
                )}
                
                {mostrarSelectorBrief && !briefTokenSeleccionado && (
                  <div className="brief-picker-panel">
                    {loadingBriefs ? (
                      <div className="brief-picker-empty">Cargando briefs...</div>
                    ) : briefsPendientes.length === 0 ? (
                      <div className="brief-picker-empty">No hay briefs pendientes</div>
                    ) : (
                      briefsPendientes.map((brief) => (
                        <button
                          key={brief.id}
                          type="button"
                          onClick={() => handleSeleccionarBrief(brief)}
                          className={`brief-picker-item ${
                            brief.completado ? 'brief-picker-item--done' : 'brief-picker-item--pending'
                          }`}
                        >
                          {brief.mockup_url && (
                            <span className="brief-picker-thumb">
                              <img src={brief.mockup_url} alt="" loading="lazy" />
                            </span>
                          )}
                          <span className="brief-picker-body">
                            <span className="brief-picker-name">
                              {brief.cliente_nombre_completo || 'Cliente sin nombre'}
                              {brief.cliente_empresa && ` — ${brief.cliente_empresa}`}
                            </span>
                            {brief.objetivo_proyecto && (
                              <span className="brief-picker-goal">{brief.objetivo_proyecto}</span>
                            )}
                            <span className="brief-picker-meta">
                              <span>{brief.completado ? '✓ Completado' : '⏳ Pendiente'}</span>
                              {brief.es_urgencia && <span>⚠️ Urgencia</span>}
                              {brief.mockup_url && <span>🖼 Mockup</span>}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selector de Pedido Web - Para todos los usuarios */}
            <div className="form-group">
              <label>🛒 Pedido Web (Opcional)</label>
              {pedidoWebSeleccionado ? (
                <div style={{ 
                  padding: '12px', 
                  background: 'rgba(235, 103, 27, 0.1)', 
                  borderRadius: '8px',
                  border: '1px solid rgba(235, 103, 27, 0.3)',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#eb671b', fontWeight: 600 }}>
                        ✓ Pedido seleccionado: {pedidoWebSeleccionado.numero_pedido}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '4px' }}>
                        Estado: {pedidoWebSeleccionado.estado} • Precio: ${pedidoWebSeleccionado.precio_total}
                        {pedidoWebSeleccionado.es_urgente && ' • ⚠️ Urgente'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPedidoWebSeleccionado(null)
                      }}
                      style={{
                        padding: '4px 12px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      ✕ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarSelectorPedidoWeb(!mostrarSelectorPedidoWeb)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'rgba(235, 103, 27, 0.1)',
                    color: '#eb671b',
                    border: '1px dashed rgba(235, 103, 27, 0.4)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {mostrarSelectorPedidoWeb ? '✕ Cerrar selector' : '🛒 Seleccionar Pedido Web Pendiente'}
                </button>
              )}
              
              {mostrarSelectorPedidoWeb && !pedidoWebSeleccionado && (
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {loadingPedidosWeb ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#d1d5db' }}>
                      Cargando pedidos...
                    </div>
                  ) : pedidosWebPendientes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#d1d5db' }}>
                      No hay pedidos web pendientes
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pedidosWebPendientes.map((pedido) => {
                        const cliente = (pedido as any).cliente
                        const nombreCliente = cliente 
                          ? (cliente.apellido ? `${cliente.nombre} ${cliente.apellido}` : cliente.nombre)
                          : 'Cliente desconocido'
                        return (
                          <button
                            key={pedido.id}
                            type="button"
                            onClick={() => handleSeleccionarPedidoWeb(pedido)}
                            style={{
                              padding: '12px',
                              background: pedido.es_urgente 
                                ? 'rgba(239, 68, 68, 0.1)' 
                                : pedido.estado === 'aprobado' 
                                  ? 'rgba(16, 185, 129, 0.1)' 
                                  : 'rgba(251, 191, 36, 0.1)',
                              border: `1px solid ${
                                pedido.es_urgente 
                                  ? 'rgba(239, 68, 68, 0.3)' 
                                  : pedido.estado === 'aprobado' 
                                    ? 'rgba(16, 185, 129, 0.3)' 
                                    : 'rgba(251, 191, 36, 0.3)'
                              }`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)'
                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                          >
                            <div style={{ fontWeight: 700, color: '#e5e7eb', marginBottom: '4px' }}>
                              {pedido.numero_pedido} - {nombreCliente}
                              {cliente?.empresa && ` (${cliente.empresa})`}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#d1d5db', marginTop: '4px' }}>
                              Precio: ${pedido.precio_total} • Estado: {pedido.estado}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: '4px' }}>
                              {pedido.es_urgente && '⚠️ Urgente • '}
                              {pedido.requiere_delivery && '🚚 Delivery • '}
                              {pedido.fecha_limite_deseada && `📅 ${new Date(pedido.fecha_limite_deseada).toLocaleDateString('es-AR')}`}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>
                DNI / CUIT
                {!briefTokenSeleccionado && !pedidoWebSeleccionado ? ' *' : ' (opcional)'}
              </label>
              <input
                type="text"
                value={dniCuit}
                onChange={(e) => setDniCuit(e.target.value)}
                placeholder="Ej: 12345678 o 20-12345678-9"
                required={!briefTokenSeleccionado && !pedidoWebSeleccionado}
              />
            </div>
          </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Teléfono cliente
              {!briefTokenSeleccionado && !pedidoWebSeleccionado ? ' *' : ' (opcional)'}
            </label>
            <input
              type="text"
              value={telefonoCliente}
              onChange={(e) => setTelefonoCliente(e.target.value)}
              placeholder="+54 9 11 ..."
              required={!briefTokenSeleccionado && !pedidoWebSeleccionado}
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

          <div className="form-row form-row--entrega">
            <div className="form-group">
              <label>Fecha Entrega</label>
              <input
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
              />
            </div>

            <div className="form-group form-group--hora">
              <label>Hora Estimada</label>
              <input
                type="time"
                step={60}
                value={horaEstimada}
                onChange={(e) => setHoraEstimada(normalizeHoraEstimada(e.target.value) || e.target.value)}
                onFocus={(e) => {
                  // Evita que el picker nativo quede tapado por el footer
                  e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }}
              />
              {!fechaEntrega && horaEstimada && (
                <small className="form-hint-warn">Elegí también la fecha de entrega para guardar la hora.</small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Sectores de la OP (múltiple selección)</label>
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
                  ℹ️ <strong>Una sola OP</strong> (N° {opNumber.trim() || '…'}):{' '}
                  {selectedSectores.length > 1 ? (
                    <>
                      con {selectedSectores.length} sectores, en el tablero habrá{' '}
                      <strong>{selectedSectores.length} fichas</strong> de <strong>esa misma OP</strong> (una por sector).
                      Comparten el N° OP y cada una avanza en su columna.{' '}
                      <br />
                      Si dos fichas de la misma OP coinciden en <strong>una misma columna</strong>, queda una sola visible:
                      la otra se <strong>absorbe</strong> (sigue en base de datos, oculta del tablero) y se conserva{' '}
                      <strong>trazabilidad</strong>: historial, comentarios y adjuntos pasan a la ficha que queda a la vista.
                      <br />
                      Cuando <strong>todas</strong> las fichas de la OP llegan a &quot;Finalizado en Taller&quot;, se unifican
                      en el cierre del flujo de taller.
                    </>
                  ) : (
                    <>
                      un solo sector → una ficha en el tablero para esta OP (no hay otras fichas de la misma OP que unificar).
                    </>
                  )}
                  <br />
                  Podés <strong>sumar sectores después</strong> editando la OP (modal Editar) y guardando: se actualiza la lista
                  y se generan las fichas que falten para los sectores nuevos.
                  <br />
                  ✅ El checklist se habilita al crear la OP. Usa &quot;Crear y abrir checklist&quot; para cargar subtareas al instante.
                </small>
              </div>
            </div>
          )}

          {requiereFotosLugar && (
            <div className="form-group">
              <div
                className="fotos-lugar-requerido-box"
                role="region"
                aria-label="Requisito: foto real del lugar de instalación o montaje"
              >
                <p className="fotos-lugar-eyebrow">Instalaciones · Metalúrgica — obligatorio</p>
                <h3 className="fotos-lugar-title">Foto real del lugar (sitio físico)</h3>
                <p className="fotos-lugar-sub">
                  No es &quot;cualquier archivo&quot;: tiene que mostrar el <strong>lugar real</strong> donde se trabaja — calle y
                  fachada, interior, pared o vidriera donde va el rótulo, acceso, obra, taller del cliente, etc.
                </p>
                <div className="fotos-lugar-lista-no">
                  <strong>Esto no cuenta como foto del lugar:</strong> solo PDF, render 3D, mockup en pantalla, flyer, logo
                  suelto o captura sin ver el espacio físico.
                </div>
                <ul className="fotos-lugar-lista-si">
                  <li>
                    Subí <strong>al menos una imagen</strong> sacada en el sitio (podés sumar más tomas).
                  </li>
                  <li>
                    Subila en <strong>Archivos de la orden</strong> (más abajo); cuando termine de subir, se habilita crear.
                  </li>
                  <li>Si más adelante la ficha entra a esas columnas por el tablero, también se exige tener esta evidencia.</li>
                </ul>
                {!tieneFotosLugarListas && (
                  <p className="fotos-lugar-falta" role="status">
                    Pendiente: subí y esperá que termine de subir al menos una foto real del lugar.
                  </p>
                )}
              </div>
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
                  const value = e.target.value
                  setTagInput(value)
                  const hasSuggestions =
                    etiquetasDisponibles.some(
                      (etiqueta) =>
                        !!etiqueta.nombre?.trim() &&
                        etiqueta.nombre.toLowerCase().includes(value.toLowerCase()) &&
                        !tags.includes(etiqueta.nombre)
                    ) || value.trim().length === 0
                  setIsTagDropdownOpen(hasSuggestions)
                }}
                onFocus={() => {
                  if (etiquetasDisponibles.length > 0) {
                    setIsTagDropdownOpen(true)
                  }
                }}
                onBlur={() => {
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
                        color: '#ffffff'
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
              <label>Operario</label>
              <select value={operario} onChange={(e) => setOperario(e.target.value)}>
                <option value="">Seleccionar...</option>
                {filteredOperarios.map((member) => (
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
            <div className="task-desc-toolbar">
              <label htmlFor="task-create-summary">Descripción del trabajo *</label>
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
                  disabled={plotAiImprovingDesc}
                  title="Reescribe la descripción con PlotAI (conserva datos; revisá antes de crear la OP)"
                >
                  {plotAiImprovingDesc ? 'Mejorando…' : '✨ Mejorar con PlotAI'}
                </button>
              </div>
            </div>
            <textarea
              id="task-create-summary"
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Qué se produce, cantidades, medidas, materiales, plazos, instalación o entrega…"
              required
              aria-required
            />
          </div>

          {/* Sección de Brief Público */}
          <div className="form-section-divider">
            <h3>📋 Brief del Proyecto (Público)</h3>
            <p className="section-description">Esta información será visible para todos los usuarios del sistema</p>
          </div>

          <div className="form-group">
            <label>Brief Público *</label>
            <textarea
              rows={5}
              value={briefPublico}
              onChange={(e) => setBriefPublico(e.target.value)}
              placeholder="Describe el proyecto, objetivos, contexto y cualquier información relevante que deba conocer el equipo..."
              required
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
                value={deadlineBrief}
                onChange={(e) => setDeadlineBrief(e.target.value)}
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

          <div className="form-group">
            <label>Ítems con metros (opcional)</label>
            <p className="form-hint-muted">
              Varias piezas con tipo y m². Si cargás ítems, el total se usa como m² de la OP. Sugerencias de tipo con el
              mismo patrón que etiquetas (recientes en este equipo).
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
            <label>
              Metros cuadrados (m²)
              {lineasMetrosM2.length > 0 ? ' — total calculado' : null}
              {selectedSectores.includes('Taller Gráfico') ? (
                <span style={{ color: '#fbbf24' }}> *</span>
              ) : null}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={metrosCuadrados}
              onChange={(e) => setMetrosCuadrados(e.target.value)}
              placeholder={
                selectedSectores.includes('Taller Gráfico')
                  ? 'Obligatorio si hay Taller Gráfico (ej: 6.24)'
                  : 'Opcional en cualquier sector (ej: 6.24)'
              }
              disabled={lineasMetrosM2.length > 0}
            />
            <small style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Podés cargar m² aunque el sector no sea Taller Gráfico. Si marcás Taller Gráfico entre los sectores, el
              valor es obligatorio (manual o sumando ítems). Sin ítems, podés editar el total a mano.
            </small>
          </div>

          <div className="form-group">
            <label>Materiales</label>
            <p className="form-hint-muted">
              Como etiquetas: buscá en el catálogo (precargados) o escribí libre; cada ítem es una pastilla con color.
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
              {requiereFotosLugar
                ? 'Archivos de la orden — acá va la foto REAL del lugar (obligatoria) y, si querés, PDFs u otras imágenes de apoyo'
                : 'Archivos (imágenes o PDF)'}
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
                  : requiereFotosLugar && !tieneFotosLugarListas
                    ? 'Elegí una imagen del lugar real y esperá a que termine de subir (no alcanza solo PDF).'
                    : attachments.length === 0
                      ? 'Ningún archivo seleccionado'
                      : `${attachments.length} archivo(s) listo(s)`}
              </span>
            </div>
          </div>
        </div>

        <footer className="modal-footer modal-footer--create">
          <OpCobroFooterChecks
            estado={cobroOp}
            montoParcial={montoPagoParcialInput}
            onEstadoChange={setCobroOp}
            onMontoChange={setMontoPagoParcialInput}
          />
          <button type="button" className="btn-cancel" onClick={handleCloseKeepDraft}>
            Cerrar
          </button>
          <button type="button" className="btn-draft" onClick={handleSaveDraftAndClose}>
            Guardar borrador
          </button>
          <div className="footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleCreate(true)}
              disabled={hasPendingUploads || createBlockedPorFotos}
              title={
                createBlockedPorFotos
                  ? 'Falta la foto real del lugar físico (Instalaciones / Metalúrgica)'
                  : undefined
              }
            >
              Crear y abrir checklist
            </button>
            <button
              type="button"
              className="btn-create"
              onClick={() => void handleCreate(false)}
              disabled={hasPendingUploads || createBlockedPorFotos}
              title={
                createBlockedPorFotos
                  ? 'Falta la foto real del lugar físico (Instalaciones / Metalúrgica)'
                  : undefined
              }
            >
              Agregar Orden
            </button>
          </div>
        </footer>
      </div>

      {/* Modal de previsualización de archivos */}
      {previewAttachment && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null)
          }}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) setPreviewAttachment(null)
          }}
          style={{ zIndex: 2000 }}
        >
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

export default TaskCreateModal

