import type { ActivityEvent, Priority, Task, TaskStatus } from '../types/board'
import type { HistorialMovimiento, OrdenTrabajo, TareaRecord } from '../types/api'
import { getArgentinaDate } from './dateUtils'

const STATUS_TO_ESTADO: Record<TaskStatus, string> = {
  'diseno-grafico': 'Diseño Gráfico',
  'diseno-proceso': 'Diseño en Proceso',
  'en-espera': 'En Espera',
  imprenta: 'Imprenta (Área de Impresión)',
  'taller-imprenta': 'Taller de Imprenta',
  'taller-grafico': 'Taller Gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica',
  'finalizado-taller': 'Finalizado en Taller',
  'almacen-entrega': 'Almacén de Entrega',
  'asesor-tecnico': 'Asesor Técnico',
  presupuestos: 'Presupuestos',
  'no-aprobados-asesor-presupuestos': 'No Aprobados',
  'finalizado-asesor-presupuestos': 'Finalizado'
}

const ESTADO_TO_STATUS: Record<string, TaskStatus> = Object.entries(STATUS_TO_ESTADO).reduce(
  (acc, [status, estado]) => {
    acc[estado.toLowerCase()] = status as TaskStatus
    return acc
  },
  {} as Record<string, TaskStatus>
)

// Agregar mapeo adicional para "Entregado o Instalado" (las fichas entregadas se filtran por entregado=true)
ESTADO_TO_STATUS['entregado o instalado'] = 'almacen-entrega'

const PRIORITY_TO_DB: Record<Priority, string> = {
  alta: 'Alta',
  media: 'Normal',
  baja: 'Baja'
}

const PRIORITY_FROM_DB: Record<string, Priority> = {
  alta: 'alta',
  normal: 'media',
  media: 'media',
  baja: 'baja'
}

const IMPACT_TO_COMPLEJIDAD: Record<Task['impact'], string> = {
  alta: 'Alta',
  media: 'Media',
  low: 'Baja'
}

const COMPLEJIDAD_TO_IMPACT: Record<string, Task['impact']> = {
  alta: 'alta',
  media: 'media',
  baja: 'low'
}

// Mapeo de estados a porcentaje de progreso
const STATUS_TO_PROGRESS: Record<TaskStatus, number> = {
  'diseno-grafico': 10,
  'diseno-proceso': 20,
  'en-espera': 30,
  'imprenta': 40,
  'taller-imprenta': 50,
  'taller-grafico': 50,
  'instalaciones': 60,
  'metalurgica': 60,
  'finalizado-taller': 80,
  'almacen-entrega': 90,
  'asesor-tecnico': 15,
  presupuestos: 25,
  'no-aprobados-asesor-presupuestos': 95,
  'finalizado-asesor-presupuestos': 100
}

// Función para calcular el progreso basado en el estado
const calculateProgressFromStatus = (status: TaskStatus, entregado?: boolean): number => {
  // Si está entregado, 100%
  if (entregado) return 100
  // Si no, usar el mapeo de estados
  return STATUS_TO_PROGRESS[status] || 0
}

const buildWhatsappLinkFromPhone = (phone?: string | null): string | undefined => {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined

  // Normalizar para Argentina: quitar 0 inicial, asegurar prefijo 54
  let normalized = digits
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1)
  }

  if (!normalized.startsWith('54')) {
    normalized = `54${normalized}`
  }

  return `https://wa.me/${normalized}`
}

export const mapStatusToEstado = (status: TaskStatus): string =>
  STATUS_TO_ESTADO[status] ?? status

export const mapEstadoToStatus = (estado: string): TaskStatus => {
  const normalized = estado?.toLowerCase().trim()
  return ESTADO_TO_STATUS[normalized] ?? 'en-espera'
}

export const mapPriorityToDb = (priority: Priority): string =>
  PRIORITY_TO_DB[priority] ?? 'Normal'

export const mapPriorityFromDb = (priority: string | null | undefined): Priority =>
  PRIORITY_FROM_DB[priority?.toLowerCase() ?? 'normal'] ?? 'media'

export const mapImpactToComplejidad = (impact: Task['impact']): string =>
  IMPACT_TO_COMPLEJIDAD[impact] ?? 'Media'

