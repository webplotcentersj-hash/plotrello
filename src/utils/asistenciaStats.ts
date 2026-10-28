import type { Asistencia, RrhhNovedad } from '../types/api'
import { CONFIG_CALCULO_DEFAULT, horarioSabadoEfectivo, type ConfigCalculo } from '../services/relojBiometricoService'
import { asistenciaHoraCorta, isoToArgentinaDateKey } from './dateUtils'
import { esFeriado } from './feriadosArgentina'
import { esDiaHabil, novedadEnDia } from './rrhhNovedadDates'
import { resolverHorarioEsperadoDia } from './rrhhHorarioEsperadoDia'
import type { RotacionAsignacion, RotacionPlantilla } from './rrhhTurnosRotativos'

/** Contexto opcional para alinear stats con tablet (override → rotativo → fijo). */
export type HorarioEsperadoCtx = {
  plantillas?: RotacionPlantilla[]
  asignaciones?: RotacionAsignacion[]
  /** Clave `${idUsuario}|YYYY-MM-DD` → entrada/salida del día (turnos / ajustes). */
  overridesPorUsuarioDia?: Record<string, { entrada: string; salida: string }>
}

export function horarioEsperadoDesdeCtx(
  idUsuario: number,
  fecha: string,
  horario: HorarioFijoAsistencia | null,
  ctx?: HorarioEsperadoCtx | null
): { entrada: string | null; salida: string | null; esFranco?: boolean } | null {
  if (!ctx) return null
  const ov = ctx.overridesPorUsuarioDia?.[`${idUsuario}|${fecha.slice(0, 10)}`]
  const r = resolverHorarioEsperadoDia({
    fechaIso: fecha,
    fijo: horario
      ? {
          entrada: horario.entrada,
          salida: horario.salida,
          trabajaSabado: horario.trabajaSabado,
          sabadoEntrada: horario.sabadoEntrada,
          sabadoSalida: horario.sabadoSalida,
          horas: horario.horas
        }
      : null,
    override: ov || null,
    plantillas: ctx.plantillas,
    asignaciones: ctx.asignaciones,
    idUsuario
  })
  return { entrada: r.entrada, salida: r.salida, esFranco: r.esFranco }
}

export type HorarioFijoAsistencia = {
  entrada: string
  salida: string
  horas: number | null
  trabajaSabado: boolean
  sabadoEntrada?: string | null
  sabadoSalida?: string | null
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
  extra50: number
  extra100: number
  costoExtra: number
  minutosTardeTotal: number
  /** Días en que debía asistir (hasta hoy, sin justificados): con marca + ausencias + sin marca laborables. */
  diasExigibles: number
  /** Días puntuales / días exigibles. Quien casi no marca no puede dar 100%. */
  puntualidadPct: number
}

export type ExtraDiaDetalle = {
  extra50: number
  extra100: number
  total: number
}

export const LS_VALOR_HORA_EXTRA = 'rrhh-asistencia-valor-hora-extra'

/** Multiplicadores sobre valor hora normal (LCT Argentina: +50% y +100%). */
export const MULTIPLICADOR_HE50 = 1.5
export const MULTIPLICADOR_HE100 = 2

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

