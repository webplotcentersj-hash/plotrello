export type WorkPoolProduct = 'plot-design' | 'bolsa-plot'

export type WorkPoolSector = 'diseno' | 'instalaciones' | 'metalurgica'

export type WorkPoolJobEstado =
  | 'borrador'
  | 'disponible'
  | 'asignado'
  | 'en_curso'
  | 'entregado'
  | 'en_revision'
  | 'aprobado'
  | 'cambios'
  | 'cancelado'

export type WorkPoolJobModo = 'bolsa' | 'asignado'

export type WorkPoolLedgerTipo = 'acreditacion' | 'pago' | 'ajuste' | 'reverso'

export type WorkPoolSolicitudRubro = 'diseno' | 'instalaciones' | 'metalurgica'
export type WorkPoolSolicitudNivel =
  | 'estudiante'
  | 'junior'
  | 'semi_senior'
  | 'titulado'
  | 'experto'

export type WorkPoolSolicitud = {
  id: number
  tipo: 'diseno' | 'bolsa'
  rubro: WorkPoolSolicitudRubro | null
  nivel: WorkPoolSolicitudNivel | null
  nombre_completo: string
  email: string
  telefono: string | null
  documento: string | null
  titulo_texto: string | null
  experiencia: string | null
  referencias: string | null
  portfolio_url: string | null
  portfolio_archivo_url: string | null
  portfolio_archivo_nombre: string | null
  cv_url: string | null
  cv_nombre: string | null
  titulo_url: string | null
  titulo_nombre: string | null
  titulo_universitario_url: string | null
  titulo_universitario_nombre: string | null
  libreta_url: string | null
  libreta_nombre: string | null
  mensaje: string | null
  skills: string[]
  zona_cobertura: string | null
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  id_usuario_creado: number | null
  revisado_por: number | null
  notas_admin: string | null
  /** formulario = /postulacion-operarios; rrhh = espejo desde /rrhh/postulaciones */
  origen: 'formulario' | 'rrhh'
  id_rrhh_postulacion: number | null
  created_at: string
  updated_at: string
}

export type WorkPoolJob = {
  id: number
  sector: WorkPoolSector
  id_orden: number | null
  numero_op: string | null
  id_pedido_cliente?: number | null
  numero_pedido?: string | null
  titulo: string
  descripcion: string | null
  modo: WorkPoolJobModo
  estado: WorkPoolJobEstado
  prioridad: string
  plazo: string | null
  monto_presupuestado: number
  monto_final: number | null
  moneda: string
  id_usuario_asignado: number | null
  id_usuario_creador: number | null
  codigo_tarifa: string | null
  metadata: Record<string, unknown>
  notas_entrega: string | null
  motivo_rechazo: string | null
  tomado_at: string | null
  entregado_at: string | null
  aprobado_at: string | null
  created_at: string
  updated_at: string
  asignado_nombre?: string | null
}

export type WorkPoolPricingRule = {
  id: number
  sector: WorkPoolSector
  codigo: string
  nombre: string
  monto_base: number
  activo: boolean
}

export type WorkPoolPedidoChat = {
  id_pedido: number
  numero_pedido: string
  titulo_trabajo: string
  id_job: number
  mensajes_no_leidos: number
  ultimo_mensaje_at: string | null
}

export type WorkPoolSaldoOperario = {
  acreditado: number
  pagado: number
  saldo_pendiente: number
}

export type WorkPoolResumenSector = {
  sector: string
  trabajos_abiertos: number
  trabajos_aprobados: number
  deuda_operarios: number
}

export type WorkPoolProfile = {
  id: number
  id_usuario: number
  sector: WorkPoolSector
  skills: string[]
  zona_cobertura: string | null
  activo: boolean
  aprobado: boolean
  notas_admin: string | null
  created_at: string
  updated_at: string
}

