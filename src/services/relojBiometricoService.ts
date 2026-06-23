import * as XLSX from 'xlsx'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { esUsuarioGenericoRrhh, esUsuarioRrhhExcluido } from '../utils/rrhhUsuariosExcluidos'

// ============================================================
// Importador de reloj biométrico (asistencia) + cálculo de horas
// El reloj exporta un Excel "crudo" (29.xls) con una fila por
// marcación. Este servicio lo normaliza, empareja entrada/salida
// (incluyendo turnos que cruzan medianoche), calcula horas
// trabajadas y horas extra, y permite exportarlo al formato
// "limpio" (RELOJ - MAYO 2026.xls).
// ============================================================

export type TipoMarcacion = 'entrada' | 'salida' | 'falta' | 'otro'

export interface MarcacionReloj {
  idUsuario: string
  nombre: string
  fechaHora: Date
  fechaHoraStr: string
  tipo: TipoMarcacion
  descripcion: string
  departamento: string
}

export type AnomaliaSesion = null | 'sin_salida' | 'sin_entrada' | 'falta' | 'turno_largo'

export interface SesionDia {
  idUsuario: string
  nombre: string
  departamento: string
  dia: string
  fecha: string
  entrada: Date | null
  salida: Date | null
  entradaStr: string
  salidaStr: string
  horasTrabajadas: number
  horasExtra: number
  cruzaMedianoche: boolean
  anomalia: AnomaliaSesion
  observaciones: string
  tarde: boolean
  minutosTarde: number
}

export interface ResumenEmpleado {
  idUsuario: string
  nombre: string
  departamento: string
  sesiones: SesionDia[]
  totalHoras: number
  totalExtra: number
  diasTrabajados: number
  anomalias: number
  diasConEntrada: number
  tardanzas: number
  minutosTardeTotal: number
  puntualidadPct: number
  baselineEntrada: string
}

export interface ConfigCalculo {
  jornadaLunVie: number
  jornadaSab: number
  domingoTodoExtra: boolean
  redondeoExtra: number
  /** Tolerancia en minutos antes de marcar una entrada como tardía. */
  toleranciaTardanzaMin: number
  /** Hora de entrada esperada fija "HH:mm". Si está vacío, se usa el horario habitual de cada empleado. */
  horaEntradaEsperada: string
}

/** Tolerancia fija de tardanza en minutos (no configurable). */
export const TOLERANCIA_TARDANZA_MIN = 15

export const CONFIG_CALCULO_DEFAULT: ConfigCalculo = {
  jornadaLunVie: 9,
  jornadaSab: 5,
  domingoTodoExtra: true,
  redondeoExtra: 0.5,
  toleranciaTardanzaMin: TOLERANCIA_TARDANZA_MIN,
  horaEntradaEsperada: ''
}

/**
 * Horario fijo de un empleado (estándar de días hábiles), usado como
 * referencia para puntualidad (entrada esperada) y horas extra
 * (jornada esperada). Indexado por idUsuario del reloj.
 */
export interface HorarioFijoCalc {
  /** Minutos desde 00:00 de la entrada esperada. null = sin definir. */
  entradaMin: number | null
  /** Horas de jornada esperada (Lun-Sáb). null = usar configuración global. */
  horasJornada: number | null
  /** Si trabaja sábado (Lun-Sáb). false = Lun-Vie (sábado todo extra). */
  trabajaSabado: boolean
}

export type MapaHorariosFijos = Record<string, HorarioFijoCalc>

const DIAS_SEMANA_UP = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------