function jornadaNormal(fecha: string, horario: HorarioFijoAsistencia | null, config: ConfigCalculo): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  if (dow === 0) return config.domingoTodoExtra ? 0 : config.jornadaLunVie
  if (dow === 6) {
    if (horario && !horario.trabajaSabado) return 0
    const sab = horarioSabadoEfectivo(horario)
    if (sab) return sab.horas
    return config.jornadaSab > 0 ? config.jornadaSab : 5
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

/** Lun–Vie siempre; sábado solo si el horario fijo del empleado lo incluye; domingo nunca. */
function esDiaLaborableEmpleado(fecha: string, horario: HorarioFijoAsistencia | null): boolean {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  if (dow === 0) return false
  if (dow === 6) return horario?.trabajaSabado === true
  return true
}

function horasTrabajadasDe(a: Asistencia): number {
  if (a.horas_trabajadas != null && a.horas_trabajadas > 0) return a.horas_trabajadas
  if (!a.hora_entrada || !a.hora_salida) return 0
  const entrada = new Date(a.hora_entrada).getTime()
  const salida = new Date(a.hora_salida).getTime()
  if (!Number.isFinite(entrada) || !Number.isFinite(salida) || salida <= entrada) return 0
  return Math.round(((salida - entrada) / 3_600_000) * 100) / 100
}

function redondearExtra(valor: number, paso: number): number {
  if (paso <= 0) return Math.round(valor * 100) / 100
  return Math.round(valor / paso) * paso
}

/** Horas extra del día desglosadas HE 50% / HE 100%. */
export function calcularHorasExtraDiaDetalle(
  a: Asistencia,
  fecha: string,
  horario: HorarioFijoAsistencia | null,
  novs: RrhhNovedad[],
  config: ConfigCalculo = CONFIG_CALCULO_DEFAULT
): ExtraDiaDetalle {
  let extra50 = 0
  let extra100 = 0

  for (const n of novs) {
    if (n.grupo !== 'horas_extra' || n.horas_extra_cantidad == null) continue
    const h = n.horas_extra_cantidad
    if (n.codigo === 'horas_extra_100') extra100 += h
    else extra50 += h
  }

  if (a.tipo_registro === 'ausente' || a.tipo_registro === 'justificado') {
    return { extra50: round2(extra50), extra100: round2(extra100), total: round2(extra50 + extra100) }
  }
  if (!a.hora_entrada || !a.hora_salida) {
    return { extra50: round2(extra50), extra100: round2(extra100), total: round2(extra50 + extra100) }
  }

  const horasTrabajadas = horasTrabajadasDe(a)
  if (horasTrabajadas <= 0) {
    return { extra50: round2(extra50), extra100: round2(extra100), total: round2(extra50 + extra100) }
  }

  const feriado = esFeriado(fecha)
  const normal = feriado ? 0 : jornadaNormal(fecha, horario, config)
  const bruto = horasTrabajadas - normal
  const marcExtra = bruto <= 0 ? 0 : redondearExtra(bruto, config.redondeoExtra)

  if (marcExtra > 0) {
    const [y, m, d] = fecha.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0 || feriado) extra100 += marcExtra
    else extra50 += marcExtra
  }

  return {
    extra50: round2(extra50),
    extra100: round2(extra100),
    total: round2(extra50 + extra100)
  }
}

/** Horas extra de un registro vs jornada esperada (misma lógica que importador reloj). */
export function calcularHorasExtraDia(
  a: Asistencia,
  fecha: string,
  horario: HorarioFijoAsistencia | null,
  novs: RrhhNovedad[],
  config: ConfigCalculo = CONFIG_CALCULO_DEFAULT
): number {
  return calcularHorasExtraDiaDetalle(a, fecha, horario, novs, config).total
}

export function calcularCostoHorasExtra(
  extra50: number,
  extra100: number,
  valorHoraBase: number
): number {
  if (!valorHoraBase || valorHoraBase <= 0) return 0
  return round2(extra50 * valorHoraBase * MULTIPLICADOR_HE50 + extra100 * valorHoraBase * MULTIPLICADOR_HE100)
}

export function formatArs(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Mapa empleado → fecha → extra del día; fecha → acumulado hasta ese día (inclusive). */
export function buildExtraAcumuladoPorEmpleado(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
  config?: ConfigCalculo
  horarioEsperadoCtx?: HorarioEsperadoCtx | null
}): {
  porDia: Map<number, Map<string, ExtraDiaDetalle>>
  acumulado: Map<number, Map<string, number>>
} {
  const {
    asistencia,
    novedades,
    dias,
    horariosPorMes = {},
    horarioFallback,
    config,
    horarioEsperadoCtx
  } = params

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

  const ids = new Set<number>()
  asistencia.forEach((a) => ids.add(a.id_usuario))
  novedades.forEach((n) => ids.add(n.id_usuario))

  const porDia = new Map<number, Map<string, ExtraDiaDetalle>>()
  const acumulado = new Map<number, Map<string, number>>()

  for (const id of ids) {
    let suma = 0
    const mapDia = new Map<string, ExtraDiaDetalle>()
    const mapAcum = new Map<string, number>()
    for (const f of dias) {
      const a = porUsuarioDia.get(`${id}|${f}`)
      const novs = novedadesPorUsuarioDia.get(`${id}|${f}`) ?? []
      const horario = horarioParaMes(id, f, horariosPorMes, horarioFallback)
      const horarioEsperado = horarioEsperadoDesdeCtx(id, f, horario, horarioEsperadoCtx)
      const ev = evaluarDiaAsistencia({
        idUsuario: id,
        fecha: f,
        asistencia: a,
        novedades: novs,
        horario,
        config,
        horarioEsperado
      })
      const det = ev.extraDet
      if (det.total > 0) mapDia.set(f, det)
      suma = round2(suma + det.total)
      mapAcum.set(f, suma)
    }
    porDia.set(id, mapDia)
    acumulado.set(id, mapAcum)
  }

  return { porDia, acumulado }
}

