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

export function fechaYmd(s: string): string {
  return String(s || '').slice(0, 10)
}

export function periodoDesdeSnapshot(snapshot: RelojReporteSnapshot): { desde: string; hasta: string } {
  if (snapshot.diasPeriodo.length) {
    const sorted = [...snapshot.diasPeriodo].sort()
    return { desde: sorted[0], hasta: sorted[sorted.length - 1] }
  }
  return { desde: '', hasta: '' }
}

export type RelojDiaCalendarioResumen = {
  presentes: number
  ausentes: number
  tardanzas: number
  sinMarca: number
  totalEmpleados: number
  esInicioPeriodo: boolean
  esFinPeriodo: boolean
  tieneInformeIa: boolean
}

function parseHoraMin(h: string): number | null {
  const m = String(h || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function diasEnSnapshot(snapshot: RelojReporteSnapshot): string[] {
  if (snapshot.diasPeriodo.length) return [...snapshot.diasPeriodo].sort()
  const set = new Set<string>()
  for (const emp of snapshot.planilla) {
    for (const f of Object.keys(emp.dias ?? {})) set.add(f)
  }
  return [...set].sort()
}

function baselineEntradaEmpleado(
  snapshot: RelojReporteSnapshot,
  idUsuarioReloj: string
): number | null {
  const plotId = snapshot.override[idUsuarioReloj]
  const fijo = plotId != null ? snapshot.horariosFijos[plotId] : undefined
  if (fijo?.entrada) return parseHoraMin(fijo.entrada)
  if (snapshot.config.horaEntradaEsperada) return parseHoraMin(snapshot.config.horaEntradaEsperada)
  return null
}

/** Totales del día a partir del snapshot guardado (planilla + horarios fijos). */
export function resumenDiaCalendario(
  snapshot: RelojReporteSnapshot,
  dayStr: string,
  periodo?: { desde: string; hasta: string }
): RelojDiaCalendarioResumen | null {
  const dias = diasEnSnapshot(snapshot)
  const pDesde = fechaYmd(periodo?.desde ?? dias[0] ?? '')
  const pHasta = fechaYmd(periodo?.hasta ?? dias[dias.length - 1] ?? '')
  const enLista = dias.includes(dayStr)
  const enPeriodo = Boolean(pDesde && pHasta && dayStr >= pDesde && dayStr <= pHasta)
  if (!enLista && !enPeriodo) return null
  if (!snapshot.planilla.length) return null

  const tolerancia = snapshot.config.toleranciaTardanzaMin ?? 15
  let presentes = 0
  let ausentes = 0
  let tardanzas = 0
  let sinMarca = 0

  for (const emp of snapshot.planilla) {
    const celda = emp.dias[dayStr]
    if (!celda) {
      sinMarca++
      continue
    }
    if (celda.ausente) {
      ausentes++
      continue
    }
    if (celda.entrada || celda.salida) {
      presentes++
      const entradaMin = celda.entrada ? parseHoraMin(celda.entrada) : null
      const baseline = baselineEntradaEmpleado(snapshot, emp.idUsuario)
      if (entradaMin != null && baseline != null && entradaMin > baseline + tolerancia) {
        tardanzas++
      } else if (/tarde/i.test(celda.obs)) {
        tardanzas++
      }
      continue
    }
    sinMarca++
  }

  return {
    presentes,
    ausentes,
    tardanzas,
    sinMarca,
    totalEmpleados: snapshot.planilla.length,
    esInicioPeriodo: dayStr === pDesde,
    esFinPeriodo: dayStr === pHasta,
    tieneInformeIa: Boolean(snapshot.informeIa?.trim())
  }
}

export function tooltipDiaCalendario(
  dayStr: string,
  reporte: { periodo_desde: string; periodo_hasta: string; archivo_nombre: string | null; created_at?: string },
  resumen: RelojDiaCalendarioResumen
): string {
  const partes = [
    `${dayStr} · Informe ${reporte.periodo_desde} → ${reporte.periodo_hasta}`,
    `Presentes: ${resumen.presentes}`,
    resumen.ausentes ? `Ausentes: ${resumen.ausentes}` : null,
    resumen.tardanzas ? `Tardanzas: ${resumen.tardanzas}` : null,
    resumen.sinMarca ? `Sin marca: ${resumen.sinMarca}` : null,
    reporte.archivo_nombre ? `Archivo: ${reporte.archivo_nombre}` : null,
    resumen.tieneInformeIa ? 'Incluye informe PlotAI' : null
  ].filter(Boolean)
  return partes.join('\n')
}
