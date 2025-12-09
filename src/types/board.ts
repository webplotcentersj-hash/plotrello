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
  clientEmail?: string
  clientAddress?: string
  whatsappUrl?: string
  locationUrl?: string
  driveUrl?: string
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

