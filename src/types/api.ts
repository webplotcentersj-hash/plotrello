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
  entregado?: boolean | null // Indica si la ficha fue entregada y está archivada
  etiquetas?: string[] | null // Etiquetas de colores
  metros_cuadrados?: number | null // Metros cuadrados para impresión (especialmente en Taller Gráfico)
  brief_publico?: string | null // Brief público del proyecto
  objetivo_proyecto?: string | null // Objetivo principal del proyecto
  publico_objetivo?: string | null // Público objetivo del diseño
  estilo_diseno?: string | null // Estilo de diseño requerido
  referencias?: string | null // Referencias visuales o enlaces
  deadline_brief?: string | null // Fecha límite para completar el brief
  estado_revision?: string | null // Estado de revisión: 'pendiente', 'en_revision', 'aprobado', 'requiere_cambios'
}

export interface RevisionOrden {
  id: number
  id_orden: number
  usuario_revisor_id: number
  usuario_revisor_nombre: string
  estado_revision: 'pendiente' | 'en_revision' | 'aprobado' | 'requiere_cambios'
  comentarios: string | null
  fecha_revision: string
  fecha_aprobacion: string | null
}

export interface TrabajoGaleria {
  id: number
  id_orden: number
  numero_op: string
  cliente: string
  titulo: string | null
  descripcion: string | null
  imagen_url: string
  categoria: string | null
  tags: string[] | null
  fecha_completado: string
  usuario_subio_nombre: string | null
  visible_publico: boolean
  destacado: boolean
  created_at: string
}

export interface CategoriaGaleria {
  categoria: string
  cantidad: number
}

export interface RegistroTiempo {
  id: number
  id_orden: number
  usuario_id: number
  usuario_nombre: string
  fecha: string
  hora_inicio: string
  hora_fin: string | null
  tiempo_minutos: number | null
  descripcion: string | null
  tipo_trabajo: 'diseno' | 'revision' | 'correccion' | 'consulta' | 'otro'
  created_at: string
}

export interface TiempoUsuario {
  fecha: string
  total_minutos: number
  registros: number
}

// Subtareas / checklist por ficha
export interface TareaSubitem {
  id: number
  id_orden: number
  titulo: string
  done: boolean
  duracion_estimada_min?: number | null
  tiempo_invertido_seg: number
  iniciado_en?: string | null
  completado_en?: string | null
  creado_en?: string
  actualizado_en?: string
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
  | 'compras'

export interface UsuarioRecord {
  id: number
  nombre: string
  rol: UserRole
}

export interface ClienteRecord {
  id: number
  nombre: string
  dni_cuit?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  ubicacion_link?: string | null
  drive_link?: string | null
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
  stock?: number | null // Cantidad disponible en stock
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
  pedido_id: number | null
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

