import * as XLSX from 'xlsx'
import type { RrhhLiquidacionLinea, RrhhNovedad } from '../types/api'
import { etiquetaCodigoRrhhNovedad, etiquetaGrupoRrhhNovedad } from './rrhhNovedadCatalog'
import { diasEntre } from './asistenciaStats'
import {
  codigoEfectivoCierre,
  conteosNovedadCierre,
  etiquetaPeriodoEs,
  novedadRecategorizadaCierre,
  numDetalleLinea,
  periodoRango,
  totalesLineas
} from './rrhhLiquidacion'
import { novedadEmpleadoIncorrecto } from './rrhhNovedadEmpleadoObs'

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
  const diasMes = diasEntre(periodoRango(periodo).desde, periodoRango(periodo).hasta)
  const totNov = conteosNovedadCierre(novedades, diasMes, undefined, nombres)
  const usarNov = novedades.length > 0

  const hojaLiq = lineas.map((l) => {
    const novs = novedades.filter((n) => n.id_usuario === l.id_usuario)
    const c = conteosNovedadCierre(novs, diasMes, l.nombre, nombres)
    const vac = novs.length ? c.vacaciones : numDetalleLinea(l, 'dias_vacaciones')
    const lic = novs.length ? c.licencias : numDetalleLinea(l, 'dias_licencia')
    const fj = novs.length ? c.faltas_justificadas : numDetalleLinea(l, 'faltas_justificadas')
    const fi = novs.length ? c.faltas_injustificadas : l.faltas_injustificadas
    return {
      Empleado: l.nombre,
      'Días trabajados': l.dias_trabajados,
      Vacaciones: vac,
      Licencias: lic,
      Tardanzas: l.tardanzas,
      'Min. tarde': l.minutos_tarde,
      'F. justificadas': fj,
      'Faltas injust.': fi,
      'HE 50%': l.he50,
      'HE 100%': l.he100,
      'Costo HE': l.costo_he,
      'Anticipación $': l.anticipacion_sueldo,
      'Desc. comida $': l.descuento_comida
    }
  })
  hojaLiq.push({
    Empleado: 'TOTAL',
    'Días trabajados': '' as unknown as number,
    Vacaciones: usarNov ? totNov.vacaciones : tot.vacaciones,
    Licencias: usarNov ? totNov.licencias : tot.licencias,
    Tardanzas: tot.tardanzas,
    'Min. tarde': '' as unknown as number,
    'F. justificadas': usarNov ? totNov.faltas_justificadas : tot.faltas_justificadas,
    'Faltas injust.': usarNov ? totNov.faltas_injustificadas : tot.faltas_injustificadas,
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

  const hojaNov = novedades.map((n) => {
    const recat = novedadRecategorizadaCierre(n)
    const codigoEf = codigoEfectivoCierre(n)
    const cruzados = novedadEmpleadoIncorrecto(n, nombres)
    const avisoCruzado = cruzados.length
      ? `Empleado incorrecto: el texto habla de ${cruzados[0]!.nombre}`
      : ''
    const avisoCat = recat ? 'Texto indica vacaciones; corregir categoría en RRHH' : ''
    return {
      Id: n.id,
      Empleado: nombres.get(n.id_usuario) || n.id_usuario,
      Grupo: recat ? etiquetaGrupoRrhhNovedad('licencia') : etiquetaGrupoRrhhNovedad(n.grupo),
      Categoría: etiquetaCodigoRrhhNovedad(codigoEf),
      'Cargada como': recat ? etiquetaCodigoRrhhNovedad(n.codigo) : '',
      Aviso: [avisoCruzado, avisoCat].filter(Boolean).join(' · '),
      Desde: n.fecha_desde?.slice(0, 10),
      Hasta: n.fecha_hasta?.slice(0, 10),
      Minutos: n.duracion_minutos ?? '',
      'Horas extra': n.horas_extra_cantidad ?? '',
      Observaciones: n.observaciones || ''
    }
  })

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(hojaLiq)
  const ws2 = XLSX.utils.json_to_sheet(hojaHe.length ? hojaHe : [{ Empleado: '(sin HE)' }])
  const ws3 = XLSX.utils.json_to_sheet(hojaNov.length ? hojaNov : [{ Id: '(sin novedades)' }])
  XLSX.utils.book_append_sheet(wb, ws1, 'Liquidación')
  XLSX.utils.book_append_sheet(wb, ws2, 'HE')
  XLSX.utils.book_append_sheet(wb, ws3, 'Novedades del mes')
  XLSX.writeFile(wb, `rrhh-liquidacion-${etiquetaPeriodoEs(periodo).replace(/\s+/g, '-')}-${estado}.xlsx`)
}