/**
 * Tardanza vs base de Horarios reloj (misma regla que auditoría tablet / registrar_marcacion).
 * Solo compara HORA DE ENTRADA vs entrada esperada (+15 min). La salida no genera tardanza.
 */
export function detectarTardeMarcacion(
  a: Asistencia,
  novs: RrhhNovedad[],
  horaEsperada: string | null
): { tarde: boolean; minutos: number } {
  if (!a.hora_entrada) {
    // Sin entrada no hay tardanza (aunque haya salida o tipo_registro).
    if (novs.some((n) => n.codigo === 'tardanza')) {
      const novT = novs.find((n) => n.codigo === 'tardanza')
      return { tarde: true, minutos: novT?.duracion_minutos ?? 0 }
    }
    return { tarde: false, minutos: 0 }
  }
  if (horaEsperada) {
    const real = minutosDesdeIso(a.hora_entrada)
    const esperada = minutosDesdeHora(horaEsperada)
    if (real != null && esperada != null) {
      const limite = esperada + TOLERANCIA_TARDANZA_MIN
      if (real > limite) {
        return { tarde: true, minutos: real - esperada }
      }
      // Entrada a horario: no heredar T de una novedad o tipo_registro viejos.
      return { tarde: false, minutos: 0 }
    }
  }
  return { tarde: false, minutos: 0 }
}

/** Marcación tablet (facial / QR / manual) mínima para fusionar en stats. */
export type TabletMarcacionParaStats = {
  id_usuario: number
  tipo: string
  marcado_at: string
  empleado?: string | null
}

/**
 * Incorpora entradas/salidas del reloj tablet (incl. facial) cuando faltan en `asistencia`.
 * La tardanza se recalcula luego contra Horarios reloj.
 */
export function mergeTabletMarcacionesIntoAsistencia(
  asistencia: Asistencia[],
  tablet: TabletMarcacionParaStats[]
): Asistencia[] {
  if (!tablet.length) return asistencia

  const map = new Map<string, Asistencia>()
  for (const a of asistencia) {
    map.set(`${a.id_usuario}|${a.fecha.slice(0, 10)}`, { ...a })
  }

  type Acc = { entrada?: string; salida?: string; nombre?: string }
  const porDia = new Map<string, Acc>()

  for (const t of tablet) {
    const fecha = isoToArgentinaDateKey(t.marcado_at)
    if (!fecha) continue
    const k = `${t.id_usuario}|${fecha}`
    const cur = porDia.get(k) ?? {}
    const tipo = (t.tipo || '').toLowerCase()
    if (tipo === 'entrada' || tipo === 'in') {
      if (!cur.entrada || t.marcado_at < cur.entrada) cur.entrada = t.marcado_at
    } else if (tipo === 'salida' || tipo === 'out') {
      if (!cur.salida || t.marcado_at > cur.salida) cur.salida = t.marcado_at
    } else if (!cur.entrada) {
      cur.entrada = t.marcado_at
    }
    if (t.empleado) cur.nombre = t.empleado
    porDia.set(k, cur)
  }

  for (const [k, v] of porDia) {
    const [idStr, fecha] = k.split('|')
    const idUsuario = Number(idStr)
    const existing = map.get(k)
    if (existing) {
      if (!existing.hora_entrada && v.entrada) existing.hora_entrada = v.entrada
      if (!existing.hora_salida && v.salida) existing.hora_salida = v.salida
      if (!existing.nombre_usuario && v.nombre) existing.nombre_usuario = v.nombre
      continue
    }
    map.set(k, {
      id: 0,
      id_usuario: idUsuario,
      nombre_usuario: v.nombre || undefined,
      fecha,
      hora_entrada: v.entrada ?? null,
      hora_salida: v.salida ?? null,
      horas_trabajadas: null,
      tipo_registro: 'normal',
      observaciones: 'Reloj tablet (facial / QR / manual)',
      created_at: '',
      updated_at: ''
    })
  }

  return [...map.values()]
}

