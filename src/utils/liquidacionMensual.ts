import type { Asistencia, RrhhNovedad, SolicitudPermiso } from '../types/api'
import { isoToArgentinaDateKey } from './dateUtils'
import { nombreFeriado } from './feriadosArgentina'
import { etiquetaCodigoRrhhNovedad, etiquetaGrupoRrhhNovedad } from './rrhhNovedadCatalog'
import { novedadEnDia } from './rrhhNovedadDates'
import { diaEnMediaJornadaPostSuspension, diaEnSuspension } from './rrhhSuspension'
import {
  MULTIPLICADOR_HE100,
  MULTIPLICADOR_HE50,
  horarioEsperadoDesdeCtx,
  type HorarioEsperadoCtx,
  type HorarioFijoAsistencia,
  type StatsEmpleadoAsistencia
} from './asistenciaStats'
import { fmtAntiguedad } from './rrhhDesvinculacionesStats'
import { antiguedadMesesAlPeriodo } from './rrhhLibroSueldos'
import {
  EMPLEADO_LEGAL_DEFAULT,
  HORAS_JORNADA_DEFAULT,
  IDS_CARGAS_SINDICATO,
  calcularCargasLegales,
  importeMinutosNoTrabajados,
  parametrosLegalesDefault,
  remuneracionDeclarada,
  type CargaSocialDef,
  type EmpleadoLegal,
  type ItemCarga,
  type ParametrosLegales,
  type RemuneracionDeclaradaInput
} from './rrhhCargasLegales'

export type { CargaSocialDef, ItemCarga }
export { IDS_CARGAS_SINDICATO }

export type MontosLiquidacion = {
  precioHora: number
  /**
   * Sueldo en blanco: base del recibo, de la antigüedad y de aportes/contribuciones.
   * (Se llama sueldoBase por compatibilidad con lo ya guardado en la BD.)
   */
  sueldoBase: number
  /**
   * @deprecated Columna “En blanco” del primer modelo (antes de oct-2026), cuando sueldoBase
   * era el total pactado. Desde entonces el sueldo en blanco es sueldoBase. Se conserva
   * el valor viejo al guardar para no perder datos, pero no entra en el cálculo.
   */
  sueldoBlanco?: number
  sueldoSinDeclarar: number
  /** Si no es null, reemplaza el neto calculado (editable y persistido). */
  netoManual: number | null
  /** Fuera de convenio: no se le aplica la cuota sindical. */
  fueraConvenio?: boolean
  /** Contrato a tiempo parcial (art. 92 ter LCT): OS sobre jornada completa. */
  jornadaParcial?: boolean
  /** Sueldo de jornada completa de la categoría (base de obra social si es parcial). */
  sueldoJornadaCompleta?: number
  /** Alta en el Régimen de Incentivo a la Formalización Laboral (Ley 27.802). */
  rifl?: boolean
}

/**
 * Versión del formato de config del período.
 * v2: un 0 explícito en alícuotas / antigüedad se respeta (antes 0 = “sin configurar”).
 */
