import type { Asistencia, MenuDescuentoBeneficioComida, RrhhLiquidacionLinea, RrhhNovedad } from '../types/api'
import {
  calcularStatsAsistencia,
  diasEntre,
  ultimoDiaMes,
  type HorarioFijoAsistencia,
  type StatsEmpleadoAsistencia
} from './asistenciaStats'
import { novedadEnDia } from './rrhhNovedadDates'
import { etiquetaCodigoRrhhNovedad, etiquetaGrupoRrhhNovedad } from './rrhhNovedadCatalog'
import { novedadEmpleadoIncorrecto } from './rrhhNovedadEmpleadoObs'
import { HE_DECLARADA_MARKER } from '../types/api'

export function periodoRango(periodo: string): { desde: string; hasta: string } {
  return { desde: `${periodo}-01`, hasta: ultimoDiaMes(periodo) }
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
]

/** Etiqueta del período YYYY-MM → «agosto 2026». */
export function etiquetaPeriodoEs(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const mes = MESES_ES[(m || 1) - 1] || periodo
  return `${mes} ${y || ''}`.trim()
}

export function fechaCortaEs(iso: string): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-')
  if (!d || !m) return iso
  return y ? `${d}/${m}/${y}` : `${d}/${m}`
}

export function rangoNovedadCorto(n: Pick<RrhhNovedad, 'fecha_desde' | 'fecha_hasta'>): string {
  const a = String(n.fecha_desde || '').slice(0, 10)
  const b = String(n.fecha_hasta || '').slice(0, 10)
  if (!a) return '—'
  if (!b || a === b) return fechaCortaEs(a)
  return `${fechaCortaEs(a)} → ${fechaCortaEs(b)}`
}

/** Observación que habla de vacaciones aunque el código sea otra cosa (p. ej. FI). */
const RE_OBS_VACACIONES =
  /vacacion(?:es)?|goce\s+de\s+vacaciones|descuento(?:\s+correspondiente)?\s+por\s+vacaciones/i

/**
 * Código a usar en el cierre. Si una falta está cargada mal pero el texto
 * deja claro que son vacaciones aprobadas, se toma como vacaciones.
 */
export function codigoEfectivoCierre(
  n: Pick<RrhhNovedad, 'codigo' | 'grupo' | 'observaciones'>
): string {
  const obs = n.observaciones || ''
  if (!RE_OBS_VACACIONES.test(obs)) return n.codigo
  if (n.codigo === 'licencia_vacaciones') return n.codigo
  if (
    n.codigo === 'falta_injustificada' ||
    n.codigo === 'falta_justificada_tramites' ||
    n.codigo === 'falta_justificada_enfermedad' ||
    n.grupo === 'falta' ||
    n.codigo === 'licencia_otro'
  ) {
    return 'licencia_vacaciones'
  }
  return n.codigo
}

export function novedadRecategorizadaCierre(
  n: Pick<RrhhNovedad, 'codigo' | 'grupo' | 'observaciones'>
): boolean {
  return codigoEfectivoCierre(n) !== n.codigo
}

export function diasNovedadEnPeriodo(n: RrhhNovedad, diasMes: string[]): number {
  let c = 0
  for (const f of diasMes) {
    if (novedadEnDia(n, f)) c += 1
  }
  return c
}

export type ConteosNovedadCierre = {
  vacaciones: number
  licencias: number
  faltas_justificadas: number
  faltas_injustificadas: number
  avisos: string[]
}

export function conteosNovedadCierre(
  novedades: RrhhNovedad[],
  diasMes: string[],
  nombre?: string,
  nombresPorId?: Map<number, string>
): ConteosNovedadCierre {
  const out: ConteosNovedadCierre = {
    vacaciones: 0,
    licencias: 0,
    faltas_justificadas: 0,
    faltas_injustificadas: 0,
    avisos: []
  }
  const quien = nombre ? `${nombre}: ` : ''
  for (const n of novedades) {
    const dias = diasNovedadEnPeriodo(n, diasMes)
    if (dias <= 0) continue
    if (nombresPorId && nombresPorId.size > 0) {
      const cruzados = novedadEmpleadoIncorrecto(n, nombresPorId)
      if (cruzados.length > 0) {
        const sugerido = cruzados[0]!
        out.avisos.push(
          `${quien}${rangoNovedadCorto(n)} no corresponde a este trabajador: el texto habla de ${sugerido.nombre}. Corregí el empleado en Novedades (no se cuenta en este cierre).`
        )
        continue
      }
    }
    const codigo = codigoEfectivoCierre(n)
    if (novedadRecategorizadaCierre(n)) {
      out.avisos.push(
        `${quien}${rangoNovedadCorto(n)} está cargada como ${etiquetaCodigoRrhhNovedad(n.codigo)} pero el texto indica vacaciones (en el cierre se toma como vacaciones). Corregí la novedad en RRHH.`
      )
    }
    if (codigo === 'licencia_vacaciones') {
      out.vacaciones += dias
      continue
    }
    if (n.grupo === 'licencia' || codigo.startsWith('licencia_')) {
      out.licencias += dias
      continue
    }
    if (codigo === 'falta_injustificada') {
      out.faltas_injustificadas += dias
      continue
    }
    if (codigo === 'falta_justificada_enfermedad' || codigo === 'falta_justificada_tramites') {
      out.faltas_justificadas += dias
    }
  }
  return out
}

