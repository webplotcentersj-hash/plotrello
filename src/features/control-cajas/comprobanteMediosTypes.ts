export type ComprobanteMedioTipo =
  | 'resumen_mp'
  | 'ticket_mp'
  | 'ticket_posnet'
  | 'ticket_tarjeta'
  | 'egreso'
  | 'desconocido'

export type ComprobanteLineaResumen = {
  concepto: string
  cantidad: number
  monto: number
  marca_tarjeta?: string | null
  metodo_pago?: string | null
}

export type ComprobanteMedioParsed = {
  archivo_nombre: string
  tipo: ComprobanteMedioTipo
  fecha: string
  hora?: string | null
  comercio?: string | null
  operacion_numero?: string | null
  medio: 'mercado_pago' | 'posnet' | 'tarjeta' | 'otro'
  metodo_pago?: string | null
  marca_tarjeta?: string | null
  ultimos_digitos?: string | null
  monto: number
  estado?: string | null
  es_resumen: boolean
  lineas_resumen: ComprobanteLineaResumen[]
  total_resumen?: number | null
  warnings: string[]
}

export type ComprobanteLoteParsed = {
  comprobantes: ComprobanteMedioParsed[]
  total_monto_operaciones: number
  warnings: string[]
}
