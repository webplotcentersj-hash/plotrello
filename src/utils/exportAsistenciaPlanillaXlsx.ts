import * as XLSX from 'xlsx'
import type { Asistencia, RrhhNovedad } from '../types/api'
import { abreviaturaCodigoNovedad, novedadEnDia } from './rrhhNovedadDates'
import { etiquetaCodigoRrhhNovedad } from './rrhhNovedadCatalog'
import { asistenciaHoraCorta } from './dateUtils'
import { totalesStats, type ExtraDiaDetalle, type StatsEmpleadoAsistencia } from './asistenciaStats'

function textoCeldaExport(
  asistencia: Asistencia | undefined,
  novedades: RrhhNovedad[],
  extraDia?: ExtraDiaDetalle,
  acumulado?: number
): string {
  let base = ''
  if (asistencia) {
    if (asistencia.tipo_registro === 'ausente') {
      const nov = novedades[0]
      base = nov
        ? `Ausente · ${etiquetaCodigoRrhhNovedad(nov.codigo)}`
        : `Ausente${asistencia.observaciones ? ` · ${asistencia.observaciones}` : ''}`
    } else if (asistencia.tipo_registro === 'justificado') {
      const nov = novedades[0]
      base = nov
        ? `Justificado · ${etiquetaCodigoRrhhNovedad(nov.codigo)}`
        : 'Justificado'
    } else {
      const e = asistenciaHoraCorta(asistencia.hora_entrada)
      const s = asistenciaHoraCorta(asistencia.hora_salida)
      const tipo = asistencia.tipo_registro === 'tarde' ? ' (tarde)' : ''
      const hs =
        asistencia.horas_trabajadas != null && asistencia.horas_trabajadas > 0
          ? ` · ${asistencia.horas_trabajadas.toFixed(1)}hs`
          : ''
      base = `${e || '—'} / ${s || '—'}${tipo}${hs}`
    }
  } else if (novedades.length) {
    base = novedades.map((n) => etiquetaCodigoRrhhNovedad(n.codigo)).join('; ')
  }

  const extraParts: string[] = []
  if (extraDia && extraDia.total > 0) extraParts.push(`+${extraDia.total.toFixed(1)} ext`)
  if (acumulado != null && acumulado > 0) extraParts.push(`Σ${acumulado.toFixed(1)}`)
  if (extraParts.length) {
    base = base ? `${base} · ${extraParts.join(' ')}` : extraParts.join(' ')
  }
  return base
}

export function exportarAsistenciaPlanillaXlsx(opts: {
  empleados: Array<{ id: number; nombre: string; dias: Record<string, Asistencia>; horas: number }>
  dias: string[]
  novedades: RrhhNovedad[]
  fechaDesde: string
  fechaHasta: string
  stats?: StatsEmpleadoAsistencia[]
  extraPorDia?: Map<number, Map<string, ExtraDiaDetalle>>
  extraAcumulado?: Map<number, Map<string, number>>
  valorHora?: number
}): void {
  const { empleados, dias, novedades, fechaDesde, fechaHasta, stats, extraPorDia, extraAcumulado, valorHora = 0 } = opts

  const statsMap = stats ? new Map(stats.map((s) => [s.id, s])) : null

  const filas = empleados.map((emp) => {
    const st = statsMap?.get(emp.id)
    const row: Record<string, string | number> = {
      Empleado: emp.nombre,
      'Total hs': emp.horas || 0,
      'Ext Σ': st?.totalHorasExtra ?? 0,
      'HE 50%': st?.extra50 ?? 0,
      'HE 100%': st?.extra100 ?? 0
    }
    if (valorHora > 0) {
      row['Costo extra'] = st?.costoExtra ?? 0
    }
    for (const f of dias) {
      const a = emp.dias[f]
      const novs = novedades.filter((n) => n.id_usuario === emp.id && novedadEnDia(n, f))
      const extraDia = extraPorDia?.get(emp.id)?.get(f)
      const acum = extraAcumulado?.get(emp.id)?.get(f)
      row[f] = textoCeldaExport(a, novs, extraDia, acum)
    }
    return row
  })

  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')

  if (stats?.length) {
    const conExtra = stats.filter((s) => s.totalHorasExtra > 0).sort((a, b) => b.totalHorasExtra - a.totalHorasExtra)
    if (conExtra.length) {
      const tot = totalesStats(stats)
      const liqRows = conExtra.map((s) => ({
        Empleado: s.nombre,
        'HE 50% (hs)': s.extra50,
        'HE 100% (hs)': s.extra100,
        'Total hs extra': s.totalHorasExtra,
        'Costo estimado': valorHora > 0 ? s.costoExtra : ''
      }))
      liqRows.push({
        Empleado: 'TOTAL',
        'HE 50% (hs)': tot.totalExtra50,
        'HE 100% (hs)': tot.totalExtra100,
        'Total hs extra': tot.totalHorasExtra,
        'Costo estimado': valorHora > 0 ? tot.costoExtraTotal : ''
      })
      const wsLiq = XLSX.utils.json_to_sheet(liqRows)
      XLSX.utils.book_append_sheet(wb, wsLiq, 'Liquidación HE')
    }
  }

  XLSX.writeFile(wb, `asistencia-${fechaDesde}_${fechaHasta}.xlsx`)
}

export { abreviaturaCodigoNovedad as abrevCeldaNovedad }
