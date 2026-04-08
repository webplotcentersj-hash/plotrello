export type TaskStatus =
  | 'diseno-grafico'
  | 'diseno-proceso'
  | 'en-espera'
  | 'imprenta'
  | 'taller-imprenta'
  | 'taller-grafico'
  | 'instalaciones'
  | 'metalurgica'
  | 'finalizado-taller'
  | 'almacen-entrega'
  | 'asesor-tecnico'
  | 'presupuestos'
  | 'no-aprobados-asesor-presupuestos'
  | 'armados-enviados-asesor-presupuestos'
  | 'finalizado-asesor-presupuestos'
export type Priority = 'alta' | 'media' | 'baja'

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  productivity: number
}

export interface Task {
  id: string
  opNumber: string
  title: string
  dniCuit?: string
  summary: string
  status: TaskStatus
  priority: Priority
  ownerId: string
  createdBy: string
  workingUser?: string
  tags: string[]
  materials: string[]
  assignedSector: string // Sector actual (para compatibilidad)
  sectores?: string[] // Array de sectores requeridos
  sectorInicial?: string // Sector donde aparece la ficha principal (puede NO estar en sectores[])
  finalLocation?: string // Ubicación física al llegar a Finalizado en Taller (sector previo)
  esSubTarea?: boolean // Indica si es una sub-tarea
  idFichaPrincipal?: string // ID de la ficha principal (si es sub-tarea)
  esDuplicado?: boolean // Indica si es una ficha duplicada
  idOrdenOriginal?: number // ID de la ficha original (si es duplicada)
  photoUrl: string
  storyPoints: number
  progress: number
  createdAt: string
  dueDate: string
  updatedAt: string
  impact: 'alta' | 'media' | 'low'
  clientPhone?: string
  idPedidoCliente?: number | null // ID del pedido web que originó esta tarea
  origenPedidoWeb?: boolean | null // Indica si la tarea viene de un pedido web
  clientEmail?: string
  clientAddress?: string
  whatsappUrl?: string
  locationUrl?: string
  driveUrl?: string
  /** Si true, la OP está trabada: no se mueve ni se edita salvo por admin/gerencia o destaque del operario asignado */
  opBloqueada?: boolean
  entregado?: boolean // Indica si la ficha fue entregada y está archivada
  subtasks?: Subtask[]
  subtaskProgress?: number // porcentaje completado
  subtaskTimeSpentSec?: number // tiempo total invertido en subtareas
  metrosCuadrados?: number | null // Metros cuadrados para impresión (especialmente en Taller Gráfico)
  etapaTallerGrafico?: string | null // Etapa actual dentro de Taller Gráfico
  etapaTallerGraficoFechaInicio?: string | null // Fecha de inicio de la etapa actual
  etapaInstalaciones?: string | null // Etapa actual dentro de Instalaciones
  etapaInstalacionesFechaInicio?: string | null // Fecha de inicio de la etapa actual en Instalaciones
  etapaTallerImprenta?: string | null // Etapa actual dentro de Taller de Imprenta
  etapaTallerImprentaFechaInicio?: string | null // Fecha de inicio de la etapa actual en Taller de Imprenta
  etapaImpresionDigital?: string | null // Etapa en Imprenta (Área de Impresión): En Proceso, Pausa, Fichas técnicas, etc.
  etapaImpresionDigitalFechaInicio?: string | null // Fecha de inicio de la etapa actual
  etapaMetalurgica?: string | null // Etapa actual dentro de Metalúrgica
  etapaMetalurgicaFechaInicio?: string | null // Fecha de inicio de la etapa actual en Metalúrgica
  briefPublico?: string | null // Brief público del proyecto
  objetivoProyecto?: string | null // Objetivo principal del proyecto
  publicoObjetivo?: string | null // Público objetivo del diseño
  estiloDiseno?: string | null // Estilo de diseño requerido
  referencias?: string | null // Referencias visuales o enlaces
  deadlineBrief?: string | null // Fecha límite para completar el brief
  estadoRevision?: string | null // Estado de revisión: 'pendiente', 'en_revision', 'aprobado', 'requiere_cambios'
  briefToken?: string | null // Token único para acceso público al formulario de brief
  // Campos del brief público completo
  clienteNombreCompleto?: string | null
  clienteEmpresa?: string | null
  tipoProductoServicio?: string[] | null
  tipoProductoOtro?: string | null
  necesitaAsesoramiento?: boolean | null
  dondeColocados?: string | null
  digitalOImpresion?: string | null
  cantidades?: string | null
  materialLogo?: string | null
  materialTextos?: string | null
  materialImagenes?: string | null
  tieneReferencias?: boolean | null
  referenciasLinks?: string | null
  fechaLimiteBrief?: string | null
  esUrgencia?: boolean | null
  esFichaNoOP?: boolean | null
  /** Si existía como FICHA-* antes de convertir a OP (historial) */
  numeroFichaOriginal?: string | null
  planillaPreliminar?: boolean | null
  fichaTecnicaPdfUrl?: string | null
  fichaTecnicaCargada?: boolean | null // Indica si la ficha técnica fue cargada (checklist)
  /** Marcado manual en edición: ficha técnica incompleta */
  fichaTecnicaIncompleta?: boolean | null
  presupuestoEnviadoCliente?: boolean | null // Indica si el presupuesto fue enviado al cliente (checklist)
  presupuestoArmado?: boolean | null // Presupuestos: checklist "Armado"
  presupuestoEnEspera?: boolean | null // Presupuestos: checklist "En espera"
  /** UI only: marca cuando se movió entre columnas para mostrar "NEW" */
  uiMovedAt?: number
  /** Reclamo registrado: trabajo a rehacer (bordes destacados en ficha) */
  enReclamo?: boolean
  /** Motivo del reclamo (si se cargó al marcar) */
  reclamoMotivo?: string | null
}

export interface Subtask {
  id: string
  ordenId: number
  title: string
  done: boolean
  estimatedMinutes?: number
  timeSpentSec: number
  startedAt?: string
  completedAt?: string
}

export interface ActivityEvent {
  id: string
  taskId: string
  from: TaskStatus
  to: TaskStatus
  actorId: string
  timestamp: string
  note: string
}

export interface ColumnConfig {
  id: TaskStatus
  label: string
  description: string
  accent: string
}