export const mapComplejidadToImpact = (
  complejidad: string | null | undefined
): Task['impact'] => COMPLEJIDAD_TO_IMPACT[complejidad?.toLowerCase() ?? 'media'] ?? 'media'

export const ordenToTask = (orden: OrdenTrabajo): Task => {
  // Normalizar fechas a zona horaria de Argentina para evitar "día anterior"
  const baseArgentinaDate = getArgentinaDate()
  const nowArgentinaIso = baseArgentinaDate.toISOString()
  const createdDate =
    orden.fecha_creacion != null ? new Date(orden.fecha_creacion) : baseArgentinaDate
  const createdArgentina = new Date(
    createdDate.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  )
  const createdArgentinaIso = createdArgentina.toISOString()
  const dueDateSource = orden.fecha_entrega ?? orden.fecha_creacion ?? nowArgentinaIso
  // Si viene como DATE (YYYY-MM-DD), NO usar new Date('YYYY-MM-DD') directo (interpreta UTC y se corre de día).
  const dueDateParsed =
    typeof dueDateSource === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDateSource)
      ? new Date(`${dueDateSource}T12:00:00Z`) // mediodía UTC evita corrimiento
      : new Date(dueDateSource)
  const dueDateArgentina = new Date(
    dueDateParsed.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  )
  const dueDateArgentinaIso = dueDateArgentina.toISOString()
  const updatedSource = orden.fecha_ingreso ?? orden.fecha_creacion ?? nowArgentinaIso
  const updatedArgentina = new Date(
    new Date(updatedSource).toLocaleString('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires'
    })
  )
  const updatedArgentinaIso = updatedArgentina.toISOString()
  const clientPhone = orden.telefono_cliente?.trim() || undefined
  const whatsappUrl = orden.whatsapp_link?.trim() || buildWhatsappLinkFromPhone(clientPhone)
  const clientEmail = orden.email_cliente?.trim() || undefined
  const clientAddress = orden.direccion_cliente?.trim() || undefined
  const locationUrl = orden.ubicacion_link?.trim() || undefined
  const driveUrl = orden.drive_link?.trim() || undefined

  // Debug: log si hay datos de contacto
  if (clientPhone || clientEmail || clientAddress || locationUrl || driveUrl) {
    console.log(`📞 Orden ${orden.numero_op} tiene datos de contacto:`, {
      telefono: clientPhone || 'no',
      email: clientEmail || 'no',
      direccion: clientAddress || 'no',
      ubicacion: locationUrl || 'no',
      drive: driveUrl || 'no',
      whatsapp: whatsappUrl || 'no'
    })
  }

  // ⚠️ IMPORTANTE: Para fichas duplicadas, usar el sector para determinar la columna
  // El backend ya asegura que estado = sector al crear fichas duplicadas
  // Pero si hay discrepancia, priorizar el sector (donde debe aparecer la ficha)
  const estadoMapeado = mapEstadoToStatus(orden.estado)
  // Para fichas duplicadas, siempre usar el sector para determinar la columna
  // Para fichas principales, usar el estado si está bien mapeado, sino el sector
  const statusFinal = orden.es_duplicado && orden.sector
    ? mapEstadoToStatus(orden.sector)  // Fichas duplicadas: usar sector directamente
    : (estadoMapeado !== 'en-espera' || !orden.sector)
      ? estadoMapeado  // Fichas principales: usar estado si es válido
      : mapEstadoToStatus(orden.sector)  // Fallback al sector si el estado es inválido

  return {
    id: orden.id?.toString() ?? crypto.randomUUID(),
    opNumber: orden.numero_op,
    title: orden.cliente,
    dniCuit: orden.dni_cuit ?? undefined,
    summary: orden.descripcion ?? 'Sin descripción',
    status: statusFinal,
    priority: mapPriorityFromDb(orden.prioridad),
    ownerId: orden.operario_asignado ?? 'sin-asignar',
    createdBy: orden.nombre_creador ?? 'Sistema',
    workingUser: orden.usuario_trabajando_nombre ?? undefined,
    tags: orden.etiquetas ?? [],
    materials: orden.materiales
      ? orden.materiales.split(',').map((m) => m.trim()).filter(Boolean)
      : [],
    // ⚠️ IMPORTANTE: Usar sector (actual) para assignedSector, NO sector_inicial
    // sector_inicial es el sector primario/indeleble donde se creó la OP
    // sector es el sector actual donde está la OP ahora
    assignedSector: orden.sector ?? orden.sector_inicial ?? 'Sin sector',
    sectores: orden.sectores && orden.sectores.length > 0 ? orden.sectores : (orden.sector ? [orden.sector] : []),
    sectorInicial: orden.sector_inicial ?? orden.sector ?? undefined,
    finalLocation: orden.ubicacion_final ?? undefined,
    esSubTarea: false, // Las órdenes principales no son sub-tareas
    esDuplicado: orden.es_duplicado ?? false,
    idOrdenOriginal: orden.id_orden_original ?? undefined,
    photoUrl: orden.foto_url?.trim() || '',
    storyPoints: 0,
    progress: calculateProgressFromStatus(statusFinal, orden.entregado ?? false),
    createdAt: createdArgentinaIso,
    dueDate: dueDateArgentinaIso,
    updatedAt: updatedArgentinaIso,
    impact: mapComplejidadToImpact(orden.complejidad),
    clientPhone,
    clientEmail,
    clientAddress,
    whatsappUrl,
    locationUrl,
    driveUrl,
    opBloqueada: orden.op_bloqueada === true,
    entregado: orden.entregado ?? false,
    metrosCuadrados: orden.metros_cuadrados ?? undefined,
    esFichaNoOP: orden.es_ficha_no_op ?? false,
    numeroFichaOriginal: orden.numero_ficha_original ?? undefined,
    planillaPreliminar: orden.planilla_preliminar ?? false,
    fichaTecnicaPdfUrl: orden.ficha_tecnica_pdf_url ?? undefined,
    fichaTecnicaCargada: orden.ficha_tecnica_cargada ?? false,
    fichaTecnicaIncompleta: orden.ficha_tecnica_incompleta ?? false,
    presupuestoEnviadoCliente: orden.presupuesto_enviado_cliente ?? false,
    presupuestoArmado: orden.presupuesto_armado ?? false,
    presupuestoEnEspera: orden.presupuesto_en_espera ?? false,
    etapaTallerGrafico: orden.etapa_taller_grafico ?? undefined,
    etapaTallerGraficoFechaInicio: orden.etapa_taller_grafico_fecha_inicio ?? undefined,
    etapaInstalaciones: orden.etapa_instalaciones ?? undefined,
    etapaInstalacionesFechaInicio: orden.etapa_instalaciones_fecha_inicio ?? undefined,
    etapaTallerImprenta: orden.etapa_taller_imprenta ?? undefined,
    etapaTallerImprentaFechaInicio: orden.etapa_taller_imprenta_fecha_inicio ?? undefined,
    etapaImpresionDigital: orden.etapa_impresion_digital ?? undefined,
    etapaImpresionDigitalFechaInicio: orden.etapa_impresion_digital_fecha_inicio ?? undefined,
    etapaMetalurgica: orden.etapa_metalurgica ?? undefined,
    etapaMetalurgicaFechaInicio: orden.etapa_metalurgica_fecha_inicio ?? undefined,
    briefPublico: orden.brief_publico ?? undefined,
    objetivoProyecto: orden.objetivo_proyecto ?? undefined,
    publicoObjetivo: orden.publico_objetivo ?? undefined,
    estiloDiseno: orden.estilo_diseno ?? undefined,
    referencias: orden.referencias ?? undefined,
    deadlineBrief: orden.deadline_brief ?? undefined,
    estadoRevision: orden.estado_revision ?? undefined,
    briefToken: orden.brief_token ?? undefined,
    // Campos del brief público completo
    clienteNombreCompleto: orden.cliente_nombre_completo ?? undefined,
    clienteEmpresa: orden.cliente_empresa ?? undefined,
    tipoProductoServicio: orden.tipo_producto_servicio ?? undefined,
    tipoProductoOtro: orden.tipo_producto_otro ?? undefined,
    necesitaAsesoramiento: orden.necesita_asesoramiento ?? undefined,
    dondeColocados: orden.donde_colocados ?? undefined,
    digitalOImpresion: orden.digital_o_impresion ?? undefined,
    cantidades: orden.cantidades ?? undefined,
    materialLogo: orden.material_logo ?? undefined,
    materialTextos: orden.material_textos ?? undefined,
    materialImagenes: orden.material_imagenes ?? undefined,
    tieneReferencias: orden.tiene_referencias ?? undefined,
    referenciasLinks: orden.referencias_links ?? undefined,
    fechaLimiteBrief: orden.fecha_limite_brief ?? undefined,
    esUrgencia: orden.es_urgencia ?? undefined,
    enReclamo: orden.en_reclamo === true
  }
}

