import type {
  ConfigCalculo,
  PlanillaEmpleado
} from '../services/relojBiometricoService'
import { CONFIG_CALCULO_DEFAULT } from '../services/relojBiometricoService'

export type RelojResumenCompacto = {
  idUsuario: string
  nombre: string
  departamento: string
  totalHoras: number
  totalExtra: number
  tardanzas: number
  anomalias: number
  puntualidadPct: number
  diasTrabajados: number
}

export type RelojReporteSnapshot = {
  version: 1
  config: ConfigCalculo
  planilla: PlanillaEmpleado[]
  diasPeriodo: string[]
  override: Record<string, number>
  horariosFijos: Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean }>
  fileName: string
  informeIa?: string
  resumenesCompactos?: RelojResumenCompacto[]
  registrarTardanzas?: boolean
  guardadoAsistencia?: { insertados: number; actualizados: number; total: number } | null
  guardadoEn?: string
}

export function crearSnapshotReloj(input: Omit<RelojReporteSnapshot, 'version' | 'guardadoEn'>): RelojReporteSnapshot {
  return {
    version: 1,
    guardadoEn: new Date().toISOString(),
    ...input
  }
}

export function parseSnapshotReloj(raw: unknown): RelojReporteSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  return {
    version: 1,
    config: { ...CONFIG_CALCULO_DEFAULT, ...(o.config as ConfigCalculo) },
    planilla: Array.isArray(o.planilla) ? (o.planilla as PlanillaEmpleado[]) : [],
    diasPeriodo: Array.isArray(o.diasPeriodo) ? (o.diasPeriodo as string[]) : [],
    override: (o.override as Record<string, number>) ?? {},
    horariosFijos: (o.horariosFijos as RelojReporteSnapshot['horariosFijos']) ?? {},
    fileName: String(o.fileName ?? ''),
    informeIa: o.informeIa ? String(o.informeIa) : undefined,
    resumenesCompactos: Array.isArray(o.resumenesCompactos)
      ? (o.resumenesCompactos as RelojResumenCompacto[])
      : undefined,
    registrarTardanzas: o.registrarTardanzas === true,
    guardadoAsistencia: (o.guardadoAsistencia as RelojReporteSnapshot['guardadoAsistencia']) ?? null,
    guardadoEn: o.guardadoEn ? String(o.guardadoEn) : undefined
  }
}

export function periodoDesdeSnapshot(snapshot: RelojReporteSnapshot): { desde: string; hasta: string } {
  if (snapshot.diasPeriodo.length) {
    const sorted = [...snapshot.diasPeriodo].sort()
    return { desde: sorted[0], hasta: sorted[sorted.length - 1] }
  }
  return { desde: '', hasta: '' }
}