function quitarAcentos(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarTexto(s: unknown): string {
  return quitarAcentos(String(s ?? '').trim()).toUpperCase()
}

/** Convierte una clave de encabezado a una forma comparable. */
function normKey(s: string): string {
  return quitarAcentos(String(s ?? '').toLowerCase()).replace(/[^a-z0-9]/g, '')
}

/** Parsea un valor de celda a Date, soportando string "YYYY-MM-DD HH:mm:ss" y serial de Excel. */
function parseFechaHora(value: unknown): { date: Date | null; str: string } {
  if (value == null || value === '') return { date: null, str: '' }

  // Serial numérico de Excel
  if (typeof value === 'number') {
    const parsed = XLSX.SSF?.parse_date_code?.(value)
    if (parsed) {
      const d = new Date(parsed.y, (parsed.m || 1) - 1, parsed.d || 1, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0))
      return { date: d, str: formatFechaHora(d) }
    }
  }

  if (value instanceof Date) {
    return { date: value, str: formatFechaHora(value) }
  }

  const raw = String(value).trim()
  // Normalizar separador: "2026-05-02 08:04:28" o "02/05/2026 08:04"
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || '0'))
    return { date: d, str: raw }
  }
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || '0'))
    return { date: d, str: formatFechaHora(d) }
  }
  const fallback = new Date(raw)
  if (!isNaN(fallback.getTime())) return { date: fallback, str: raw }
  return { date: null, str: raw }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatFechaHora(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatHoras(h: number): string {
  if (!h) return '0:00'
  const totalMin = Math.round(h * 60)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${hh}:${pad(mm)}`
}

function diaSemanaUp(d: Date): string {
  return DIAS_SEMANA_UP[d.getDay()]
}

function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function redondear(valor: number, paso: number): number {
  if (!paso || paso <= 0) return Math.round(valor * 100) / 100
  return Math.round(valor / paso) * paso
}

// ------------------------------------------------------------
// Parseo del Excel
// ------------------------------------------------------------

function leerAoa(file: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(file, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false }) as unknown[][]
}

/** Detecta la fila de encabezados y devuelve filas como objetos normalizados por clave. */
function leerFilas(file: ArrayBuffer): Record<string, unknown>[] {
  const aoa = leerAoa(file)
  if (!aoa.length) return []

  // Buscar la fila de encabezado (la que contiene "Nombre" y "Fecha/Hora")
  let headerIdx = 0
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const keys = aoa[i].map((c) => normKey(String(c)))
    if (keys.includes('nombre') && keys.some((k) => k.includes('fechahora') || k === 'fecha')) {
      headerIdx = i
      break
    }
  }
  const headers = aoa[headerIdx].map((c) => normKey(String(c)))
  const rows: Record<string, unknown>[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const arr = aoa[i]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      if (h) obj[h] = arr[idx]
    })
    rows.push(obj)
  }
  return rows
}

function detectarTipo(descripcion: string, tipoRegistro: unknown): TipoMarcacion {
  const desc = normalizarTexto(descripcion)
  if (desc.includes('FALTA') || desc.includes('AUSENT')) return 'falta'
  if (desc.startsWith('ENTRA')) return 'entrada'
  if (desc.startsWith('SALI')) return 'salida'
  const tr = normalizarTexto(String(tipoRegistro ?? ''))
  // Tipo de registro: 0/1 (numérico) o ENTRADA/SALIDA (texto del export del reloj)
  if (tr === '0' || tr === 'ENTRADA' || tr.startsWith('ENTRA')) return 'entrada'
  if (tr === '1' || tr === 'SALIDA' || tr.startsWith('SALI')) return 'salida'
  if (desc) return 'otro'
  return 'otro'
}

export function parsearMarcaciones(file: ArrayBuffer): MarcacionReloj[] {
  const filas = leerFilas(file)
  const marcaciones: MarcacionReloj[] = []

  for (const row of filas) {
    const nombre = String(row['nombre'] ?? '').trim()
    const fechaHoraRaw = row['fechahora'] ?? row['fecha']
    if (!nombre || (fechaHoraRaw == null || fechaHoraRaw === '')) continue

    const { date, str } = parseFechaHora(fechaHoraRaw)
    if (!date) continue

    const descripcion = String(row['descripcion'] ?? '').trim()
    const tipoRegistro = row['tipoderegistro']
    const idUsuario =
      String(row['iddeusuario'] ?? row['usuarionro'] ?? row['codigodeidentificacion'] ?? '').trim() || nombre
    const departamento = String(row['departamento'] ?? '').trim().toUpperCase()

    marcaciones.push({
      idUsuario,
      nombre: nombre.toUpperCase(),
      fechaHora: date,
      fechaHoraStr: str,
      tipo: detectarTipo(descripcion, tipoRegistro),
      descripcion,
      departamento
    })
  }

  return marcaciones
}

// ------------------------------------------------------------
// Emparejado entrada/salida + cálculo de horas
// ------------------------------------------------------------

const MAX_HORAS_SESION = 18

function horasNormales(fecha: Date, config: ConfigCalculo, horarioFijo?: HorarioFijoCalc): number {
  const dow = fecha.getDay()
  // Domingo: todo extra (jornada normal 0) salvo config en contra.
  if (dow === 0) return config.domingoTodoExtra ? 0 : config.jornadaLunVie
  if (dow === 6) {
    // Sábado según el horario fijo del empleado.
    if (horarioFijo) {
      // No trabaja sábado (Lun-Vie) → todo lo trabajado es extra.
      if (!horarioFijo.trabajaSabado) return 0
      // Trabaja sábado (Lun-Sáb) → cuenta su jornada normal.
      if (horarioFijo.horasJornada != null) return horarioFijo.horasJornada
    }
    return config.jornadaSab
  }
  // Lun-Vie: jornada esperada del horario fijo del empleado si está definida.
  if (horarioFijo && horarioFijo.horasJornada != null) return horarioFijo.horasJornada
  return config.jornadaLunVie
}

function calcularExtra(horasTrabajadas: number, normal: number, config: ConfigCalculo): number {
  const bruto = horasTrabajadas - normal
  if (bruto <= 0) return 0
  return Math.max(0, redondear(bruto, config.redondeoExtra))
}

function crearSesion(
  entrada: MarcacionReloj | null,
  salida: MarcacionReloj | null,
  config: ConfigCalculo,
  horarioFijo?: HorarioFijoCalc
): SesionDia {
  const ref = entrada || salida
  const refDate = ref!.fechaHora
  let horasTrabajadas = 0
  let cruzaMedianoche = false
  let anomalia: AnomaliaSesion = null

  if (entrada && salida) {
    const diffMs = salida.fechaHora.getTime() - entrada.fechaHora.getTime()
    horasTrabajadas = diffMs / (1000 * 60 * 60)
    cruzaMedianoche = fechaISO(entrada.fechaHora) !== fechaISO(salida.fechaHora)
    if (horasTrabajadas < 0) {
      horasTrabajadas = 0
      anomalia = 'sin_entrada'
    } else if (horasTrabajadas > MAX_HORAS_SESION) {
      anomalia = 'turno_largo'
    }
  } else if (entrada && !salida) {
    anomalia = 'sin_salida'
  } else if (!entrada && salida) {
    anomalia = 'sin_entrada'
  }

  horasTrabajadas = Math.round(horasTrabajadas * 100) / 100
  const normal = horasNormales(refDate, config, horarioFijo)
  const horasExtra = anomalia ? 0 : calcularExtra(horasTrabajadas, normal, config)

  const observacionesPartes: string[] = []
  if (anomalia === 'sin_salida') observacionesPartes.push('Falta marcar salida')
  if (anomalia === 'sin_entrada') observacionesPartes.push('Falta marcar entrada')
  if (anomalia === 'turno_largo') observacionesPartes.push('Turno > 18h, revisar')

  return {
    idUsuario: ref!.idUsuario,
    nombre: ref!.nombre,
    departamento: ref!.departamento,
    dia: diaSemanaUp(refDate),
    fecha: fechaISO(refDate),
    entrada: entrada ? entrada.fechaHora : null,
    salida: salida ? salida.fechaHora : null,
    entradaStr: entrada ? entrada.fechaHoraStr : '',
    salidaStr: salida ? salida.fechaHoraStr : '',
    horasTrabajadas,
    horasExtra,
    cruzaMedianoche,
    anomalia,
    observaciones: observacionesPartes.join('; '),
    tarde: false,
    minutosTarde: 0
  }
}

function minutosDelDia(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function parseHoraEsperada(hhmm: string): number | null {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function mediana(valores: number[]): number {
  if (!valores.length) return 0
  const ord = [...valores].sort((a, b) => a - b)
  const mid = Math.floor(ord.length / 2)
  return ord.length % 2 ? ord[mid] : Math.round((ord[mid - 1] + ord[mid]) / 2)
}

/** Calcula tardanzas y puntualidad anotando las sesiones in-place. */
function calcularPuntualidad(sesiones: SesionDia[], config: ConfigCalculo, horarioFijo?: HorarioFijoCalc): {
  diasConEntrada: number
  tardanzas: number
  minutosTardeTotal: number
  puntualidadPct: number
  baselineEntrada: string
} {
  const entradas = sesiones
    .filter((s) => s.entrada && !s.anomalia)
    .map((s) => minutosDelDia(s.entrada as Date))

  const esperadaFija = parseHoraEsperada(config.horaEntradaEsperada)
  // Baseline (prioridad): horario fijo del empleado > hora fija global > mediana habitual.
  const baselineMin =
    horarioFijo && horarioFijo.entradaMin != null
      ? horarioFijo.entradaMin
      : esperadaFija != null
        ? esperadaFija
        : mediana(entradas)
  const limite = baselineMin + (config.toleranciaTardanzaMin || 0)

  let diasConEntrada = 0
  let tardanzas = 0
  let minutosTardeTotal = 0

  for (const s of sesiones) {
    if (!s.entrada || s.anomalia) continue
    diasConEntrada++
    const min = minutosDelDia(s.entrada)
    const tarde = min > limite
    s.tarde = tarde
    s.minutosTarde = tarde ? min - baselineMin : 0
    if (tarde) {
      tardanzas++
      minutosTardeTotal += s.minutosTarde
      if (s.observaciones) s.observaciones += `; Tarde ${s.minutosTarde}min`
      else s.observaciones = `Tarde ${s.minutosTarde}min`
    }
  }

  const puntualidadPct = diasConEntrada ? Math.round(((diasConEntrada - tardanzas) / diasConEntrada) * 100) : 0
  const baselineHora = `${pad(Math.floor(baselineMin / 60))}:${pad(baselineMin % 60)}`

  return { diasConEntrada, tardanzas, minutosTardeTotal, puntualidadPct, baselineEntrada: baselineHora }
}

function emparejarEmpleado(marcaciones: MarcacionReloj[], config: ConfigCalculo, horarioFijo?: HorarioFijoCalc): SesionDia[] {
  const ordenadas = [...marcaciones].sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())
  const sesiones: SesionDia[] = []
  let pendienteEntrada: MarcacionReloj | null = null

  for (const m of ordenadas) {
    if (m.tipo === 'falta') {
      sesiones.push({
        idUsuario: m.idUsuario,
        nombre: m.nombre,
        departamento: m.departamento,
        dia: diaSemanaUp(m.fechaHora),
        fecha: fechaISO(m.fechaHora),
        entrada: null,
        salida: null,
        entradaStr: '',
        salidaStr: '',
        horasTrabajadas: 0,
        horasExtra: 0,
        cruzaMedianoche: false,
        anomalia: 'falta',
        observaciones: m.descripcion || 'Falta',
        tarde: false,
        minutosTarde: 0
      })
      continue
    }

    if (m.tipo === 'entrada') {
      if (pendienteEntrada) {
        // Entrada nueva sin salida previa -> cerrar la anterior como incompleta
        sesiones.push(crearSesion(pendienteEntrada, null, config, horarioFijo))
      }
      pendienteEntrada = m
    } else if (m.tipo === 'salida') {
      if (pendienteEntrada) {
        sesiones.push(crearSesion(pendienteEntrada, m, config, horarioFijo))
        pendienteEntrada = null
      } else {
        // Salida sin entrada
        sesiones.push(crearSesion(null, m, config, horarioFijo))
      }
    }
  }

  if (pendienteEntrada) {
    sesiones.push(crearSesion(pendienteEntrada, null, config, horarioFijo))
  }

  return sesiones
}

export function procesarMarcaciones(
  marcaciones: MarcacionReloj[],
  config: ConfigCalculo = CONFIG_CALCULO_DEFAULT,
  horariosFijos: MapaHorariosFijos = {}
): ResumenEmpleado[] {
  const porEmpleado = new Map<string, MarcacionReloj[]>()
  for (const m of marcaciones) {
    const key = m.idUsuario || m.nombre
    if (!porEmpleado.has(key)) porEmpleado.set(key, [])
    porEmpleado.get(key)!.push(m)
  }

  const resumenes: ResumenEmpleado[] = []
  for (const [key, lista] of porEmpleado) {
    const horarioFijo = horariosFijos[key] || horariosFijos[lista[0]?.idUsuario]
    const sesiones = emparejarEmpleado(lista, config, horarioFijo)
    const punt = calcularPuntualidad(sesiones, config, horarioFijo)
    const totalHoras = sesiones.reduce((acc, s) => acc + s.horasTrabajadas, 0)
    const totalExtra = sesiones.reduce((acc, s) => acc + s.horasExtra, 0)
    const diasTrabajados = new Set(sesiones.filter((s) => s.horasTrabajadas > 0).map((s) => s.fecha)).size
    const anomalias = sesiones.filter((s) => s.anomalia).length
    const primero = lista[0]
    resumenes.push({
      idUsuario: primero.idUsuario,
      nombre: primero.nombre,
      departamento: primero.departamento,
      sesiones,
      totalHoras: Math.round(totalHoras * 100) / 100,
      totalExtra: Math.round(totalExtra * 100) / 100,
      diasTrabajados,
      anomalias,
      diasConEntrada: punt.diasConEntrada,
      tardanzas: punt.tardanzas,
      minutosTardeTotal: punt.minutosTardeTotal,
      puntualidadPct: punt.puntualidadPct,
      baselineEntrada: punt.baselineEntrada
    })
  }

  resumenes.sort((a, b) => a.nombre.localeCompare(b.nombre))
  return resumenes
}

function esFormatoPlanillaAsistencia(aoa: unknown[][]): boolean {
  if (!aoa.length) return false
  const headers = aoa[0].map((c) => String(c ?? '').trim())
  const hasEmpleado = headers.some((h) => normKey(h) === 'empleado')
  const fechas = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))
  return hasEmpleado && fechas.length >= 1
}

function horaDesdeCeldaPlanilla(token: string): string {
  const t = String(token ?? '').trim()
  if (!t || t === '—' || t === '–' || t === '-' || /^[-—–\s]+$/.test(t)) return ''
  const m = t.match(/^(\d{1,2}):(\d{2})/)
  return m ? `${pad(Number(m[1]))}:${m[2]}` : ''
}

/** Indica si la celda del día tiene asistencia registrada (marca, ausente u observación). */
export function celdaTieneDatos(c: CeldaDia | undefined): boolean {
  if (!c) return false
  return c.ausente || Boolean(c.entrada) || Boolean(c.salida) || Boolean(c.obs?.trim())
}

/** Conserva solo fechas con al menos un empleado con datos en la planilla. */
export function filtrarDiasConDatosPlanilla(
  planilla: PlanillaEmpleado[],
  candidatos: string[]
): string[] {
  if (!planilla.length || !candidatos.length) return []
  return candidatos.filter((fecha) => planilla.some((emp) => celdaTieneDatos(emp.dias[fecha])))
}

/** Parsea celdas del Excel planilla (Empleado + columnas YYYY-MM-DD). */
export function parsearCeldaPlanillaAsistencia(text: unknown): CeldaDia {
  const raw = String(text ?? '').trim()
  if (!raw) return { entrada: '', salida: '', ausente: false, obs: '' }

  const slashIdx = raw.indexOf('/')
  if (slashIdx > 0) {
    const parteIzq = raw.slice(0, slashIdx).trim()
    const resto = raw.slice(slashIdx + 1)
    const parteDerMatch = resto.match(/^\s*([^\s·(]+)/)
    const parteDer = parteDerMatch ? parteDerMatch[1] : resto.split(/[·(]/)[0].trim()
    const entrada = horaDesdeCeldaPlanilla(parteIzq)
    const salida = horaDesdeCeldaPlanilla(parteDer)
    if (entrada || salida) {
      const obs: string[] = []
      if (raw.includes('(tarde)')) obs.push('Tarde')
      return { entrada, salida, ausente: false, obs: obs.join('; ') }
    }
  }

  if (/\binjustificad/i.test(raw) || /\bausente\b/i.test(raw)) {
    return { entrada: '', salida: '', ausente: true, obs: raw }
  }

  return { entrada: '', salida: '', ausente: false, obs: raw }
}

function parsearPlanillaAsistenciaDesdeAoa(aoa: unknown[][]): { planilla: PlanillaEmpleado[]; dias: string[] } {
  const headers = aoa[0].map((c) => String(c ?? '').trim())
  const idxEmpleado = headers.findIndex((h) => normKey(h) === 'empleado')
  const dias = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h))
  const planilla: PlanillaEmpleado[] = []

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] as unknown[]
    const nombreRaw = String(row[idxEmpleado] ?? '').trim()
    if (!nombreRaw) continue
    const nombre = nombreRaw.toUpperCase()
    const diasMap: Record<string, CeldaDia> = {}
    for (const fecha of dias) {
      const colIdx = headers.indexOf(fecha)
      diasMap[fecha] = parsearCeldaPlanillaAsistencia(colIdx >= 0 ? row[colIdx] : '')
    }
    planilla.push({ idUsuario: nombre, nombre, departamento: '', dias: diasMap })
  }

  const diasConDatos = filtrarDiasConDatosPlanilla(planilla, dias)
  return { planilla, dias: diasConDatos }
}

/** Atajo: archivo -> resúmenes por empleado. */
export function procesarArchivoReloj(
  file: ArrayBuffer,
  config: ConfigCalculo = CONFIG_CALCULO_DEFAULT,
  horariosFijos: MapaHorariosFijos = {}
): {
  marcaciones: MarcacionReloj[]
  resumenes: ResumenEmpleado[]
  planillaDirecta?: PlanillaEmpleado[]
  diasPeriodo?: string[]
} {
  let marcaciones = parsearMarcaciones(file)
  let planillaDirecta: PlanillaEmpleado[] | undefined
  let diasPeriodo: string[] | undefined

  if (!marcaciones.length) {
    const aoa = leerAoa(file)
    if (esFormatoPlanillaAsistencia(aoa)) {
      const parsed = parsearPlanillaAsistenciaDesdeAoa(aoa)
      if (parsed.planilla.length) {
        planillaDirecta = parsed.planilla
        diasPeriodo = parsed.dias
        marcaciones = planillaToMarcaciones(parsed.planilla)
      }
    }
  }

  const resumenes = procesarMarcaciones(marcaciones, config, horariosFijos)
  return { marcaciones, resumenes, planillaDirecta, diasPeriodo }
}

// ------------------------------------------------------------
// Planilla editable (grilla empleados x días)
// ------------------------------------------------------------

export interface CeldaDia {
  entrada: string // 'HH:mm' o ''
  salida: string // 'HH:mm' o ''
  ausente: boolean
  obs: string
}

export interface PlanillaEmpleado {
  idUsuario: string
  nombre: string
  departamento: string
  dias: Record<string, CeldaDia>
}

function horaHHmm(fechaHoraStr: string): string {
  // "YYYY-MM-DD HH:mm:ss" -> "HH:mm"
  const m = String(fechaHoraStr || '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${pad(Number(m[1]))}:${m[2]}` : ''
}

/** Lista de fechas (ISO) entre la primera y la última marcación, inclusive. */
export function diasDelPeriodo(marcaciones: MarcacionReloj[]): string[] {
  if (!marcaciones.length) return []
  const times = marcaciones.map((m) => m.fechaHora.getTime())
  const min = new Date(Math.min(...times))
  const max = new Date(Math.max(...times))
  const dias: string[] = []
  const cur = new Date(min.getFullYear(), min.getMonth(), min.getDate())
  const fin = new Date(max.getFullYear(), max.getMonth(), max.getDate())
  while (cur <= fin) {
    dias.push(fechaISO(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dias
}

/** Construye la planilla editable a partir de los resúmenes ya calculados. */
export function construirPlanilla(resumenes: ResumenEmpleado[]): PlanillaEmpleado[] {
  return resumenes.map((emp) => {
    const dias: Record<string, CeldaDia> = {}
    for (const s of emp.sesiones) {
      const prev = dias[s.fecha]
      const entrada = horaHHmm(s.entradaStr)
      const salida = horaHHmm(s.salidaStr)
      if (prev) {
        // Combinar sesiones del mismo día: primera entrada, última salida.
        if (entrada && (!prev.entrada || entrada < prev.entrada)) prev.entrada = entrada
        if (salida && (!prev.salida || salida > prev.salida)) prev.salida = salida
        prev.ausente = prev.ausente && s.anomalia === 'falta'
      } else {
        dias[s.fecha] = {
          entrada,
          salida,
          ausente: s.anomalia === 'falta',
          obs: s.anomalia === 'falta' ? s.observaciones : ''
        }
      }
    }
    return {
      idUsuario: emp.idUsuario,
      nombre: emp.nombre,
      departamento: emp.departamento,
      dias
    }
  })
}

/** Convierte la planilla editable de vuelta a marcaciones para recalcular con el motor. */
export function planillaToMarcaciones(planilla: PlanillaEmpleado[]): MarcacionReloj[] {
  const marcaciones: MarcacionReloj[] = []
  for (const emp of planilla) {
    for (const [fecha, celda] of Object.entries(emp.dias)) {
      const [y, mo, d] = fecha.split('-').map(Number)
      if (celda.ausente) {
        const fhFalta = new Date(y, mo - 1, d, 0, 0, 0)
        marcaciones.push({
          idUsuario: emp.idUsuario,
          nombre: emp.nombre,
          fechaHora: fhFalta,
          fechaHoraStr: `${fecha} 00:00:00`,
          tipo: 'falta',
          descripcion: 'FALTA INJUSTIFICADA',
          departamento: emp.departamento
        })
        continue
      }
      const mkEntrada = (hhmm: string): Date | null => {
        const mm = hhmm.match(/^(\d{1,2}):(\d{2})$/)
        if (!mm) return null
        return new Date(y, mo - 1, d, Number(mm[1]), Number(mm[2]), 0)
      }
      const entradaDate = celda.entrada ? mkEntrada(celda.entrada) : null
      let salidaDate = celda.salida ? mkEntrada(celda.salida) : null
      // Si la salida es menor o igual a la entrada, cruza la medianoche.
      if (entradaDate && salidaDate && salidaDate <= entradaDate) {
        salidaDate = new Date(salidaDate.getTime() + 24 * 60 * 60 * 1000)
      }
      if (entradaDate) {
        marcaciones.push({
          idUsuario: emp.idUsuario,
          nombre: emp.nombre,
          fechaHora: entradaDate,
          fechaHoraStr: formatFechaHora(entradaDate),
          tipo: 'entrada',
          descripcion: 'ENTRADA',
          departamento: emp.departamento
        })
      }
      if (salidaDate) {
        marcaciones.push({
          idUsuario: emp.idUsuario,
          nombre: emp.nombre,
          fechaHora: salidaDate,
          fechaHoraStr: formatFechaHora(salidaDate),
          tipo: 'salida',
          descripcion: 'SALIDA',
          departamento: emp.departamento
        })
      }
    }
  }
  return marcaciones
}

// ------------------------------------------------------------
// Importador de horarios reales (planilla "PERSONAL ACTUAL")
// Columnas: COLABORADORES | JORNADA SEMANAL | PUESTO | HORARIO | CANTIDAD DE HS
// ------------------------------------------------------------

export interface HorarioRealRow {
  nombre: string
  jornadaSemanal: string
  puesto: string
  horarioTexto: string
  horasDia: number | null
  /** Entrada estándar de días hábiles 'HH:mm' (vacío si no se pudo derivar). */
  entrada: string
  /** Salida estándar de días hábiles 'HH:mm' (vacío si no se pudo derivar). */
  salida: string
  /** Si el empleado trabaja sábado (deducido de la jornada semanal / horario). */
  trabajaSabado: boolean
}

/** Deduce si la jornada incluye el sábado a partir del texto del Excel. */
function detectarTrabajaSabado(jornadaSemanal: string, horarioTexto: string): boolean {
  const t = `${jornadaSemanal} ${horarioTexto}`.toLowerCase()
  // Menciona el sábado explícitamente como día trabajado.
  if (/s[aá]b/.test(t)) return true
  // "lunes a viernes" / "lun a vie" → no trabaja sábado.
  if (/vier|vie\b/.test(t) && !/s[aá]b/.test(t)) return false
  return true
}

function minToHHmm(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/**
 * Extrae el rango de entrada/salida de días hábiles del texto de horario.
 * Ej: "09 a 18:00 - Sabado 09.00 a 14.00" → { entrada:'09:00', salida:'18:00' }
 * Ignora la parte de "Sabado/Jornada/Turnos" (el modelo fijo es único Lun-Vie).
 */
export function parseRangoHorario(texto: string): { entrada: string; salida: string } {
  const base = String(texto || '').split(/sabado|sábado|jornada|turno/i)[0]
  const times: number[] = []
  for (const m of base.matchAll(/(\d{1,2})(?:[:.](\d{2}))?/g)) {
    const h = Number(m[1])
    const mi = m[2] != null ? Number(m[2]) : 0
    if (h <= 23 && mi <= 59) times.push(h * 60 + mi)
  }
  if (times.length >= 2 && times[1] > times[0]) {
    return { entrada: minToHHmm(times[0]), salida: minToHHmm(times[1]) }
  }
  return { entrada: '', salida: '' }
}

export function parsearHorariosReales(file: ArrayBuffer): HorarioRealRow[] {
  const wb = XLSX.read(file, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false }) as unknown[][]
  if (!aoa.length) return []

  // Detectar fila de encabezado (contiene "COLABORADORES" y "HORARIO").
  let headerIdx = 0
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const keys = aoa[i].map((c) => normKey(String(c)))
    if (keys.some((k) => k.includes('colaborador')) && keys.some((k) => k.includes('horario'))) {
      headerIdx = i
      break
    }
  }
  const headers = aoa[headerIdx].map((c) => normKey(String(c)))
  const idx = (pred: (k: string) => boolean) => headers.findIndex(pred)
  const colNombre = idx((k) => k.includes('colaborador'))
  const colJornada = idx((k) => k.includes('jornada'))
  const colPuesto = idx((k) => k.includes('puesto'))
  const colHorario = idx((k) => k === 'horario' || (k.includes('horario') && !k.includes('cantidad')))
  const colHoras = idx((k) => k.includes('cantidad'))

  const rows: HorarioRealRow[] = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const arr = aoa[i]
    const nombre = String(arr[colNombre] ?? '').trim().toUpperCase()
    if (!nombre) continue
    const horarioTexto = String(arr[colHorario] ?? '').trim()
    const horasRaw = arr[colHoras]
    const horasDia = horasRaw === '' || horasRaw == null ? null : Number(horasRaw) || null
    const { entrada, salida } = parseRangoHorario(horarioTexto)
    const jornadaSemanal = String(arr[colJornada] ?? '').trim().toUpperCase()
    rows.push({
      nombre,
      jornadaSemanal,
      puesto: String(arr[colPuesto] ?? '').trim().toUpperCase(),
      horarioTexto,
      horasDia,
      entrada,
      salida,
      trabajaSabado: detectarTrabajaSabado(jornadaSemanal, horarioTexto)
    })
  }
  return rows
}

// ------------------------------------------------------------
// Matcheo con usuarios de Plot Lab (por nombre, sin importar orden)
// ------------------------------------------------------------

/** Solo letras (sin acentos, en minúscula). */
function soloLetras(s: string): string {
  return quitarAcentos(String(s || '').toLowerCase()).replace(/[^a-z]/g, '')
}

/** Parte local del login/email (antes de la @), solo letras. */
function loginLocal(nombre: string): string {
  const base = String(nombre || '').split('@')[0]
  return soloLetras(base)
}

function tokensReloj(nombre: string): string[] {
  return quitarAcentos(String(nombre || '').toLowerCase())
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter((t) => t.length >= 2)
}

const PLOTCENTER_EMAIL_DOMAIN = 'plotcenter.com.ar'

/** Login corporativo: inicial(nombre) + apellido → "rtabera" desde "Rosa Tabera". */
function loginDesdeNombreDisplay(nombre: string): string | null {
  const tokens = tokensReloj(nombre)
  if (tokens.length < 2 || nombre.includes('@')) return null
  const candidatos = candidatosLoginDesdeTokens(tokens)
  // Preferir el más corto (suele ser inicial+apellido, no apellido completo solo).
  const ordenados = [...candidatos].filter((c) => c.length >= 4 && c.length <= 12).sort((a, b) => a.length - b.length)
  return ordenados[0] ?? null
}

/** Genera logins tipo achavez, rtabera, jalvarado, esanti a partir de tokens del nombre. */
function candidatosLoginDesdeTokens(tokens: string[]): Set<string> {
  const out = new Set<string>()
  for (const t of tokens) {
    if (t.length >= 3) out.add(t)
  }
  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < tokens.length; j++) {
      if (i === j) continue
      const ini = tokens[i][0]
      const dest = tokens[j]
      if (!ini || dest.length < 3) continue
      out.add(ini + dest)
      if (dest.length > 6) out.add(ini + dest.slice(0, 5))
    }
  }
  return out
}

