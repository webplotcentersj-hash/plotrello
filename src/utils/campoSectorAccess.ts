import type { Task } from '../types/board'

export type CampoListSectorMode = 'instalaciones' | 'metalurgica' | 'both' | 'none'

export type CampoSectorFlags = {
  instalaciones: boolean
  metalurgica: boolean
}

export function taskTouchesInstalaciones(t: Task): boolean {
  return (
    t.status === 'instalaciones' ||
    t.assignedSector === 'Instalaciones' ||
    Boolean(t.sectores?.includes('Instalaciones'))
  )
}

export function taskTouchesMetalurgica(t: Task): boolean {
  return (
    t.status === 'metalurgica' ||
    t.assignedSector === 'Metalúrgica' ||
    Boolean(t.sectores?.includes('Metalúrgica'))
  )
}

export function campoFlagsFromRol(rol: string | undefined | null): CampoSectorFlags {
  if (rol === 'instalaciones') return { instalaciones: true, metalurgica: false }
  if (rol === 'metalurgica') return { instalaciones: false, metalurgica: true }
  if (rol === 'administracion' || rol === 'gerencia') return { instalaciones: true, metalurgica: true }
  return { instalaciones: false, metalurgica: false }
}

export function mergeCampoSectorFlags(a: CampoSectorFlags, b: CampoSectorFlags): CampoSectorFlags {
  return {
    instalaciones: a.instalaciones || b.instalaciones,
    metalurgica: a.metalurgica || b.metalurgica
  }
}

export function resolveCampoListSectorMode(flags: CampoSectorFlags): CampoListSectorMode {
  if (flags.instalaciones && flags.metalurgica) return 'both'
  if (flags.metalurgica) return 'metalurgica'
  if (flags.instalaciones) return 'instalaciones'
  return 'none'
}

export function taskAllowedInCampoMode(task: Task, mode: CampoListSectorMode): boolean {
  if (mode === 'both') return taskTouchesInstalaciones(task) || taskTouchesMetalurgica(task)
  if (mode === 'instalaciones') return taskTouchesInstalaciones(task)
  if (mode === 'metalurgica') return taskTouchesMetalurgica(task)
  return false
}

export function clampCampoFinalTarget(
  target: 'instalaciones' | 'metalurgica' | null,
  mode: CampoListSectorMode
): 'instalaciones' | 'metalurgica' | null {
  if (!target || mode === 'none') return null
  if (mode === 'both') return target
  if (mode === 'instalaciones' && target === 'instalaciones') return target
  if (mode === 'metalurgica' && target === 'metalurgica') return target
  return null
}
