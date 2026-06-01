export type CajaRegistro = {
  slug: string
  nombre: string
  fondo_fijo: number
  activa: boolean
}

export type CajaArqueo = {
  id: string
  fecha: string
  caja_slug: string
  turno: string
  id_usuario?: number | null
  usuario_nombre?: string | null
  billetes: Record<string, number>
  total: number
  firma_data_url?: string | null
  created_at?: string
}

export type CajaMovimientoConcepto =
  | 'Fondo de caja'
  | 'Pase de caja'
  | 'Cierre de caja'
  | 'Otro'

export type CajaMovimiento = {
  id: string
  fecha: string
  hora?: string | null
  concepto: CajaMovimientoConcepto | string
  origen_slug: string
  destino_slug: string
  efectivo: number
  otros: number
  nro_comprobante?: string | null
  observacion?: string | null
  id_usuario?: number | null
  usuario_nombre?: string | null
  origen_importacion: 'manual' | 'excel' | 'planilla_pdf'
  created_at?: string
}

export type CajaCierreEstado = 'OK' | 'REVISAR'

export type CajaCierre = {
  id: string
  fecha: string
  caja_slug: string
  turno: string
  cajera?: string | null
  email_ok?: 'Sí' | 'No' | null
  fondo_fijo: number
  ing_ef: number
  egr_ef: number
  ef_teorico: number
  ef_contado: number
  dif_ef: number
  tarj_sist: number
  tarj_fis: number
  dif_tarj: number
  mp_qr: number
  trans: number
  cta_cte: number
  total_ventas: number
  dif_total: number
  estado: CajaCierreEstado
  observacion?: string | null
  id_planilla?: string | null
  created_at?: string
}

export type CajaConcilMP = {
  id: string
  fecha: string
  sistema: number
  dashboard: number
  diferencia: number
  estado: CajaCierreEstado
  observacion?: string | null
  created_at?: string
}

export type CajaConcilBanco = {
  id: string
  fecha: string
  sistema: number
  extracto: number
  diferencia: number
  estado: CajaCierreEstado
  observacion?: string | null
  created_at?: string
}

export type CajaDiferencia = {
  id: string
  fecha: string
  caja_slug?: string | null
  tipo: 'Faltante' | 'Sobrante'
  monto: number
  motivo?: string | null
  responsable?: string | null
  estado: 'Pendiente' | 'Resuelto'
  id_cierre?: string | null
  auto_desde_cierre?: boolean
  created_at?: string
}

export type CajaCajera = { nombre: string; usuario: string }

export type CajaParams = {
  tolerancia: number
  cajeras: CajaCajera[]
}

export type CajaSectionId =
  | 'tablero_admin'
  | 'tablero'
  | 'cierres_new'
  | 'cierres'
  | 'arqueo'
  | 'movimientos'
  | 'historial'
  | 'arqueos_admin'
  | 'movimientos_admin'
  | 'concil_mp'
  | 'concil_banco'
  | 'diferencias'
  | 'ventas'
  | 'config'
  | 'asistente'

export type MovimientoExcelRow = Omit<CajaMovimiento, 'id' | 'created_at' | 'origen_importacion'> & {
  origen_importacion?: 'excel'
}

export type PlanillaCajaGuardada = {
  id: string
  archivo_nombre: string
  fecha_desde: string
  fecha_hasta: string
  caja_nombre: string
  caja_slug: string | null
  totales: Record<string, number> | null
  resumen: {
    cantidad_ventas: number
    cantidad_egresos: number
    cantidad_mec: number
  }
  id_usuario?: number | null
  usuario_nombre?: string | null
  created_at?: string
}
