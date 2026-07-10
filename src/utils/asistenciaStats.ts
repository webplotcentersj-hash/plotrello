import type { Asistencia, RrhhNovedad } from '../types/api'
import { CONFIG_CALCULO_DEFAULT, type ConfigCalculo } from '../services/relojBiometricoService'
import { asistenciaHoraCorta } from './dateUtils'
import { esDiaHabil, novedadEnDia } from './rrhhNovedadDates'

export type HorarioFijoAsistencia = {
  entrada: string
  salida: string
  horas: number | null
  trabajaSabado: boolean
}

export type StatsEmpleadoAsistencia = {
  id: number
  nombre: string
  diasConEntrada: number
  tardanzas: number
  ausencias: number
  justificados: number
  sinMarca: number
  totalHoras: number
  totalHorasExtra: number
  minutosTardeTotal: number
  puntualidadPct: number
}

const TOLERANCIA_TARDANZA_MIN = 15

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function diasEntre(desde: string, hasta: string): string[] {
  const [y, m, d] = desde.split('-').map(Number)
  const [Y, M, D] = hasta.split('-').map(Number)
  const cur = new Date(y, m - 1, d)
  const fin = new Date(Y, M - 1, D)
  const out: string[] = []
  while (cur <= fin) {
    out.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function minutosDesdeHora(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function minutosDesdeIso(ts: string): number | null {
  const h = asistenciaHoraCorta(ts)
  return h ? minutosDesdeHora(h) : null
}

function horarioParaMes(
  idUsuario: number,
  fecha: string,
  horariosPorMes: Record<string, Record<number, HorarioFijoAsistencia>>,
  horarioFallback?: Record<number, HorarioFijoAsistencia>
): HorarioFijoAsistencia | null {
  const mes = fecha.slice(0, 7)
  return horariosPorMes[mes]?.[idUsuario] ?? horarioFallback?.[idUsuario] ?? null
}

function horarioEntradaParaMes(
  idUsuario: number,
  fecha: string,
  horariosPorMes: Record<string, Record<number, HorarioFijoAsistencia>>,
  horarioFallback?: Record<number, HorarioFijoAsistencia>
): string | null {
  return horarioParaMes(idUsuario, fecha, horariosPorMes, horarioFallback)?.entrada || null
}

function jornadaNormal(fecha: string, horario: HorarioFijoAsistencia | null, config: ConfigCalculo): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  if (dow === 0) return config.domingoTodoExtra ? 0 : config.jornadaLunVie
  if (dow === 6) {
    if (horario) {
      if (!horario.trabajaSabado) return 0
      if (horario.horas != null) return horario.horas
    }
    return config.jornadaSab
  }
  if (horario?.horas != null) return horario.horas
  if (horario?.entrada && horario?.salida) {
    const pe = horario.entrada.match(/^(\d{1,2}):(\d{2})$/)
    const ps = horario.salida.match(/^(\d{1,2}):(\d{2})$/)
    if (pe && ps) {
      let diff = Number(ps[1]) * 60 + Number(ps[2]) - (Number(pe[1]) * 60 + Number(pe[2]))
      if (diff <= 0) diff += 24 * 60
      return Math.round((diff / 60) * 100) / 100
    }
  }
  return config.jornadaLunVie
}

function redondearExtra(valor: number, paso: number): number {
  if (paso <= 0) return Math.round(valor * 100) / 100
  return Math.round(valor / paso) * paso
}

/** Horas extra de un registro vs jornada esperada (misma lógica que importador reloj). */
export function calcularHorasExtraDia(
  a: Asistencia,
  fecha: string,
  horario: HorarioFijoAsistencia | null,
  novs: RrhhNovedad[],
  config: ConfigCalculo = CONFIG_CALCULO_DEFAULT
): number {
  const novExtra = novs
    .filter((n) => n.grupo === 'horas_extra' && n.horas_extra_cantidad != null)
    .reduce((sum, n) => sum + (n.horas_extra_cantidad || 0), 0)

  if (a.tipo_registro === 'ausente' || a.tipo_registro === 'justificado') {
    return novExtra
  }
  if (!a.hora_entrada || !a.hora_salida) {
    return novExtra
  }

  const horasTrabajadas = a.horas_trabajadas ?? 0
  if (horasTrabajadas <= 0) return novExtra

  const normal = jornadaNormal(fecha, horario, config)
  const bruto = horasTrabajadas - normal
  const extraMarcacion = bruto <= 0 ? 0 : redondearExtra(bruto, config.redondeoExtra)
  return Math.round((extraMarcacion + novExtra) * 100) / 100
}

function esTarde(
  a: Asistencia,
  novs: RrhhNovedad[],
  horaEsperada: string | null
): { tarde: boolean; minutos: number } {
  if (a.tipo_registro === 'tarde') {
    return { tarde: true, minutos: 0 }
  }
  if (novs.some((n) => n.codigo === 'tardanza' || n.grupo === 'tardanza_retiro')) {
    return { tarde: true, minutos: 0 }
  }
  if (!a.hora_entrada || !horaEsperada) {
    return { tarde: false, minutos: 0 }
  }
  const real = minutosDesdeIso(a.hora_entrada)
  const esperada = minutosDesdeHora(horaEsperada)
  if (real == null || esperada == null) return { tarde: false, minutos: 0 }
  const limite = esperada + TOLERANCIA_TARDANZA_MIN
  if (real > limite) {
    return { tarde: true, minutos: real - esperada }
  }
  return { tarde: false, minutos: 0 }
}

export function calcularStatsAsistencia(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  nombres: Map<number, string>
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
  config?: ConfigCalculo
}): StatsEmpleadoAsistencia[] {
  const { asistencia, novedades, dias, nombres, horariosPorMes = {}, horarioFallback, config = CONFIG_CALCULO_DEFAULT } = params

  const ids = new Set<number>()
  asistencia.forEach((a) => ids.add(a.id_usuario))
  novedades.forEach((n) => ids.add(n.id_usuario))

  const porUsuarioDia = new Map<string, Asistencia>()
  for (const a of asistencia) {
    porUsuarioDia.set(`${a.id_usuario}|${a.fecha.slice(0, 10)}`, a)
  }

  const novedadesPorUsuarioDia = new Map<string, RrhhNovedad[]>()
  for (const n of novedades) {
    for (const f of dias) {
      if (!novedadEnDia(n, f)) continue
      const k = `${n.id_usuario}|${f}`
      const prev = novedadesPorUsuarioDia.get(k) ?? []
      prev.push(n)
      novedadesPorUsuarioDia.set(k, prev)
    }
  }

  const stats: StatsEmpleadoAsistencia[] = []

  for (const id of ids) {
    let diasConEntrada = 0
    let tardanzas = 0
    let ausencias = 0
    let justificados = 0
    let sinMarca = 0
    let totalHoras = 0
    let totalHorasExtra = 0
    let minutosTardeTotal = 0

    for (const f of dias) {
      const a = porUsuarioDia.get(`${id}|${f}`)
      const novs = novedadesPorUsuarioDia.get(`${id}|${f}`) ?? []
      const habil = esDiaHabil(f)
      const horario = horarioParaMes(id, f, horariosPorMes, horarioFallback)

      if (a) {
        totalHoras += a.horas_trabajadas || 0
        totalHorasExtra += calcularHorasExtraDia(a, f, horario, novs, config)
        if (a.tipo_registro === 'ausente') {
          ausencias++
          continue
        }
        if (a.tipo_registro === 'justificado') {
          justificados++
          continue
        }
        if (a.hora_entrada || a.tipo_registro === 'normal' || a.tipo_registro === 'tarde') {
          diasConEntrada++
          const horaEsp = horarioEntradaParaMes(id, f, horariosPorMes, horarioFallback)
          const t = esTarde(a, novs, horaEsp)
          if (t.tarde) {
            tardanzas++
            minutosTardeTotal += t.minutos
          }
          continue
        }
      }

      if (novs.some((n) => n.grupo === 'falta')) {
        ausencias++
        continue
      }
      if (novs.some((n) => n.grupo === 'licencia')) {
        justificados++
        continue
      }
      if (novs.some((n) => n.grupo === 'horas_extra')) {
        totalHorasExtra += novs
          .filter((n) => n.grupo === 'horas_extra' && n.horas_extra_cantidad != null)
          .reduce((sum, n) => sum + (n.horas_extra_cantidad || 0), 0)
        continue
      }
      if (habil && !a) {
        sinMarca++
      }
    }

    const puntualidadPct = diasConEntrada
      ? Math.round(((diasConEntrada - tardanzas) / diasConEntrada) * 100)
      : 0

    stats.push({
      id,
      nombre: nombres.get(id) || `Usuario ${id}`,
      diasConEntrada,
      tardanzas,
      ausencias,
      justificados,
      sinMarca,
      totalHoras,
      totalHorasExtra: Math.round(totalHorasExtra * 100) / 100,
      minutosTardeTotal,
      puntualidadPct
    })
  }

  return stats.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function rankingPuntualidad(stats: StatsEmpleadoAsistencia[]): StatsEmpleadoAsistencia[] {
  return [...stats]
    .filter((s) => s.diasConEntrada > 0)
    .sort((a, b) => b.puntualidadPct - a.puntualidadPct || a.minutosTardeTotal - b.minutosTardeTotal)
}

export function totalesStats(stats: StatsEmpleadoAsistencia[]) {
  const conEntrada = stats.filter((s) => s.diasConEntrada > 0)
  const promedioPuntualidad = conEntrada.length
    ? Math.round(conEntrada.reduce((a, s) => a + s.puntualidadPct, 0) / conEntrada.length)
    : 0
  return {
    empleados: stats.length,
    conRegistro: conEntrada.length,
    promedioPuntualidad,
    totalTardanzas: stats.reduce((a, s) => a + s.tardanzas, 0),
    totalAusencias: stats.reduce((a, s) => a + s.ausencias, 0),
    totalJustificados: stats.reduce((a, s) => a + s.justificados, 0),
    totalSinMarca: stats.reduce((a, s) => a + s.sinMarca, 0),
    totalHoras: Math.round(stats.reduce((a, s) => a + s.totalHoras, 0) * 10) / 10,
    totalHorasExtra: Math.round(stats.reduce((a, s) => a + s.totalHorasExtra, 0) * 10) / 10
  }
}

export function ultimoDiaMes(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
