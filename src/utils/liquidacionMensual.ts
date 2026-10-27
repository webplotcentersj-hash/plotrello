import type { Asistencia, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { isoToArgentinaDateKey } from './dateUtils'
import { nombreFeriado } from './feriadosArgentina'
import { etiquetaCodigoRrhhNovedad, etiquetaGrupoRrhhNovedad } from './rrhhNovedadCatalog'
import { novedadEnDia } from './rrhhNovedadDates'
import {
  MULTIPLICADOR_HE100,
  MULTIPLICADOR_HE50,
  type HorarioFijoAsistencia,
  type StatsEmpleadoAsistencia
} from './asistenciaStats'
import { fmtAntiguedad } from './rrhhDesvinculacionesStats'
import { antiguedadMesesAlPeriodo } from './rrhhLibroSueldos'

export type MontosLiquidacion = {
  precioHora: number
  sueldoBase: number
  sueldoBlanco: number
  sueldoSinDeclarar: number
}

export type CargaSocialDef = {
  id: string
  nombre: string
  lado: 'aporte' | 'contribucion'
  porcentaje: number
}

export type ItemCarga = {
  id: string
  nombre: string
  lado: 'aporte' | 'contribucion'
  porcentaje: number
  importe: number
}

export type LineaNovedadLiquidacion = {
  desde: string
  hasta: string
  grupo: string
  etiqueta: string
  detalle: string
}

export type LineaPermisoLiquidacion = {
  titulo: string
  tipo: string
  desde: string
  hasta: string
  dias: number | null
  detalle: string
}

export type LiquidacionEmpleado = {
  id: number
  nombre: string
  fechaIngreso: string | null
  antiguedadMeses: number | null
  antiguedadAnios: number
  antiguedadLabel: string
  pctAntiguedadLegal: number
  /** Antigüedad plena del mes (sueldo × años × %), antes del proporcional. */
  adicionalAntiguedadCompleto: number
  adicionalAntiguedad: number
  /** Días laborables del período según su horario (mes completo). */
  diasLaborablesPeriodo: number
  /** Factor días que debía / días laborables del período (ingreso a mitad de mes < 1). */
  factorProporcional: number
  novedades: LineaNovedadLiquidacion[]
  diasConEntrada: number
  diasExigibles: number
  puntualidadPct: number
  tardanzas: number
  minutosTarde: number
  ausencias: number
  faltas: number
  fechasFaltas: string[]
  diasDebia: number
  diasVino: number
  domingos: number
  domingosVino: number
  horasDomingo: number
  importeDomingo: number
  feriados: number
  feriadosVino: number
  horasFeriado: number
  importeFeriado: number
  diasNoTrabaja: number
  noTrabajaVino: number
  diasJustificados: number
  sinMarca: number
  totalHoras: number
  totalHorasExtra: number
  permisos: LineaPermisoLiquidacion[]
  ventas: number
  plataVendida: number
  opsMovidas: number
  trabajos: number
  extra50: number
  extra100: number
  precioHora: number
  sueldoBase: number
  sueldoBlanco: number
  sueldoSinDeclarar: number
  importeExtra50: number
  importeExtra100: number
  descuentoFaltas: number
  descuentoTardanzas: number
  aportes: ItemCarga[]
  contribuciones: ItemCarga[]
  totalAportes: number
  totalContribuciones: number
  remuneracion: number
  haberes: number
  neto: number
  costoEmpresa: number
  baseDistinta: boolean
}

export const MONTOS_VACIOS: MontosLiquidacion = {
  precioHora: 0,
  sueldoBase: 0,
  sueldoBlanco: 0,
  sueldoSinDeclarar: 0
}

/** Referencia del régimen general, sin reducción pyme y sin ART. Se editan en la pantalla. */
export const CARGAS_SOCIALES_DEFAULT: CargaSocialDef[] = [
  { id: 'ap-jub', nombre: 'Jubilación (SIPA)', lado: 'aporte', porcentaje: 11 },
  { id: 'ap-pami', nombre: 'PAMI (INSSJP)', lado: 'aporte', porcentaje: 3 },
  { id: 'ap-os', nombre: 'Obra social', lado: 'aporte', porcentaje: 3 },
  { id: 'co-jub', nombre: 'Jubilación (SIPA)', lado: 'contribucion', porcentaje: 10.17 },
  { id: 'co-pami', nombre: 'PAMI (INSSJP)', lado: 'contribucion', porcentaje: 1.5 },
  { id: 'co-af', nombre: 'Asignaciones familiares', lado: 'contribucion', porcentaje: 4.44 },
  { id: 'co-fne', nombre: 'Fondo Nacional de Empleo', lado: 'contribucion', porcentaje: 0.89 },
  { id: 'co-os', nombre: 'Obra social', lado: 'contribucion', porcentaje: 6 },
  { id: 'co-art', nombre: 'ART', lado: 'contribucion', porcentaje: 0 }
]

/** % del sueldo base por cada año cumplido (uso habitual CCT / convenio). */
export const PCT_ANTIGUEDAD_LEGAL_DEFAULT = 1

const LS_KEY = 'rrhh-liquidacion-v1'

type MesGuardado = {
  cargas: CargaSocialDef[]
  montos: Record<string, MontosLiquidacion>
  pctAntiguedadLegal?: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function num(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? round2(v) : 0
}

export function mesDeFecha(fecha: string): string {
  return fecha.slice(0, 7)
}

export function mesAnterior(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function normalizarCargas(raw: unknown): CargaSocialDef[] {
  if (!Array.isArray(raw)) return CARGAS_SOCIALES_DEFAULT.map((c) => ({ ...c }))
  const porId = new Map<string, CargaSocialDef>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<CargaSocialDef>
    if (!row.id || (row.lado !== 'aporte' && row.lado !== 'contribucion')) continue
    porId.set(row.id, {
      id: row.id,
      nombre: String(row.nombre || row.id),
      lado: row.lado,
      porcentaje: num(row.porcentaje)
    })
  }
  return CARGAS_SOCIALES_DEFAULT.map((def) => porId.get(def.id) ?? { ...def })
}

function normalizarMontos(raw: unknown): MontosLiquidacion {
  const row = raw && typeof raw === 'object' ? (raw as Partial<MontosLiquidacion>) : {}
  return {
    precioHora: num(row.precioHora),
    sueldoBase: num(row.sueldoBase),
    sueldoBlanco: num(row.sueldoBlanco),
    sueldoSinDeclarar: num(row.sueldoSinDeclarar)
  }
}

function leerTodo(): Record<string, MesGuardado> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, MesGuardado>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function escribirTodo(data: Record<string, MesGuardado>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

function normalizarPctAntiguedad(raw: unknown): number {
  const v = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(v) || v < 0) return PCT_ANTIGUEDAD_LEGAL_DEFAULT
  return round2(v)
}

export function cargarMesLiquidacion(mes: string): {
  cargas: CargaSocialDef[]
  montos: Record<number, MontosLiquidacion>
  pctAntiguedadLegal: number
} {
  const todo = leerTodo()
  const propio = todo[mes]
  const base = propio ?? todo[mesAnterior(mes)]
  const cargas = normalizarCargas(base?.cargas)
  const pctAntiguedadLegal = normalizarPctAntiguedad(
    propio?.pctAntiguedadLegal ?? base?.pctAntiguedadLegal ?? PCT_ANTIGUEDAD_LEGAL_DEFAULT
  )
  const montos: Record<number, MontosLiquidacion> = {}
  const origen = propio?.montos ?? base?.montos ?? {}
  for (const [id, row] of Object.entries(origen)) {
    montos[Number(id)] = normalizarMontos(row)
  }
  if (!propio) {
    todo[mes] = {
      cargas,
      montos: Object.fromEntries(Object.entries(montos).map(([id, m]) => [id, m])),
      pctAntiguedadLegal
    }
    escribirTodo(todo)
  }
  return { cargas, montos, pctAntiguedadLegal }
}

export function guardarMesLiquidacion(
  mes: string,
  cargas: CargaSocialDef[],
  montos: Record<number, MontosLiquidacion>,
  pctAntiguedadLegal: number = PCT_ANTIGUEDAD_LEGAL_DEFAULT
) {
  const todo = leerTodo()
  todo[mes] = {
    cargas: normalizarCargas(cargas),
    montos: Object.fromEntries(Object.entries(montos).map(([id, m]) => [id, normalizarMontos(m)])),
    pctAntiguedadLegal: normalizarPctAntiguedad(pctAntiguedadLegal)
  }
  escribirTodo(todo)
}

export function remuneracionPactada(m: MontosLiquidacion): number {
  return round2(m.sueldoBase + m.sueldoSinDeclarar)
}

export function descuentoPorFaltas(faltas: number, remuneracion: number, precioHora: number): number {
  if (faltas <= 0) return 0
  if (remuneracion > 0) return round2(faltas * (remuneracion / 30))
  if (precioHora > 0) return round2(faltas * precioHora * 8)
  return 0
}

export function descuentoPorTardanzas(minutos: number, remuneracion: number, precioHora: number): number {
  if (minutos <= 0) return 0
  const hora = precioHora > 0 ? precioHora : remuneracion > 0 ? remuneracion / 30 / 8 : 0
  if (hora <= 0) return 0
  return round2((minutos / 60) * hora)
}

function permisoSolapa(p: SolicitudPermiso, desde: string, hasta: string): boolean {
  const ini = (p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  const fin = (p.fecha_fin || p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  if (!ini || !fin) return false
  return ini <= hasta && fin >= desde
}

function dowDe(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function vinoEseDia(a: Asistencia | undefined): boolean {
  if (!a) return false
  if (a.tipo_registro === 'ausente' || a.tipo_registro === 'justificado') return false
  return a.hora_entrada != null || a.tipo_registro === 'normal' || a.tipo_registro === 'tarde'
}

function horasVino(a: Asistencia | undefined): number {
  if (!a || !vinoEseDia(a)) return 0
  if (a.horas_trabajadas != null && a.horas_trabajadas > 0) return a.horas_trabajadas
  if (!a.hora_entrada || !a.hora_salida) return 0
  const entrada = new Date(a.hora_entrada).getTime()
  const salida = new Date(a.hora_salida).getTime()
  if (!Number.isFinite(entrada) || !Number.isFinite(salida) || salida <= entrada) return 0
  return round2((salida - entrada) / 3_600_000)
}

function esJustificadoDia(a: Asistencia | undefined, novs: RrhhNovedad[]): boolean {
  if (a?.tipo_registro === 'justificado') return true
  return novs.some(
    (n) =>
      n.grupo === 'licencia' ||
      n.codigo === 'falta_justificada_enfermedad' ||
      n.codigo === 'falta_justificada_tramites' ||
      n.codigo.startsWith('licencia_')
  )
}

/** Día hábil del empleado: no domingo, no feriado, y sábado solo si trabaja sábado. */
export function esDiaLaborableEmpleado(
  fecha: string,
  horario: HorarioFijoAsistencia | null | undefined
): boolean {
  const dia = dowDe(fecha)
  if (dia === 0) return false
  if (nombreFeriado(fecha)) return false
  if (dia === 6 && horario?.trabajaSabado !== true) return false
  return true
}

/**
 * Proporcional del período: días que le corresponden trabajar desde el ingreso
 * sobre los días laborables del período completo según su horario.
 */
export function factorProporcionalPeriodo(diasDebia: number, diasLaborablesPeriodo: number): number {
  if (diasLaborablesPeriodo <= 0) return diasDebia > 0 ? 1 : 0
  return Math.min(1, Math.max(0, diasDebia / diasLaborablesPeriodo))
}

export function armarLiquidacionEmpleado(params: {
  id: number
  nombre: string
  fechaIngreso?: string | null
  stats: StatsEmpleadoAsistencia | null
  montos: MontosLiquidacion
  precioHoraDefault: number
  cargas: CargaSocialDef[]
  pctAntiguedadLegal?: number
  novedades: RrhhNovedad[]
  permisos: SolicitudPermiso[]
  dias: string[]
  fechaDesde: string
  fechaHasta: string
  asistencia?: Asistencia[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
}): LiquidacionEmpleado {
  const periodo = params.fechaHasta.slice(0, 7)
  const fechaIngreso = params.fechaIngreso?.slice(0, 10) || null
  const tieneIngreso = Boolean(fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso))
  const antiguedadMeses = tieneIngreso ? antiguedadMesesAlPeriodo(fechaIngreso, periodo) : null
  const antiguedadAnios = antiguedadMeses != null ? Math.floor(antiguedadMeses / 12) : 0
  const antiguedadLabel = fmtAntiguedad(antiguedadMeses)
  const pctAntiguedadLegal = normalizarPctAntiguedad(
    params.pctAntiguedadLegal ?? PCT_ANTIGUEDAD_LEGAL_DEFAULT
  )

  const precioHora = params.montos.precioHora > 0 ? params.montos.precioHora : params.precioHoraDefault
  const stats = params.stats
  const extra50 = stats?.extra50 ?? 0
  const extra100 = stats?.extra100 ?? 0
  const importeExtra50 = round2(extra50 * precioHora * MULTIPLICADOR_HE50)
  const importeExtra100 = round2(extra100 * precioHora * MULTIPLICADOR_HE100)
  const hoy = isoToArgentinaDateKey(new Date().toISOString())
  const marcas = new Map<string, Asistencia>()
  for (const a of params.asistencia ?? []) {
    if (a.id_usuario === params.id) marcas.set(a.fecha.slice(0, 10), a)
  }
  let diasLaborablesPeriodo = 0
  let diasDebia = 0
  let diasVino = 0
  let domingos = 0
  let domingosVino = 0
  let horasDomingo = 0
  let feriados = 0
  let feriadosVino = 0
  let horasFeriado = 0
  let diasNoTrabaja = 0
  let noTrabajaVino = 0
  const fechasFaltas: string[] = []
  for (const fecha of params.dias) {
    const horario = params.horariosPorMes?.[fecha.slice(0, 7)]?.[params.id] ?? null
    const dia = dowDe(fecha)
    const feriado = nombreFeriado(fecha)
    const marca = marcas.get(fecha)
    const vino = vinoEseDia(marca)
    const horas = horasVino(marca)
    const novs = params.novedades.filter((n) => n.id_usuario === params.id && novedadEnDia(n, fecha))
    const yaIngreso = !fechaIngreso || fecha >= fechaIngreso

    if (esDiaLaborableEmpleado(fecha, horario)) {
      diasLaborablesPeriodo += 1
    }

    // Antes del ingreso no cuenta como día debido ni falta.
    if (!yaIngreso) continue

    if (dia === 0) {
      domingos += 1
      if (vino) {
        domingosVino += 1
        horasDomingo += horas
      }
      continue
    }
    if (feriado) {
      feriados += 1
      if (vino) {
        feriadosVino += 1
        horasFeriado += horas
      }
      continue
    }
    if (dia === 6 && horario?.trabajaSabado !== true) {
      diasNoTrabaja += 1
      if (vino) noTrabajaVino += 1
      continue
    }
    diasDebia += 1
    if (vino) {
      diasVino += 1
      continue
    }
    if (fecha <= hoy && !esJustificadoDia(marca, novs)) fechasFaltas.push(fecha)
  }
  const faltas = fechasFaltas.length
  const factorProporcional = factorProporcionalPeriodo(diasDebia, diasLaborablesPeriodo)
  const adicionalAntiguedadCompleto = round2(
    params.montos.sueldoBase * antiguedadAnios * (pctAntiguedadLegal / 100)
  )
  const adicionalAntiguedad = round2(adicionalAntiguedadCompleto * factorProporcional)
  const remuneracionMensual = remuneracionPactada(params.montos)
  const remuneracionBase = round2(remuneracionMensual * factorProporcional)
  const remuneracion = round2(remuneracionBase + adicionalAntiguedad)
  const sueldoBaseProporcional = round2(params.montos.sueldoBase * factorProporcional)
  const sueldoSinDeclararProporcional = round2(params.montos.sueldoSinDeclarar * factorProporcional)

  horasDomingo = round2(horasDomingo)
  horasFeriado = round2(horasFeriado)
  const importeDomingo = round2(horasDomingo * precioHora * MULTIPLICADOR_HE100)
  const importeFeriado = round2(horasFeriado * precioHora * MULTIPLICADOR_HE100)
  const minutosTarde = stats?.minutosTardeTotal ?? 0
  // Valor día = remuneración mensual completa / 30 (no el proporcional del ingreso).
  const remuneracionDiaRef = round2(remuneracionMensual + adicionalAntiguedadCompleto)
  const descuentoFaltas = descuentoPorFaltas(faltas, remuneracionDiaRef, precioHora)
  const descuentoTardanzas = descuentoPorTardanzas(minutosTarde, remuneracionDiaRef, precioHora)
  const baseImponible = round2(sueldoBaseProporcional + adicionalAntiguedad)

  const items = params.cargas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    lado: c.lado,
    porcentaje: c.porcentaje,
    importe: round2(baseImponible * (c.porcentaje / 100))
  }))
  const aportes = items.filter((c) => c.lado === 'aporte')
  const contribuciones = items.filter((c) => c.lado === 'contribucion')
  const totalAportes = round2(aportes.reduce((a, c) => a + c.importe, 0))
  const totalContribuciones = round2(contribuciones.reduce((a, c) => a + c.importe, 0))
  const haberes = round2(remuneracion + importeExtra50 + importeExtra100)
  const neto = round2(haberes - descuentoFaltas - descuentoTardanzas - totalAportes)
  const costoEmpresa = round2(haberes - descuentoFaltas - descuentoTardanzas + totalContribuciones)

  const novedades = params.novedades
    .filter((n) => n.id_usuario === params.id && params.dias.some((d) => novedadEnDia(n, d)))
    .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))
    .map((n) => {
      const extra: string[] = []
      if (n.duracion_minutos) extra.push(`${n.duracion_minutos} min`)
      if (n.horas_extra_cantidad) extra.push(`${n.horas_extra_cantidad} hs`)
      if (n.observaciones) extra.push(n.observaciones)
      return {
        desde: n.fecha_desde.slice(0, 10),
        hasta: n.fecha_hasta.slice(0, 10),
        grupo: etiquetaGrupoRrhhNovedad(n.grupo),
        etiqueta: etiquetaCodigoRrhhNovedad(n.codigo),
        detalle: extra.join(' · ')
      }
    })

  const permisos = params.permisos
    .filter((p) => p.id_usuario === params.id && p.estado === 'aprobado' && permisoSolapa(p, params.fechaDesde, params.fechaHasta))
    .map((p) => {
      const extra: string[] = []
      if (p.descripcion?.trim()) extra.push(p.descripcion.trim())
      if (p.observaciones?.trim()) extra.push(p.observaciones.trim())
      return {
        titulo: p.titulo,
        tipo: p.tipo_solicitud,
        desde: (p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10),
        hasta: (p.fecha_fin || p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10),
        dias: p.dias_solicitados,
        detalle: extra.join(' · ')
      }
    })

  const baseDistinta = false

  return {
    id: params.id,
    nombre: params.nombre,
    fechaIngreso,
    antiguedadMeses,
    antiguedadAnios,
    antiguedadLabel,
    pctAntiguedadLegal,
    adicionalAntiguedadCompleto,
    adicionalAntiguedad,
    diasLaborablesPeriodo,
    factorProporcional: round2(factorProporcional),
    novedades,
    diasConEntrada: stats?.diasConEntrada ?? 0,
    diasExigibles: stats?.diasExigibles ?? 0,
    puntualidadPct: stats?.puntualidadPct ?? 0,
    tardanzas: stats?.tardanzas ?? 0,
    minutosTarde,
    ausencias: stats?.ausencias ?? 0,
    faltas,
    fechasFaltas,
    diasDebia,
    diasVino,
    domingos,
    domingosVino,
    horasDomingo,
    importeDomingo,
    feriados,
    feriadosVino,
    horasFeriado,
    importeFeriado,
    diasNoTrabaja,
    noTrabajaVino,
    diasJustificados: stats?.justificados ?? 0,
    sinMarca: stats?.sinMarca ?? 0,
    totalHoras: stats?.totalHoras ?? 0,
    totalHorasExtra: stats?.totalHorasExtra ?? 0,
    permisos,
    ventas: 0,
    plataVendida: 0,
    opsMovidas: 0,
    trabajos: 0,
    extra50,
    extra100,
    precioHora,
    sueldoBase: sueldoBaseProporcional,
    sueldoBlanco: params.montos.sueldoBlanco,
    sueldoSinDeclarar: sueldoSinDeclararProporcional,
    importeExtra50,
    importeExtra100,
    descuentoFaltas,
    descuentoTardanzas,
    aportes,
    contribuciones,
    totalAportes,
    totalContribuciones,
    remuneracion,
    haberes,
    neto,
    costoEmpresa,
    baseDistinta
  }
}

