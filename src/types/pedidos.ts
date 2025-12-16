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
  fecha_entrega_estimada?: string | null
  fecha_entrega_real?: string | null
  estado_entrega?: EstadoEntrega | null
  tracking_number?: string | null
  transportista?: string | null
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
  sector?: string | null
}

// Tipos para gestión de proveedores
export interface Proveedor {
  id: number
  nombre: string
  razon_social?: string | null
  cuit?: string | null
  contacto_nombre?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  ciudad?: string | null
  provincia?: string | null
  codigo_postal?: string | null
  sitio_web?: string | null
  notas?: string | null
  activo: boolean
  calificacion: number
  total_compras: number
  monto_total_compras: number
  created_at: string
  updated_at: string
}

export interface ProveedorProducto {
  id: number
  id_proveedor: number
  codigo_producto?: string | null
  descripcion: string
  unidad: string
  precio_unitario?: number | null
  moneda: string
  stock_disponible?: number | null
  tiempo_entrega_dias?: number | null
  observaciones?: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type EstadoPresupuesto = 'Pendiente' | 'Enviado' | 'Recibido' | 'Aceptado' | 'Rechazado' | 'Vencido'

export interface Presupuesto {
  id: number
  numero_presupuesto: string
  id_pedido_compra?: number | null
  id_proveedor: number
  estado: EstadoPresupuesto
  fecha_solicitud: string
  fecha_envio?: string | null
  fecha_recepcion?: string | null
  fecha_vencimiento?: string | null
  fecha_aceptacion?: string | null
  monto_total?: number | null
  moneda: string
  condiciones_pago?: string | null
  tiempo_entrega_dias?: number | null
  observaciones?: string | null
  archivo_adjunto_url?: string | null
  id_usuario_solicitante?: number | null
  nombre_usuario_solicitante?: string | null
  created_at: string
  updated_at: string
  items?: PresupuestoItem[]
  proveedor?: Proveedor
}

export interface PresupuestoItem {
  id: number
  id_presupuesto: number
  id_item_pedido?: number | null
  codigo_producto?: string | null
  descripcion: string
  cantidad: number
  unidad: string
  precio_unitario: number
  precio_total: number
  observaciones?: string | null
  created_at: string
}

export interface PrecioHistorial {
  id: number
  id_proveedor_producto?: number | null
  id_proveedor?: number | null
  codigo_producto?: string | null
  descripcion: string
  precio_anterior?: number | null
  precio_nuevo: number
  fecha_cambio: string
  id_usuario?: number | null
  motivo?: string | null
  created_at: string
}

export interface ComparacionPresupuestos {
  id: number
  id_pedido_compra: number
  id_presupuesto_seleccionado?: number | null
  notas_comparacion?: string | null
  criterio_seleccion?: string | null
  id_usuario_comparador?: number | null
  fecha_comparacion: string
  created_at: string
}

export type EstadoEntrega = 
  | 'Pendiente'
  | 'En Tránsito'
  | 'Parcialmente Entregado'
  | 'Listo para Retirar'
  | 'Entregado'
  | 'Retrasado'

// Tipos para conciliación bancaria
export type EstadoPago = 'Pendiente' | 'Parcial' | 'Completado' | 'Vencido' | 'Cancelado'

export interface Pago {
  id: number
  numero_pago: string
  id_pedido_compra?: number | null
  id_proveedor?: number | null
  monto_total: number
  monto_pagado: number
  moneda: string
  fecha_vencimiento?: string | null
  fecha_pago?: string | null
  metodo_pago?: string | null
  numero_comprobante?: string | null
  banco?: string | null
  cuenta_bancaria?: string | null
  estado: EstadoPago
  observaciones?: string | null
  id_usuario_registro?: number | null
  nombre_usuario_registro?: string | null
  fecha_conciliacion?: string | null
  id_usuario_conciliacion?: number | null
  created_at: string
  updated_at: string
  pedido?: PedidoCompra
  proveedor?: Proveedor
}

export interface MovimientoBancario {
  id: number
  fecha_movimiento: string
  fecha_valor?: string | null
  tipo: 'Ingreso' | 'Egreso'
  concepto: string
  monto: number
  moneda: string
  banco: string
  cuenta_bancaria: string
  numero_comprobante?: string | null
  referencia?: string | null
  id_pago_asociado?: number | null
  conciliado: boolean
  fecha_conciliacion?: string | null
  id_usuario_conciliacion?: number | null
  observaciones?: string | null
  created_at: string
  updated_at: string
  pago?: Pago
}

export interface ConciliacionBancaria {
  id: number
  fecha_conciliacion: string
  fecha_desde: string
  fecha_hasta: string
  banco: string
  cuenta_bancaria: string
  saldo_inicial: number
  saldo_final: number
  total_ingresos: number
  total_egresos: number
  movimientos_conciliados: number
  movimientos_pendientes: number
  id_usuario: number
  nombre_usuario: string
  observaciones?: string | null
  created_at: string
  movimientos?: MovimientoBancario[]
}