/** Email inferido @plotcenter.com.ar para matcheo cuando el usuario no trae email explícito. */
export function inferirEmailPlotcenter(nombre: string): string | null {
  const local = loginDesdeNombreDisplay(nombre)
  return local ? `${local}@${PLOTCENTER_EMAIL_DOMAIN}` : null
}

/** Logins posibles según lo que exporta el reloj (email o APELLIDO NOMBRE). */
function localesReloj(nombreReloj: string): Set<string> {
  const out = new Set<string>()
  const raw = String(nombreReloj || '').trim()
  if (!raw) return out

  if (raw.includes('@')) {
    const l = loginLocal(raw)
    if (l) out.add(l)
    return out
  }

  const tokens = tokensReloj(raw)
  for (const c of candidatosLoginDesdeTokens(tokens)) out.add(c)
  return out
}

/** Logins posibles del usuario Plot Lab (email, nombre o inferido). */
function localesUsuario(identidad: string): Set<string> {
  const out = new Set<string>()
  const raw = String(identidad || '').trim()
  if (!raw) return out
  const l = loginLocal(raw)
  if (l) out.add(l)
  if (!raw.includes('@')) {
    const inf = loginDesdeNombreDisplay(raw)
    if (inf) out.add(inf)
    for (const c of candidatosLoginDesdeTokens(tokensReloj(raw))) {
      if (c.length >= 4 && c.length <= 12) out.add(c)
    }
  }
  return out
}

