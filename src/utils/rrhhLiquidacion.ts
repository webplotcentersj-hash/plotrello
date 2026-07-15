import type { Asistencia, MenuDescuentoBeneficioComida, RrhhLiquidacionLinea, RrhhNovedad } from '../types/api'
import {
  calcularStatsAsistencia,
  diasEntre,
  ultimoDiaMes,
  type HorarioFijoAsistencia,
  type StatsEmpleadoAsistencia
} from './asistenciaStats'
import { novedadEnDia } from './rrhhNovedadDates'

export function periodoRango(periodo: string): { desde: string; hasta: string } {
  return { desde: `${periodo}-01`, hasta: ultimoDiaMes(periodo) }
}

/** Extrae monto en ARS desde observaciones (ej. "$150000" o "150000"). */
export function parseMontoObservacion(obs: string | null | undefined): number {
  if (!obs) return 0
  const m = obs.replace(/\./g, '').match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/)
  if (!m) return 0
  const n = Number(String(m[1]).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function armarLineasLiquidacion(params: {
  periodo: string
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  nombres: Map<number, string>
  horariosPorMes: Record<string, Record<number, HorarioFijoAsistencia>>
  valorHora: number
  descuentosComida?: MenuDescuentoBeneficioComida[]
}): { lineas: RrhhLiquidacionLinea[]; stats: StatsEmpleadoAsistencia[]; avisosSolapeHe: string[] } {
  const { periodo, asistencia, novedades, nombres, horariosPorMes, valorHora, descuentosComida = [] } =
    params
  const { desde, hasta } = periodoRango(periodo)
  const dias = diasEntre(desde, hasta)

  const stats = calcularStatsAsistencia({
    asistencia,
    novedades,
    dias,
    nombres,
    horariosPorMes,
    valorHoraBase: valorHora
  })

  const avisosSolapeHe: string[] = []
  const statsById = new Map(stats.map((s) => [s.id, s]))

  const ids = new Set<number>()
  asistencia.forEach((a) => ids.add(a.id_usuario))
  novedades.forEach((n) => ids.add(n.id_usuario))
  descuentosComida.forEach((d) => ids.add(d.id_usuario))

  const lineas: RrhhLiquidacionLinea[] = []

  for (const id of ids) {
    const st = statsById.get(id)
    const novsEmp = novedades.filter((n) => n.id_usuario === id)

    let faltasInjustificadas = 0
    let anticipacion = 0
    for (const n of novsEmp) {
      if (n.codigo === 'falta_injustificada') {
        // contar días hábiles del rango de la novedad dentro del mes
        for (const f of dias) {
          if (novedadEnDia(n, f)) faltasInjustificadas += 1
        }
      }
      if (n.codigo === 'anticipacion_sueldo') {
        anticipacion += parseMontoObservacion(n.observaciones)
      }
    }

    let descuentoComida = 0
    for (const d of descuentosComida) {
      if (d.id_usuario !== id) continue
      descuentoComida += Number(d.monto) || 0
    }

    // Solape HE: día con marca + novedad horas_extra
    for (const f of dias) {
      const a = asistencia.find((x) => x.id_usuario === id && x.fecha.slice(0, 10) === f)
      const heNov = novsEmp.some((n) => n.grupo === 'horas_extra' && novedadEnDia(n, f))
      if (a?.hora_entrada && a?.hora_salida && heNov) {
        avisosSolapeHe.push(
          `${nombres.get(id) || `Usuario ${id}`}: ${f} tiene marca y novedad de horas extra`
        )
      }
    }

    lineas.push({
      id_usuario: id,
      nombre: nombres.get(id) || st?.nombre || `Usuario ${id}`,
      dias_trabajados: st?.diasConEntrada ?? 0,
      tardanzas: st?.tardanzas ?? 0,
      minutos_tarde: st?.minutosTardeTotal ?? 0,
      ausencias: st?.ausencias ?? 0,
      he50: st?.extra50 ?? 0,
      he100: st?.extra100 ?? 0,
      costo_he: st?.costoExtra ?? 0,
      faltas_injustificadas: faltasInjustificadas,
      anticipacion_sueldo: anticipacion,
      descuento_comida: descuentoComida,
      detalle_json: {
        justificados: st?.justificados ?? 0,
        sin_marca: st?.sinMarca ?? 0,
        total_horas: st?.totalHoras ?? 0,
        puntualidad_pct: st?.puntualidadPct ?? 0
      }
    })
  }

  lineas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { lineas, stats, avisosSolapeHe }
}

export function totalesLineas(lineas: RrhhLiquidacionLinea[]) {
  return lineas.reduce(
    (acc, l) => {
      acc.he50 += l.he50
      acc.he100 += l.he100
      acc.costo_he += l.costo_he
      acc.tardanzas += l.tardanzas
      acc.ausencias += l.ausencias
      acc.faltas_injustificadas += l.faltas_injustificadas
      acc.anticipacion_sueldo += l.anticipacion_sueldo
      acc.descuento_comida += l.descuento_comida
      return acc
    },
    {
      he50: 0,
      he100: 0,
      costo_he: 0,
      tardanzas: 0,
      ausencias: 0,
      faltas_injustificadas: 0,
      anticipacion_sueldo: 0,
      descuento_comida: 0
    }
  )
}
