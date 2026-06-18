export type AfipAmbiente = 'Testing' | 'Homologación' | 'Producción'

export type AfipConfigResumen = {
  id?: number
  cuit?: string
  punto_venta?: number
  ambiente?: AfipAmbiente
  webservice?: string
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
  id_factura_referencia?: number | null
  items?: Array<{
    iva_porcentaje?: number
    subtotal?: number
    iva_monto?: number
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
  resultado: string
  observaciones?: string | null
  raw?: unknown
}
