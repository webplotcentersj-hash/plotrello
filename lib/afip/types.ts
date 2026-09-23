export type AfipAmbiente = 'Testing' | 'Homologación' | 'Producción'

export type AfipConfigResumen = {
  id?: number
  cuit?: string
  punto_venta?: number
  ambiente?: AfipAmbiente
  webservice?: string
  /** Condición IVA del emisor (define si emite A/B o C). */
  condicion_iva?: string
  ultimo_numero_factura_a?: number
  ultimo_numero_factura_b?: number
  ultimo_numero_factura_c?: number
}

export type FacturaAfipInput = {
  id: number
  tipo_comprobante: string
  punto_venta: number
  numero_comprobante: number
  fecha_emision: string
  cliente_nombre: string
  cliente_dni_cuit?: string | null
  cliente_condicion_iva?: string | null
  subtotal: number
  iva: number
  total: number
  /** 1 Productos · 2 Servicios · 3 Productos y Servicios. */
  concepto?: number | null
  fecha_servicio_desde?: string | null
  fecha_servicio_hasta?: string | null
  /** Vencimiento del pago (obligatorio en AFIP para servicios). */
  fecha_vencimiento?: string | null
  id_factura_referencia?: number | null
  items?: Array<{
    iva_porcentaje?: number
    subtotal?: number
    iva_monto?: number
    total?: number
  }>
}

export type FacturaReferenciaAfip = {
  tipo_comprobante: string
  punto_venta: number
  numero_comprobante: number
} | null

export type AutorizarFacturaResult = {
  cae: string
  caeVencimiento: string
  numeroComprobante: number
  puntoVenta: number
  /** Fecha del comprobante informada a AFIP (yyyy-mm-dd). */
  fechaEmision: string
  /** Servicios: período y vencimiento del pago informados (yyyy-mm-dd). Null para productos. */
  servicio?: { desde: string; hasta: string; vtoPago: string } | null
  resultado: string
  observaciones?: string | null
  /** true si el CAE se recuperó de un intento anterior en vez de pedir uno nuevo. */
  recuperado?: boolean
  raw?: unknown
}
