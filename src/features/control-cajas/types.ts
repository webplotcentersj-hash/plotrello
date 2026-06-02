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

export type CajaMovimientoTrazabilidad = {
  origen_efectivo_antes?: number | null
  origen_otros_antes?: number | null
  destino_efectivo_antes?: number | null
  destino_otros_antes?: number | null
  origen_efectivo_despues?: number | null
  origen_otros_despues?: number | null
  destino_efectivo_despues?: number | null
  destino_otros_despues?: number | null
}

export type CajaPaseSubtipo = 'fondo' | 'resto_admin' | 'libre'

export type CajaTipoMovimiento = 'ingreso' | 'egreso' | 'traspaso' | 'ajuste'

export type CajaMovimiento = {
  id: string
  fecha: string
  hora?: string | null
  concepto: CajaMovimientoConcepto | string
  tipo_movimiento?: CajaTipoMovimiento | null
  categoria?: string | null
  tercero_nombre?: string | null
  monto_total?: number | null
  cuenta_corriente?: number | null
  cheque_propio?: number | null
  cheque_tercero?: number | null
  tarjeta?: number | null
  documento?: number | null
  cuenta_contable?: number | null
  transferencia_bancaria?: number | null
  subtipo_pase?: CajaPaseSubtipo | null
  id_lote?: string | null
  cierre_id?: string | null
  anulado?: boolean
  origen_slug: string
  destino_slug: string
  efectivo: number
  otros: number
  nro_comprobante?: string | null
  observacion?: string | null
  id_usuario?: number | null
  usuario_nombre?: string | null
  origen_importacion: 'manual' | 'excel' | 'planilla_pdf'
  traspaso_id?: string | null
  /** Desglose por medio de pago (columnas planilla Plot Center). */
  medios?: Record<string, number> | null
  created_at?: string
} & CajaMovimientoTrazabilidad

export type CajaCierreEstado = 'OK' | 'REVISAR'

export type CajaCierreEstadoCierre = 'abierto' | 'cerrado' | 'observado' | 'anulado'

export type CajaCierre = {
  id: string
  fecha: string
  fecha_hasta?: string | null
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
  estado_cierre?: CajaCierreEstadoCierre
  snapshot_totales?: Record<string, unknown> | null
  observacion?: string | null
  id_planilla?: string | null
  created_at?: string
  updated_at?: string
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

export type CajaAlertaSeveridad = 'ok' | 'info' | 'warn' | 'error'

export type CajaAlertaDominio =
  | 'efectivo'
  | 'mercado_pago'
  | 'banco'
  | 'cierre'
  | 'arqueo'
  | 'movimiento'
  | 'diferencia'
  | 'general'

export type CajaAlerta = {
  id: string
  severidad: CajaAlertaSeveridad
  dominio: CajaAlertaDominio
  titulo: string
  detalle: string
  fecha?: string
  accion?: { label: string; section: CajaSectionId }
}

export type CajaSaludResumen = {
  puntaje: number
  etiqueta: 'Excelente' | 'Atención' | 'Crítico'
  alertas: CajaAlerta[]
  fechasRecientes: string[]
  totalesMes: {
    cierres: number
    ok: number
    revisar: number
    difNeta: number
    ventas: number
  }
}

export type CajaSectionId =
  | 'tablero_admin'
  | 'centro_ia'
  | 'tablero'
  | 'cierres_new'
  | 'cierres'
  | 'arqueo'
  | 'pase_caja'
  | 'cierre_turno'
  | 'egresos'
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

export type CajaEgresoEstado = 'pendiente' | 'aprobado' | 'rechazado'

export type CajaEgresoSolicitud = {
  id: string
  fecha: string
  caja_slug: string
  concepto: string
  monto_efectivo: number
  monto_otros: number
  estado: CajaEgresoEstado
  solicitante_id?: number | null
  solicitante_nombre?: string | null
  aprobador_id?: number | null
  aprobador_nombre?: string | null
  observacion?: string | null
  motivo_rechazo?: string | null
  id_movimiento?: string | null
  created_at?: string
  updated_at?: string
}

export type CajaTransferenciaLote = {
  id: string
  fecha: string
  hora?: string | null
  origen_slug: string
  caja_fondo_destino_slug: string
  arqueo_efectivo: number
  arqueo_otros: number
  fondo_monto: number
  resto_efectivo: number
  resto_otros: number
  egresos_aprobados_ef: number
  id_planilla?: string | null
  id_usuario?: number | null
  usuario_nombre?: string | null
  observacion?: string | null
  created_at?: string
}

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
