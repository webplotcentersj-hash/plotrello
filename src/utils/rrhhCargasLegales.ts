/**
 * Motor único de remuneración declarada y cargas sociales (aportes / contribuciones).
 * Lo usan la Liquidación mensual y el Libro de sueldos para que ambos den lo mismo.
 *
 * Normativa considerada (vigente a nov-2026):
 * - Aportes: Ley 24.241 (11%), Ley 19.032 INSSJP (3%), Ley 23.660 OS (3%). Topados por la
 *   base imponible máxima (art. 9 Ley 24.241, actualizada por ANSES).
 * - Contribuciones Dto. 814/01 (Ley 27.430): 18% PyME / resto (SIPA 10,77 · INSSJP 1,59 ·
 *   AAFF 4,70 · FNE 0,94) + OS 6%. Sin tope. Detracción Ley 27.541 sobre su base (no OS/ART).
 * - Jornada parcial (art. 92 ter LCT): OS sobre la remuneración de jornada completa.
 * - Cuota sindical / aporte de convenio: solo trabajadores dentro de convenio.
 * - Ley 27.802: RIFL (altas 05/2026–04/2027) contribuciones SIPA+INSSJP+AAFF+FNE = 5% total;
 *   Fondo de Asistencia Laboral (Dto. 408/2026) se detrae de las contribuciones SIPA.
 * - Inasistencias injustificadas / suspensiones sin goce: no son remuneración (no tributan).
 */

export type LadoCarga = 'aporte' | 'contribucion'

export type CargaSocialDef = {
  id: string
  nombre: string
  lado: LadoCarga
  porcentaje: number
}

export type ItemCarga = {
  id: string
  nombre: string
  lado: LadoCarga
  porcentaje: number
  importe: number
  /** Base sobre la que se calculó (tope, base OS jornada completa, detracción…). */
  base?: number
  /** Suma fija (ART por trabajador) incluida en el importe. */
  fijo?: number
}

/** Datos legales por empleado (se cargan en la Liquidación). */
export type EmpleadoLegal = {
  enConvenio: boolean
  /** Contrato a tiempo parcial (art. 92 ter LCT). */
  jornadaParcial: boolean
  /** Remuneración de jornada completa de su categoría (base de obra social si es parcial). */
  sueldoJornadaCompleta: number
  /** Alta bajo el Régimen de Incentivo a la Formalización Laboral (Ley 27.802). */
  rifl: boolean
}

export const EMPLEADO_LEGAL_DEFAULT: EmpleadoLegal = {
  enConvenio: true,
  jornadaParcial: false,
  sueldoJornadaCompleta: 0,
  rifl: false
}

/** Parámetros legales del período (se cargan en la Liquidación). */
export type ParametrosLegales = {
  /** Base imponible máxima de aportes del período. */
  topeAportes: number
  /** Base imponible mínima (solo informativa / aviso). */
  baseMinima: number
  /** % Fondo de Asistencia Laboral (2,5 MiPyME con certificado · 1 resto). */
  falPct: number
  /** Primer período (YYYY-MM) en que se contribuye al FAL. */
  falDesde: string
  /** Suma fija ART por trabajador (la alícuota % va en la carga co-art). */
  artFijo: number
  /** Detracción mensual por trabajador sobre la base de contribuciones (Ley 27.541). */
  detraccion: number
  /** Alícuota total RIFL sobre SIPA+INSSJP+AAFF+FNE. */
  riflPct: number
}

/** Bases imponibles SIPA publicadas por ANSES (devengado). */
export const TOPES_SIPA: Record<string, { maxima: number; minima: number; norma: string }> = {
  '2026-08': { maxima: 4594798.23, minima: 0, norma: 'ANSES' },
  '2026-09': { maxima: 4691748.47, minima: 0, norma: 'Res. ANSES 257/2026' },
  '2026-10': { maxima: 4769631.49, minima: 0, norma: 'ANSES' },
  '2026-11': { maxima: 4861685.38, minima: 149592.45, norma: 'Res. ANSES 304/2026' }
}