export function totalesLiquidacion(filas: LiquidacionEmpleado[]) {
  const sum = (pick: (f: LiquidacionEmpleado) => number) => round2(filas.reduce((a, f) => a + pick(f), 0))
  const conMarca = filas.filter((f) => f.diasConEntrada > 0)
  const puntualidadPromedio = conMarca.length
    ? Math.round(conMarca.reduce((a, f) => a + f.puntualidadPct, 0) / conMarca.length)
    : 0
  return {
    empleados: filas.length,
    diasConEntrada: filas.reduce((a, f) => a + f.diasConEntrada, 0),
    diasExigibles: filas.reduce((a, f) => a + f.diasExigibles, 0),
    puntualidadPromedio,
    tardanzas: filas.reduce((a, f) => a + f.tardanzas, 0),
    ausencias: filas.reduce((a, f) => a + f.ausencias, 0),
    faltas: filas.reduce((a, f) => a + f.faltas, 0),
    justificados: filas.reduce((a, f) => a + f.diasJustificados, 0),
    sinMarca: filas.reduce((a, f) => a + f.sinMarca, 0),
    totalHoras: sum((f) => f.totalHoras),
    totalHorasExtra: sum((f) => f.totalHorasExtra),
    permisos: filas.reduce((a, f) => a + f.permisos.length, 0),
    extra50: sum((f) => f.extra50),
    extra100: sum((f) => f.extra100),
    haberes: sum((f) => f.haberes),
    aportes: sum((f) => f.totalAportes),
    contribuciones: sum((f) => f.totalContribuciones),
    neto: sum((f) => f.neto),
    costoEmpresa: sum((f) => f.costoEmpresa)
  }
}