export function numDetalleLinea(l: RrhhLiquidacionLinea, key: string): number {
  const v = l.detalle_json?.[key]
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
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

    const conteosNov = conteosNovedadCierre(novsEmp, dias, nombres.get(id) || st?.nombre, nombres)
    let anticipacion = 0
    for (const n of novsEmp) {
      if (n.codigo === 'anticipacion_sueldo' || n.grupo === 'anticipacion_sueldo') {
        anticipacion += parseMontoObservacion(n.observaciones)
      }
    }

    let descuentoComida = 0
    for (const d of descuentosComida) {
      if (d.id_usuario !== id) continue
      descuentoComida += Number(d.monto) || 0
    }

    // Solape HE: día con marca + novedad horas_extra (no avisar HE declaradas: van a sumar aparte)
    for (const f of dias) {
      const a = asistencia.find((x) => x.id_usuario === id && x.fecha.slice(0, 10) === f)
      const heNov = novsEmp.some(
        (n) =>
          n.grupo === 'horas_extra' &&
          novedadEnDia(n, f) &&
          !(n.observaciones || '').includes(HE_DECLARADA_MARKER)
      )
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
      faltas_injustificadas: conteosNov.faltas_injustificadas,
      anticipacion_sueldo: anticipacion,
      descuento_comida: descuentoComida,
      detalle_json: {
        justificados: st?.justificados ?? 0,
        sin_marca: st?.sinMarca ?? 0,
        total_horas: st?.totalHoras ?? 0,
        puntualidad_pct: st?.puntualidadPct ?? 0,
        dias_vacaciones: conteosNov.vacaciones,
        dias_licencia: conteosNov.licencias,
        faltas_justificadas: conteosNov.faltas_justificadas,
        avisos_categoria: conteosNov.avisos
      }
    })
  }

  lineas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { lineas, stats, avisosSolapeHe }
}

/** Concepto al estilo Libro de Sueldos Digital / Mi liquidación digital (reg. 04). */
export type ConceptoLiquidacionDigital = {
  codigo: string
  concepto: string
  cantidad: string
  unidad: string
  importe: number | null
  debCred: 'C' | 'D' | '—'
}