export type EvaluacionDiaAsistencia = {
  extraDet: ExtraDiaDetalle
  esTarde: boolean
  minutosTarde: number
  esAusenciaInjustificada: boolean
  esJustificado: boolean
  /** Día con marca o tardanza (para puntualidad). */
  cuentaParaPuntualidad: boolean
  esSinMarca: boolean
  horasTrabajadas: number
  soloNovedadHorasExtra: boolean
}

function asistenciaVacia(idUsuario: number, fecha: string): Asistencia {
  return {
    id: 0,
    id_usuario: idUsuario,
    fecha,
    hora_entrada: null,
    hora_salida: null,
    horas_trabajadas: null,
    tipo_registro: 'ausente',
    observaciones: null,
    created_at: '',
    updated_at: ''
  }
}

function esFaltaJustificada(n: RrhhNovedad): boolean {
  return (
    n.codigo === 'falta_justificada_enfermedad' ||
    n.codigo === 'falta_justificada_tramites'
  )
}

/** Unifica marcación + novedades para estadísticas, acumulado y planilla. */
export function evaluarDiaAsistencia(params: {
  idUsuario: number
  fecha: string
  asistencia?: Asistencia | null
  novedades: RrhhNovedad[]
  horario: HorarioFijoAsistencia | null
  config?: ConfigCalculo
  /** Misma prioridad que tablet: override → rotativo → fijo. */
  horarioEsperado?: {
    entrada: string | null
    salida: string | null
    esFranco?: boolean
  } | null
}): EvaluacionDiaAsistencia {
  const { idUsuario, fecha, asistencia: a, novedades: novs, horario, config = CONFIG_CALCULO_DEFAULT } = params
  const habil = esDiaHabil(fecha)
  const reg = a ?? asistenciaVacia(idUsuario, fecha)
  const horarioParaExtra =
    params.horarioEsperado?.entrada && params.horarioEsperado?.salida
      ? {
          ...(horario || { entrada: '', salida: '', horas: null, trabajaSabado: true }),
          entrada: params.horarioEsperado.entrada,
          salida: params.horarioEsperado.salida
        }
      : horario
  const extraDet = calcularHorasExtraDiaDetalle(reg, fecha, horarioParaExtra, novs, config)

  const novFalta = novs.find((n) => n.grupo === 'falta')
  const novLicencia = novs.find((n) => n.grupo === 'licencia')
  const novTardanza = novs.find((n) => n.codigo === 'tardanza')
  const novsHe = novs.filter((n) => n.grupo === 'horas_extra')
  // Sábado: usar entrada de sábado del fijo si no hay esperado explícito
  let horaEsp = params.horarioEsperado?.entrada ?? null
  if (horaEsp == null && horario) {
    const [y, m, d] = fecha.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 6) {
      horaEsp = horarioSabadoEfectivo(horario)?.entrada ?? null
    } else if (dow !== 0) {
      horaEsp = horario.entrada || null
    }
  }
  const tardeInfo = a
    ? detectarTardeMarcacion(a, novs, horaEsp)
    : { tarde: !!novTardanza, minutos: novTardanza?.duracion_minutos ?? 0 }

  let esJustificado =
    a?.tipo_registro === 'justificado' || !!novLicencia || (novFalta != null && esFaltaJustificada(novFalta))

  let esAusenciaInjustificada =
    !esJustificado &&
    (a?.tipo_registro === 'ausente' || novFalta?.codigo === 'falta_injustificada' || (novFalta != null && !esFaltaJustificada(novFalta) && !novLicencia))

  if (novFalta && esFaltaJustificada(novFalta)) {
    esJustificado = true
    esAusenciaInjustificada = false
  }

  const llegoTarde = !esAusenciaInjustificada && !esJustificado && tardeInfo.tarde

  const tieneMarca =
    !!a &&
    (a.hora_entrada != null || a.tipo_registro === 'normal' || a.tipo_registro === 'tarde')

  const soloNovedadHorasExtra = !a && novsHe.length > 0 && !novFalta && !novLicencia && !novTardanza

  const cuentaParaPuntualidad =
    !esAusenciaInjustificada && !esJustificado && (tieneMarca || (!!novTardanza && !novFalta && !novLicencia))

  const diaExplicado =
    !!a ||
    !!novFalta ||
    !!novLicencia ||
    !!novTardanza ||
    novsHe.length > 0 ||
    novs.some((n) => n.grupo === 'tardanza_retiro')

  const esSinMarca = habil && !diaExplicado

  return {
    extraDet,
    esTarde: llegoTarde,
    minutosTarde: tardeInfo.tarde ? tardeInfo.minutos || novTardanza?.duracion_minutos || 0 : 0,
    esAusenciaInjustificada,
    esJustificado,
    cuentaParaPuntualidad,
    esSinMarca,
    horasTrabajadas: a?.horas_trabajadas || 0,
    soloNovedadHorasExtra
  }
}