function identidadesUsuarioMatch(u: UsuarioRelojMatch): string[] {
  const ids = [u.nombre]
  if (u.email) ids.push(u.email)
  if (u.legajoNombre && u.legajoApellido) {
    const nom = u.legajoNombre.trim()
    const ape = u.legajoApellido.trim()
    ids.push(`${nom} ${ape}`)
    ids.push(`${ape} ${nom}`)
    const n = nom.toLowerCase()
    const a = ape.toLowerCase()
    if (n && a) {
      ids.push(`${n[0]}${a}`)
      ids.push(`${a[0]}${n}`)
    }
    for (const c of candidatosLoginDesdeTokens(tokensReloj(`${ape} ${nom}`))) {
      if (c.length >= 4 && c.length <= 14) ids.push(c)
    }
    for (const c of candidatosLoginDesdeTokens(tokensReloj(`${nom} ${ape}`))) {
      if (c.length >= 4 && c.length <= 14) ids.push(c)
    }
  }
  const inf = inferirEmailPlotcenter(u.nombre)
  if (inf) ids.push(inf)
  return ids
}

function puntajeUsuarioReloj(nombreReloj: string, u: UsuarioRelojMatch): number {
  let score = 0
  for (const id of identidadesUsuarioMatch(u)) {
    score = Math.max(score, puntajeMatch(nombreReloj, id))
  }
  return score
}