export const historialToActivity = (registro: HistorialMovimiento): ActivityEvent => ({
  id: registro.id.toString(),
  taskId: registro.id_orden.toString(),
  from: mapEstadoToStatus(registro.estado_anterior || ''),
  to: mapEstadoToStatus(registro.estado_nuevo || ''),
  actorId: registro.id_usuario.toString(),
  timestamp: registro.timestamp,
  note: registro.comentario ?? 'Cambio de estado'
})

const toDateOnly = (value?: string) => {
  if (!value) return undefined
  // Si ya viene como date-only, no convertir (evita corrimientos por UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  // Generar YYYY-MM-DD en zona horaria Argentina
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

/**
 * Ficha No OP (presupuesto / asesor técnico): correlativo FICHA-n asignado por BD.
 * No alcanza con el booleano en el Task: si numero_op es "FICHA-" (sin dígitos), es la misma alta.
 */
export function ordenUsaCorrelativoFichaNoOP(
  numeroOp: string | null | undefined,
  esFichaNoOP: boolean | null | undefined
): boolean {
  if (esFichaNoOP === true) return true
  const s = (numeroOp ?? '').trim()
  if (!s) return false
  const up = s.toUpperCase()
  return up.startsWith('FICHA') && !/^FICHA-[0-9]+$/.test(up)
}

export const taskToOrdenPayload = (task: Omit<Task, 'id'> | Task): Partial<OrdenTrabajo> => {
  // Normalizar dniCuit: si es string vacío, convertir a null
  const dniCuitValue = task.dniCuit?.trim() || null

  const clientPhone = task.clientPhone?.trim() || null
  const whatsappLink =
    task.whatsappUrl?.trim() || buildWhatsappLinkFromPhone(clientPhone ?? undefined) || null

  // Asegurar que operario_asignado se normalice correctamente
  // Si es 'sin-asignar', convertir a null para la base de datos
  const operarioAsignado = task.ownerId && task.ownerId !== 'sin-asignar' 
    ? task.ownerId 
    : null

  const payload = {
    numero_op: task.opNumber,
    cliente: task.title,
    dni_cuit: dniCuitValue,
    descripcion: task.summary,
    estado: mapStatusToEstado(task.status), // Preservar el estado (columna) actual
    prioridad: mapPriorityToDb(task.priority),
    fecha_entrega: task.dueDate ? toDateOnly(task.dueDate) : null,
    fecha_creacion: task.createdAt,
    fecha_ingreso: task.updatedAt,
    operario_asignado: operarioAsignado, // Normalizar: null si es 'sin-asignar'
    complejidad: mapImpactToComplejidad(task.impact),
    // Actualizar tanto sector como sector_inicial si cambian
    sector: task.assignedSector ?? (task.sectores && task.sectores.length > 0 ? task.sectores[0] : null), // Sector actual
    sectores: task.sectores && task.sectores.length > 0 ? task.sectores : (task.assignedSector ? [task.assignedSector] : null),
    sector_inicial: task.sectorInicial ?? task.assignedSector ?? (task.sectores && task.sectores.length > 0 ? task.sectores[0] : null), // Puede actualizarse si cambia
    materiales: task.materials.join(', '),
    nombre_creador: task.createdBy,
    foto_url: task.photoUrl?.trim() || null,
    usuario_trabajando_nombre: task.workingUser ?? null,
    telefono_cliente: clientPhone,
    email_cliente: task.clientEmail?.trim() || null,
    direccion_cliente: task.clientAddress?.trim() || null,
    whatsapp_link: whatsappLink,
    ubicacion_link: task.locationUrl?.trim() || null,
    drive_link: task.driveUrl?.trim() || null,
    etiquetas: task.tags && Array.isArray(task.tags) && task.tags.length > 0 ? task.tags : null,
    metros_cuadrados: task.metrosCuadrados || null,
    etapa_taller_grafico: task.etapaTallerGrafico?.trim() || null,
    etapa_taller_grafico_fecha_inicio: task.etapaTallerGraficoFechaInicio || null,
    etapa_instalaciones: task.etapaInstalaciones?.trim() || null,
    etapa_instalaciones_fecha_inicio: task.etapaInstalacionesFechaInicio || null,
    etapa_taller_imprenta: task.etapaTallerImprenta?.trim() || null,
    etapa_taller_imprenta_fecha_inicio: task.etapaTallerImprentaFechaInicio || null,
    etapa_impresion_digital: task.etapaImpresionDigital?.trim() || null,
    etapa_impresion_digital_fecha_inicio: task.etapaImpresionDigitalFechaInicio || null,
    etapa_metalurgica: task.etapaMetalurgica?.trim() || null,
    etapa_metalurgica_fecha_inicio: task.etapaMetalurgicaFechaInicio || null,
    brief_publico: task.briefPublico?.trim() || null,
    objetivo_proyecto: task.objetivoProyecto?.trim() || null,
    publico_objetivo: task.publicoObjetivo?.trim() || null,
    estilo_diseno: task.estiloDiseno?.trim() || null,
    referencias: task.referencias?.trim() || null,
    deadline_brief: task.deadlineBrief ? toDateOnly(task.deadlineBrief) : null,
    es_ficha_no_op: ordenUsaCorrelativoFichaNoOP(task.opNumber, task.esFichaNoOP),
    ...(task.numeroFichaOriginal !== undefined
      ? {
          numero_ficha_original:
            task.numeroFichaOriginal != null && task.numeroFichaOriginal.trim() !== ''
              ? task.numeroFichaOriginal.trim()
              : null
        }
      : {}),
    planilla_preliminar: task.planillaPreliminar ?? false,
    ficha_tecnica_pdf_url: task.fichaTecnicaPdfUrl?.trim() || null,
    ficha_tecnica_cargada: task.fichaTecnicaCargada ?? false,
    ficha_tecnica_incompleta: task.fichaTecnicaIncompleta ?? false,
    presupuesto_enviado_cliente: task.presupuestoEnviadoCliente ?? false,
    presupuesto_armado: task.presupuestoArmado ?? false,
    presupuesto_en_espera: task.presupuestoEnEspera ?? false,
    ...(task.opBloqueada !== undefined ? { op_bloqueada: task.opBloqueada } : {}),
    ...(task.enReclamo !== undefined ? { en_reclamo: task.enReclamo } : {})
  }
  
  console.log('🏷️ [taskToOrdenPayload] task.tags:', task.tags)
  console.log('🏷️ [taskToOrdenPayload] payload.etiquetas:', payload.etiquetas)

  // Debug: log datos de sectores y contacto
  console.log('📋 taskToOrdenPayload - Datos completos:', {
    numero_op: payload.numero_op,
    sectores: payload.sectores,
    sector_inicial: payload.sector_inicial,
    sector: payload.sector,
    telefono: payload.telefono_cliente || 'null',
    ubicacion: payload.ubicacion_link || 'null',
    direccion: payload.direccion_cliente || 'null',
    email: payload.email_cliente || 'null',
    whatsapp: payload.whatsapp_link || 'null',
    drive: payload.drive_link || 'null'
  })

  return payload
}

// Convertir sub-tarea a Task
export const tareaToTask = (tarea: TareaRecord, orden: OrdenTrabajo): Task => {
  // Mapear estado_kanban a TaskStatus según el sector
  const mapSectorToStatus = (sector: string | null | undefined): TaskStatus => {
    if (!sector) return 'diseno-grafico'
    const sectorMap: Record<string, TaskStatus> = {
      'Diseño Gráfico': 'diseno-grafico',
      'Diseño en Proceso': 'diseno-proceso',
      'En Espera': 'en-espera',
      'Taller de Imprenta': 'taller-imprenta',
      'Taller Gráfico': 'taller-grafico',
      'Instalaciones': 'instalaciones',
      'Metalúrgica': 'metalurgica',
      'Imprenta (Área de Impresión)': 'imprenta',
      'Finalizado en Taller': 'finalizado-taller',
      'Almacén de Entrega': 'almacen-entrega',
      'Asesor Técnico': 'asesor-tecnico',
      'Presupuestos': 'presupuestos',
      'Finalizado': 'finalizado-asesor-presupuestos',
      'Mostrador': 'diseno-grafico',
      'Caja': 'diseno-grafico'
    }
    return sectorMap[sector] || 'diseno-grafico'
  }

  // Mapear estado_kanban a status
  const estadoToStatus: Record<string, TaskStatus> = {
    'Pendiente': mapSectorToStatus(tarea.sector),
    'En Proceso': mapSectorToStatus(tarea.sector),
    'Finalizado': 'almacen-entrega' // Las completadas no se muestran, pero por si acaso
  }

  return {
    id: `subtask-${tarea.id}`,
    opNumber: orden.numero_op,
    title: `${orden.cliente} - ${tarea.sector || 'Sector'}`,
    dniCuit: orden.dni_cuit ?? undefined,
    summary: tarea.descripcion_tarea,
    status: estadoToStatus[tarea.estado_kanban] || mapSectorToStatus(tarea.sector),
    priority: mapPriorityFromDb(orden.prioridad),
    ownerId: orden.operario_asignado ?? 'sin-asignar',
    createdBy: orden.nombre_creador ?? 'Sistema',
    workingUser: undefined,
    tags: [],
    materials: orden.materiales
      ? orden.materiales.split(',').map((m) => m.trim()).filter(Boolean)
      : [],
    assignedSector: tarea.sector || orden.sector || 'Sin sector',
    sectores: orden.sectores && orden.sectores.length > 0 ? orden.sectores : (orden.sector ? [orden.sector] : []),
    sectorInicial: orden.sector_inicial || orden.sector || undefined,
    esSubTarea: true,
    idFichaPrincipal: orden.id.toString(),
    photoUrl: orden.foto_url?.trim() || '',
    storyPoints: 0,
    progress: tarea.estado_kanban === 'Finalizado' ? 100 : tarea.estado_kanban === 'En Proceso' ? 50 : 0,
    createdAt: orden.fecha_creacion ?? new Date().toISOString(),
    dueDate: orden.fecha_entrega ?? orden.fecha_creacion ?? new Date().toISOString(),
    updatedAt: orden.fecha_ingreso ?? orden.fecha_creacion ?? new Date().toISOString(),
    impact: mapComplejidadToImpact(orden.complejidad),
    clientPhone: orden.telefono_cliente?.trim() || undefined,
    clientEmail: orden.email_cliente?.trim() || undefined,
    clientAddress: orden.direccion_cliente?.trim() || undefined,
    whatsappUrl: orden.whatsapp_link?.trim() || buildWhatsappLinkFromPhone(orden.telefono_cliente),
    locationUrl: orden.ubicacion_link?.trim() || undefined,
    driveUrl: orden.drive_link?.trim() || undefined
  }
}

export const parseTaskIdToOrdenId = (taskId: string): number | null => {
  const direct = Number(taskId)
  if (!Number.isNaN(direct)) return direct
  const match = taskId.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

// Mapeo de sectores a roles permitidos
const SECTOR_TO_ROLES: Record<string, string[]> = {
  'Diseño Gráfico': ['diseno', 'administracion'],
  'Diseño en Proceso': ['diseno', 'administracion'],
  'En Espera': ['administracion', 'gerencia'],
  'Imprenta (Área de Impresión)': ['imprenta', 'administracion'],
  'Taller de Imprenta': ['taller', 'imprenta'],
  'Taller Gráfico': ['taller-grafico', 'taller'],
  'Instalaciones': ['instalaciones', 'taller'],
  'Metalúrgica': ['metalurgica', 'taller'],
  'Finalizado en Taller': ['administracion', 'gerencia'],
  'Almacén de Entrega': ['administracion', 'gerencia', 'mostrador', 'caja']
}

// Filtrar operarios según el sector de la ficha
export const filterOperariosBySector = (
  teamMembers: Array<{ id: string; name: string; role: string }>,
  sector: string | null | undefined
): Array<{ id: string; name: string; role: string }> => {
  if (!sector) return teamMembers
  
  const allowedRoles = SECTOR_TO_ROLES[sector] || []
  if (allowedRoles.length === 0) return teamMembers
  
  return teamMembers.filter((member) => {
    const roleLower = member.role.toLowerCase()
    return allowedRoles.some((allowed) => roleLower.includes(allowed.toLowerCase()))
  })
}

