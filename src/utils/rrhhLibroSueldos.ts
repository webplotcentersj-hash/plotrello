import { numeroALetras } from './crmExportUtils'
import {
  EMPLEADO_LEGAL_DEFAULT,
  NOMBRE_LEGAL_CARGA,
  calcularCargasLegales,
  normalizarEmpleadoLegal,
  normalizarParametrosLegales,
  parametrosLegalesDefault,
  remuneracionDeclarada,
  type CargaSocialDef,
  type CodigoConceptoDeclarado,
  type EmpleadoLegal,
  type ItemCarga,
  type LegalLibro,
  type SnapshotLibroEmpleado
} from './rrhhCargasLegales'

/** Alícuotas del modelo Plot Center (recibo LCT mensual). */
export const ALICUOTAS_LCT_DEFAULT = {
  sipaEmpleador: 0.1077,
  inssjpEmpleador: 0.0159,
  osEmpleador: 0.06,
  asignaciones: 0.047,
  fne: 0.0094,
  sindicatoEmpleador: 0.0075,
  sindicatoTrabajador: 0.02,
  jubilacion: 0.11,
  inssjpTrabajador: 0.03,
  osTrabajador: 0.03
} as const

export type AlicuotasLct = { [K in keyof typeof ALICUOTAS_LCT_DEFAULT]: number }

export const ALICUOTA_CAMPOS: Array<{ key: keyof AlicuotasLct; label: string; grupo: 'empleador' | 'trabajador' }> = [
  { key: 'sipaEmpleador', label: 'SIPA empleador', grupo: 'empleador' },
  { key: 'inssjpEmpleador', label: 'INSSJP empleador', grupo: 'empleador' },
  { key: 'osEmpleador', label: 'Obra social empleador', grupo: 'empleador' },
  { key: 'asignaciones', label: 'Asignaciones familiares', grupo: 'empleador' },
  { key: 'fne', label: 'Fondo Nac. de Empleo', grupo: 'empleador' },
  { key: 'sindicatoEmpleador', label: 'Sindicato empleador', grupo: 'empleador' },
  { key: 'sindicatoTrabajador', label: 'Sindicato trabajador', grupo: 'trabajador' },
  { key: 'jubilacion', label: 'Jubilación Ley 24.241', grupo: 'trabajador' },
  { key: 'inssjpTrabajador', label: 'INSSJP trabajador', grupo: 'trabajador' },
  { key: 'osTrabajador', label: 'Obra social trabajador', grupo: 'trabajador' }
]

export type ReciboExtra = {
  id: string
  concepto: string
  tipo: 'remunerativo' | 'no_remunerativo' | 'descuento' | 'empleador'
  unidad: string
  base: number | null
  monto: number
  codigo_lsd: string
  /** Cantidad para el LSD (horas, días). */
  cantidad?: number
  /** 'liq' = lo generó la Liquidación mensual (se reemplaza al sincronizar). */
  origen?: 'liq'
}

export function extraVacio(): ReciboExtra {
  return {
    id: `x-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    concepto: '',
    tipo: 'remunerativo',
    unidad: '',
    base: null,
    monto: 0,
    codigo_lsd: ''
  }
}

/** Si Unidad trae "22%", se interpreta como alícuota (0.22). */
export function parseUnidadPorcentaje(unidad: string | null | undefined): number | null {
  const s = String(unidad || '').trim()
  if (!s.includes('%')) return null
  const n = Number(s.replace(/%/g, '').replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n === 0) return null
  return n / 100
}

/**
 * Monto efectivo del concepto extra: usa `monto` si > 0;
 * si no, calcula base × % cuando Unidad es p. ej. "22%".
 */
export function montoExtraEfectivo(
  x: Pick<ReciboExtra, 'monto' | 'unidad' | 'base'>,
  baseDefault: number
): { monto: number; base: number | null; pct: number | null } {
  const raw = round2(Number(x.monto) || 0)
  const pct = parseUnidadPorcentaje(x.unidad)
  const baseExpl =
    x.base != null && Number.isFinite(Number(x.base)) && Number(x.base) !== 0
      ? Number(x.base)
      : null
  if (raw !== 0) {
    return { monto: raw, base: baseExpl, pct }
  }
  if (pct == null) return { monto: 0, base: baseExpl, pct: null }
  const base = baseExpl != null ? baseExpl : baseDefault
  return { monto: round2(base * pct), base, pct }
}

/**
 * Acepta pesos AR (`145.064,45` / `150.000` / `145064,45`) o decimal US (`137622.31`).
 * Un solo `.` con 1–2 decimales = decimal; `.` de miles (`1.500` / `1.500.000`) se quita.
 */
export function parseImporteInput(raw: string): number | null {
  let s = String(raw || '')
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d.,\-]/g, '')
  if (!s || s === '-' || s === ',' || s === '.' || s === '-.' || s === '-,') return null

  const neg = s.startsWith('-')
  if (neg) s = s.slice(1)
  if (!s) return null

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234.567,89
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234,567.89
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`
    } else if (parts.length === 2) {
      // más de 2 decimales raros → igual como decimal
      s = `${parts[0].replace(/\./g, '')}.${parts[1]}`
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasDot) {
    const parts = s.split('.')
    // Un solo punto con 1–2 decimales → decimal (137622.31), no miles.
    if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
      // keep
    } else {
      // 150.000 / 1.500 / 1.500.000
      s = s.replace(/\./g, '')
    }
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

export function importeToEdit(n: number): string {
  if (!n) return ''
  return String(n).replace('.', ',')
}

/** Ej. `2026-11` → `Recibo de sueldo · Noviembre 2026` */
export function tituloReciboPeriodo(periodo: string): string {
  const raw = String(periodo || '').trim()
  const m = raw.match(/^(\d{4})-(\d{2})$/)
  if (!m) return raw ? `Recibo de sueldo · ${raw}` : 'Recibo de sueldo'
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return `Recibo de sueldo · ${raw}`
  const label = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric'
  })
  const pretty = label.charAt(0).toUpperCase() + label.slice(1)
  return `Recibo de sueldo · ${pretty}`
}

