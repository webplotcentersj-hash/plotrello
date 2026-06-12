import type { WorkPoolProduct, WorkPoolSector } from '../../types/workPool'

export type { WorkPoolProduct }

export const WORK_POOL_PRODUCT_CONFIG: Record<
  WorkPoolProduct,
  {
    label: string
    shortLabel: string
    tagline: string
    adminTagline: string
    icon: string
    route: string
    sectors: WorkPoolSector[]
    themeClass: string
    accent: string
  }
> = {
  'plot-design': {
    label: 'Plot Design',
    shortLabel: 'Design',
    tagline: 'Bolsa y asignaciones de diseño para freelancers y equipo interno.',
    adminTagline: 'Gestioná diseñadores externos, bolsa creativa y cuenta corriente de diseño.',
    icon: '🎨',
    route: '/plot-design',
    sectors: ['diseno'],
    themeClass: 'work-pool--plot-design',
    accent: '#a855f7'
  },
  'bolsa-plot': {
    label: 'Bolsa Plot',
    shortLabel: 'Bolsa',
    tagline: 'Trabajos de instalaciones y metalúrgica — bolsa o asignación directa.',
    adminTagline: 'Instaladores y metalúrgicos: bolsa de campo, entregas y pagos Plot.',
    icon: '🧰',
    route: '/bolsa-plot',
    sectors: ['instalaciones', 'metalurgica'],
    themeClass: 'work-pool--bolsa-plot',
    accent: '#f97316'
  }
}

export function sectorsForProduct(product: WorkPoolProduct): WorkPoolSector[] {
  return WORK_POOL_PRODUCT_CONFIG[product].sectors
}

export function productForSector(sector: WorkPoolSector): WorkPoolProduct {
  return sector === 'diseno' ? 'plot-design' : 'bolsa-plot'
}

export function defaultSectorForProduct(
  product: WorkPoolProduct,
  rol?: string
): WorkPoolSector {
  const sectors = sectorsForProduct(product)
  if (product === 'bolsa-plot') {
    if (rol === 'metalurgica') return 'metalurgica'
    return 'instalaciones'
  }
  return sectors[0]
}

/** Rol de staff que puede operar cada producto (sin contar admin/presupuestos). */
export function operarioRolForProduct(product: WorkPoolProduct): string[] {
  if (product === 'plot-design') return ['diseno', 'operario-diseno']
  return ['instalaciones', 'metalurgica', 'operario-bolsa']
}

export function operarioExternoRolForProduct(product: WorkPoolProduct): string {
  return product === 'plot-design' ? 'operario-diseno' : 'operario-bolsa'
}

export function canOperarioAccessProduct(product: WorkPoolProduct, rol?: string): boolean {
  if (!rol) return false
  return operarioRolForProduct(product).includes(rol)
}

export function staffRolForWorkPoolSector(sector: WorkPoolSector): string {
  if (sector === 'diseno') return 'diseno'
  if (sector === 'instalaciones') return 'instalaciones'
  return 'metalurgica'
}

export function inferSectorFromOpSectorName(name?: string | null): WorkPoolSector | null {
  const n = (name ?? '').toLowerCase()
  if (n.includes('metal')) return 'metalurgica'
  if (n.includes('instal')) return 'instalaciones'
  if (n.includes('dise') || n.includes('graf')) return 'diseno'
  return null
}

export function inferProductFromOpSectorName(name?: string | null): WorkPoolProduct | null {
  const sector = inferSectorFromOpSectorName(name)
  if (!sector) return null
  return productForSector(sector)
}

/** Roles de empleados internos asignables en publicar (sin operarios externos). */
export function rolForWorkPoolSector(sector: WorkPoolSector): string {
  return staffRolForWorkPoolSector(sector)
}

/** Roles asignables al publicar: internos + operarios externos aprobados. */
export function rolesAsignablesWorkPoolSector(sector: WorkPoolSector): string[] {
  if (sector === 'diseno') return ['diseno', 'operario-diseno']
  return ['instalaciones', 'metalurgica', 'operario-bolsa']
}