export type WorkPoolFreelancerResumen = {
  id_usuario: number
  nombre: string
  foto_url: string | null
  sectores: WorkPoolSector[]
  skills: string[]
  zona_cobertura: string | null
  perfil_aprobado: boolean
  perfil_activo: boolean
  trabajos_activos: number
  trabajos_aprobados: number
  pendientes_revision: number
  acreditado: number
  pagado: number
  saldo_pendiente: number
  ultimo_trabajo_at: string | null
  /** Promedio de encuesta cliente (1–5) sobre OPs del operario; null si no hay. */
  valoracion_promedio: number | null
  /** Cantidad de calificaciones cliente usadas en el promedio. */
  valoracion_count: number
  /** Notas admin del perfil principal (si hay). */
  notas_admin?: string | null
}

export type WorkPoolValoracion = {
  id: number
  id_usuario: number
  id_job: number | null
  numero_op: string | null
  rating: number
  comentario: string | null
  id_usuario_autor: number | null
  created_at: string
  origen?: 'admin' | 'cliente'
}

export type WorkPoolAdminKpis = {
  deuda_total: number
  trabajos_abiertos: number
  pendientes_revision: number
  operarios_activos: number
  disponibles_bolsa: number
  aprobados_mes: number
  acreditado_total: number
  pagado_total: number
  /** Briefs + pedidos portal + OPs en cola del tablero (entrantes a publicar). */
  trabajos_entrantes: number
}

export type WorkPoolOrdenSugerida = {
  id: number
  numero_op: string
  cliente: string
  descripcion: string | null
  estado: string
  sector: string | null
  /** OP en cola del tablero (Diseño Gráfico, Instalaciones o Metalúrgica). */
  en_tablero?: boolean
  /** @deprecated Usar en_tablero */
  en_tablero_diseno?: boolean
  brief_publico?: string | null
  objetivo_proyecto?: string | null
  brief_token?: string | null
  id_pedido_cliente?: number | null
}

export type WorkPoolBajaRegistro = {
  id: number
  id_usuario: number
  nombre: string
  rol: string | null
  motivo: string
  tipo_desvinculacion: string | null
  fecha_desvinculacion: string | null
  observaciones: string | null
  registrado_por: number | null
  created_at: string
}

export type WorkPoolAdminDashboard = {
  kpis: WorkPoolAdminKpis
  resumen_sectores: WorkPoolResumenSector[]
  freelancers: WorkPoolFreelancerResumen[]
  /** Historial de diseñadores/operarios dados de baja (no aparecen en listas activas). */
  dados_de_baja: WorkPoolBajaRegistro[]
  pendientes_revision: WorkPoolJob[]
  /** Trabajos publicados en bolsa (estado disponible). */
  publicados_bolsa: WorkPoolJob[]
  jobs_recientes: WorkPoolJob[]
  /** Avances de trabajos activos agrupados por operario asignado. */
  avances_por_operario: WorkPoolOperarioAvance[]
}

/** Pasos del flujo creativo / bolsa para seguimiento admin. */
export const WORK_POOL_AVANCE_PASOS = [
  { key: 'asignado', label: 'Asignado' },
  { key: 'en_curso', label: 'En curso' },
  { key: 'revision', label: 'Revisión' },
  { key: 'aprobado', label: 'Aprobado' }
] as const

export type WorkPoolJobAvance = {
  job: WorkPoolJob
  /** 1..4 según WORK_POOL_AVANCE_PASOS */
  paso: number
  etiqueta_paso: string
  /** true si está en 'cambios' (vuelve a producir) */
  en_cambios: boolean
}

export type WorkPoolOperarioAvance = {
  id_usuario: number
  nombre: string
  trabajos_en_curso: number
  en_revision: number
  jobs: WorkPoolJobAvance[]
}

export const WORK_POOL_SECTOR_LABELS: Record<WorkPoolSector, string> = {
  diseno: 'Diseño',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica'
}

export const WORK_POOL_ESTADO_LABELS: Record<WorkPoolJobEstado, string> = {
  borrador: 'Borrador',
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_curso: 'En curso',
  entregado: 'Entregado',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  cambios: 'Cambios',
  cancelado: 'Cancelado'
}
