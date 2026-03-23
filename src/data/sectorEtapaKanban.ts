import type { Task, TaskStatus } from '../types/board'

/** Columna interna para fichas sin etapa asignada (solo lectura como destino de drop) */
export const SIN_ETAPA_COLUMN_ID = '__sin_etapa__'

export type SectorEtapaSlug =
  | 'taller-grafico'
  | 'instalaciones'
  | 'taller-imprenta'
  | 'imprenta'
  | 'metalurgica'

export type SectorEtapaColumnDef = {
  id: string
  label: string
  accent: string
}

export type SectorEtapaKanbanConfig = {
  slug: SectorEtapaSlug
  /** Nombre de sector como en `assignedSector` / filtro */
  sectorName: string
  /** Solo tareas en esta columna del tablero principal */
  taskStatus: TaskStatus
  /** Etapas en orden (mismos textos que en modales / RPC) */
  etapas: SectorEtapaColumnDef[]
}

const TG_ETAPAS: SectorEtapaColumnDef[] = [
  { id: 'Falta Material para Impresión o archivo', label: 'Falta Material para Impresión o archivo', accent: '#ef4444' },
  { id: 'En Proceso', label: 'En Proceso', accent: '#3b82f6' },
  { id: 'Para Cortar o Pegar', label: 'Para Cortar o Pegar', accent: '#f59e0b' },
  { id: 'Para Rotular', label: 'Para Rotular', accent: '#8b5cf6' },
  { id: 'Instalaciones/Ploteo', label: 'Instalaciones/Ploteo', accent: '#10b981' },
  { id: 'Metalurgica Instalacion', label: 'Metalurgica Instalacion', accent: '#ec4899' },
  { id: 'laminas', label: 'laminas', accent: '#06b6d4' }
]

const INST_ETAPAS: SectorEtapaColumnDef[] = [
  { id: 'Falta Info o Material', label: 'Falta Info o Material', accent: '#ef4444' },
  { id: 'Coordinados para Instalaciones', label: 'Coordinados para Instalaciones', accent: '#3b82f6' },
  { id: 'Listos para instalar', label: 'Listos para instalar', accent: '#10b981' },
  { id: 'Pausados', label: 'Pausados', accent: '#f59e0b' },
  { id: 'Rehacer', label: 'Rehacer', accent: '#ec4899' }
]

const TIMP_ETAPAS: SectorEtapaColumnDef[] = [
  { id: 'Proceso', label: 'Proceso', accent: '#3b82f6' },
  { id: 'Finalizado/máquina con Precorte', label: 'Finalizado/máquina con Precorte', accent: '#10b981' },
  { id: 'Almacén', label: 'Almacén', accent: '#f59e0b' },
  { id: 'Entregado/ Derivado', label: 'Entregado/ Derivado', accent: '#8b5cf6' },
  { id: 'Sin Realizar Por faltantes', label: 'Sin Realizar Por faltantes', accent: '#ef4444' },
  { id: 'En Revisión', label: 'En Revisión', accent: '#ec4899' }
]

const IMP_DIG_ETAPAS: SectorEtapaColumnDef[] = [
  { id: 'En Proceso', label: 'En Proceso', accent: '#3b82f6' },
  { id: 'Pausa', label: 'Pausa', accent: '#f59e0b' },
  { id: 'Fichas técnicas', label: 'Fichas técnicas', accent: '#8b5cf6' },
  { id: 'Delivery', label: 'Delivery', accent: '#06b6d4' },
  { id: 'Taller de Imprenta', label: 'Taller de Imprenta', accent: '#22c55e' },
  { id: 'Para Embalar', label: 'Para Embalar', accent: '#eab308' },
  { id: 'Embalado', label: 'Embalado', accent: '#10b981' }
]

const MET_ETAPAS: SectorEtapaColumnDef[] = [
  { id: 'En Proceso', label: 'En Proceso', accent: '#3b82f6' },
  { id: 'Corte', label: 'Corte', accent: '#ef4444' },
  { id: 'Soldadura', label: 'Soldadura', accent: '#f59e0b' },
  { id: 'Pintura/Tratamiento', label: 'Pintura/Tratamiento', accent: '#8b5cf6' },
  { id: 'Montaje', label: 'Montaje', accent: '#06b6d4' },
  { id: 'Listo para Instalar', label: 'Listo para Instalar', accent: '#10b981' },
  { id: 'Finalizado', label: 'Finalizado', accent: '#6366f1' }
]

const CONFIGS: SectorEtapaKanbanConfig[] = [
  {
    slug: 'taller-grafico',
    sectorName: 'Taller Gráfico',
    taskStatus: 'taller-grafico',
    etapas: TG_ETAPAS
  },
  {
    slug: 'instalaciones',
    sectorName: 'Instalaciones',
    taskStatus: 'instalaciones',
    etapas: INST_ETAPAS
  },
  {
    slug: 'taller-imprenta',
    sectorName: 'Taller de Imprenta',
    taskStatus: 'taller-imprenta',
    etapas: TIMP_ETAPAS
  },
  {
    slug: 'imprenta',
    sectorName: 'Imprenta (Área de Impresión)',
    taskStatus: 'imprenta',
    etapas: IMP_DIG_ETAPAS
  },
  {
    slug: 'metalurgica',
    sectorName: 'Metalúrgica',
    taskStatus: 'metalurgica',
    etapas: MET_ETAPAS
  }
]

export function getSectorEtapaKanbanConfigs(): SectorEtapaKanbanConfig[] {
  return CONFIGS
}

export function getSectorEtapaKanbanBySlug(slug: string): SectorEtapaKanbanConfig | null {
  return CONFIGS.find((c) => c.slug === slug) ?? null
}

export function getSectorEtapaKanbanBySectorName(sectorName: string): SectorEtapaKanbanConfig | null {
  return CONFIGS.find((c) => c.sectorName === sectorName) ?? null
}

export function sectorNameSupportsEtapaKanban(sectorName: string): boolean {
  return sectorName !== 'todos' && CONFIGS.some((c) => c.sectorName === sectorName)
}

/** Valor de etapa actual en la tarea según sector */
export function getTaskEtapaValue(task: Task, config: SectorEtapaKanbanConfig): string | null {
  switch (config.slug) {
    case 'taller-grafico':
      return task.etapaTallerGrafico?.trim() || null
    case 'instalaciones':
      return task.etapaInstalaciones?.trim() || null
    case 'taller-imprenta':
      return task.etapaTallerImprenta?.trim() || null
    case 'imprenta':
      return task.etapaImpresionDigital?.trim() || null
    case 'metalurgica':
      return task.etapaMetalurgica?.trim() || null
    default:
      return null
  }
}

/** id de columna del kanban (etapa o sin etapa) */
export function resolveEtapaColumnId(task: Task, config: SectorEtapaKanbanConfig): string {
  const raw = getTaskEtapaValue(task, config)
  if (!raw) return SIN_ETAPA_COLUMN_ID
  const known = config.etapas.some((e) => e.id === raw)
  return known ? raw : SIN_ETAPA_COLUMN_ID
}

export function filterTasksForSectorEtapaKanban(tasks: Task[], config: SectorEtapaKanbanConfig): Task[] {
  return tasks.filter(
    (t) =>
      !t.entregado &&
      t.status === config.taskStatus &&
      (t.assignedSector === config.sectorName ||
        (Array.isArray(t.sectores) && t.sectores.includes(config.sectorName)))
  )
}