/** Ej. `2026-11` → `Noviembre 2026` */
export function labelPeriodoMes(periodo: string): string {
  const t = tituloReciboPeriodo(periodo)
  return t.replace(/^Recibo de sueldo ·\s*/i, '') || periodo
}

/** Códigos internos del empleador para parametrizar en ARCA LSD (módulo Conceptos). */
export const CONCEPTOS_LSD = {
  sueldo: { codigo: 'SUELDO', arca: '110000', tipo: 'REMUNERATIVO' as const, label: 'Sueldo básico' },
  antig: { codigo: 'ANTIG', arca: '110001', tipo: 'REMUNERATIVO' as const, label: 'Adicional por antigüedad' },
  sind: { codigo: 'SIND', arca: '850000', tipo: 'DESCUENTO' as const, label: 'Sindicato' },
  jub: { codigo: 'JUB', arca: '810000', tipo: 'DESCUENTO' as const, label: 'Jubilación - Ley 24.241' },
  inssjp: { codigo: 'INSSJP', arca: '810001', tipo: 'DESCUENTO' as const, label: 'Ley 19.032 - INSSJP' },
  os: { codigo: 'OS', arca: '810002', tipo: 'DESCUENTO' as const, label: 'Obra Social' }
} as const

/** Datos de Simplificación registral ARCA (PLOT CENTER SRL). */
export const EMPRESA_LCT_DEFAULT = {
  nombre: 'PLOT CENTER SRL',
  domicilio: 'Avenida Libertador Este 580, San Juan',
  cuit: '30715518801',
  jurisdiccion: 'SAN JUAN',
  artCodigo: '00000',
  scvoCia: 'S880 EXPERTA SEGUROS'
}

export const CCTS_PLOT = [
  { codigo: '0409/05', label: '0409/05 · Gráficos (FATIGA / FAIGA)' },
  { codigo: '9999/99', label: '9999/99 · Excluido de convenio' }
] as const

export function cctEnConvenio(codigo: string | null | undefined): boolean {
  const c = String(codigo || '').trim()
  return c !== '' && c !== '9999/99'
}

export type RrhhLibroSueldos = {
  id: number
  periodo: string
  estado: 'borrador' | 'cerrado'
  empresa_nombre: string
  empresa_domicilio: string
  empresa_cuit: string
  jurisdiccion: string
  cct_default: string
  art_codigo: string
  scvo_cia: string
  banco: string | null
  fecha_pago: string | null
  scvo_default: number
  os_base_mult: number
  nro_liquidacion: number
  dias_base: number
  tipo_empleador: string
  codigo_actividad: string
  codigo_localidad: string
  codigo_os_default: string | null
  importe_detraer: number
  /** Alícuotas del modelo viejo + `legal`: parámetros y cargas traídos de la liquidación. */
  alicuotas: Partial<AlicuotasLct> & { legal?: LegalLibro }
  notas: string | null
  id_lote_recibos: number | null
  created_by: number | null
  created_at: string
}

export type RrhhLibroSueldosItem = {
  id: number
  id_libro: number
  id_usuario: number
  incluido: boolean
  n_legajo: number
  apellido_nombre: string
  cuil: string
  categoria: string | null
  fecha_ingreso: string | null
  antiguedad_reconocida: number
  anios_antiguedad: number
  dias: number
  etiqueta_basico: string
  sueldo_basico: number
  adicional_antiguedad: number
  scvo: number
  banco: string | null
  cbu: string | null
  forma_pago: string
  conyuge: boolean
  hijos: number
  cct: boolean
  cct_codigo: string | null
  cobertura_scvo: boolean
  situacion_revista: string
  condicion: string
  actividad: string | null
  modalidad: string
  codigo_os: string | null
  horas_trabajadas: number
  extras: ReciboExtra[]
}

export type RrhhSueldoFicha = {
  id_usuario: number
  n_legajo: number | null
  cuil: string | null
  categoria: string | null
  etiqueta_basico: string | null
  sueldo_basico: number | null
  adicional_antiguedad: number | null
  antiguedad_reconocida: number | null
  scvo: number | null
  banco: string | null
  cbu: string | null
  forma_pago: string | null
  conyuge: boolean | null
  hijos: number | null
  cct: boolean | null
  cct_codigo: string | null
  cobertura_scvo: boolean | null
  situacion_revista: string | null
  condicion: string | null
  actividad: string | null
  modalidad: string | null
  codigo_os: string | null
}

