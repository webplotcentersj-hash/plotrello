// Tipos para el sistema de pedidos de compra

export type EstadoPedido = 
  | 'Pendiente'
  | 'En Revisión'
  | 'Aprobado'
  | 'Rechazado'
  | 'En Compra'
  | 'Completado'
  | 'Cancelado'

export type PrioridadPedido = 'Baja' | 'Normal' | 'Alta' | 'Urgente'

export type TipoMovimientoStock = 
  | 'Entrada'
  | 'Salida'
  | 'Ajuste'
  | 'Pedido'
  | 'Venta'
  | 'Devolución'

export interface PedidoCompra {
  id: number
  numero_pedido: string
  id_solicitante: number
  nombre_solicitante: string
  sector_solicitante?: string | null
  estado: EstadoPedido
  prioridad: PrioridadPedido
  motivo?: string | null
  observaciones?: string | null
  fecha_solicitud: string
  fecha_aprobacion?: string | null
  fecha_rechazo?: string | null
  fecha_completado?: string | null
  id_aprobador?: number | null
  nombre_aprobador?: string | null
  motivo_rechazo?: string | null
  created_at: string
  updated_at: string
  items?: PedidoCompraItem[]
  comentarios?: PedidoCompraComentario[]
}

export interface PedidoCompraItem {
  id: number
  id_pedido: number
  id_articulo_stock?: number | null
  codigo_articulo?: string | null
  descripcion: string
  cantidad_solicitada: number
  cantidad_aprobada?: number | null
  cantidad_comprada?: number | null
  unidad: string
  precio_unitario?: number | null
  precio_total?: number | null
  proveedor?: string | null
  observaciones?: string | null
  created_at: string
}

export interface PedidoCompraComentario {
  id: number
  id_pedido: number
  id_usuario: number
  nombre_usuario: string
  comentario: string
  es_interno: boolean
  created_at: string
}

export interface StockMovimiento {
  id: number
  id_articulo_stock: number
  codigo_articulo?: string | null
  descripcion: string
  tipo_movimiento: TipoMovimientoStock
  cantidad: number
  cantidad_anterior?: number | null
  cantidad_nueva?: number | null
  motivo?: string | null
  id_orden_trabajo?: number | null
  id_pedido_compra?: number | null
  id_usuario?: number | null
  nombre_usuario?: string | null
  created_at: string
}

export interface ArticuloStock {
  id: number
  codigo?: string | null
  descripcion: string
  stock: number | null
  unidad?: string | null
  precio?: number | null
  proveedor?: string | null
  categoria?: string | null
  stock_minimo?: number | null
  activo?: boolean | null
}

