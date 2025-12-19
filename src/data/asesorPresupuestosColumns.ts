import type { ColumnConfig } from '../types/board'

// Columnas del Kanban para Asesor Técnico y Presupuestos
export const ASESOR_PRESUPUESTOS_COLUMNS: ColumnConfig[] = [
  {
    id: 'asesor-tecnico',
    label: 'Asesor Técnico',
    description: 'Mediciones y evaluación de factibilidad de proyectos',
    accent: '#06b6d4' // cyan
  },
  {
    id: 'presupuestos',
    label: 'Presupuestos',
    description: 'Cotizaciones y presupuestos de proyectos',
    accent: '#f59e0b' // amber
  },
  {
    id: 'finalizado-asesor-presupuestos',
    label: 'Finalizado',
    description: 'Proyectos completados en asesoría y presupuestos',
    accent: '#10b981' // verde
  }
]