export type ReciboEmpresa = {
  nombre: string
  domicilio: string
  cuit: string
  banco: string
  fechaPago: string
  periodo: string
}

export type ReciboLinea = {
  /** Id de la carga social (ap-jub, co-os…) cuando la línea viene del motor de cargas. */
  id?: string
  concepto: string
  unidad: string
  base: number | null
  remunerativo: number | null
  noRemunerativo: number | null
  descuento: number | null
  montoEmpleador?: number | null
  pct?: number | null
}

export type ReciboComposicion = {
  sindicalEmpleador: number
  sindicalTrabajador: number
  ssEmpleador: number
  ssTrabajador: number
  osEmpleador: number
  osTrabajador: number
  inssjpEmpleador: number
  inssjpTrabajador: number
  art: number
  scvo: number
}

export type ReciboLiquidado = {
  item: RrhhLibroSueldosItem
  empresa: ReciboEmpresa
  bruto: number
  baseOs: number
  /** Bases imponibles (LSD registro 04 / SICOSS). */
  bases: { remuneracion: number; aportes: number; aportesOs: number; os: number; contribSs: number }
  /** La remuneración superó la base imponible máxima de aportes. */
  topeAplicado: boolean
  empleado: EmpleadoLegal
  neto: number
  descuentos: number
  contribuciones: number
  costoEmpleador: number
  lineasEmpleador: ReciboLinea[]
  lineasTrabajador: ReciboLinea[]
  composicion: ReciboComposicion
  netoEnLetras: string
}

export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function mergeAlicuotas(partial?: Partial<AlicuotasLct> | null): AlicuotasLct {
  return { ...ALICUOTAS_LCT_DEFAULT, ...(partial || {}) }
}

export function etiquetaPeriodoLibro(periodo: string): string {
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre'
  ]
  const [y, m] = String(periodo || '').split('-')
  const mes = meses[(Number(m) || 1) - 1] || periodo
  return y ? `${y} ${mes}` : String(periodo || '')
}

export function fechaCortaEs(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-')
  if (!d || !m) return iso ? String(iso) : ''
  return y ? `${d}/${m}/${y}` : `${d}/${m}`
}

export function aniosAntiguedadAlPeriodo(ingreso: string | null | undefined, periodo: string): number {
  const fi = String(ingreso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fi) || !/^\d{4}-\d{2}$/.test(periodo)) return 0
  const [y, m] = periodo.split('-').map(Number)
  const fin = new Date(y, m, 0)
  const ini = new Date(Number(fi.slice(0, 4)), Number(fi.slice(5, 7)) - 1, Number(fi.slice(8, 10)))
  let years = fin.getFullYear() - ini.getFullYear()
  const mdFin = (fin.getMonth() + 1) * 100 + fin.getDate()
  const mdIni = (ini.getMonth() + 1) * 100 + ini.getDate()
  if (mdFin < mdIni) years -= 1
  return Math.max(0, years)
}

export function antiguedadMesesAlPeriodo(ingreso: string | null | undefined, periodo: string): number {
  const fi = String(ingreso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fi) || !/^\d{4}-\d{2}$/.test(periodo)) return 0
  const [y, m] = periodo.split('-').map(Number)
  const a = Number(fi.slice(0, 4))
  const b = Number(fi.slice(5, 7))
  return Math.max(0, y * 12 + m - (a * 12 + b))
}

/**
 * Texto para el recibo: solo años (p. ej. "3 años").
 * `antiguedad_reconocida` se guarda en meses.
 */
export function formatAntiguedadReconocida(meses: number | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(meses) || 0))
  const anios = Math.floor(n / 12)
  if (anios <= 0) return ''
  return `${anios} año${anios === 1 ? '' : 's'}`
}

/**
 * Si alguien cargó años en el campo de meses (ej. 3 con 3 años reales ≈ 36–39 meses),
 * preferimos los meses calculados desde el ingreso.
 */
export function mesesReconocidosEfectivos(opts: {
  antiguedad_reconocida: number | null | undefined
  anios_antiguedad?: number | null | undefined
  fecha_ingreso?: string | null
  periodo?: string | null
}): number {
  const raw = Math.max(0, Math.floor(Number(opts.antiguedad_reconocida) || 0))
  const anios = Math.max(0, Math.floor(Number(opts.anios_antiguedad) || 0))
  const calc =
    opts.fecha_ingreso && opts.periodo
      ? antiguedadMesesAlPeriodo(opts.fecha_ingreso, opts.periodo)
      : 0
  if (calc > 0 && raw > 0 && raw === anios && raw <= 40 && calc >= raw * 11) {
    return calc
  }
  if (calc > 0 && raw === 0) return calc
  return raw || calc
}

/** % del básico por año de antigüedad (misma regla que liquidación mensual). */
export const PCT_ANTIGUEDAD_LIBRO_DEFAULT = 1

