import type { WorkPoolSector } from '../../types/workPool'

export const TABLERO_COLA_LABEL: Record<WorkPoolSector, string> = {
  diseno: 'Diseño Gráfico',
  instalaciones: 'Instalaciones',
  metalurgica: 'Metalúrgica'
}

export const TABLERO_COLA_SHORT: Record<WorkPoolSector, string> = {
  diseno: 'DG',
  instalaciones: 'Inst.',
  metalurgica: 'Met.'
}

/** Filtro Supabase `.or()` para OPs en la columna del tablero del sector. */
export function supabaseTableroColaOrFilter(sector: WorkPoolSector): string {
  switch (sector) {
    case 'diseno':
      return 'estado.eq.Diseño Gráfico,estado.ilike.%Diseño Gráfico%,estado.ilike.%Diseno Grafico%'
    case 'instalaciones':
      return 'estado.eq.Instalaciones,estado.ilike.%Instalaciones%,sector.ilike.%Instalaciones%'
    case 'metalurgica':
      return 'estado.eq.Metalúrgica,estado.ilike.%Metalúrgica%,estado.ilike.%Metalurgica%,sector.ilike.%Metal%'
  }
}

/** Filtro amplio para historial de trabajos del sector en el tablero. */
export function supabaseHistorialSectorOrFilter(sector: WorkPoolSector): string {
  switch (sector) {
    case 'diseno':
      return 'sector.ilike.%dise%,estado.ilike.%Dise%,estado.ilike.%Gráfico%,estado.ilike.%Grafico%'
    case 'instalaciones':
      return 'sector.ilike.%instal%,estado.ilike.%Instalaciones%'
    case 'metalurgica':
      return 'sector.ilike.%metal%,estado.ilike.%Metalúrgica%,estado.ilike.%Metalurgica%'
  }
}

export function isOrdenEnTableroCola(
  estado: string,
  workPoolSector: WorkPoolSector,
  sectorField?: string | null
): boolean {
  const e = (estado ?? '').toLowerCase()
  const s = (sectorField ?? '').toLowerCase()
  switch (workPoolSector) {
    case 'diseno':
      return e.includes('diseño gráfico') || e.includes('diseno grafico') || s.includes('diseño gráfico')
    case 'instalaciones':
      return e === 'instalaciones' || e.includes('instalaciones') || s.includes('instalaciones')
    case 'metalurgica':
      return (
        e.includes('metalúrgica') ||
        e.includes('metalurgica') ||
        s.includes('metalúrgica') ||
        s.includes('metalurgica')
      )
  }
}
