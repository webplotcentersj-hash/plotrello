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

export type WorkPoolJob = {
  id: number
  sector: WorkPoolSector
  id_orden: number | null
  numero_op: string | null
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

export type WorkPoolAdminDashboard = {
  kpis: WorkPoolAdminKpis
  resumen_sectores: WorkPoolResumenSector[]
  freelancers: WorkPoolFreelancerResumen[]
  pendientes_revision: WorkPoolJob[]
  jobs_recientes: WorkPoolJob[]
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