/** Longitud de la subcadena común más larga (tolera prefijos y typos menores). */
function lcsLongitud(a: string, b: string): number {
  if (!a || !b) return 0
  let best = 0
  const dp = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    let prev = 0
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev + 1
        if (dp[j] > best) best = dp[j]
      } else {
        dp[j] = 0
      }
      prev = tmp
    }
  }
  return best
}

/** Distancia de Damerau-Levenshtein (cuenta transposiciones como 1). */
function damerauLevenshtein(a: string, b: string): number {
  const al = a.length
  const bl = b.length
  if (!al) return bl
  if (!bl) return al
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0))
  for (let i = 0; i <= al; i++) d[i][0] = i
  for (let j = 0; j <= bl; j++) d[0][j] = j
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[al][bl]
}

/**
 * Puntaje de coincidencia entre el nombre del reloj (ej. "TABERA ROSA MARIA" o
 * "rtabera@plotcenter.com.ar") y el usuario Plot Lab (login/email o nombre).
 */
export function puntajeMatch(nombreReloj: string, nombreUsuario: string): number {
  const relojLocales = localesReloj(nombreReloj)
  const userLocales = localesUsuario(nombreUsuario)
  if (!relojLocales.size || !userLocales.size) return 0

  for (const r of relojLocales) {
    for (const u of userLocales) {
      if (r === u) return 25
      if (r.length >= 4 && u.length >= 4 && (r.includes(u) || u.includes(r))) return 18
      if (r.length >= 5 && u.length >= 5) {
        const dist = damerauLevenshtein(r, u)
        if (dist === 1) return 20
        if (dist === 2) return 12
      }
    }
  }

  const local = [...userLocales][0]
  const tokens = [...relojLocales]
  if (!local || !tokens.length) return 0

  let mejorToken = 0
  for (const t of tokens) {
    if (t.length < 3) continue
    if (local.includes(t) || t.includes(local)) {
      mejorToken = Math.max(mejorToken, Math.min(t.length, local.length) * 2)
    } else {
      const lcs = lcsLongitud(local, t)
      if (lcs >= 4) mejorToken = Math.max(mejorToken, lcs)
    }
  }

  const inicialBonus = tokens.some((t) => t[0] === local[0]) ? 3 : 0
  const scoreContencion = mejorToken + (mejorToken > 0 ? inicialBonus : 0)

  let mejorFuzzy = 0
  for (const r of relojLocales) {
    for (const u of userLocales) {
      if (Math.abs(r.length - u.length) > 2) continue
      const dist = damerauLevenshtein(r, u)
      const score = dist === 0 ? 25 : dist === 1 ? 20 : dist === 2 ? 12 : 0
      if (score > mejorFuzzy) mejorFuzzy = score
    }
  }

  return Math.max(scoreContencion, mejorFuzzy)
}