export function calcularStatsAsistencia(params: {
  asistencia: Asistencia[]
  novedades: RrhhNovedad[]
  dias: string[]
  nombres: Map<number, string>
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  horarioFallback?: Record<number, HorarioFijoAsistencia>
  /** Empleados con Horarios reloj aunque no tengan marcas en el período. */
  idsConHorario?: number[]
  config?: ConfigCalculo
  valorHoraBase?: number
  horarioEsperadoCtx?: HorarioEsperadoCtx | null
}): StatsEmpleadoAsistencia[] {
  const {
    asistencia,
    novedades,
    dias,
    nombres,
    horariosPorMes = {},
    horarioFallback,
    idsConHorario,
    config = CONFIG_CALCULO_DEFAULT,
    valorHoraBase = 0,
    horarioEsperadoCtx
  } = params

  const ids = new Set<number>()
  asistencia.forEach((a) => ids.add(a.id_usuario))
  novedades.forEach((n) => ids.add(n.id_usuario))
  idsConHorario?.forEach((id) => ids.add(id))

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
  const hoy = isoToArgentinaDateKey(new Date().toISOString())

  for (const id of ids) {
    let diasConEntrada = 0
    let tardanzas = 0
    let ausencias = 0
    let justificados = 0
    let sinMarca = 0
    let totalHoras = 0
    let totalHorasExtra = 0
    let extra50 = 0
    let extra100 = 0
    let minutosTardeTotal = 0
    let faltasExigibles = 0

    for (const f of dias) {
      const a = porUsuarioDia.get(`${id}|${f}`)
      const novs = novedadesPorUsuarioDia.get(`${id}|${f}`) ?? []
      const horario = horarioParaMes(id, f, horariosPorMes, horarioFallback)
      const horarioEsperado = horarioEsperadoDesdeCtx(id, f, horario, horarioEsperadoCtx)
      const ev = evaluarDiaAsistencia({
        idUsuario: id,
        fecha: f,
        asistencia: a,
        novedades: novs,
        horario,
        config,
        horarioEsperado
      })

      totalHorasExtra += ev.extraDet.total
      extra50 += ev.extraDet.extra50
      extra100 += ev.extraDet.extra100
      totalHoras += ev.horasTrabajadas

      if (horarioEsperado?.esFranco) continue
      if (esFeriado(f) || !esDiaLaborableEmpleado(f, horario)) continue

      if (ev.esAusenciaInjustificada) {
        ausencias++
        if (f <= hoy) faltasExigibles++
        continue
      }
      if (ev.esJustificado) {
        justificados++
        continue
      }
      if (ev.cuentaParaPuntualidad) {
        diasConEntrada++
        if (ev.esTarde) {
          tardanzas++
          minutosTardeTotal += ev.minutosTarde
        }
        continue
      }
      if (ev.soloNovedadHorasExtra) continue
      if (ev.esSinMarca) {
        sinMarca++
        if (f <= hoy && esDiaLaborableEmpleado(f, horario)) faltasExigibles++
      }
    }

    // Puntualidad sobre los días que debía asistir, no solo sobre los que marcó:
    // 4 marcas puntuales en un mes de 20 días hábiles = 20%, no 100%.
    const diasExigibles = diasConEntrada + faltasExigibles
    const puntualidadPct = diasExigibles
      ? Math.round((Math.max(0, diasConEntrada - tardanzas) / diasExigibles) * 100)
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
      totalHorasExtra: round2(totalHorasExtra),
      extra50: round2(extra50),
      extra100: round2(extra100),
      costoExtra: calcularCostoHorasExtra(extra50, extra100, valorHoraBase),
      minutosTardeTotal,
      diasExigibles,
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
    totalHorasExtra: round2(stats.reduce((a, s) => a + s.totalHorasExtra, 0)),
    totalExtra50: round2(stats.reduce((a, s) => a + s.extra50, 0)),
    totalExtra100: round2(stats.reduce((a, s) => a + s.extra100, 0)),
    costoExtraTotal: round2(stats.reduce((a, s) => a + s.costoExtra, 0))
  }
}

export function ultimoDiaMes(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