export const CONFIG_LIQUIDACION_VERSION = 2

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
  /** Faltas injustificadas + faltas equivalentes por bloques de 3 tardanzas. */
  faltasEquivalentes: number
  /** Solo injustificadas (descuentan valor día). */
  fechasFaltas: string[]
  /** Justificadas / licencia / permiso: sin descuento. */
  fechasJustificadas: string[]
  /** Días laborables dentro de una suspensión (sin goce). */
  fechasSuspensiones: string[]
  diasSuspension: number
  /** Días laborables con media jornada post-suspensión. */
  fechasMediaJornada: string[]
  diasMediaJornada: number
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
  sueldoSinDeclarar: number
  fueraConvenio: boolean
  /** Base de aportes/contribuciones: sueldo en blanco proporcional + antigüedad + horas extra. */
  baseImponible: number
  importeExtra50: number
  importeExtra100: number
  descuentoFaltas: number
  descuentoTardanzas: number
  /** Suspensión: 1 valor día por cada día laborable del período. */
  descuentoSuspensiones: number
  /** Media jornada post-suspensión: ½ valor día por cada día laborable. */
  descuentoMediaJornada: number
  /** Valor día usado para faltas / bloques de tardanzas. */
  valorDiaDescuento: number
  /** Faltas equivalentes por bloques de 3 tardanzas (misma cifra que descuenta). */
  diasDescuentoTardanzas: number
  aportes: ItemCarga[]
  contribuciones: ItemCarga[]
  totalAportes: number
  totalContribuciones: number
  remuneracion: number
  haberes: number
  /** Neto calculado (haberes − faltas − tardanzas − aportes). */
  netoCalculado: number
  /** Neto a pagar (manual si hay override, si no el calculado). */
  neto: number
  netoManual: boolean
  costoEmpresa: number
  baseDistinta: boolean
  /** Base de obra social (jornada completa si es parcial). */
  baseOs: number
  /** La remuneración superó la base imponible máxima: aportes topados. */
  topeAplicado: boolean
  /** Datos legales del empleado usados en el cálculo. */
  legal: EmpleadoLegal
  /** Jornada parcial sin sueldo de jornada completa cargado: se usó sueldo × 2. */
  jornadaCompletaEstimada: boolean
  criterioTardanzas: CriterioTardanzas
  /** Horas de su jornada (horario del período, o 8). */
  horasJornada: number
  /** Entrada de la remuneración declarada (lo que lee el Libro de sueldos). */
  declarado: RemuneracionDeclaradaInput
}

export const MONTOS_VACIOS: MontosLiquidacion = {
  precioHora: 0,
  sueldoBase: 0,
  sueldoSinDeclarar: 0,
  netoManual: null,
  fueraConvenio: false
}

/**
 * Alícuotas de ley / LCT alineadas al recibo (libro de sueldos):
 * aportes trabajador 11+3+3; contribuciones con alícuotas del régimen aplicable
 * (SIPA 10,77 · INSSJP 1,59 · AAFF 4,7 · FNE 0,94 · OS 6). ART queda en 0 para cargar la de la empresa.
 */
export const CARGAS_SOCIALES_BASE_LEY: CargaSocialDef[] = [
  { id: 'ap-jub', nombre: 'Jubilación (SIPA)', lado: 'aporte', porcentaje: 11 },
  { id: 'ap-pami', nombre: 'PAMI (INSSJP)', lado: 'aporte', porcentaje: 3 },
  { id: 'ap-os', nombre: 'Obra social', lado: 'aporte', porcentaje: 3 },
  { id: 'co-jub', nombre: 'Jubilación (SIPA)', lado: 'contribucion', porcentaje: 10.77 },
  { id: 'co-pami', nombre: 'PAMI (INSSJP)', lado: 'contribucion', porcentaje: 1.59 },
  { id: 'co-af', nombre: 'Asignaciones familiares', lado: 'contribucion', porcentaje: 4.7 },
  { id: 'co-fne', nombre: 'Fondo Nacional de Empleo', lado: 'contribucion', porcentaje: 0.94 },
  { id: 'co-os', nombre: 'Obra social', lado: 'contribucion', porcentaje: 6 },
  { id: 'co-art', nombre: 'ART', lado: 'contribucion', porcentaje: 0 }
]

/** Cuota sindical típica CCT gráficos 0409/05 (FATIGA/FAIGA), alineada al libro. */
export const CARGAS_SINDICATO_CCT: CargaSocialDef[] = [
  { id: 'ap-sind', nombre: 'Sindicato (convenio)', lado: 'aporte', porcentaje: 2 },
  { id: 'co-sind', nombre: 'Sindicato (convenio)', lado: 'contribucion', porcentaje: 0.75 }
]

/** Convenio por defecto de Plot Center en liquidación / recibos. */
export const CCT_LIQUIDACION_DEFAULT = '0409/05'

function cctEnConvenioLiq(codigo: string | null | undefined): boolean {
  const c = String(codigo || '').trim()
  return c !== '' && c !== '9999/99'
}