export function conceptosMiLiquidacionDigital(
  l: RrhhLiquidacionLinea,
  valorHora: number,
  novedadesEmp?: RrhhNovedad[],
  periodo?: string,
  nombresPorId?: Map<number, string>
): ConceptoLiquidacionDigital[] {
  const diasMes = periodo ? diasEntre(periodoRango(periodo).desde, periodoRango(periodo).hasta) : []
  const fromNov =
    novedadesEmp && novedadesEmp.length > 0 && diasMes.length > 0
      ? conteosNovedadCierre(novedadesEmp, diasMes, l.nombre, nombresPorId)
      : null
  const vac = fromNov?.vacaciones ?? numDetalleLinea(l, 'dias_vacaciones')
  const lic = fromNov?.licencias ?? numDetalleLinea(l, 'dias_licencia')
  const fj = fromNov?.faltas_justificadas ?? numDetalleLinea(l, 'faltas_justificadas')
  const fi = fromNov?.faltas_injustificadas ?? l.faltas_injustificadas

  const rows: ConceptoLiquidacionDigital[] = [
    {
      codigo: 'DIAS',
      concepto: 'Días trabajados',
      cantidad: String(l.dias_trabajados),
      unidad: 'días',
      importe: null,
      debCred: '—'
    }
  ]
  if (l.he50 > 0) {
    rows.push({
      codigo: 'HE50',
      concepto: 'Horas extra 50%',
      cantidad: l.he50.toFixed(2),
      unidad: 'hs',
      importe: valorHora > 0 ? Math.round(l.he50 * valorHora * 1.5 * 100) / 100 : null,
      debCred: 'C'
    })
  }
  if (l.he100 > 0) {
    rows.push({
      codigo: 'HE100',
      concepto: 'Horas extra 100%',
      cantidad: l.he100.toFixed(2),
      unidad: 'hs',
      importe: valorHora > 0 ? Math.round(l.he100 * valorHora * 2 * 100) / 100 : null,
      debCred: 'C'
    })
  }
  if (l.tardanzas > 0) {
    rows.push({
      codigo: 'TARD',
      concepto: 'Tardanzas',
      cantidad: String(l.tardanzas),
      unidad: 'un',
      importe: null,
      debCred: '—'
    })
  }
  if (vac > 0) {
    rows.push({
      codigo: 'VAC',
      concepto: 'Vacaciones',
      cantidad: String(vac),
      unidad: 'días',
      importe: null,
      debCred: '—'
    })
  }
  if (lic > 0) {
    rows.push({
      codigo: 'LIC',
      concepto: 'Licencias',
      cantidad: String(lic),
      unidad: 'días',
      importe: null,
      debCred: '—'
    })
  }
  if (fj > 0) {
    rows.push({
      codigo: 'FJ',
      concepto: 'Falta justificada',
      cantidad: String(fj),
      unidad: 'días',
      importe: null,
      debCred: '—'
    })
  }
  if (fi > 0) {
    rows.push({
      codigo: 'FI',
      concepto: 'Falta injustificada',
      cantidad: String(fi),
      unidad: 'días',
      importe: null,
      debCred: '—'
    })
  }
  if (l.anticipacion_sueldo > 0) {
    rows.push({
      codigo: 'ANT',
      concepto: 'Anticipación de sueldo',
      cantidad: '1',
      unidad: 'un',
      importe: l.anticipacion_sueldo,
      debCred: 'D'
    })
  }
  if (l.descuento_comida > 0) {
    rows.push({
      codigo: 'COM',
      concepto: 'Descuento beneficio comida',
      cantidad: '1',
      unidad: 'un',
      importe: l.descuento_comida,
      debCred: 'D'
    })
  }
  return rows
}

export function totalesConceptosDigital(conceptos: ConceptoLiquidacionDigital[]) {
  return conceptos.reduce(
    (acc, c) => {
      if (c.importe == null) return acc
      if (c.debCred === 'C') acc.credito += c.importe
      if (c.debCred === 'D') acc.debito += c.importe
      return acc
    },
    { credito: 0, debito: 0 }
  )
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
      acc.vacaciones += numDetalleLinea(l, 'dias_vacaciones')
      acc.licencias += numDetalleLinea(l, 'dias_licencia')
      acc.faltas_justificadas += numDetalleLinea(l, 'faltas_justificadas')
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
      descuento_comida: 0,
      vacaciones: 0,
      licencias: 0,
      faltas_justificadas: 0
    }
  )
}

export function avisosCategoriaCierre(
  novedades: RrhhNovedad[],
  nombres: Map<number, string>,
  periodo: string
): string[] {
  const { desde, hasta } = periodoRango(periodo)
  const dias = diasEntre(desde, hasta)
  const avisos: string[] = []
  const ids = [...new Set(novedades.map((n) => n.id_usuario))]
  for (const id of ids) {
    const nombre = nombres.get(id) || `Usuario ${id}`
    const c = conteosNovedadCierre(
      novedades.filter((n) => n.id_usuario === id),
      dias,
      nombre,
      nombres
    )
    avisos.push(...c.avisos)
  }
  return avisos
}

export function etiquetaNovedadCierre(n: RrhhNovedad): {
  grupo: string
  etiqueta: string
  recategorizada: boolean
  codigoOriginal: string
} {
  const recategorizada = novedadRecategorizadaCierre(n)
  const codigo = codigoEfectivoCierre(n)
  const declarada = (n.observaciones || '').includes(HE_DECLARADA_MARKER)
  const grupo = declarada
    ? 'HE declarada'
    : recategorizada || codigo.startsWith('licencia_')
      ? etiquetaGrupoRrhhNovedad('licencia')
      : etiquetaGrupoRrhhNovedad(n.grupo)
  return {
    grupo,
    etiqueta: etiquetaCodigoRrhhNovedad(codigo),
    recategorizada,
    codigoOriginal: etiquetaCodigoRrhhNovedad(n.codigo)
  }
}