export type UsuarioRelojMatch = {
  id: number
  nombre: string
  email?: string | null
  legajoNombre?: string | null
  legajoApellido?: string | null
}

export function matchearUsuario(
  nombreReloj: string,
  usuarios: UsuarioRelojMatch[]
): { id: number; nombre: string } | null {
  let mejor: { id: number; nombre: string } | null = null
  let mejorScore = 0
  for (const u of usuarios) {
    if (esUsuarioRrhhExcluido(u)) continue
    const score = puntajeUsuarioReloj(nombreReloj, u)
    if (score > mejorScore) {
      mejorScore = score
      mejor = u
    }
  }
  return mejorScore >= 6 ? mejor : null
}

/**
 * Asigna empleados del reloj a usuarios Plot Lab sin repetir el mismo usuario
 * (evita que dos BARBETTA compitan por el mismo login).
 */
export function matchearUsuariosReloj(
  empleados: Array<{ idUsuario: string; nombre: string }>,
  usuarios: UsuarioRelojMatch[],
  override: Record<string, number> = {}
): Record<string, { id: number; nombre: string }> {
  const operarios = usuarios.filter((u) => !esUsuarioRrhhExcluido(u))
  const resultado: Record<string, { id: number; nombre: string }> = {}

  for (const emp of empleados) {
    if (emp.idUsuario in override) {
      const u = operarios.find((x) => x.id === override[emp.idUsuario])
      resultado[emp.idUsuario] = u ? { id: u.id, nombre: u.nombre } : { id: 0, nombre: '' }
    }
  }

  const candidatos: Array<{ key: string; usuario: UsuarioRelojMatch; score: number }> = []
  for (const emp of empleados) {
    if (emp.idUsuario in resultado) continue
    for (const u of operarios) {
      const score = puntajeUsuarioReloj(emp.nombre, u)
      if (score >= 6) candidatos.push({ key: emp.idUsuario, usuario: u, score })
    }
  }
  candidatos.sort((a, b) => b.score - a.score)

  const usuariosUsados = new Set(
    Object.values(resultado)
      .map((v) => v.id)
      .filter((id) => id > 0)
  )

  for (const c of candidatos) {
    if (c.key in resultado) continue
    if (usuariosUsados.has(c.usuario.id)) continue
    resultado[c.key] = { id: c.usuario.id, nombre: c.usuario.nombre }
    usuariosUsados.add(c.usuario.id)
  }

  for (const emp of empleados) {
    if (!(emp.idUsuario in resultado)) resultado[emp.idUsuario] = { id: 0, nombre: '' }
  }
  return resultado
}