/** Cargas según convenio: con sindicato si aplica CCT (ej. 0409/05); sin sindicato si 9999/99. */
export function cargasSocialesSegunConvenio(
  cctCodigo: string | null | undefined = CCT_LIQUIDACION_DEFAULT
): CargaSocialDef[] {
  const base = CARGAS_SOCIALES_BASE_LEY.map((c) => ({ ...c }))
  if (!cctEnConvenioLiq(cctCodigo ?? CCT_LIQUIDACION_DEFAULT)) return base
  const aportes = base.filter((c) => c.lado === 'aporte')
  const contrib = base.filter((c) => c.lado === 'contribucion' && c.id !== 'co-art')
  const art = base.filter((c) => c.id === 'co-art')
  return [
    ...aportes,
    ...CARGAS_SINDICATO_CCT.filter((c) => c.lado === 'aporte').map((c) => ({ ...c })),
    ...contrib,
    ...CARGAS_SINDICATO_CCT.filter((c) => c.lado === 'contribucion').map((c) => ({ ...c })),
    ...art
  ]
}

/** Default de pantalla: ley + convenio gráficos Plot. */
export const CARGAS_SOCIALES_DEFAULT: CargaSocialDef[] = cargasSocialesSegunConvenio(CCT_LIQUIDACION_DEFAULT)

/** True si no hay alícuotas cargadas (todo en 0 salvo ART). */
export function cargasParecenSinConfigurar(cargas: CargaSocialDef[] | null | undefined): boolean {
  if (!Array.isArray(cargas) || cargas.length === 0) return true
  return cargas
    .filter((c) => c.id !== 'co-art')
    .every((c) => !(Number(c.porcentaje) > 0))
}

/** % del sueldo en blanco por cada año cumplido (uso habitual CCT / convenio). */
export const PCT_ANTIGUEDAD_LEGAL_DEFAULT = 1

/** Valor fijo de un día para descontar faltas injustificadas y bloques de tardanzas. */
export const VALOR_DIA_DESCUENTO_DEFAULT = 52232

/** Cada N tardanzas equivalen a 1 día de descuento (solo con el criterio 'bloques'). */
export const TARDANZAS_POR_DIA_DESCUENTO = 3

/**
 * Cómo se descuentan las tardanzas:
 * - 'minutos' (default): solo el tiempo no trabajado, al valor hora de su jornada. Es lo que
 *   permite la LCT (art. 69 prohíbe las multas; art. 131 limita las retenciones).
 * - 'bloques': criterio interno anterior, cada 3 tardanzas = 1 día. No pasa al recibo/libro.
 */
export type CriterioTardanzas = 'minutos' | 'bloques'
export const CRITERIO_TARDANZAS_DEFAULT: CriterioTardanzas = 'minutos'

export function normalizarCriterioTardanzas(raw: unknown): CriterioTardanzas {
  return raw === 'bloques' ? 'bloques' : CRITERIO_TARDANZAS_DEFAULT
}

const LS_KEY = 'rrhh-liquidacion-v1'

type MesGuardado = {
  version?: number
  cargas: CargaSocialDef[]
  montos: Record<string, MontosLiquidacion>
  pctAntiguedadLegal?: number
  valorDiaDescuento?: number
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

/**
 * Normaliza cargas guardadas. Si vienen vacías / todas en 0, precarga ley + convenio.
 * Si hay valores, completa ids faltantes (p. ej. sindicato) desde el template del CCT.
 * Con `respetarCeros` (config v2) un 0 cargado a mano se mantiene; en configs viejas
 * un 0 en un ítem con alícuota de ley se toma como “sin configurar”.
 */
export function normalizarCargas(
  raw: unknown,
  cctCodigo: string | null | undefined = CCT_LIQUIDACION_DEFAULT,
  respetarCeros = false
): CargaSocialDef[] {
  const plantilla = cargasSocialesSegunConvenio(cctCodigo)
  if (!Array.isArray(raw) || raw.length === 0) return plantilla
  if (!respetarCeros && cargasParecenSinConfigurar(raw as CargaSocialDef[])) {
    return plantilla
  }
  const porId = new Map<string, CargaSocialDef>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<CargaSocialDef>
    if (!row.id || (row.lado !== 'aporte' && row.lado !== 'contribucion')) continue
    const pctRaw = typeof row.porcentaje === 'number' ? row.porcentaje : Number(row.porcentaje)
    const pct = Number.isFinite(pctRaw) && pctRaw >= 0 ? round2(pctRaw) : 0
    porId.set(row.id, {
      id: row.id,
      nombre: String(row.nombre || row.id),
      lado: row.lado,
      porcentaje: pct
    })
  }
  return plantilla.map((def) => {
    const saved = porId.get(def.id)
    if (!saved) return { ...def }
    // Config vieja: 0 en un ítem que por ley/convenio tiene alícuota → usar default (salvo ART).
    if (!respetarCeros && def.id !== 'co-art' && !(saved.porcentaje > 0) && def.porcentaje > 0) {
      return { ...def }
    }
    return { ...saved, nombre: saved.nombre || def.nombre }
  })
}

