import * as XLSX from 'xlsx'
import type { RrhhLiquidacionLinea, RrhhNovedad } from '../types/api'
import { etiquetaCodigoRrhhNovedad, etiquetaGrupoRrhhNovedad } from './rrhhNovedadCatalog'
import { totalesLineas } from './rrhhLiquidacion'

export function exportarLiquidacionXlsx(opts: {
  periodo: string
  lineas: RrhhLiquidacionLinea[]
  novedades: RrhhNovedad[]
  nombres: Map<number, string>
  valorHora: number
  estado: string
}): void {
  const { periodo, lineas, novedades, nombres, valorHora, estado } = opts
  const tot = totalesLineas(lineas)

  const hojaLiq = lineas.map((l) => ({
    Empleado: l.nombre,
    'Días trabajados': l.dias_trabajados,
    Tardanzas: l.tardanzas,
    'Min. tarde': l.minutos_tarde,
    Ausencias: l.ausencias,
    'Faltas injust.': l.faltas_injustificadas,
    'HE 50%': l.he50,
    'HE 100%': l.he100,
    'Costo HE': l.costo_he,
    'Anticipación $': l.anticipacion_sueldo,
    'Desc. comida $': l.descuento_comida
  }))
  hojaLiq.push({
    Empleado: 'TOTAL',
    'Días trabajados': '' as unknown as number,
    Tardanzas: tot.tardanzas,
    'Min. tarde': '' as unknown as number,
    Ausencias: tot.ausencias,
    'Faltas injust.': tot.faltas_injustificadas,
    'HE 50%': tot.he50,
    'HE 100%': tot.he100,
    'Costo HE': tot.costo_he,
    'Anticipación $': tot.anticipacion_sueldo,
    'Desc. comida $': tot.descuento_comida
  })

  const hojaHe = lineas
    .filter((l) => l.he50 > 0 || l.he100 > 0)
    .map((l) => ({
      Empleado: l.nombre,
      'HE 50%': l.he50,
      'HE 100%': l.he100,
      Total: Math.round((l.he50 + l.he100) * 100) / 100,
      'Costo estimado': l.costo_he,
      'Valor hora': valorHora
    }))

  const hojaNov = novedades.map((n) => ({
    Id: n.id,
    Empleado: nombres.get(n.id_usuario) || n.id_usuario,
    Grupo: etiquetaGrupoRrhhNovedad(n.grupo),
    Categoría: etiquetaCodigoRrhhNovedad(n.codigo),
    Desde: n.fecha_desde?.slice(0, 10),
    Hasta: n.fecha_hasta?.slice(0, 10),
    Minutos: n.duracion_minutos ?? '',
    'Horas extra': n.horas_extra_cantidad ?? '',
    Observaciones: n.observaciones || ''
  }))

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(hojaLiq)
  const ws2 = XLSX.utils.json_to_sheet(hojaHe.length ? hojaHe : [{ Empleado: '(sin HE)' }])
  const ws3 = XLSX.utils.json_to_sheet(hojaNov.length ? hojaNov : [{ Id: '(sin novedades)' }])
  XLSX.utils.book_append_sheet(wb, ws1, 'Liquidación')
  XLSX.utils.book_append_sheet(wb, ws2, 'HE')
  XLSX.utils.book_append_sheet(wb, ws3, 'Novedades del mes')
  XLSX.writeFile(wb, `rrhh-liquidacion-${periodo}-${estado}.xlsx`)
}