/**
 * Construye el mapa de horarios fijos por idUsuario del reloj a partir de
 * los vínculos (relojId → usuario Plot Lab) y los horarios fijos guardados
 * por id de usuario de Plot Lab ({ entrada: 'HH:mm', salida: 'HH:mm' }).
 */
export function construirMapaHorariosFijos(
  vinculacion: Record<string, { id: number } | undefined>,
  horariosPorUsuario: Record<number, { entrada: string; salida: string; horas?: number | null; trabajaSabado?: boolean }>
): MapaHorariosFijos {
  const mapa: MapaHorariosFijos = {}
  for (const [relojId, v] of Object.entries(vinculacion)) {
    if (!v?.id) continue
    const h = horariosPorUsuario[v.id]
    if (!h || !h.entrada) continue
    const entradaMin = parseHoraEsperada(h.entrada)
    let horasJornada: number | null = null
    // Jornada esperada: la horas guardada manualmente tiene prioridad; si no,
    // se deriva del rango entrada→salida.
    if (h.horas != null) {
      horasJornada = h.horas
    } else {
      const salidaMin = parseHoraEsperada(h.salida)
      if (entradaMin != null && salidaMin != null) {
        let diff = salidaMin - entradaMin
        if (diff <= 0) diff += 24 * 60
        horasJornada = Math.round((diff / 60) * 100) / 100
      }
    }
    mapa[relojId] = { entradaMin, horasJornada, trabajaSabado: h.trabajaSabado !== false }
  }
  return mapa
}

// ------------------------------------------------------------
// Construcción de registros para guardar en la asistencia de Plot Lab
// ------------------------------------------------------------

export interface RegistroAsistenciaBD {
  id_usuario: number
  fecha: string
  hora_entrada: string | null
  hora_salida: string | null
  horas_trabajadas: number | null
  tipo_registro: 'normal' | 'tarde' | 'ausente' | 'justificado'
  observaciones: string | null
}

export interface ResultadoVinculacion {
  registros: RegistroAsistenciaBD[]
  vinculados: Array<{ nombre: string; plotLab: string }>
  noVinculados: string[]
}

/**
 * Construye los registros para guardar en BD.
 * `vinculacion` mapea idUsuario del reloj → { id, nombre } del usuario de Plot Lab.
 * Los empleados sin entrada en el mapa (o con id 0) se omiten.
 */