/** Normaliza un registro de montos (BD o localStorage). */
export function normalizarMontos(raw: unknown): MontosLiquidacion {
  const row = raw && typeof raw === 'object' ? (raw as Partial<MontosLiquidacion>) : {}
  const netoRaw = row.netoManual
  let netoManual: number | null = null
  if (netoRaw != null && netoRaw !== ('' as unknown)) {
    const n = typeof netoRaw === 'number' ? netoRaw : Number(netoRaw)
    if (Number.isFinite(n) && n >= 0) netoManual = round2(n)
  }
  const legadoBlanco = num(row.sueldoBlanco)
  const jornadaCompleta = num(row.sueldoJornadaCompleta)
  return {
    precioHora: num(row.precioHora),
    sueldoBase: num(row.sueldoBase),
    sueldoSinDeclarar: num(row.sueldoSinDeclarar),
    netoManual,
    fueraConvenio: row.fueraConvenio === true,
    // Se guarda también el false explícito: pisa lo que diga el legajo.
    ...(typeof row.jornadaParcial === 'boolean' ? { jornadaParcial: row.jornadaParcial } : {}),
    ...(jornadaCompleta > 0 ? { sueldoJornadaCompleta: jornadaCompleta } : {}),
    ...(row.rifl === true ? { rifl: true } : {}),
    // Dato de la columna “En blanco” anterior a oct-2026: se conserva tal cual al guardar.
    ...(legadoBlanco > 0 ? { sueldoBlanco: legadoBlanco } : {})
  }
}

/**
 * Montos que se heredan al abrir un mes nuevo: sueldos, precio y convenio.
 * El neto manual es del mes en que se cargó y NO pasa al siguiente.
 */
export function montosHeredadosMesNuevo(
  origen: Record<string | number, unknown>
): Record<number, MontosLiquidacion> {
  const out: Record<number, MontosLiquidacion> = {}
  for (const [id, row] of Object.entries(origen)) {
    out[Number(id)] = { ...normalizarMontos(row), netoManual: null }
  }
  return out
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

/**
 * % de antigüedad por año. En configs viejas 0 = “sin configurar” (1% de CCT);
 * con `respetarCero` (config v2) un 0 cargado a mano desactiva el adicional.
 */
export function normalizarPctAntiguedad(raw: unknown, respetarCero = false): number {
  if (raw == null || raw === '') return PCT_ANTIGUEDAD_LEGAL_DEFAULT
  const v = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(v) || v < 0) return PCT_ANTIGUEDAD_LEGAL_DEFAULT
  if (v === 0 && !respetarCero) return PCT_ANTIGUEDAD_LEGAL_DEFAULT
  return round2(v)
}

function normalizarValorDia(raw: unknown): number {
  const v = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(v) || v < 0) return VALOR_DIA_DESCUENTO_DEFAULT
  return round2(v)
}

export function cargarMesLiquidacion(mes: string): {
  cargas: CargaSocialDef[]
  montos: Record<number, MontosLiquidacion>
  pctAntiguedadLegal: number
  valorDiaDescuento: number
} {
  const todo = leerTodo()
  const propio = todo[mes]
  const base = propio ?? todo[mesAnterior(mes)]
  const v2 = (base?.version ?? 0) >= CONFIG_LIQUIDACION_VERSION
  const cargas = normalizarCargas(base?.cargas, CCT_LIQUIDACION_DEFAULT, v2)
  const pctAntiguedadLegal = normalizarPctAntiguedad(base?.pctAntiguedadLegal, v2)
  const valorDiaDescuento = normalizarValorDia(
    propio?.valorDiaDescuento ?? base?.valorDiaDescuento ?? VALOR_DIA_DESCUENTO_DEFAULT
  )
  let montos: Record<number, MontosLiquidacion> = {}
  if (propio) {
    for (const [id, row] of Object.entries(propio.montos ?? {})) {
      montos[Number(id)] = normalizarMontos(row)
    }
  } else {
    // Mes nuevo: hereda sueldos del anterior, pero no el neto manual.
    montos = montosHeredadosMesNuevo(base?.montos ?? {})
  }
  if (!propio) {
    todo[mes] = {
      version: CONFIG_LIQUIDACION_VERSION,
      cargas,
      montos: Object.fromEntries(Object.entries(montos).map(([id, m]) => [id, m])),
      pctAntiguedadLegal,
      valorDiaDescuento
    }
    escribirTodo(todo)
  }
  return { cargas, montos, pctAntiguedadLegal, valorDiaDescuento }
}

