import type { ActivityEvent, Priority, Task, TaskStatus } from '../types/board'
import type { HistorialMovimiento, OrdenTrabajo, TareaRecord } from '../types/api'

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
  'almacen-entrega': 'Almacén de Entrega'
}

const ESTADO_TO_STATUS: Record<string, TaskStatus> = Object.entries(STATUS_TO_ESTADO).reduce(
  (acc, [status, estado]) => {
    acc[estado.toLowerCase()] = status as TaskStatus
    return acc
  },
  {} as Record<string, TaskStatus>
)

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

  return {
    id: orden.id?.toString() ?? crypto.randomUUID(),
    opNumber: orden.numero_op,
    title: orden.cliente,
    dniCuit: orden.dni_cuit ?? undefined,
    summary: orden.descripcion ?? 'Sin descripción',
    status: mapEstadoToStatus(orden.estado),
    priority: mapPriorityFromDb(orden.prioridad),
    ownerId: orden.operario_asignado ?? 'sin-asignar',
    createdBy: orden.nombre_creador ?? 'Sistema',
    workingUser: orden.usuario_trabajando_nombre ?? undefined,
    tags: [],
    materials: orden.materiales
      ? orden.materiales.split(',').map((m) => m.trim()).filter(Boolean)
      : [],
    assignedSector: orden.sector_inicial ?? orden.sector ?? 'Sin sector',
    sectores: orden.sectores && orden.sectores.length > 0 ? orden.sectores : (orden.sector ? [orden.sector] : []),
    sectorInicial: orden.sector_inicial ?? orden.sector ?? undefined,
    esSubTarea: false, // Las órdenes principales no son sub-tareas
    esDuplicado: orden.es_duplicado ?? false,
    idOrdenOriginal: orden.id_orden_original ?? undefined,
    photoUrl: orden.foto_url?.trim() || '',
    storyPoints: 0,
    progress: orden.estado?.toLowerCase().includes('finalizado') ? 100 : 50,
    createdAt: orden.fecha_creacion ?? new Date().toISOString(),
    dueDate: orden.fecha_entrega ?? orden.fecha_creacion ?? new Date().toISOString(),
    updatedAt: orden.fecha_ingreso ?? orden.fecha_creacion ?? new Date().toISOString(),
    impact: mapComplejidadToImpact(orden.complejidad),
    clientPhone,
    clientEmail,
    clientAddress,
    whatsappUrl,
    locationUrl,
    driveUrl
  }
}

export const historialToActivity = (registro: HistorialMovimiento): ActivityEvent => ({
  id: registro.id.toString(),
  taskId: registro.id_orden.toString(),
  from: mapEstadoToStatus(registro.estado_anterior),
  to: mapEstadoToStatus(registro.estado_nuevo),
  actorId: registro.id_usuario.toString(),
  timestamp: registro.timestamp,
  note: registro.comentario ?? 'Cambio de estado'
})

const toDateOnly = (value?: string) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().split('T')[0]
}

export const taskToOrdenPayload = (task: Omit<Task, 'id'> | Task): Partial<OrdenTrabajo> => {
  // Normalizar dniCuit: si es string vacío, convertir a null
  const dniCuitValue = task.dniCuit?.trim() || null

  const clientPhone = task.clientPhone?.trim() || null
  const whatsappLink =
    task.whatsappUrl?.trim() || buildWhatsappLinkFromPhone(clientPhone ?? undefined) || null

  const payload = {
    numero_op: task.opNumber,
    cliente: task.title,
    dni_cuit: dniCuitValue,
    descripcion: task.summary,
    estado: mapStatusToEstado(task.status),
    prioridad: mapPriorityToDb(task.priority),
    fecha_entrega: toDateOnly(task.dueDate),
    fecha_creacion: task.createdAt,
    fecha_ingreso: task.updatedAt,
    operario_asignado: task.ownerId,
    complejidad: mapImpactToComplejidad(task.impact),
    sector: task.sectorInicial ?? task.assignedSector, // Usar sectorInicial si existe
    sectores: task.sectores && task.sectores.length > 0 ? task.sectores : (task.assignedSector ? [task.assignedSector] : null),
    sector_inicial: task.sectorInicial ?? task.assignedSector ?? null,
    materiales: task.materials.join(', '),
    nombre_creador: task.createdBy,
    foto_url: task.photoUrl?.trim() || null,
    usuario_trabajando_nombre: task.workingUser ?? null,
    telefono_cliente: clientPhone,
    email_cliente: task.clientEmail?.trim() || null,
    direccion_cliente: task.clientAddress?.trim() || null,
    whatsapp_link: whatsappLink,
    ubicacion_link: task.locationUrl?.trim() || null,
    drive_link: task.driveUrl?.trim() || null
  }

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
      'Taller de Imprenta': 'taller-imprenta',
      'Taller Gráfico': 'taller-grafico',
      'Instalaciones': 'instalaciones',
      'Metalúrgica': 'metalurgica',
      'Imprenta (Área de Impresión)': 'imprenta',
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

