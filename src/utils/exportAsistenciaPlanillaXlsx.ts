import * as XLSX from 'xlsx'
import type { Asistencia, RrhhNovedad } from '../types/api'
import { abreviaturaCodigoNovedad, novedadEnDia } from './rrhhNovedadDates'
import { etiquetaCodigoRrhhNovedad } from './rrhhNovedadCatalog'
import { asistenciaHoraCorta } from './dateUtils'

function textoCeldaExport(
  asistencia: Asistencia | undefined,
  novedades: RrhhNovedad[]
): string {
  if (asistencia) {
    if (asistencia.tipo_registro === 'ausente') {
      const nov = novedades[0]
      return nov
        ? `Ausente · ${etiquetaCodigoRrhhNovedad(nov.codigo)}`
        : `Ausente${asistencia.observaciones ? ` · ${asistencia.observaciones}` : ''}`
    }
    if (asistencia.tipo_registro === 'justificado') {
      const nov = novedades[0]
      return nov
        ? `Justificado · ${etiquetaCodigoRrhhNovedad(nov.codigo)}`
        : 'Justificado'
    }
    const e = asistenciaHoraCorta(asistencia.hora_entrada)
    const s = asistenciaHoraCorta(asistencia.hora_salida)
    const tipo = asistencia.tipo_registro === 'tarde' ? ' (tarde)' : ''
    const hs =
      asistencia.horas_trabajadas != null && asistencia.horas_trabajadas > 0
        ? ` · ${asistencia.horas_trabajadas.toFixed(1)}hs`
        : ''
    return `${e || '—'} / ${s || '—'}${tipo}${hs}`
  }
  if (novedades.length) {
    return novedades.map((n) => etiquetaCodigoRrhhNovedad(n.codigo)).join('; ')
  }
  return ''
}

export function exportarAsistenciaPlanillaXlsx(opts: {
  empleados: Array<{ id: number; nombre: string; dias: Record<string, Asistencia>; horas: number }>
  dias: string[]
  novedades: RrhhNovedad[]
  fechaDesde: string
  fechaHasta: string
}): void {
  const { empleados, dias, novedades, fechaDesde, fechaHasta } = opts
  const filas = empleados.map((emp) => {
    const row: Record<string, string | number> = { Empleado: emp.nombre, 'Total hs': emp.horas || 0 }
    for (const f of dias) {
      const a = emp.dias[f]
      const novs = novedades.filter((n) => n.id_usuario === emp.id && novedadEnDia(n, f))
      row[f] = textoCeldaExport(a, novs)
    }
    return row
  })

  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
  XLSX.writeFile(wb, `asistencia-${fechaDesde}_${fechaHasta}.xlsx`)
}

export { abreviaturaCodigoNovedad as abrevCeldaNovedad }