export function guardarMesLiquidacion(
  mes: string,
  cargas: CargaSocialDef[],
  montos: Record<number, MontosLiquidacion>,
  pctAntiguedadLegal: number = PCT_ANTIGUEDAD_LEGAL_DEFAULT,
  valorDiaDescuento: number = VALOR_DIA_DESCUENTO_DEFAULT
) {
  const todo = leerTodo()
  todo[mes] = {
    version: CONFIG_LIQUIDACION_VERSION,
    cargas: normalizarCargas(cargas, CCT_LIQUIDACION_DEFAULT, true),
    montos: Object.fromEntries(Object.entries(montos).map(([id, m]) => [id, normalizarMontos(m)])),
    pctAntiguedadLegal: normalizarPctAntiguedad(pctAntiguedadLegal, true),
    valorDiaDescuento: normalizarValorDia(valorDiaDescuento)
  }
  escribirTodo(todo)
}

export function remuneracionPactada(m: MontosLiquidacion): number {
  return round2(m.sueldoBase + m.sueldoSinDeclarar)
}

/** Falta injustificada: 1 día × valor día fijo (default $52.232). */
export function descuentoPorFaltas(
  faltas: number,
  valorDia: number = VALOR_DIA_DESCUENTO_DEFAULT
): number {
  if (faltas <= 0 || valorDia <= 0) return 0
  return round2(faltas * valorDia)
}

/**
 * Cada 3 tardanzas = 1 falta (1 día de descuento al valor día fijo).
 * Las tardanzas sueltas (resto) no descuentan hasta completar el bloque.
 */
export function descuentoPorTardanzas(
  tardanzas: number,
  valorDia: number = VALOR_DIA_DESCUENTO_DEFAULT,
  porBloque: number = TARDANZAS_POR_DIA_DESCUENTO
): number {
  if (tardanzas <= 0 || valorDia <= 0 || porBloque <= 0) return 0
  const dias = Math.floor(tardanzas / porBloque)
  if (dias <= 0) return 0
  return round2(dias * valorDia)
}

/** Cantidad de faltas equivalentes por bloques de tardanzas (cada 3 = 1). */
export function diasDescuentoPorTardanzas(
  tardanzas: number,
  porBloque: number = TARDANZAS_POR_DIA_DESCUENTO
): number {
  if (tardanzas <= 0 || porBloque <= 0) return 0
  return Math.floor(tardanzas / porBloque)
}

/**
 * Tardanzas del mes para descuento. La fuente es la estadística de asistencia
 * (misma regla que la pestaña Asistencia): el reloj decide si hay horario esperado
 * y, sin horario, vale la novedad `tardanza`. Se descartan las previas al ingreso
 * y las que caen fuera del período.
 */