/** Adicional de antigüedad = básico × años × (% / 100). */
export function adicionalAntiguedadCalculado(
  sueldoBasico: number,
  anios: number,
  pctPorAnio: number = PCT_ANTIGUEDAD_LIBRO_DEFAULT
): number {
  const b = Number(sueldoBasico) || 0
  const a = Math.max(0, Math.floor(Number(anios) || 0))
  const pRaw = Number(pctPorAnio)
  const p = Number.isFinite(pRaw) && pRaw >= 0 ? pRaw : PCT_ANTIGUEDAD_LIBRO_DEFAULT
  if (!(b > 0) || a <= 0 || !(p > 0)) return 0
  return Math.round(b * a * (p / 100) * 100) / 100
}

/**
 * Detecta antigüedad vacía o un valor confundido con el % (ej. 1 en vez del monto).
 * En esos casos conviene recalcular desde el básico.
 */
export function adicionalAntiguedadNecesitaPrecarga(
  adicional: number | null | undefined,
  sueldoBasico: number,
  pctPorAnio: number = PCT_ANTIGUEDAD_LIBRO_DEFAULT
): boolean {
  const b = Number(sueldoBasico) || 0
  if (!(b > 0)) return false
  const a = Number(adicional) || 0
  if (!(a > 0)) return true
  const p = Number.isFinite(Number(pctPorAnio)) ? Number(pctPorAnio) : PCT_ANTIGUEDAD_LIBRO_DEFAULT
  return a <= Math.max(p, 1) + 0.001 && b > 1000
}

/** Lee sueldoBase por usuario desde config_json de rrhh_liquidacion_periodos. */
export function montosSueldoBaseDesdeLiqConfig(
  config: Record<string, unknown> | null | undefined
): { montos: Record<number, number>; pctAntiguedad: number } {
  const rawMontos =
    config && typeof config === 'object' && config.montos && typeof config.montos === 'object'
      ? (config.montos as Record<string, { sueldoBase?: unknown }>)
      : {}
  const montos: Record<number, number> = {}
  for (const [id, row] of Object.entries(rawMontos)) {
    const n = Number(row?.sueldoBase)
    if (Number.isFinite(n) && n > 0) montos[Number(id)] = Math.round(n * 100) / 100
  }
  const pctRaw = config?.pctAntiguedadLegal
  const pctNum = pctRaw == null || pctRaw === '' ? NaN : Number(pctRaw)
  // 0 o inválido → default del libro (1% por año); si en liquidación pusieron un % > 0, se respeta.
  const pctAntiguedad =
    Number.isFinite(pctNum) && pctNum > 0 ? Math.round(pctNum * 100) / 100 : PCT_ANTIGUEDAD_LIBRO_DEFAULT
  return { montos, pctAntiguedad }
}

export function formatArs2(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n))
}

