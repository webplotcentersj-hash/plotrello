import type { ColumnConfig } from '../types/board'

// Kanban Asesor / Presupuestos: aquí el trabajo son fichas (No OP), no OPs de producción hasta cerrar acá.
export const ASESOR_PRESUPUESTOS_COLUMNS: ColumnConfig[] = [
  {
    id: 'asesor-tecnico',
    label: 'Asesor Técnico',
    description: 'Fichas en medición y factibilidad (no es OP de taller)',
    accent: '#06b6d4' // cyan
  },
  {
    id: 'presupuestos',
    label: 'Presupuestos',
    description: 'Fichas en cotización (aún no son OP)',
    accent: '#f59e0b' // amber
  },
  {
    id: 'finalizado-asesor-presupuestos',
    label: 'Finalizado',
    description: 'Cierre: la ficha pasa a OP real y entra al tablero general',
    accent: '#10b981' // verde
  }
]