export function contarTardanzasParaDescuento(params: {
  stats: Pick<StatsEmpleadoAsistencia, 'tardanzas' | 'minutosTardeTotal' | 'tardanzasDetalle'> | null
  fechaIngreso?: string | null
  fechaDesde: string
  fechaHasta: string
}): { tardanzas: number; minutos: number; fechas: string[] } {
  const st = params.stats
  if (!st) return { tardanzas: 0, minutos: 0, fechas: [] }
  if (!st.tardanzasDetalle) {
    return { tardanzas: st.tardanzas || 0, minutos: st.minutosTardeTotal || 0, fechas: [] }
  }
  const desde = params.fechaDesde.slice(0, 10)
  const hasta = params.fechaHasta.slice(0, 10)
  const ingreso = params.fechaIngreso?.slice(0, 10) || ''
  const validas = st.tardanzasDetalle.filter(
    (t) => t.fecha >= desde && t.fecha <= hasta && (!ingreso || t.fecha >= ingreso)
  )
  return {
    tardanzas: validas.length,
    minutos: validas.reduce((a, t) => a + (t.minutos || 0), 0),
    fechas: validas.map((t) => t.fecha)
  }
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

function esFaltaJustificadaNovedad(n: RrhhNovedad): boolean {
  if (n.grupo === 'licencia' || n.codigo.startsWith('licencia_')) return true
  if (n.codigo.startsWith('falta_justificada')) return true
  return (
    n.codigo === 'falta_justificada_enfermedad' || n.codigo === 'falta_justificada_tramites'
  )
}

function permisoCubreDia(p: SolicitudPermiso, fecha: string): boolean {
  if (p.estado !== 'aprobado') return false
  if (p.tipo_solicitud === 'turno' || p.tipo_solicitud === 'ropa') return false
  const ini = (p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  const fin = (p.fecha_fin || p.fecha_inicio || p.fecha_solicitud || '').slice(0, 10)
  if (!ini) return false
  const hasta = fin || ini
  return fecha >= ini && fecha <= hasta
}

/** Día sin descuento: justificado en asistencia, novedad justificada/licencia o permiso aprobado. */
function esJustificadoDia(
  fecha: string,
  a: Asistencia | undefined,
  novs: RrhhNovedad[],
  permisos: SolicitudPermiso[] = []
): boolean {
  if (a?.tipo_registro === 'justificado') return true
  if (novs.some(esFaltaJustificadaNovedad)) return true
  if (permisos.some((p) => permisoCubreDia(p, fecha))) return true
  return false
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
  /** Valor fijo de un día para faltas y cada 3 tardanzas. */
  valorDiaDescuento?: number
  novedades: RrhhNovedad[]
  permisos: SolicitudPermiso[]
  dias: string[]
  fechaDesde: string
  fechaHasta: string
  asistencia?: Asistencia[]
  horariosPorMes?: Record<string, Record<number, HorarioFijoAsistencia>>
  /** Rotativos / francos / ajustes de turno (misma regla que la pestaña Asistencia). */
  horarioEsperadoCtx?: HorarioEsperadoCtx | null
  /** Tope de aportes, FAL, ART fija, detracción, RIFL (default: los del período). */
  parametrosLegales?: ParametrosLegales
  /** Minutos no trabajados (default) o cada 3 tardanzas = 1 día. */
  criterioTardanzas?: CriterioTardanzas
  /** El legajo dice "medio día": se toma como jornada parcial si no se marcó otra cosa. */
  jornadaParcialLegajo?: boolean
}): LiquidacionEmpleado {
  const periodo = params.fechaHasta.slice(0, 7)
  const fechaIngreso = params.fechaIngreso?.slice(0, 10) || null
  const tieneIngreso = Boolean(fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso))
  const antiguedadMeses = tieneIngreso ? antiguedadMesesAlPeriodo(fechaIngreso, periodo) : null
  const antiguedadAnios = antiguedadMeses != null ? Math.floor(antiguedadMeses / 12) : 0
  const antiguedadLabel = fmtAntiguedad(antiguedadMeses)
  // El valor que llega ya viene normalizado por la pantalla: un 0 es explícito.
  const pctAntiguedadLegal = normalizarPctAntiguedad(
    params.pctAntiguedadLegal ?? PCT_ANTIGUEDAD_LEGAL_DEFAULT,
    true
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
  const fechasJustificadas: string[] = []
  const fechasSuspensiones: string[] = []
  const fechasMediaJornada: string[] = []
  const permisosEmpleado = params.permisos.filter((p) => p.id_usuario === params.id)
  for (const fecha of params.dias) {
    const horario = params.horariosPorMes?.[fecha.slice(0, 7)]?.[params.id] ?? null
    const dia = dowDe(fecha)
    const feriado = nombreFeriado(fecha)
    const marca = marcas.get(fecha)
    const vino = vinoEseDia(marca)
    const horas = horasVino(marca)
    const novs = params.novedades.filter((n) => n.id_usuario === params.id && novedadEnDia(n, fecha))
    const yaIngreso = !fechaIngreso || fecha >= fechaIngreso
    const enSuspension = diaEnSuspension(params.novedades, params.id, fecha)
    const enMediaJornada = diaEnMediaJornadaPostSuspension(params.novedades, params.id, fecha)
    const esFranco =
      horarioEsperadoDesdeCtx(params.id, fecha, horario, params.horarioEsperadoCtx)?.esFranco === true

    if (esDiaLaborableEmpleado(fecha, horario) && !esFranco) {
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
    // Sábado que no trabaja o franco del rotativo: no se debe ni descuenta.
    if ((dia === 6 && horario?.trabajaSabado !== true) || esFranco) {
      diasNoTrabaja += 1
      if (vino) noTrabajaVino += 1
      continue
    }
    diasDebia += 1
    if (enSuspension) {
      fechasSuspensiones.push(fecha)
      continue
    }
    if (enMediaJornada) {
      // Presente o justificado: ½ valor día (jornada reducida). Ausente: falta de 1 día.
      if (vino) {
        fechasMediaJornada.push(fecha)
        diasVino += 1
        continue
      }
      if (fecha > hoy) {
        fechasMediaJornada.push(fecha)
        continue
      }
      if (esJustificadoDia(fecha, marca, novs, permisosEmpleado)) {
        fechasMediaJornada.push(fecha)
        fechasJustificadas.push(fecha)
        continue
      }
      fechasFaltas.push(fecha)
      continue
    }
    if (vino) {
      diasVino += 1
      continue
    }
    if (fecha > hoy) continue
    // Justificadas / licencia / permiso aprobado: NO descuentan del neto.
    if (esJustificadoDia(fecha, marca, novs, permisosEmpleado)) {
      fechasJustificadas.push(fecha)
      continue
    }
    fechasFaltas.push(fecha)
  }
  const faltas = fechasFaltas.length
  const diasSuspension = fechasSuspensiones.length
  const diasMediaJornada = fechasMediaJornada.length
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
  const tard = contarTardanzasParaDescuento({
    stats,
    fechaIngreso,
    fechaDesde: params.fechaDesde,
    fechaHasta: params.fechaHasta
  })
  const tardanzasCount = tard.tardanzas
  const minutosTarde = tard.minutos
  const valorDiaDescuento = normalizarValorDia(
    params.valorDiaDescuento ?? VALOR_DIA_DESCUENTO_DEFAULT
  )
  const criterioTardanzas = normalizarCriterioTardanzas(params.criterioTardanzas)
  const horarioPeriodo = params.horariosPorMes?.[periodo]?.[params.id]
  const horasJornada =
    horarioPeriodo && Number(horarioPeriodo.horas) > 0 ? Number(horarioPeriodo.horas) : HORAS_JORNADA_DEFAULT
  // Falta injustificada = 1 día. Tardanzas: solo los minutos no trabajados (default) o,
  // con el criterio 'bloques', cada 3 tardanzas = 1 falta (mismo valor día).
  const descuentoFaltas = descuentoPorFaltas(faltas, valorDiaDescuento)
  const diasDescTard = criterioTardanzas === 'bloques' ? diasDescuentoPorTardanzas(tardanzasCount) : 0
  const descuentoTardanzas =
    criterioTardanzas === 'bloques'
      ? descuentoPorTardanzas(tardanzasCount, valorDiaDescuento)
      : importeMinutosNoTrabajados(minutosTarde, valorDiaDescuento, horasJornada)
  const faltasEquivalentes = faltas + diasDescTard
  // Suspensión sin goce = 1 valor día. Media jornada post-suspensión = ½ valor día.
  const descuentoSuspensiones = round2(diasSuspension * valorDiaDescuento)
  const descuentoMediaJornada = round2(diasMediaJornada * valorDiaDescuento * 0.5)
  const fueraConvenio = params.montos.fueraConvenio === true
  // Remuneración declarada (la misma que usa el Libro de sueldos): sueldo en blanco
  // proporcional + antigüedad + horas extra − inasistencias / suspensiones sin goce y
  // minutos de tardanza no trabajados, que no son remuneración. El criterio 'bloques'
  // (3 tardanzas = 1 día) es una multa y no pasa al recibo.
  const declarado: RemuneracionDeclaradaInput = {
    minutosTardanza: criterioTardanzas === 'minutos' ? minutosTarde : 0,
    horasJornada,
    sueldoMensual: params.montos.sueldoBase,
    factorProporcional,
    antiguedadAnios,
    pctAntiguedad: pctAntiguedadLegal,
    horasHe50: extra50,
    importeHe50: importeExtra50,
    horasHe100: extra100,
    importeHe100: importeExtra100,
    diasInasistencia: faltas,
    diasSuspension,
    diasMediaJornada
  }
  const baseImponible = remuneracionDeclarada(declarado).remuneracion
  // Jornada parcial: lo marcado en la liquidación; si nunca se marcó, lo del legajo ("medio día").
  const jornadaParcial = params.montos.jornadaParcial ?? params.jornadaParcialLegajo === true
  const jornadaCompletaCargada = params.montos.sueldoJornadaCompleta ?? 0
  // Sin sueldo de jornada completa cargado: se estima como medio día (sueldo × 2).
  const jornadaCompletaEstimada = jornadaParcial && !(jornadaCompletaCargada > 0)
  const legal: EmpleadoLegal = {
    ...EMPLEADO_LEGAL_DEFAULT,
    enConvenio: !fueraConvenio,
    jornadaParcial,
    sueldoJornadaCompleta: jornadaCompletaEstimada
      ? round2(params.montos.sueldoBase * 2)
      : jornadaParcial
        ? jornadaCompletaCargada
        : 0,
    rifl: params.montos.rifl === true
  }
  const calc = calcularCargasLegales({
    periodo,
    remuneracion: baseImponible,
    cargas: params.cargas,
    parametros: params.parametrosLegales ?? parametrosLegalesDefault(periodo),
    empleado: legal
  })
  const aportes = calc.aportes
  const contribuciones = calc.contribuciones
  const totalAportes = round2(aportes.reduce((a, c) => a + c.importe, 0))
  const totalContribuciones = round2(contribuciones.reduce((a, c) => a + c.importe, 0))
  const haberes = round2(remuneracion + importeExtra50 + importeExtra100)
  const descuentosLaborales = round2(
    descuentoFaltas + descuentoTardanzas + descuentoSuspensiones + descuentoMediaJornada
  )
  // Aportes (cargas del empleado) se descuentan del base/haberes → neto a pagar.
  const netoCalculado = round2(haberes - descuentosLaborales - totalAportes)
  const tieneNetoManual = params.montos.netoManual != null
  const neto = tieneNetoManual ? round2(Number(params.montos.netoManual) || 0) : netoCalculado
  const costoEmpresa = round2(haberes - descuentosLaborales + totalContribuciones)

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
    baseOs: calc.baseOs,
    topeAplicado: calc.topeAplicado,
    legal,
    jornadaCompletaEstimada,
    criterioTardanzas,
    horasJornada,
    declarado,
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
    tardanzas: tardanzasCount,
    minutosTarde,
    ausencias: stats?.ausencias ?? 0,
    faltas,
    faltasEquivalentes,
    fechasFaltas,
    fechasJustificadas,
    fechasSuspensiones,
    diasSuspension,
    fechasMediaJornada,
    diasMediaJornada,
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
    diasJustificados: Math.max(stats?.justificados ?? 0, fechasJustificadas.length),
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
    sueldoSinDeclarar: sueldoSinDeclararProporcional,
    fueraConvenio,
    baseImponible,
    importeExtra50,
    importeExtra100,
    descuentoFaltas,
    descuentoTardanzas,
    descuentoSuspensiones,
    descuentoMediaJornada,
    valorDiaDescuento,
    diasDescuentoTardanzas: diasDescTard,
    aportes,
    contribuciones,
    totalAportes,
    totalContribuciones,
    remuneracion,
    haberes,
    netoCalculado,
    neto,
    netoManual: tieneNetoManual,
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
    faltasEquivalentes: filas.reduce((a, f) => a + f.faltasEquivalentes, 0),
    diasDescuentoTardanzas: filas.reduce((a, f) => a + f.diasDescuentoTardanzas, 0),
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
