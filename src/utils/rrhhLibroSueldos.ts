import { numeroALetras } from './crmExportUtils'

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

/** Acepta 145064.45, 145064,45 o 145.064,45 sin pisar mientras se escribe. */
export function parseImporteInput(raw: string): number | null {
  const t = String(raw || '').trim().replace(/\s/g, '')
  if (!t || t === '-' || t === ',' || t === '.') return null
  let n: number
  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    n = lastComma > lastDot
      ? Number(t.replace(/\./g, '').replace(',', '.'))
      : Number(t.replace(/,/g, ''))
  } else if (t.includes(',')) {
    n = Number(t.replace(',', '.'))
  } else {
    n = Number(t)
  }
  return Number.isFinite(n) ? n : null
}

export function importeToEdit(n: number): string {
  if (!n) return ''
  return String(n).replace('.', ',')
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
  alicuotas: Partial<AlicuotasLct>
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
>

export function numerosLiquidacion(item: RrhhLibroSueldosItem, libro: LibroLiq) {
  const a = mergeAlicuotas(libro.alicuotas)
  const osMult = Number(libro.os_base_mult) > 0 ? Number(libro.os_base_mult) : 2
  const extras = item.extras || []
  const extraRem = round2(extras.filter((x) => x.tipo === 'remunerativo').reduce((s, x) => s + (Number(x.monto) || 0), 0))
  const extraNoRem = round2(
    extras.filter((x) => x.tipo === 'no_remunerativo').reduce((s, x) => s + (Number(x.monto) || 0), 0)
  )
  const extraDesc = round2(extras.filter((x) => x.tipo === 'descuento').reduce((s, x) => s + (Number(x.monto) || 0), 0))
  const extraEmp = round2(extras.filter((x) => x.tipo === 'empleador').reduce((s, x) => s + (Number(x.monto) || 0), 0))
  const basico = round2(item.sueldo_basico)
  const antig = round2(item.adicional_antiguedad)
  const bruto = round2(basico + antig + extraRem)
  const baseOs = round2(bruto * osMult)
  const scvo = round2(item.scvo)
  const sipa = round2(bruto * a.sipaEmpleador)
  const inssjpE = round2(bruto * a.inssjpEmpleador)
  const osE = round2(baseOs * a.osEmpleador)
  const af = round2(bruto * a.asignaciones)
  const fne = round2(bruto * a.fne)
  const sindE = round2(bruto * a.sindicatoEmpleador)
  const contribuciones = round2(sipa + inssjpE + osE + af + fne + sindE + scvo + extraEmp)
  const sindT = round2(bruto * a.sindicatoTrabajador)
  const jub = round2(bruto * a.jubilacion)
  const inssjpT = round2(bruto * a.inssjpTrabajador)
  const osT = round2(baseOs * a.osTrabajador)
  const descuentos = round2(sindT + jub + inssjpT + osT + extraDesc)
  const neto = round2(bruto + extraNoRem - descuentos)
  const costoEmpleador = round2(bruto + extraNoRem + contribuciones)
  return {
    a,
    extras,
    extraRem,
    extraNoRem,
    extraDesc,
    extraEmp,
    basico,
    antig,
    bruto,
    baseOs,
    scvo,
    sipa,
    inssjpE,
    osE,
    af,
    fne,
    sindE,
    contribuciones,
    sindT,
    jub,
    inssjpT,
    osT,
    descuentos,
    neto,
    costoEmpleador,
    anios: item.anios_antiguedad || 0
  }
}

export function liquidarRecibo(opts: { item: RrhhLibroSueldosItem; libro: LibroLiq }): ReciboLiquidado {
  const { item, libro } = opts
  const n = numerosLiquidacion(item, libro)
  const {
    a,
    extras,
    basico,
    antig,
    bruto,
    baseOs,
    scvo,
    sipa,
    inssjpE,
    osE,
    af,
    fne,
    sindE,
    contribuciones,
    sindT,
    jub,
    inssjpT,
    osT,
    descuentos,
    neto,
    costoEmpleador,
    anios
  } = n

  const lineasEmpleador: ReciboLinea[] = [
    {
      concepto: 'SIPA – Ley 24.241',
      unidad: formatPct(a.sipaEmpleador),
      base: bruto,
      montoEmpleador: sipa,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.sipaEmpleador
    },
    {
      concepto: 'Ley 19.032 – INSSJP',
      unidad: formatPct(a.inssjpEmpleador),
      base: bruto,
      montoEmpleador: inssjpE,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.inssjpEmpleador
    },
    {
      concepto: 'Obra Social',
      unidad: formatPct(a.osEmpleador),
      base: baseOs,
      montoEmpleador: osE,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.osEmpleador
    },
    {
      concepto: 'Asignaciones Familiares',
      unidad: formatPct(a.asignaciones),
      base: bruto,
      montoEmpleador: af,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.asignaciones
    },
    {
      concepto: 'Fondo Nacional de Empleo',
      unidad: formatPct(a.fne),
      base: bruto,
      montoEmpleador: fne,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.fne
    },
    {
      concepto: 'Sindicato',
      unidad: formatPct(a.sindicatoEmpleador),
      base: bruto,
      montoEmpleador: sindE,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null,
      pct: a.sindicatoEmpleador
    },
    {
      concepto: 'scvo',
      unidad: '',
      base: null,
      montoEmpleador: scvo,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null
    }
  ]

  const lineasTrabajador: ReciboLinea[] = [
    {
      concepto: item.etiqueta_basico || 'Sueldo básico',
      unidad: String(item.dias || libro.dias_base || 30),
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
    {
      concepto: 'Sindicato',
      unidad: formatPct(a.sindicatoTrabajador),
      base: bruto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: sindT,
      pct: a.sindicatoTrabajador
    },
    {
      concepto: 'Jubilación - Ley 24.241',
      unidad: formatPct(a.jubilacion),
      base: bruto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: jub,
      pct: a.jubilacion
    },
    {
      concepto: 'Ley 19.032 - INSSJP',
      unidad: formatPct(a.inssjpTrabajador),
      base: bruto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: inssjpT,
      pct: a.inssjpTrabajador
    },
    {
      concepto: 'Obra Social',
      unidad: formatPct(a.osTrabajador),
      base: baseOs,
      remunerativo: null,
      noRemunerativo: null,
      descuento: osT,
      pct: a.osTrabajador
    },
    ...extras
      .filter((x) => x.tipo !== 'empleador' && (x.concepto.trim() || x.monto))
      .map((x) => ({
        concepto: x.concepto || '(concepto)',
        unidad: x.unidad,
        base: x.base,
        remunerativo: x.tipo === 'remunerativo' ? x.monto : null,
        noRemunerativo: x.tipo === 'no_remunerativo' ? x.monto : null,
        descuento: x.tipo === 'descuento' ? x.monto : null,
        montoEmpleador: x.tipo === 'empleador' ? x.monto : null
      }))
  ]

  for (const x of extras.filter((e) => e.tipo === 'empleador' && (e.concepto.trim() || e.monto))) {
    lineasEmpleador.push({
      concepto: x.concepto || '(concepto empleador)',
      unidad: x.unidad,
      base: x.base,
      montoEmpleador: x.monto,
      remunerativo: null,
      noRemunerativo: null,
      descuento: null
    })
  }

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
    baseOs,
    neto,
    descuentos,
    contribuciones,
    costoEmpleador,
    lineasEmpleador,
    lineasTrabajador,
    composicion: {
      sindicalEmpleador: sindE,
      sindicalTrabajador: sindT,
      ssEmpleador: round2(sipa + af + fne),
      ssTrabajador: jub,
      osEmpleador: osE,
      osTrabajador: osT,
      inssjpEmpleador: inssjpE,
      inssjpTrabajador: inssjpT,
      art: 0,
      scvo
    },
    netoEnLetras: netoEnLetras(neto)
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
