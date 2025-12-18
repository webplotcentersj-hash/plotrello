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
  etapa_taller_grafico?: string | null // Etapa actual dentro de Taller Gráfico
  etapa_taller_grafico_fecha_inicio?: string | null // Fecha de inicio de la etapa actual
  etapa_instalaciones?: string | null // Etapa actual dentro de Instalaciones
  etapa_instalaciones_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Instalaciones
  etapa_taller_imprenta?: string | null // Etapa actual dentro de Taller de Imprenta
  etapa_taller_imprenta_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Taller de Imprenta
  etapa_metalurgica?: string | null // Etapa actual dentro de Metalúrgica
  etapa_metalurgica_fecha_inicio?: string | null // Fecha de inicio de la etapa actual en Metalúrgica
  id_pedido_cliente?: number | null // ID del pedido web que originó esta OP
  origen_pedido_web?: boolean | null // Indica si la OP viene de un pedido web
  brief_publico?: string | null // Brief público del proyecto
  objetivo_proyecto?: string | null // Objetivo principal del proyecto
  publico_objetivo?: string | null // Público objetivo del diseño
  estilo_diseno?: string | null // Estilo de diseño requerido
  referencias?: string | null // Referencias visuales o enlaces
  deadline_brief?: string | null // Fecha límite para completar el brief
  estado_revision?: string | null // Estado de revisión: 'pendiente', 'en_revision', 'aprobado', 'requiere_cambios'
  brief_token?: string | null // Token único para acceso público al formulario de brief
  cliente_nombre_completo?: string | null // Nombre completo del cliente (del brief)
  cliente_empresa?: string | null // Empresa/Emprendimiento del cliente
  tipo_producto_servicio?: string[] | null // Array de tipos de productos/servicios seleccionados
  tipo_producto_otro?: string | null // Otro tipo de producto especificado
  necesita_asesoramiento?: boolean | null // Si necesita asesoramiento
  donde_colocados?: string | null // Dónde serán colocados los productos
  digital_o_impresion?: string | null // Si es digital, impresión o ambos
  cantidades?: string | null // Cantidades requeridas
  material_logo?: string | null // Estado del material de logo
  material_textos?: string | null // Estado del material de textos
  material_imagenes?: string | null // Estado del material de imágenes
  tiene_referencias?: boolean | null // Si tiene referencias de estilo
  referencias_links?: string | null // Links o descripción de referencias
  fecha_limite_brief?: string | null // Fecha límite del proyecto
  es_urgencia?: boolean | null // Si es un pedido urgente
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

export interface LegajoEmpleado {
  id?: number
  id_usuario: number
  nombre?: string | null
  apellido?: string | null
  telefono?: string | null
  ubicacion?: string | null
  foto_url?: string | null
  sector?: string | null
  funciones?: string | null
  fecha_ingreso?: string | null
  fecha_nacimiento?: string | null
  dni?: string | null
  direccion?: string | null
  email?: string | null
  estado_civil?: string | null
  contacto_emergencia_nombre?: string | null
  contacto_emergencia_telefono?: string | null
  observaciones?: string | null
  created_at?: string
  updated_at?: string
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

// ============================================
// SISTEMA DE PEDIDOS WEB
// ============================================

export interface ClienteWebRecord {
  id: number
  usuario: string
  nombre: string
  apellido?: string | null
  empresa?: string | null
  telefono?: string | null
  email?: string | null
  dni_cuit?: string | null
  direccion?: string | null
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface ArticuloEmpresaRecord {
  id: number
  codigo: string
  nombre: string
  descripcion?: string | null
  categoria?: string | null
  precio_base?: number | null
  activo: boolean
  imagen_url?: string | null
  tiempo_estimado_dias?: number | null
  requiere_archivos: boolean
  visible_clientes: boolean
  created_at?: string
  updated_at?: string
}

export interface PedidoClienteRecord {
  id: number
  id_cliente: number
  numero_pedido: string
  estado: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'convertido_parcial' | 'convertido_completo' | 'cancelado'
  id_op_asociada?: number | null
  fecha_pedido: string
  fecha_limite_deseada?: string | null
  observaciones_cliente?: string | null
  observaciones_internas?: string | null
  precio_total: number
  es_urgente?: boolean
  requiere_delivery?: boolean
  direccion_delivery?: string | null
  tipo_producto_servicio?: string[] | null
  tipo_producto_otro?: string | null
  necesita_asesoramiento?: boolean
  donde_colocados?: string | null
  digital_o_impresion?: string | null
  cantidades?: string | null
  objetivo_proyecto?: string | null
  material_logo?: string | null
  material_textos?: string | null
  material_imagenes?: string | null
  tiene_referencias?: boolean
  referencias_links?: string | null
  brief_publico?: string | null
  estilo_diseno?: string | null
  referencias?: string | null
  created_at?: string
  updated_at?: string
}

export interface MensajePedidoClienteRecord {
  id: number
  id_pedido_cliente: number
  id_cliente: number
  id_usuario?: number | null
  mensaje: string
  es_del_cliente: boolean
  leido: boolean
  fecha_creacion: string
}

export interface PedidoClienteItemRecord {
  id: number
  id_pedido: number
  id_articulo: number
  cantidad: number
  precio_unitario: number
  precio_total: number
  descripcion_personalizada?: string | null
  created_at?: string
  updated_at?: string
}

export interface PedidoClienteArchivoRecord {
  id: number
  id_pedido: number
  id_item?: number | null
  url: string
  nombre_archivo: string
  tipo?: string | null
  tamaño?: number | null
  uploaded_at?: string
}

export interface PedidoClienteDetalle {
  pedido: PedidoClienteRecord & {
    cliente: ClienteWebRecord
  }
  items: Array<PedidoClienteItemRecord & {
    articulo: ArticuloEmpresaRecord
  }>
  archivos: PedidoClienteArchivoRecord[]
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

export interface HistorialEtapaInstalaciones {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaTallerImprenta {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaMetalurgica {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
}

export interface HistorialEtapaTallerGrafico {
  id: number
  id_orden: number
  etapa_anterior?: string | null
  etapa_nueva: string
  id_usuario?: number | null
  nombre_usuario?: string | null
  comentario?: string | null
  fecha_cambio: string
  fecha_inicio_etapa: string
  fecha_fin_etapa?: string | null
  tiempo_en_etapa_seg?: number | null
  tiempo_formateado?: string | null
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

