import type { WorkPoolJob } from '../../types/workPool'

export const OPERARIO_EXTERNO_ROLES = ['operario-diseno', 'operario-bolsa'] as const
export type OperarioExternoRol = (typeof OPERARIO_EXTERNO_ROLES)[number]

export function isOperarioExternoRol(rol?: string | null): rol is OperarioExternoRol {
  return !!rol && (OPERARIO_EXTERNO_ROLES as readonly string[]).includes(rol)
}

export function operarioExternoHomeRoute(rol?: string | null): string | null {
  if (rol === 'operario-diseno') return '/plot-design'
  if (rol === 'operario-bolsa') return '/bolsa-plot'
  return null
}

/** Operario externo: solo trabajos asignados desde Plot Design / Bolsa Plot admin. */
export function operarioExternoSoloAsignados(): boolean {
  return true
}

export function maskJobForOperarioExterno(job: WorkPoolJob): WorkPoolJob {
  const meta = { ...(job.metadata ?? {}) }
  if (job.numero_pedido) meta.numero_pedido = job.numero_pedido
  return {
    ...job,
    numero_op: null,
    id_orden: null,
    metadata: meta
  }
}

export function jobPedidoLabel(job: WorkPoolJob): string | null {
  return job.numero_pedido || (job.metadata?.numero_pedido as string) || null
}

export function solicitudTipoLabel(tipo: 'diseno' | 'bolsa'): string {
  return tipo === 'diseno' ? 'Plot Design' : 'Bolsa Plot'
}