export function construirRegistrosAsistencia(
  resumenes: ResumenEmpleado[],
  vinculacion: Record<string, { id: number; nombre: string }>
): ResultadoVinculacion {
  const registros: RegistroAsistenciaBD[] = []
  const vinculados: Array<{ nombre: string; plotLab: string }> = []
  const noVinculados: string[] = []

  for (const emp of resumenes) {
    const match = vinculacion[emp.idUsuario]
    if (!match || !match.id) {
      noVinculados.push(emp.nombre)
      continue
    }
    if (esUsuarioGenericoRrhh(match.nombre)) continue
    vinculados.push({ nombre: emp.nombre, plotLab: match.nombre })

    // Agrupar por fecha (la tabla tiene UNIQUE(id_usuario, fecha))
    const porFecha = new Map<string, SesionDia[]>()
    for (const s of emp.sesiones) {
      if (!porFecha.has(s.fecha)) porFecha.set(s.fecha, [])
      porFecha.get(s.fecha)!.push(s)
    }

    for (const [fecha, sesiones] of porFecha) {
      const esFalta = sesiones.every((s) => s.anomalia === 'falta')
      const conEntrada = sesiones.filter((s) => s.entrada)
      const conSalida = sesiones.filter((s) => s.salida)
      const horas = sesiones.reduce((acc, s) => acc + s.horasTrabajadas, 0)
      const tarde = sesiones.some((s) => s.tarde)
      const obs = sesiones.map((s) => s.observaciones).filter(Boolean).join('; ')

      const entradaMin = conEntrada.length
        ? conEntrada.reduce((a, s) => (a.entrada! < s.entrada! ? a : s)).entradaStr
        : null
      const salidaMax = conSalida.length
        ? conSalida.reduce((a, s) => (a.salida! > s.salida! ? a : s)).salidaStr
        : null

      registros.push({
        id_usuario: match.id,
        fecha,
        hora_entrada: entradaMin,
        hora_salida: salidaMax,
        horas_trabajadas: esFalta ? 0 : Math.round(horas * 100) / 100,
        tipo_registro: esFalta ? 'ausente' : tarde ? 'tarde' : 'normal',
        observaciones: obs || null
      })
    }
  }

  return { registros, vinculados, noVinculados }
}

export interface TardanzaEmpleado {
  id_usuario: number
  nombrePlotLab: string
  nombreReloj: string
  fecha: string
  minutos: number
  entrada: string
  baseline: string
}

/** Extrae las tardanzas de empleados vinculados, para registrar como novedades de legajo. */
export function construirTardanzas(
  resumenes: ResumenEmpleado[],
  vinculacion: Record<string, { id: number; nombre: string }>
): TardanzaEmpleado[] {
  const tardanzas: TardanzaEmpleado[] = []
  for (const emp of resumenes) {
    const match = vinculacion[emp.idUsuario]
    if (!match || !match.id || esUsuarioGenericoRrhh(match.nombre)) continue
    for (const s of emp.sesiones) {
      if (!s.tarde || s.minutosTarde <= 0) continue
      tardanzas.push({
        id_usuario: match.id,
        nombrePlotLab: match.nombre,
        nombreReloj: emp.nombre,
        fecha: s.fecha,
        minutos: s.minutosTarde,
        entrada: s.entradaStr ? s.entradaStr.slice(11, 16) : '',
        baseline: emp.baselineEntrada
      })
    }
  }
  return tardanzas
}

// ------------------------------------------------------------
// Export al formato "limpio" (como RELOJ - MAYO 2026.xls)
// ------------------------------------------------------------

interface FilaExport {
  DIA: string
  Nombre: string
  'Fecha/Hora': string
  'Descripción': string
  Departamento: string
  'Hs Extras': number | string
  Observaciones: string
}

export function construirFilasExport(resumenes: ResumenEmpleado[]): FilaExport[] {
  const filas: FilaExport[] = []
  for (const emp of resumenes) {
    for (const s of emp.sesiones) {
      if (s.anomalia === 'falta') {
        filas.push({
          DIA: s.dia,
          Nombre: emp.nombre,
          'Fecha/Hora': `${s.fecha} 00:00:00`,
          'Descripción': 'FALTA INJUSTIFICADA',
          Departamento: s.departamento,
          'Hs Extras': '',
          Observaciones: s.observaciones
        })
        continue
      }
      if (s.entradaStr) {
        filas.push({
          DIA: s.dia,
          Nombre: emp.nombre,
          'Fecha/Hora': s.entradaStr,
          'Descripción': 'ENTRADA',
          Departamento: s.departamento,
          'Hs Extras': '',
          Observaciones: ''
        })
      }
      if (s.salidaStr) {
        filas.push({
          DIA: s.dia,
          Nombre: emp.nombre,
          'Fecha/Hora': s.salidaStr,
          'Descripción': 'SALIDA',
          Departamento: s.departamento,
          'Hs Extras': s.horasExtra > 0 ? s.horasExtra : '',
          Observaciones: s.observaciones
        })
      }
    }
  }
  return filas
}

export function exportarRelojXlsx(resumenes: ResumenEmpleado[], filename?: string): void {
  const filas = construirFilasExport(resumenes)
  const ws = XLSX.utils.json_to_sheet(filas, {
    header: ['DIA', 'Nombre', 'Fecha/Hora', 'Descripción', 'Departamento', 'Hs Extras', 'Observaciones']
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia')
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, filename || `asistencia-reloj-${fecha}.xlsx`)
}

// ------------------------------------------------------------
// Informe con IA (opcional)
// ------------------------------------------------------------

export async function generarInformeAsistenciaIa(
  resumenes: ResumenEmpleado[],
  periodo: string,
  config: ConfigCalculo
): Promise<string> {
  const empleados = resumenes.map((e) => ({
    nombre: e.nombre,
    departamento: e.departamento,
    totalHoras: e.totalHoras,
    totalExtra: e.totalExtra,
    diasTrabajados: e.diasTrabajados,
    anomalias: e.anomalias,
    sesionesAnomalas: e.sesiones
      .filter((s) => s.anomalia)
      .map((s) => ({
        fecha: s.fecha,
        dia: s.dia,
        entrada: s.entradaStr,
        salida: s.salidaStr,
        horas: s.horasTrabajadas,
        extra: s.horasExtra,
        anomalia: s.anomalia
      }))
  }))

  const resp = await plotLabFetch('/api/plotai/asistencia-reloj', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empleados,
      periodo,
      config: {
        jornadaLunVie: config.jornadaLunVie,
        jornadaSab: config.jornadaSab,
        domingoTodoExtra: config.domingoTodoExtra
      }
    })
  })

  const json = (await resp.json().catch(() => ({}))) as { informe?: string; error?: string }
  if (!resp.ok) {
    throw new Error(json.error || 'No se pudo generar el informe con IA.')
  }
  const informe = (json.informe || '').trim()
  if (!informe) throw new Error('La IA no devolvió contenido.')
  return informe
}

export function exportarResumenXlsx(resumenes: ResumenEmpleado[], filename?: string): void {
  const filas = resumenes.map((e) => ({
    Empleado: e.nombre,
    Departamento: e.departamento,
    'Días trabajados': e.diasTrabajados,
    'Horas totales': Math.round(e.totalHoras * 100) / 100,
    'Horas extra': Math.round(e.totalExtra * 100) / 100,
    'Anomalías': e.anomalias
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen')
  const fecha = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, filename || `resumen-asistencia-${fecha}.xlsx`)
}
