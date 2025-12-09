export interface OrdenTrabajo {
  id: number
  numero_op: string
  cliente: string
  dni_cuit?: string | null
  descripcion?: string | null
  estado: string
  prioridad: string
  fecha_creacion?: string | null
  fecha_entrega?: string | null
  fecha_ingreso?: string | null
  operario_asignado?: string | null
  complejidad?: string | null
  sector?: string | null // Sector único (para compatibilidad)
  sectores?: string[] | null // Array de sectores requeridos
  sector_inicial?: string | null // Sector donde aparece la ficha principal (puede NO estar en sectores[])
  materiales?: string | null
  nombre_creador?: string | null
  foto_url?: string | null
  usuario_trabajando_nombre?: string | null
  telefono_cliente?: string | null
  email_cliente?: string | null
  direccion_cliente?: string | null
  whatsapp_link?: string | null
  ubicacion_link?: string | null
  drive_link?: string | null
  es_duplicado?: boolean | null // Indica si es una ficha duplicada
  id_orden_original?: number | null // ID de la ficha original (si es duplicada)
  ubicacion_final?: string | null // Sector físico previo al pasar a Finalizado en Taller
}

export type UserRole =
  | 'administracion'
  | 'gerencia'
  | 'recursos-humanos'
  | 'diseno'
  | 'imprenta'
  | 'taller-grafico'
  | 'instalaciones'
  | 'metalurgica'
  | 'caja'
  | 'mostrador'

export interface UsuarioRecord {
  id: number
  nombre: string
  rol: UserRole
}

export interface SectorRecord {
  id: number
  nombre: string
  color?: string | null
  activo?: boolean | null
}

export interface MaterialRecord {
  id: number
  codigo?: string | null
  descripcion: string
}

export interface HistorialMovimiento {
  id: number
  id_orden: number
  estado_anterior: string
  estado_nuevo: string
  id_usuario: number
  timestamp: string
  comentario?: string | null
}

export interface ChatMessage {
  id: number
  room_id: number
  id_usuario: number
  nombre_usuario?: string
  mensaje: string
  tipo?: 'message' | 'alert' | 'buzz'
  timestamp: string
}

export interface ComentarioOrden {
  id: number
  id_orden: number
  comentario: string
  usuario_nombre: string
  mencionados?: any
  timestamp: string
}

export interface Notification {
  id: number
  user_id: number
  title: string
  description: string | null
  type: 'info' | 'success' | 'warning' | 'error' | 'mention'
  orden_id: number | null
  is_read: boolean
  timestamp: string
}

export interface TareaRecord {
  id: number
  id_orden: number
  descripcion_tarea: string
  estado_kanban: 'Pendiente' | 'En Proceso' | 'Finalizado'
  sector?: string | null
  es_sub_tarea?: boolean
}