/** Tope vigente para el período: el último publicado ≤ período (y si es más nuevo, avisa). */
export function topesSipaPeriodo(periodo: string): {
  maxima: number
  minima: number
  norma: string
  desde: string
  desactualizado: boolean
} {
  const keys = Object.keys(TOPES_SIPA).sort()
  let elegido = keys[0]
  for (const k of keys) if (k <= periodo) elegido = k
  const t = TOPES_SIPA[elegido]
  return { ...t, desde: elegido, desactualizado: periodo > keys[keys.length - 1] }
}

export function parametrosLegalesDefault(periodo: string): ParametrosLegales {
  const t = topesSipaPeriodo(periodo)
  return {
    topeAportes: t.maxima,
    baseMinima: t.minima,
    falPct: 2.5,
    // Dto. 408/2026 lo fijó en nov-2026; el Dto. 1228/2026 lo pasó a dic-2026.
    falDesde: '2026-12',
    artFijo: 0,
    detraccion: 0,
    riflPct: 5
  }
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function nonNeg(raw: unknown, def: number): number {
  const v = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(v) && v >= 0 ? round2(v) : def
}

export function normalizarParametrosLegales(raw: unknown, periodo: string): ParametrosLegales {
  const d = parametrosLegalesDefault(periodo)
  const r = raw && typeof raw === 'object' ? (raw as Partial<ParametrosLegales>) : {}
  const falDesde = typeof r.falDesde === 'string' && /^\d{4}-\d{2}$/.test(r.falDesde) ? r.falDesde : d.falDesde
  return {
    // Tope 0 o vacío → el publicado para el período.
    topeAportes: nonNeg(r.topeAportes, d.topeAportes) || d.topeAportes,
    baseMinima: nonNeg(r.baseMinima, d.baseMinima),
    falPct: nonNeg(r.falPct, d.falPct),
    falDesde,
    artFijo: nonNeg(r.artFijo, d.artFijo),
    detraccion: nonNeg(r.detraccion, d.detraccion),
    riflPct: nonNeg(r.riflPct, d.riflPct)
  }
}

export function falAplica(periodo: string, p: ParametrosLegales): boolean {
  return p.falPct > 0 && periodo >= p.falDesde
}

/** Ids de cargas del sindicato (no aplican a quien está fuera de convenio). */
export const IDS_CARGAS_SINDICATO = new Set(['ap-sind', 'co-sind'])
/** Aportes topados por la base imponible máxima. */
const IDS_APORTES_TOPADOS = new Set(['ap-jub', 'ap-pami', 'ap-os'])
/** Contribuciones de seguridad social (detracción, RIFL). */
const IDS_CONTRIB_SS = ['co-jub', 'co-pami', 'co-af', 'co-fne']

/** Nombre legal de cada carga para el recibo. */
export const NOMBRE_LEGAL_CARGA: Record<string, string> = {
  'ap-jub': 'Jubilación – Ley 24.241',
  'ap-pami': 'INSSJP – Ley 19.032',
  'ap-os': 'Obra Social – Ley 23.660',
  'ap-sind': 'Cuota sindical (CCT)',
  'co-jub': 'SIPA – Ley 24.241',
  'co-pami': 'INSSJP – Ley 19.032',
  'co-af': 'Asignaciones Familiares – Ley 24.714',
  'co-fne': 'Fondo Nacional de Empleo – Ley 24.013',
  'co-os': 'Obra Social – Ley 23.660',
  'co-sind': 'Contribución sindical (CCT)',
  'co-art': 'ART – Ley 24.557',
  'co-fal': 'Fondo de Asistencia Laboral – Ley 27.802'
}

export type CargasCalculadas = {
  aportes: ItemCarga[]
  contribuciones: ItemCarga[]
  totalAportes: number
  totalContribuciones: number
  /** Base de aportes SIPA/INSSJP (con tope). */
  baseAportes: number
  /** Base de obra social (jornada completa si es parcial), sin tope. */
  baseOs: number
  /** Base de aportes de OS (con tope). */
  baseAportesOs: number
  /** Base de contribuciones SS (con detracción). */
  baseContribSs: number
  topeAplicado: boolean
  fal: number
}

/**
 * Calcula aportes y contribuciones sobre la remuneración declarada del mes.
 * `remuneracion` es el total remunerativo (ya sin inasistencias / suspensiones).
 */
export function calcularCargasLegales(params: {
  periodo: string
  remuneracion: number
  cargas: CargaSocialDef[]
  parametros: ParametrosLegales
  empleado: EmpleadoLegal
}): CargasCalculadas {
  const { periodo, cargas, parametros: p, empleado: e } = params
  const rem = Math.max(0, round2(params.remuneracion))
  const tope = p.topeAportes > 0 ? p.topeAportes : Infinity
  const baseAportes = round2(Math.min(rem, tope))
  const baseOs =
    e.jornadaParcial && e.sueldoJornadaCompleta > rem ? round2(e.sueldoJornadaCompleta) : rem
  const baseAportesOs = round2(Math.min(baseOs, tope))
  const baseContribSs = round2(Math.max(0, rem - (rem > 0 ? p.detraccion : 0)))

  // RIFL: las 4 contribuciones de SS suman riflPct, repartido en proporción a sus alícuotas.
  const sumaSs = cargas
    .filter((c) => IDS_CONTRIB_SS.includes(c.id))
    .reduce((s, c) => s + (Number(c.porcentaje) || 0), 0)
  const factorRifl = e.rifl && sumaSs > 0 ? p.riflPct / sumaSs : 1

  const items: ItemCarga[] = []
  for (const c of cargas) {
    if (!e.enConvenio && IDS_CARGAS_SINDICATO.has(c.id)) continue
    let pct = Number(c.porcentaje) || 0
    let base = rem
    if (IDS_APORTES_TOPADOS.has(c.id)) base = c.id === 'ap-os' ? baseAportesOs : baseAportes
    else if (c.id === 'co-os') base = baseOs
    else if (IDS_CONTRIB_SS.includes(c.id)) {
      base = baseContribSs
      pct = round2(pct * factorRifl * 1000) / 1000
    }
    const fijo = c.id === 'co-art' && rem > 0 ? p.artFijo : 0
    const importe = round2(base * (pct / 100) + fijo)
    items.push({
      id: c.id,
      nombre: c.nombre,
      lado: c.lado,
      porcentaje: pct,
      importe,
      base,
      ...(fijo > 0 ? { fijo } : {})
    })
  }

  // FAL: se detrae de las contribuciones SIPA (no cambia el costo total). No aplica con RIFL.
  let fal = 0
  if (falAplica(periodo, p) && !e.rifl && rem > 0) {
    const sipa = items.find((i) => i.id === 'co-jub')
    fal = round2(rem * (p.falPct / 100))
    if (sipa) fal = Math.min(fal, sipa.importe)
    if (fal > 0) {
      if (sipa) sipa.importe = round2(sipa.importe - fal)
      const idxSind = items.findIndex((i) => i.id === 'co-sind' || i.id === 'co-art')
      const falItem: ItemCarga = {
        id: 'co-fal',
        nombre: 'Fondo de Asistencia Laboral',
        lado: 'contribucion',
        porcentaje: p.falPct,
        importe: fal,
        base: rem
      }
      if (idxSind >= 0) items.splice(idxSind, 0, falItem)
      else items.push(falItem)
    }
  }

  const aportes = items.filter((i) => i.lado === 'aporte')
  const contribuciones = items.filter((i) => i.lado === 'contribucion')
  return {
    aportes,
    contribuciones,
    totalAportes: round2(aportes.reduce((s, i) => s + i.importe, 0)),
    totalContribuciones: round2(contribuciones.reduce((s, i) => s + i.importe, 0)),
    baseAportes,
    baseOs,
    baseAportesOs,
    baseContribSs,
    topeAplicado: rem > tope,
    fal
  }
}

// ——— Remuneración declarada (lo que va al recibo / libro) ———

export type RemuneracionDeclaradaInput = {
  /** Sueldo en blanco pactado del mes completo. */
  sueldoMensual: number
  /** Proporción del mes que le corresponde (ingreso a mitad de mes < 1). */
  factorProporcional: number
  antiguedadAnios: number
  /** % del sueldo por año de antigüedad (según CCT). */
  pctAntiguedad: number
  horasHe50: number
  importeHe50: number
  horasHe100: number
  importeHe100: number
  /** Faltas injustificadas del mes. */
  diasInasistencia: number
  /** Días laborables en suspensión sin goce (art. 218 LCT). */
  diasSuspension: number
  /** Días con media jornada (½ día sin goce). */
  diasMediaJornada: number
  /** Minutos no trabajados por llegadas tarde (se descuenta solo el tiempo no trabajado). */
  minutosTardanza?: number
  /** Horas de su jornada diaria (para el valor hora de las tardanzas). */
  horasJornada?: number
}

export type CodigoConceptoDeclarado =
  | 'SUELDO'
  | 'ANTIG'
  | 'HE50'
  | 'HE100'
  | 'INASIST'
  | 'SUSP'
  | 'MEDIAJ'
  | 'TARDANZA'

/** Horas de jornada por defecto si el empleado no tiene horario cargado. */
export const HORAS_JORNADA_DEFAULT = 8

/** Descuento por tardanza: solo los minutos no trabajados, al valor hora de su jornada. */
export function importeMinutosNoTrabajados(minutos: number, valorDia: number, horasJornada: number): number {
  const m = Math.max(0, Number(minutos) || 0)
  const h = Number(horasJornada) > 0 ? Number(horasJornada) : HORAS_JORNADA_DEFAULT
  if (!(m > 0) || !(valorDia > 0)) return 0
  return round2((m / 60) * (valorDia / h))
}

export type ConceptoDeclarado = {
  codigo: CodigoConceptoDeclarado
  concepto: string
  cantidad: number
  /** Unidad LSD: D días · A años · H horas. */
  unidad: 'D' | 'A' | 'H'
  /** Positivo suma a la remuneración; negativo la reduce. */
  importe: number
}

export type RemuneracionDeclarada = {
  conceptos: ConceptoDeclarado[]
  basico: number
  antiguedad: number
  antiguedadCompleta: number
  /** Valor de un día a efectos legales: (sueldo + antigüedad) / 30. */
  valorDia: number
  /** Días a pagar (30 × proporcional − suspensión − inasistencias). */
  diasPagos: number
  remuneracion: number
}

export function remuneracionDeclarada(i: RemuneracionDeclaradaInput): RemuneracionDeclarada {
  const sueldo = Math.max(0, Number(i.sueldoMensual) || 0)
  const factor = Math.min(1, Math.max(0, Number(i.factorProporcional) || 0))
  const anios = Math.max(0, Math.floor(Number(i.antiguedadAnios) || 0))
  const pct = Math.max(0, Number(i.pctAntiguedad) || 0)
  const antiguedadCompleta = round2(sueldo * anios * (pct / 100))
  const basico = round2(sueldo * factor)
  const antiguedad = round2(antiguedadCompleta * factor)
  const valorDia = round2((sueldo + antiguedadCompleta) / 30)
  const diasMes = Math.round(30 * factor)
  // Días enteros o medios (un sábado vale ½ día).
  const medios = (v: unknown) => Math.max(0, Math.floor((Number(v) || 0) * 2) / 2)
  const inas = medios(i.diasInasistencia)
  const susp = medios(i.diasSuspension)
  const media = medios(i.diasMediaJornada)
  const conceptos: ConceptoDeclarado[] = []
  if (basico > 0) {
    conceptos.push({ codigo: 'SUELDO', concepto: 'Sueldo básico', cantidad: diasMes, unidad: 'D', importe: basico })
  }
  if (antiguedad > 0) {
    conceptos.push({
      codigo: 'ANTIG',
      concepto: `Adicional por antigüedad (${anios} año${anios === 1 ? '' : 's'})`,
      cantidad: anios,
      unidad: 'A',
      importe: antiguedad
    })
  }
  const he50 = round2(Number(i.importeHe50) || 0)
  if (he50 > 0) {
    conceptos.push({
      codigo: 'HE50',
      concepto: 'Horas extra 50% (art. 201 LCT)',
      cantidad: round2(Number(i.horasHe50) || 0),
      unidad: 'H',
      importe: he50
    })
  }
  const he100 = round2(Number(i.importeHe100) || 0)
  if (he100 > 0) {
    conceptos.push({
      codigo: 'HE100',
      concepto: 'Horas extra 100% (art. 201 LCT)',
      cantidad: round2(Number(i.horasHe100) || 0),
      unidad: 'H',
      importe: he100
    })
  }
  if (inas > 0 && valorDia > 0) {
    conceptos.push({
      codigo: 'INASIST',
      concepto: 'Inasistencias injustificadas',
      cantidad: inas,
      unidad: 'D',
      importe: -round2(inas * valorDia)
    })
  }
  if (susp > 0 && valorDia > 0) {
    conceptos.push({
      codigo: 'SUSP',
      concepto: 'Suspensión sin goce (art. 218 LCT)',
      cantidad: susp,
      unidad: 'D',
      importe: -round2(susp * valorDia)
    })
  }
  if (media > 0 && valorDia > 0) {
    conceptos.push({
      codigo: 'MEDIAJ',
      concepto: 'Media jornada sin goce',
      cantidad: media,
      unidad: 'D',
      importe: -round2(media * valorDia * 0.5)
    })
  }
  const minutosTarde = Math.max(0, Math.round(Number(i.minutosTardanza) || 0))
  const importeTarde = importeMinutosNoTrabajados(minutosTarde, valorDia, Number(i.horasJornada) || 0)
  if (importeTarde > 0) {
    conceptos.push({
      codigo: 'TARDANZA',
      concepto: 'Tardanzas (tiempo no trabajado)',
      cantidad: round2(minutosTarde / 60),
      unidad: 'H',
      importe: -importeTarde
    })
  }
  const remuneracion = Math.max(0, round2(conceptos.reduce((s, c) => s + c.importe, 0)))
  return {
    conceptos,
    basico,
    antiguedad,
    antiguedadCompleta,
    valorDia,
    diasPagos: Math.max(0, diasMes - susp - inas),
    remuneracion
  }
}

/**
 * Lo que la Liquidación deja guardado por empleado (config_json.libro) para que el
 * Libro de sueldos arme el recibo con exactamente los mismos datos.
 */
export type SnapshotLibroEmpleado = RemuneracionDeclaradaInput & {
  legal: EmpleadoLegal
  /** ISO de cuándo se generó. */
  generado: string
}

/** Lo que el Libro guarda del período: parámetros, cargas y datos legales por empleado. */
export type LegalLibro = {
  version: 1
  /** De dónde salió: la liquidación del período o la conversión del modelo viejo. */
  origen: 'liquidacion' | 'libro'
  parametros: ParametrosLegales
  cargas: CargaSocialDef[]
  empleados: Record<string, EmpleadoLegal>
}

export function normalizarEmpleadoLegal(raw: unknown): EmpleadoLegal {
  const r = raw && typeof raw === 'object' ? (raw as Partial<EmpleadoLegal>) : {}
  return {
    enConvenio: r.enConvenio !== false,
    jornadaParcial: r.jornadaParcial === true,
    sueldoJornadaCompleta: nonNeg(r.sueldoJornadaCompleta, 0),
    rifl: r.rifl === true
  }
}

export function normalizarSnapshotLibro(raw: unknown): SnapshotLibroEmpleado | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<SnapshotLibroEmpleado>
  const n = (v: unknown) => {
    const x = Number(v)
    return Number.isFinite(x) ? x : 0
  }
  return {
    sueldoMensual: n(r.sueldoMensual),
    factorProporcional: r.factorProporcional == null ? 1 : n(r.factorProporcional),
    antiguedadAnios: n(r.antiguedadAnios),
    pctAntiguedad: n(r.pctAntiguedad),
    horasHe50: n(r.horasHe50),
    importeHe50: n(r.importeHe50),
    horasHe100: n(r.horasHe100),
    importeHe100: n(r.importeHe100),
    diasInasistencia: n(r.diasInasistencia),
    diasSuspension: n(r.diasSuspension),
    diasMediaJornada: n(r.diasMediaJornada),
    minutosTardanza: n(r.minutosTardanza),
    horasJornada: n(r.horasJornada),
    legal: normalizarEmpleadoLegal(r.legal),
    generado: typeof r.generado === 'string' ? r.generado : ''
  }
}