export function formatPct(p: number): string {
  const v = round2(p * 100)
  return `${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
}

export function cuilDigitos(cuil: string | null | undefined): string {
  return String(cuil || '').replace(/\D/g, '').slice(0, 11)
}

export function formatCuil(cuil: string | null | undefined): string {
  const d = cuilDigitos(cuil)
  if (d.length !== 11) return String(cuil || '').trim()
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
}

export function cuitDigitos(cuit: string | null | undefined): string {
  return String(cuit || '').replace(/\D/g, '').slice(0, 11)
}

export function netoEnLetras(neto: number): string {
  const raw = numeroALetras(Math.abs(round2(neto)))
  return raw.replace(/\s*pesos\s*/i, ' ').replace(/\s+/g, ' ').trim()
}

type LibroLiq = Pick<
  RrhhLibroSueldos,
  | 'periodo'
  | 'empresa_nombre'
  | 'empresa_domicilio'
  | 'empresa_cuit'
  | 'banco'
  | 'fecha_pago'
  | 'os_base_mult'
  | 'alicuotas'
  | 'dias_base'
  | 'importe_detraer'
>

/** Alícuotas del modelo viejo del libro → cargas del motor común (ids de la liquidación). */
export function cargasDesdeAlicuotas(a: AlicuotasLct): CargaSocialDef[] {
  const pct = (n: number) => round2(n * 10000) / 100
  return [
    { id: 'ap-jub', nombre: 'Jubilación (SIPA)', lado: 'aporte', porcentaje: pct(a.jubilacion) },
    { id: 'ap-pami', nombre: 'PAMI (INSSJP)', lado: 'aporte', porcentaje: pct(a.inssjpTrabajador) },
    { id: 'ap-os', nombre: 'Obra social', lado: 'aporte', porcentaje: pct(a.osTrabajador) },
    { id: 'ap-sind', nombre: 'Sindicato (convenio)', lado: 'aporte', porcentaje: pct(a.sindicatoTrabajador) },
    { id: 'co-jub', nombre: 'Jubilación (SIPA)', lado: 'contribucion', porcentaje: pct(a.sipaEmpleador) },
    { id: 'co-pami', nombre: 'PAMI (INSSJP)', lado: 'contribucion', porcentaje: pct(a.inssjpEmpleador) },
    { id: 'co-af', nombre: 'Asignaciones familiares', lado: 'contribucion', porcentaje: pct(a.asignaciones) },
    { id: 'co-fne', nombre: 'Fondo Nacional de Empleo', lado: 'contribucion', porcentaje: pct(a.fne) },
    { id: 'co-os', nombre: 'Obra social', lado: 'contribucion', porcentaje: pct(a.osEmpleador) },
    { id: 'co-sind', nombre: 'Sindicato (convenio)', lado: 'contribucion', porcentaje: pct(a.sindicatoEmpleador) },
    { id: 'co-art', nombre: 'ART', lado: 'contribucion', porcentaje: 0 }
  ]
}

/** Lee el bloque legal guardado en el libro (alicuotas.legal). */
export function legalGuardado(libro: Pick<RrhhLibroSueldos, 'alicuotas' | 'periodo'>): LegalLibro | null {
  const raw = (libro.alicuotas as { legal?: unknown } | null | undefined)?.legal
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<LegalLibro>
  if (!Array.isArray(r.cargas) || !r.cargas.length) return null
  const empleados: Record<string, EmpleadoLegal> = {}
  for (const [id, e] of Object.entries(r.empleados || {})) empleados[id] = normalizarEmpleadoLegal(e)
  return {
    version: 1,
    origen: r.origen === 'liquidacion' ? 'liquidacion' : 'libro',
    parametros: normalizarParametrosLegales(r.parametros, libro.periodo),
    cargas: r.cargas.map((c) => ({
      id: String(c.id),
      nombre: String(c.nombre || c.id),
      lado: c.lado === 'aporte' ? 'aporte' : 'contribucion',
      porcentaje: Number(c.porcentaje) || 0
    })),
    empleados
  }
}

/**
 * Contexto legal del libro: el que vino de la liquidación del período, o (libros viejos)
 * el armado desde las alícuotas propias del libro.
 */
export function legalDelLibro(libro: LibroLiq): LegalLibro {
  const g = legalGuardado(libro)
  if (g) return g
  const parametros = parametrosLegalesDefault(libro.periodo)
  return {
    version: 1,
    origen: 'libro',
    parametros: { ...parametros, detraccion: round2(Number(libro.importe_detraer) || 0) },
    cargas: cargasDesdeAlicuotas(mergeAlicuotas(libro.alicuotas)),
    empleados: {}
  }
}

/** Datos legales del empleado: los de la liquidación o, si no hay, los de su ítem del libro. */
export function empleadoLegalDeItem(
  item: Pick<RrhhLibroSueldosItem, 'id_usuario' | 'cct' | 'cct_codigo' | 'modalidad'>,
  legal: LegalLibro,
  brutoParaLegado: number,
  osBaseMult: number
): EmpleadoLegal {
  const guardado = legal.empleados[String(item.id_usuario)]
  if (guardado) return guardado
  const enConvenio = item.cct_codigo ? cctEnConvenio(item.cct_codigo) : item.cct !== false
  const jornadaParcial = String(item.modalidad || '').replace(/\D/g, '').padStart(3, '0') === '008'
  const mult = Number(osBaseMult) > 0 ? Number(osBaseMult) : 2
  return {
    ...EMPLEADO_LEGAL_DEFAULT,
    enConvenio,
    jornadaParcial,
    // Libros viejos: la base OS de jornada completa era bruto × multiplicador.
    sueldoJornadaCompleta: jornadaParcial ? round2(brutoParaLegado * mult) : 0
  }
}

/** Códigos LSD de los aportes del trabajador (por id de carga). */
const LSD_POR_CARGA: Record<string, string> = {
  'ap-jub': CONCEPTOS_LSD.jub.codigo,
  'ap-pami': CONCEPTOS_LSD.inssjp.codigo,
  'ap-os': CONCEPTOS_LSD.os.codigo,
  'ap-sind': CONCEPTOS_LSD.sind.codigo
}

export function codigoLsdDeCarga(id: string): string {
  return LSD_POR_CARGA[id] || id.toUpperCase().slice(0, 10)
}

function cargaSuma(items: ItemCarga[], ...ids: string[]): number {
  return round2(items.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.importe, 0))
}

export function numerosLiquidacion(item: RrhhLibroSueldosItem, libro: LibroLiq) {
  const legal = legalDelLibro(libro)
  const extras = item.extras || []
  const basico = round2(item.sueldo_basico)
  const antig = round2(item.adicional_antiguedad)
  const baseHaberes = round2(basico + antig)
  const extraRem = round2(
    extras
      .filter((x) => x.tipo === 'remunerativo')
      .reduce((s, x) => s + montoExtraEfectivo(x, baseHaberes).monto, 0)
  )
  // Inasistencias / suspensiones entran como remunerativo negativo: el bruto nunca baja de 0.
  const bruto = Math.max(0, round2(basico + antig + extraRem))
  const extraNoRem = round2(
    extras
      .filter((x) => x.tipo === 'no_remunerativo')
      .reduce((s, x) => s + montoExtraEfectivo(x, bruto).monto, 0)
  )
  const extraDesc = round2(
    extras
      .filter((x) => x.tipo === 'descuento')
      .reduce((s, x) => s + montoExtraEfectivo(x, bruto).monto, 0)
  )
  const extraEmp = round2(
    extras
      .filter((x) => x.tipo === 'empleador')
      .reduce((s, x) => s + montoExtraEfectivo(x, bruto).monto, 0)
  )
  const empleado = empleadoLegalDeItem(item, legal, bruto, Number(libro.os_base_mult))
  const calc = calcularCargasLegales({
    periodo: libro.periodo,
    remuneracion: bruto,
    cargas: legal.cargas,
    parametros: legal.parametros,
    empleado
  })
  const scvo = round2(item.scvo)
  const contribuciones = round2(calc.totalContribuciones + scvo + extraEmp)
  const descuentos = round2(calc.totalAportes + extraDesc)
  const neto = round2(bruto + extraNoRem - descuentos)
  const costoEmpleador = round2(bruto + extraNoRem + contribuciones)
  return {
    legal,
    empleado,
    calc,
    extras,
    extraRem,
    extraNoRem,
    extraDesc,
    extraEmp,
    basico,
    antig,
    bruto,
    baseOs: calc.baseOs,
    scvo,
    contribuciones,
    descuentos,
    neto,
    costoEmpleador,
    anios: item.anios_antiguedad || 0
  }
}

export function liquidarRecibo(opts: { item: RrhhLibroSueldosItem; libro: LibroLiq }): ReciboLiquidado {
  const { item, libro } = opts
  const n = numerosLiquidacion(item, libro)
  const { calc, extras, basico, antig, bruto, scvo, contribuciones, descuentos, neto, costoEmpleador, anios } = n

  const lineasEmpleador: ReciboLinea[] = calc.contribuciones.map((c) => ({
    id: c.id,
    concepto: NOMBRE_LEGAL_CARGA[c.id] || c.nombre,
    unidad: c.fijo ? `${formatPct(c.porcentaje / 100)} + fijo` : formatPct(c.porcentaje / 100),
    base: c.base ?? bruto,
    montoEmpleador: c.importe,
    remunerativo: null,
    noRemunerativo: null,
    descuento: null,
    pct: c.porcentaje / 100
  }))
  lineasEmpleador.push({
    id: 'scvo',
    concepto: 'Seguro colectivo de vida obligatorio (Dto. 1567/74)',
    unidad: '',
    base: null,
    montoEmpleador: scvo,
    remunerativo: null,
    noRemunerativo: null,
    descuento: null
  })

  const conceptoExtra = (x: ReciboExtra) => {
    const baseDef = x.tipo === 'remunerativo' ? round2(basico + antig) : bruto
    const ef = montoExtraEfectivo(x, baseDef)
    return { x, ef }
  }

  const haberesExtras: ReciboLinea[] = extras
    .filter((x) => x.tipo === 'remunerativo' || x.tipo === 'no_remunerativo')
    .map(conceptoExtra)
    .filter(({ x, ef }) => x.concepto.trim() || ef.monto)
    .map(({ x, ef }) => ({
      concepto: x.concepto || '(concepto)',
      unidad: x.cantidad != null && x.cantidad !== 0 ? String(x.cantidad) : x.unidad,
      base: ef.base,
      remunerativo: x.tipo === 'remunerativo' ? ef.monto : null,
      noRemunerativo: x.tipo === 'no_remunerativo' ? ef.monto : null,
      descuento: null,
      montoEmpleador: null,
      pct: ef.pct ?? undefined
    }))

  const descuentosExtras: ReciboLinea[] = extras
    .filter((x) => x.tipo === 'descuento')
    .map(conceptoExtra)
    .filter(({ x, ef }) => x.concepto.trim() || ef.monto)
    .map(({ x, ef }) => ({
      concepto: x.concepto || '(concepto)',
      unidad: x.unidad,
      base: ef.base,
      remunerativo: null,
      noRemunerativo: null,
      descuento: ef.monto,
      montoEmpleador: null,
      pct: ef.pct ?? undefined
    }))

  // Días del básico: los pagos + los que se descuentan aparte (inasistencias, suspensión).
  const diasDescontados = extras
    .filter((x) => x.origen === 'liq' && (x.codigo_lsd === 'INASIST' || x.codigo_lsd === 'SUSPSG'))
    .reduce((s, x) => s + (Number(x.cantidad) || 0), 0)
  const lineasTrabajador: ReciboLinea[] = [
    {
      concepto: item.etiqueta_basico || 'Sueldo básico',
      unidad: String((item.dias || libro.dias_base || 30) + diasDescontados),
      base: null,
      remunerativo: basico,
      noRemunerativo: null,
      descuento: null
    },
    {
      concepto: `Adicional por antigüedad ( ${anios} años )`,
      unidad: String(anios || ''),
      base: antig || null,
      remunerativo: antig,
      noRemunerativo: null,
      descuento: null
    },
    ...haberesExtras,
    ...calc.aportes.map((c) => ({
      id: c.id,
      concepto: NOMBRE_LEGAL_CARGA[c.id] || c.nombre,
      unidad: formatPct(c.porcentaje / 100),
      base: c.base ?? bruto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: c.importe,
      pct: c.porcentaje / 100
    })),
    ...descuentosExtras
  ]

  for (const x of extras.filter((e) => e.tipo === 'empleador')) {
    const ef = montoExtraEfectivo(x, bruto)
    if (!x.concepto.trim() && !ef.monto) continue
    lineasEmpleador.push({
      concepto: x.concepto || '(concepto empleador)',
      unidad: x.unidad,
      base: ef.base,
      montoEmpleador: ef.monto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: ef.pct ?? undefined
    })
  }

  const co = calc.contribuciones
  const ap = calc.aportes
  return {
    item,
    empresa: {
      nombre: libro.empresa_nombre,
      domicilio: libro.empresa_domicilio,
      cuit: cuitDigitos(libro.empresa_cuit),
      banco: item.banco || libro.banco || '',
      fechaPago: libro.fecha_pago || '',
      periodo: libro.periodo
    },
    bruto,
    baseOs: calc.baseOs,
    bases: {
      remuneracion: bruto,
      aportes: calc.baseAportes,
      aportesOs: calc.baseAportesOs,
      os: calc.baseOs,
      contribSs: calc.baseContribSs
    },
    topeAplicado: calc.topeAplicado,
    empleado: n.empleado,
    neto,
    descuentos,
    contribuciones,
    costoEmpleador,
    lineasEmpleador,
    lineasTrabajador,
    composicion: {
      sindicalEmpleador: cargaSuma(co, 'co-sind'),
      sindicalTrabajador: cargaSuma(ap, 'ap-sind'),
      ssEmpleador: cargaSuma(co, 'co-jub', 'co-af', 'co-fne', 'co-fal'),
      ssTrabajador: cargaSuma(ap, 'ap-jub'),
      osEmpleador: cargaSuma(co, 'co-os'),
      osTrabajador: cargaSuma(ap, 'ap-os'),
      inssjpEmpleador: cargaSuma(co, 'co-pami'),
      inssjpTrabajador: cargaSuma(ap, 'ap-pami'),
      art: cargaSuma(co, 'co-art'),
      scvo
    },
    netoEnLetras: netoEnLetras(neto)
  }
}

export type ConceptoParaArca = {
  codigo: string
  descripcion: string
  tipo: 'Remunerativo' | 'Remunerativo (resta)' | 'No remunerativo' | 'Descuento'
  unidad: string
  /** Qué concepto de ARCA elegir al asociarlo en el módulo Conceptos del LSD. */
  asociar: string
  /** Lo genera el sistema (true) o lo cargó alguien como concepto extra del libro. */
  delSistema: boolean
}

/** Conceptos que usa el TXT y hay que dar de alta (una sola vez) en ARCA › LSD › Conceptos. */
export const CONCEPTOS_ARCA_SISTEMA: ConceptoParaArca[] = [
  { codigo: 'SUELDO', descripcion: 'Sueldo básico', tipo: 'Remunerativo', unidad: 'Días', asociar: 'Sueldo / salario básico', delSistema: true },
  { codigo: 'ANTIG', descripcion: 'Adicional por antigüedad', tipo: 'Remunerativo', unidad: 'Años', asociar: 'Adicional por antigüedad', delSistema: true },
  { codigo: 'HE50', descripcion: 'Horas extra 50% (art. 201 LCT)', tipo: 'Remunerativo', unidad: 'Horas', asociar: 'Horas extras al 50%', delSistema: true },
  { codigo: 'HE100', descripcion: 'Horas extra 100% (art. 201 LCT)', tipo: 'Remunerativo', unidad: 'Horas', asociar: 'Horas extras al 100%', delSistema: true },
  { codigo: 'INASIST', descripcion: 'Inasistencias injustificadas', tipo: 'Remunerativo (resta)', unidad: 'Días', asociar: 'Inasistencias injustificadas (descuento remunerativo)', delSistema: true },
  { codigo: 'SUSPSG', descripcion: 'Suspensión sin goce (art. 218 LCT)', tipo: 'Remunerativo (resta)', unidad: 'Días', asociar: 'Suspensión sin goce de haberes (descuento remunerativo)', delSistema: true },
  { codigo: 'MEDIAJ', descripcion: 'Media jornada sin goce', tipo: 'Remunerativo (resta)', unidad: 'Días', asociar: 'Inasistencias / horas no trabajadas (descuento remunerativo)', delSistema: true },
  { codigo: 'TARDANZA', descripcion: 'Tardanzas (tiempo no trabajado)', tipo: 'Remunerativo (resta)', unidad: 'Horas', asociar: 'Horas no trabajadas (descuento remunerativo)', delSistema: true },
  { codigo: 'JUB', descripcion: 'Jubilación – Ley 24.241', tipo: 'Descuento', unidad: '%', asociar: 'Aporte SIPA', delSistema: true },
  { codigo: 'INSSJP', descripcion: 'INSSJP – Ley 19.032', tipo: 'Descuento', unidad: '%', asociar: 'Aporte INSSJP (Ley 19.032)', delSistema: true },
  { codigo: 'OS', descripcion: 'Obra Social – Ley 23.660', tipo: 'Descuento', unidad: '%', asociar: 'Aporte obra social', delSistema: true },
  { codigo: 'SIND', descripcion: 'Cuota sindical (CCT)', tipo: 'Descuento', unidad: '%', asociar: 'Cuota sindical', delSistema: true }
]

/** Lista para ARCA: los del sistema + los códigos de conceptos extra usados en el período. */
export function conceptosParaArca(items: Array<Pick<RrhhLibroSueldosItem, 'extras'>>): ConceptoParaArca[] {
  const out = [...CONCEPTOS_ARCA_SISTEMA]
  const vistos = new Set(out.map((c) => c.codigo))
  for (const it of items) {
    for (const x of it.extras || []) {
      if (x.tipo === 'empleador' || x.origen === 'liq') continue
      const cod = (x.codigo_lsd || x.concepto || '').replace(/\s+/g, '').slice(0, 10)
      if (!cod || vistos.has(cod)) continue
      vistos.add(cod)
      out.push({
        codigo: cod,
        descripcion: x.concepto || cod,
        tipo:
          x.tipo === 'descuento' ? 'Descuento' : x.tipo === 'no_remunerativo' ? 'No remunerativo' : 'Remunerativo',
        unidad: x.unidad.includes('%') ? '%' : x.unidad || '—',
        asociar: 'Elegir el concepto ARCA equivalente',
        delSistema: false
      })
    }
  }
  return out
}

export function conceptosParaArcaCsv(lista: ConceptoParaArca[]): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
  const filas = [
    ['Código', 'Descripción', 'Tipo', 'Unidad', 'Asociar en ARCA a', 'Origen'],
    ...lista.map((c) => [c.codigo, c.descripcion, c.tipo, c.unidad, c.asociar, c.delSistema ? 'Sistema' : 'Concepto extra'])
  ]
  return filas.map((f) => f.map(esc).join(';')).join('\r\n')
}

/** Código LSD de los conceptos que arma la liquidación. */
export const LSD_CONCEPTO_DECLARADO: Record<CodigoConceptoDeclarado, string> = {
  SUELDO: CONCEPTOS_LSD.sueldo.codigo,
  ANTIG: CONCEPTOS_LSD.antig.codigo,
  HE50: 'HE50',
  HE100: 'HE100',
  INASIST: 'INASIST',
  SUSP: 'SUSPSG',
  MEDIAJ: 'MEDIAJ',
  TARDANZA: 'TARDANZA'
}

/**
 * Aplica al ítem del libro lo que liquidó la Liquidación mensual: básico y antigüedad
 * proporcionales, días pagos, horas extra, inasistencias, suspensiones, convenio y jornada.
 * Los conceptos extra cargados a mano en el libro se conservan.
 */
export function aplicarLiquidacionAItem<T extends Pick<
  RrhhLibroSueldosItem,
  | 'sueldo_basico'
  | 'adicional_antiguedad'
  | 'anios_antiguedad'
  | 'dias'
  | 'cct'
  | 'cct_codigo'
  | 'modalidad'
  | 'extras'
>>(item: T, snap: SnapshotLibroEmpleado, cctDefault: string): T {
  const decl = remuneracionDeclarada(snap)
  const manuales = (item.extras || []).filter((x) => x.origen !== 'liq')
  const auto: ReciboExtra[] = decl.conceptos
    .filter((c) => c.codigo !== 'SUELDO' && c.codigo !== 'ANTIG')
    .map((c) => ({
      id: `liq-${c.codigo}`,
      concepto: c.concepto,
      tipo: 'remunerativo',
      unidad: c.unidad === 'H' ? 'hs' : 'días',
      cantidad: c.cantidad,
      base: null,
      monto: c.importe,
      codigo_lsd: LSD_CONCEPTO_DECLARADO[c.codigo],
      origen: 'liq'
    }))
  const cct = snap.legal.enConvenio ? (cctEnConvenio(cctDefault) ? cctDefault : '0409/05') : '9999/99'
  const modalidadActual = String(item.modalidad || '001')
  return {
    ...item,
    sueldo_basico: decl.basico,
    adicional_antiguedad: decl.antiguedad,
    anios_antiguedad: Math.max(0, Math.floor(snap.antiguedadAnios)),
    dias: decl.diasPagos || item.dias,
    cct: snap.legal.enConvenio,
    cct_codigo: cct,
    modalidad: snap.legal.jornadaParcial ? '008' : modalidadActual === '008' ? '001' : modalidadActual,
    extras: [...manuales, ...auto]
  }
}

export function fichaDesdeItem(item: RrhhLibroSueldosItem): Omit<RrhhSueldoFicha, 'id_usuario'> & { id_usuario: number } {
  return {
    id_usuario: item.id_usuario,
    n_legajo: item.n_legajo,
    cuil: item.cuil,
    categoria: item.categoria,
    etiqueta_basico: item.etiqueta_basico,
    sueldo_basico: item.sueldo_basico,
    adicional_antiguedad: item.adicional_antiguedad,
    antiguedad_reconocida: item.antiguedad_reconocida,
    scvo: item.scvo,
    banco: item.banco,
    cbu: item.cbu,
    forma_pago: item.forma_pago,
    conyuge: item.conyuge,
    hijos: item.hijos,
    cct: item.cct,
    cct_codigo: item.cct_codigo,
    cobertura_scvo: item.cobertura_scvo,
    situacion_revista: item.situacion_revista,
    condicion: item.condicion,
    actividad: item.actividad,
    modalidad: item.modalidad,
    codigo_os: item.codigo_os
  }
}
